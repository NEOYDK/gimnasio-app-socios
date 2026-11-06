// App del socio de PULSO: rango (Hierro → Retador), cuota, plan de hoy según su objetivo, metas de la semana, progreso,
// profe personal, chats (general, clan y privados), ranking y clanes, y su perfil (foto, nombre, rango visible).
// Entra con DNI y PIN (los mismos de la tablet de la entrada). Demo: el gimnasio de prueba de esta visita.
// Avisos: la campanita (recordatorios del gimnasio), el mensaje del día y, si el socio acepta, notificaciones en el celular.
// Se instala como app (botón "Instalar"; en iPhone, Compartir → Agregar a inicio).
(function () {
  "use strict";
  const P = window.Pulso;
  const { $, $$, esc, plata, leer, guardar, fecha, cuando, toast, avatar, emblema, nombreCon } = P;
  const GYM = P.gym();

  let ses = leer("pulso-sesion", null);
  if (!ses || ses.gym !== GYM) ses = null;
  let c = null;                  // la cuenta (lo que manda el servidor)
  let diaVer = null;             // el día del plan que se está mirando
  let tab = "inicio";

  const api = (ruta, op = {}) => P.api(ruta, { ...op, cabeceras: ses ? { "X-Sesion": ses.token } : {} });
  async function accion(cuerpo, okTxt, deFila) {
    const r = await api("/api/socio", { metodo: "POST", cuerpo });
    if (r.status === 401) { salir(true); return null; }
    if (!r.ok) { toast(r.datos.error || "No se pudo. Probá de nuevo."); return null; }
    // Si hay más cambios en la fila, la pantalla ya los muestra marcados: se repinta con la respuesta del último
    if (r.datos.cuenta) { c = r.datos.cuenta; if (!deFila || enCola <= 1) pintar(); }
    if (okTxt) toast(okTxt);
    return r.datos;
  }
  // Los cambios del entrenamiento van de a uno, en fila: si se tocan varios ejercicios rápido, ninguno pisa al otro
  let cola = Promise.resolve(), enCola = 0;
  function enFila(cuerpo) {
    enCola++;
    const p = cola.then(() => accion(cuerpo, null, true)).finally(() => { enCola--; });
    cola = p.catch(() => {});
    return p;
  }

  // ---------- Entrar / salir ----------
  function mostrarEntrar() {
    $("[data-cargando]").hidden = true; $("[data-app]").hidden = true; $("[data-entrar]").hidden = false;
  }
  async function entrar(e) {
    e.preventDefault();
    const f = e.target, err = $("[data-error-entrar]");
    const dni = f.dni.value.replace(/\D/g, ""), pin = f.pin.value.trim();
    if (dni.length < 7 || !/^\d{4,6}$/.test(pin)) { err.innerHTML = "<li>Escribí tu DNI y tu PIN (4 a 6 números).</li>"; err.hidden = false; return; }
    const b = $("button[type=submit]", f); b.disabled = true;
    const r = await P.api("/api/socio", { metodo: "POST", cuerpo: { accion: "entrar", gym: GYM, dni, pin } });
    b.disabled = false;
    if (!r.ok) { err.innerHTML = `<li>${esc(r.datos.error || "No pudimos entrar.")}</li>`; err.hidden = false; return; }
    err.hidden = true; f.reset();
    ses = { gym: GYM, token: r.datos.token }; guardar("pulso-sesion", ses);
    c = r.datos.cuenta; trabajo = null; tab = "inicio"; arrancar();
  }
  async function salir(vencida) {
    if (!vencida && ses) await api("/api/socio", { metodo: "POST", cuerpo: { accion: "salir" } });
    ses = null; guardar("pulso-sesion", null); c = null;
    cerrarChat(); cerrarHoja();
    mostrarEntrar();
    if (vencida) toast("Tu sesión terminó: entrá de nuevo.");
  }

  function arrancar() {
    $("[data-cargando]").hidden = true; $("[data-entrar]").hidden = true; $("[data-app]").hidden = false;
    pintar();
    const t = P.params.get("tab");
    irA(["inicio", "entrenar", "progreso", "comunidad", "perfil"].includes(t) ? t : tab);
    revisarChats();
    revisarPush();
    if (P.params.get("avisos")) hojaAvisos();
  }

  // ---------- Pestañas ----------
  function irA(t) {
    tab = t;
    $$("[data-pant]").forEach(s => { s.hidden = s.dataset.pant !== t; });
    $$("[data-tab]").forEach(b => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    scrollTo({ top: 0 });
    if (t === "comunidad") pintarComunidad();
  }

  function pintar() {
    if (!c) return;
    $("[data-yo-av]").innerHTML = avatar(c.socio, 38);
    const n = $("[data-avisos-n]"); n.textContent = c.avisos.sinLeer; n.hidden = !c.avisos.sinLeer;
    $("[data-avisos]").setAttribute("aria-label", c.avisos.sinLeer ? `Avisos: ${c.avisos.sinLeer} sin leer` : "Avisos");
    pintarInicio(); pintarEntrenar(); pintarProgreso(); pintarPerfil();
  }

  // ---------- Inicio ----------
  function cuotaHtml() {
    const s = c.socio, cu = s.cuota;
    if (cu.estado === "pausada") return `<div class="tarjeta cuota cuota-pausa"><p class="t-tit">Cuota pausada</p><p>${esc(cu.motivo || "Pausa")} hasta el ${fecha(cu.hasta)}. Tu cuota vence el <b>${fecha(s.vence)}</b>: los días de la pausa no se cuentan.</p><p class="ayuda">Si volvés antes, entrá por la tablet y la pausa termina sola (te devolvemos los días que no usaste).</p></div>`;
    if (c.pendiente) return `<div class="tarjeta cuota cuota-aviso"><p class="t-tit">Pago pendiente</p><p>${esc(c.pendiente.detalle)} · <b>${plata(c.pendiente.monto)}</b></p><a class="btn btn-lima btn-chico" href="${esc(c.pendiente.link)}">Pagar ahora</a></div>`;
    if (cu.estado === "vencida") return `<div class="tarjeta cuota cuota-mal"><p class="t-tit">Tu cuota venció</p><p>Venció el ${fecha(s.vence)}. Pagala para poder entrar al gimnasio.</p><button class="btn btn-lima btn-chico" type="button" data-pagar-cuota>Pagar la cuota</button></div>`;
    if (cu.estado === "por-vencer") return `<div class="tarjeta cuota cuota-aviso"><p class="t-tit">Tu cuota vence ${cu.dias === 0 ? "hoy" : cu.dias === 1 ? "mañana" : "en " + cu.dias + " días"}</p><p>Plan ${esc(s.plan)} · vence el ${fecha(s.vence)}.</p><button class="btn btn-lima btn-chico" type="button" data-pagar-cuota>Pagar ahora</button></div>`;
    return `<div class="tarjeta cuota"><p class="t-tit">Cuota al día <span class="ok">✓</span></p><p>Plan ${esc(s.plan)} · vence el ${fecha(s.vence)}.</p><button class="link" type="button" data-pagar-cuota>Pagar por adelantado</button></div>`;
  }
  function pintarInicio() {
    const s = c.socio, r = s.rango;
    if (!trabajo) cargarTrabajo();
    const dia = c.plan.dias[trabajo.dia], total = trabajo.ejs.length, hechos = trabajo.ejs.filter(e => e.series.some(x => x.ok)).length;
    const listo = !!c.hoy.terminado;
    const metasHechas = c.metas.filter(m => m.hecha).length;
    const otros = c.historial.filter(h => !/^Día terminado/.test(h.motivo)).slice(0, 5);
    $('[data-pant="inicio"]').innerHTML = `
      <div class="rango-card" style="--c:${r.color}">
        <div class="rc-emb">${emblema(r, 104)}</div>
        <div class="rc-txt">
          <p class="rc-quien">${nombreCon({ ...s, rango: null })}</p>
          <h1 class="rc-rango ancha">${esc(r.nombre)}</h1>
          ${r.falta != null ? `<div class="barra" role="progressbar" aria-label="PL de la división" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.lp}"><i style="--p:${r.lp}%"></i></div>
          <p class="rc-pl"><b>${r.lp}</b>/100 PL · te faltan ${r.falta} para <b class="nw">${esc(r.siguiente)}</b></p>` : `<p class="rc-pl"><b>${r.lp}</b> PL arriba de Maestro${r.siguiente ? " · los 3 con más PL son Retador" : " · sos de los 3 mejores del gimnasio"}</p>`}
        </div>
        <p class="rc-pie"><span>Puesto <b>${s.puesto}</b> de ${s.de} en PULSO</span><span><b class="lima">+${s.plSemana} PL</b> esta semana</span></p>
      </div>
      ${diaHtml()}
      ${cuotaHtml()}
      ${instalarHtml()}
      <div class="tarjeta hoy${listo ? " hoy-listo" : ""}">
        <p class="t-tit">${listo ? "Hoy entrenaste" : "Hoy te toca"} <span>${hechos}/${total}</span></p>
        <div class="hoy-fila"><div><h2 class="hoy-tit ancha">${esc(dia.nombre)}</h2>
        <p class="mute">${esc(c.plan.nombre)} · ${total} ejercicios${listo ? ` · <b class="lima">+${c.hoy.pl} PL</b>` : ""}</p></div>
        <div class="hoy-fotos" aria-hidden="true">${trabajo.ejs.slice(0, 3).map(e => `<img src="${foto(e.id)}" alt="" width="52" height="52" loading="lazy">`).join("")}</div></div>
        <div class="barra"><i style="--p:${total ? Math.round(hechos / total * 100) : 0}%"></i></div>
        <button class="btn btn-lima btn-ancho" type="button" data-tab-ir="entrenar">${listo ? "Ver mi día" : hechos ? "Seguir entrenando" : "Empezar"}</button>
      </div>
      ${clasesHtml()}
      <div class="tarjeta">
        <p class="t-tit">Metas de la semana <span>${metasHechas}/${c.metas.length}</span></p>
        <ul class="metas">${c.metas.map(m => `<li class="${m.hecha ? "hecha" : ""}"><div><b>${esc(m.texto)}</b><span>${m.van}/${m.n}</span></div><div class="barra"><i style="--p:${Math.round(m.van / m.n * 100)}%"></i></div><small>${m.hecha ? "✓ " : ""}+${c.pl.meta} PL</small></li>`).join("")}</ul>
        <p class="ayuda">Cumplí las ${c.metas.length} y sumás <b>+${c.pl.semana} PL</b> extra. Se renuevan cada lunes.</p>
      </div>
      ${c.profe ? `<div class="tarjeta profe"><p class="t-tit">Tu profe personal</p>
        <div class="persona">${avatar(c.profe, 52)}<div><b>${esc(c.profe.completo)}</b><span class="mute">${esc(c.profe.especialidad)} · hasta el ${fecha(c.profe.vence)}</span></div></div>
        <button class="btn btn-borde btn-chico btn-ancho" type="button" data-abrir-chat="dm:${c.profe.id}">Escribirle</button></div>`
      : `<div class="tarjeta profe"><p class="t-tit">Profe personal</p><p>Entrená con un profe que te arma el plan, te corrige la técnica y te sigue por chat.</p>
        <button class="btn btn-borde btn-chico btn-ancho" type="button" data-ver-profes>Ver profes · ${plata(c.profePrecio)}/mes</button></div>`}
      <div class="tarjeta"><p class="t-tit">Tus días <span>últimos PL</span></p>
        ${diasHtml(c.entrenos.slice(0, 6))}
        ${otros.length ? `<p class="sub-chico">Otros PL</p><ul class="historial">${otros.map(h => `<li><span>${esc(h.motivo)}<small>${cuando(h.creado)}</small></span><b class="${h.pl < 0 ? "menos" : ""}">${h.pl > 0 ? "+" : ""}${h.pl}</b></li>`).join("")}</ul>` : ""}
      </div>`;
  }

  // Sus días terminados: qué hizo en cada ejercicio (kilos × repeticiones de cada serie) y los PL que le dio
  function diasHtml(lista) {
    if (!lista.length) return '<p class="ayuda">Terminá tu primer día en Entrenar y vas a ver acá cómo te fue y los PL que sumaste.</p>';
    return `<ul class="dias-h">${lista.map((d, n) => {
      const r = d.resumen || {}, det = d.detalle || { ejs: [] };
      const linea = e => { const ok = e.series.filter(x => x.ok); if (!ok.length) return ""; const x = ej(e.id);
        const series = ok.map(y => y.kg && y.r ? `${kgTxt(y.kg)}×${y.r}` : y.r ? `${y.r}` : "✓").join(" · ");
        return `<li><span>${esc(x.nombre)}</span><small>${series}${e.obj && ok.some(y => (y.r || 0) < e.obj) ? ' <i class="ambar">(menos repes)</i>' : ""}</small></li>`; };
      return `<li><details data-det="dia-${esc(d.fecha)}"${n === 0 ? "" : ""}><summary><span><b>${esc(d.nombre)}</b><small>${fecha(d.fecha, true)} · ${r.hechos || 0} ejercicios · ${r.repes || 0} repes${r.volumen ? ` · ${r.volumen.toLocaleString("es-AR")} kg` : ""}</small></span><b class="lima">+${d.pl}</b></summary>
        <ul class="dia-ejs">${det.ejs.map(linea).join("")}</ul>${r.pl ? `<p class="desglose">${desglose(r)}</p>` : ""}</details></li>`;
    }).join("")}</ul>`;
  }

  // ---------- Clases (reservas con cupo) ----------
  const DIA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaDe = f => new Date(f + "T12:00:00").getDay();
  const cuandoClase = f => f === c.hoy.fecha ? "Hoy" : (Date.parse(f) - Date.parse(c.hoy.fecha)) === 864e5 ? "Mañana" : DIA_CORTO[diaDe(f)] + " " + +f.slice(8);
  function clasesHtml() {
    const mis = c.misClases, info = c.clases;
    return `<div class="tarjeta clases-card"><p class="t-tit">Tus clases ${info.max ? `<span>${info.usadas}/${info.max} este mes</span>` : ""}</p>
      ${mis.length ? `<ul class="mis-clases">${mis.map(m => `<li class="${m.estado === "espera" ? "en-espera" : ""}"><span class="mc-dia"><b>${esc(cuandoClase(m.fecha))}</b><small>${esc(m.hora)}</small></span>
        <span class="mc-txt"><b>${esc(m.clase)}</b><small>${esc(m.profe)} · ${m.min} min${m.estado === "espera" ? ` · <i class="ambar">en lista de espera (${m.puesto}.º)</i>` : ""}</small></span>
        ${m.cancelable ? `<button class="link" type="button" data-cancelar-clase="${m.id}">${m.estado === "espera" ? "Salir" : "Cancelar"}</button>` : ""}</li>`).join("")}</ul>`
        : `<p class="mute">${info.puede.ok ? "Reservá tu lugar en funcional, cross, spinning, box o movilidad." : esc(info.puede.motivo)}</p>`}
      <button class="btn btn-borde btn-chico btn-ancho" type="button" data-ver-clases>${info.puede.ok ? "Reservar una clase" : "Ver los horarios"}</button></div>`;
  }
  let clasesDatos = null, clasesDia = 0;
  async function hojaClases() {
    abrirHoja(`<h2 id="hoja-tit">Clases</h2><p class="ayuda">Cargando los horarios…</p>`);
    await cargarClases();
  }
  async function cargarClases() {
    const r = await api("/api/socio?ver=clases");
    if (!r.ok) { $("[data-hoja-in]").innerHTML = `<h2 id="hoja-tit">Clases</h2><p class="ayuda">${esc(r.datos.error || "No se pudieron cargar los horarios.")}</p>`; return; }
    // La primera vez arranca en el primer día que todavía tiene clases por empezar
    if (clasesDia < 0) clasesDia = Math.max(0, r.datos.dias.findIndex(d => d.clases.some(x => !x.empezo)));
    clasesDatos = r.datos;
    if (clasesDia >= clasesDatos.dias.length) clasesDia = 0;
    pintarClases();
  }
  function pintarClases() {
    const d = clasesDatos, dia = d.dias[clasesDia];
    const libres = x => x.libres === 1 ? "Queda 1 lugar" : x.libres > 0 ? `Quedan ${x.libres}` : `Completa${x.espera ? ` · ${x.espera} en espera` : ""}`;
    const boton = x => {
      if (x.mia && x.mia.estado === "ok") return `<span class="cl-mia">Reservada ✓</span>${x.cancelable ? `<button class="link" type="button" data-cancelar-clase="${x.mia.id}">Cancelar</button>` : ""}`;
      if (x.mia) return `<span class="cl-mia ambar">En espera (${x.mia.puesto}.º)</span><button class="link" type="button" data-cancelar-clase="${x.mia.id}">Salir</button>`;
      if (x.empezo) return "";
      return `<button class="btn ${x.libres ? "btn-lima" : "btn-borde"} btn-chico" type="button" data-reservar="${esc(dia.fecha)}|${esc(x.hora)}" data-espera="${x.libres ? "" : "1"}" ${d.puede.ok ? "" : "disabled"}>${x.libres ? "Reservar" : "Lista de espera"}</button>`;
    };
    $("[data-hoja-in]").innerHTML = `<h2 id="hoja-tit">Reservar una clase</h2>
      <p class="mute">${d.puede.ok ? (d.max ? `Plan Clases: te quedan <b>${Math.max(0, d.max - d.usadas)}</b> de ${d.max} este mes.` : "Tu plan incluye todas las clases.") + " Cancelás hasta 1 hora antes." : esc(d.puede.motivo)}</p>
      <div class="dias dias-hoja" role="group" aria-label="Días">${d.dias.map((x, j) => `<button type="button" data-cl-dia="${j}" aria-pressed="${j === clasesDia}"><small>${x.fecha === c.hoy.fecha ? "Hoy" : DIA_CORTO[diaDe(x.fecha)]}</small>${+x.fecha.slice(8)}/${+x.fecha.slice(5, 7)}</button>`).join("")}</div>
      <ul class="cl-lista">${dia.clases.map(x => `<li class="${x.empezo ? "pasada" : ""}${x.mia ? " mia" : ""}"><b class="cl-hora">${esc(x.hora)}</b>
        <span class="cl-txt"><b>${esc(x.clase)}</b><small>${esc(x.profe)} · ${x.min} min · <span class="${x.empezo ? "" : x.libres ? (x.libres <= 3 ? "ambar" : "lima") : "rojo"}">${x.empezo ? "Ya empezó" : libres(x)}</span></small></span>
        <span class="cl-acc">${boton(x)}</span></li>`).join("")}</ul>
      ${d.puede.plan ? `<p class="ayuda">Para cambiarte de plan, pedilo en recepción. <a class="link" href="/#planes">Ver los planes</a></p>` : ""}`;
  }
  async function reservar(fecha, hora, espera) {
    let r = await api("/api/socio", { metodo: "POST", cuerpo: { accion: "reservar", fecha, hora, espera: !!espera } });
    if (r.status === 409 && r.datos.lleno && confirm("Se llenó justo ahora. ¿Te anotás en la lista de espera? Si alguien cancela, el lugar es tuyo.")) {
      r = await api("/api/socio", { metodo: "POST", cuerpo: { accion: "reservar", fecha, hora, espera: true } });
    }
    if (r.status === 401) { salir(true); return; }
    if (!r.ok) { if (!r.datos.lleno) toast(r.datos.error || "No se pudo reservar."); await cargarClases(); return; }
    c = r.datos.cuenta; pintar();
    toast(r.datos.texto, 3200);
    await cargarClases();
  }
  async function cancelarClase(id) {
    const m = c.misClases.find(x => x.id === id);
    if (m && m.estado === "ok" && !confirm(`¿Cancelar ${m.clase} (${cuandoClase(m.fecha).toLowerCase()} a las ${m.hora})? Tu lugar queda para otro.`)) return;
    const r = await accion({ accion: "cancelar-reserva", id });
    if (r) toast(r.texto);
    if (r && clasesDatos && !$("[data-hoja]").hidden) await cargarClases();
  }

  // ---------- Entrenar ----------
  // El día se anota serie por serie (kilos, repeticiones y ✓). Se puede elegir otro día del plan, sumar o quitar ejercicios y
  // cambiar las series, las repeticiones o el descanso. Se guarda solo (en el celu y en el servidor) y "Terminé el día" da los PL
  // (una vez por día). Las cuentas de los PL son las mismas del servidor (lib/dia.js): acá solo se muestran antes de terminar.
  const PIERNAS = new Set(["Piernas", "Isquios", "Glúteos", "Pantorrillas", "Espalda y piernas", "Isquios y glúteos"]);
  const ej = id => c.catalogo.find(x => x.id === id) || { id, nombre: id, grupo: "", como: [], tip: "", kg: false };
  const foto = (id, n = 0) => `/assets/ej/${id}-${n}.webp`;
  const kgTxt = v => String(v).replace(".", ",");
  const minSeg = s => !s ? "0" : s >= 60 ? (s % 60 ? (s / 60).toLocaleString("es-AR") : s / 60) + " min" : s + " s";
  const descTxt = s => !s ? "sin descanso" : s >= 60 ? `descanso ${s % 60 ? (s / 60).toLocaleString("es-AR") : s / 60} min` : `descanso ${s} s`;
  const hace = f => { const n = Math.round((Date.parse(c.hoy.fecha) - Date.parse(f)) / 864e5); return n <= 1 ? "ayer" : n < 14 ? `hace ${n} días` : `el ${fecha(f)}`; };
  let trabajo = null, tGuardar = 0;
  const claveTrabajo = () => "pulso-dia|" + GYM + "|" + c.socio.id + "|" + c.hoy.fecha;
  // Un ejercicio nuevo para anotar: propone los kilos y las repeticiones de la última vez
  function nuevoEj(id, { series, obj, txt, desc, extra = false }) {
    const e = ej(id), prev = c.ultimasSeries[id] || [];
    return { id, extra, obj, txt, desc, series: Array.from({ length: series }, (_, i) => {
      const p = prev[i] || prev[prev.length - 1] || {};
      return { kg: e.kg ? (p.kg != null ? p.kg : c.ultima[id] ? c.ultima[id].kg : null) : null, r: obj ? (p.r != null ? p.r : obj) : null, ok: false };
    }) };
  }
  const armarDia = n => ({ dia: n, ejs: c.plan.dias[n].ej.map(x => nuevoEj(x.id, { series: x.series, obj: x.obj, txt: x.txt, desc: x.descanso })) });
  // Lo que trae un ejercicio sumado a mano: series y repeticiones de base según el tipo
  function porDefecto(e) {
    if (e.grupo === "Cardio") return { series: 1, obj: null, txt: "15 min", desc: 0 };
    if (e.grupo === "Movilidad") return { series: 2, obj: null, txt: "1 min", desc: 0 };
    if (/plancha/.test(e.id)) return { series: 3, obj: null, txt: "30 s", desc: 45 };
    return { series: 3, obj: 10, txt: "10", desc: 60 };
  }
  function cargarTrabajo() {
    if (c.hoy.terminado) { trabajo = c.hoy.detalle; return; }
    const local = leer(claveTrabajo(), null);
    trabajo = local || c.hoy.detalle || armarDia(c.hoy.dia);
    if (!trabajo.ejs || trabajo.dia >= c.plan.dias.length) trabajo = armarDia(c.hoy.dia);
  }
  // Cada cambio queda en el celu al instante y en el servidor un segundo después (si se corta la señal, no se pierde)
  function guardarTrabajo() {
    guardar(claveTrabajo(), trabajo);
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => enFila({ accion: "guardar-dia", detalle: trabajo }), 1200);
  }
  const empezado = () => trabajo && trabajo.ejs.some(e => e.series.some(x => x.ok));
  // Las mismas cuentas que hace el servidor al terminar el día
  function cuentasDia(det) {
    const P = c.pl;
    let repes = 0, volumen = 0, completos = 0, medias = 0, piernas = 0, hechos = 0, records = 0;
    det.ejs.forEach(e => {
      const ok = e.series.filter(x => x.ok);
      if (!ok.length) return;
      hechos++;
      if (PIERNAS.has(ej(e.id).grupo)) piernas++;
      if (ok.length === e.series.length && (!e.obj || ok.every(x => (x.r || 0) >= e.obj))) completos++; else medias++;
      ok.forEach(x => { if (e.obj) repes += x.r || 0; if (x.kg && x.r) volumen += x.kg * x.r * (e.obj && x.r < e.obj ? .5 : 1); });
      const top = Math.max(0, ...ok.filter(x => x.kg && x.r).map(x => x.kg));
      if (top && c.maximos[e.id] != null && top > c.maximos[e.id]) records++;
    });
    const esPiernas = hechos > 0 && piernas * 2 >= hechos;
    const pl = { dia: hechos ? P.dia + (esPiernas ? P.piernas : 0) : 0, ejercicios: completos * P.ejercicio + medias * Math.ceil(P.ejercicio / 2),
      repes: Math.min(P.repesMax, Math.floor(repes / P.repesCada)), kilos: Math.min(P.kilosMax, Math.floor(volumen / P.kilosCada)), records: records * P.record };
    return { hechos, completos, medias, repes, volumen: Math.round(volumen), esPiernas, pl, total: Object.values(pl).reduce((a, x) => a + x, 0) };
  }
  // El detalle de los PL (para el botón, el resumen y el historial)
  const desglose = r => [["Día" + (r.esPiernas ? " de piernas" : ""), r.pl.dia], ["Ejercicios", r.pl.ejercicios], ["Repes", r.pl.repes], ["Kilos", r.pl.kilos], ["Récords", r.pl.records]]
    .filter(([, v]) => v).map(([t, v]) => `<span>${t} <b>+${v}</b></span>`).join("");

  // Una tarjeta de ejercicio. editable: el día de hoy sin terminar
  function tarjetaEj(e, i, editable) {
    const x = ej(e.id), ult = c.ultima[e.id], hechas = e.series.filter(s => s.ok).length;
    const cols = x.kg ? "con-kg" : "sin-kg";
    const filas = e.series.map((s, j) => `<div class="set${s.ok ? " ok" : ""}" data-fila="${i}.${j}"><span class="set-n">${j + 1}</span>
      ${x.kg ? `<label class="set-c"><span class="sr-only">Kilos de la serie ${j + 1}</span><input inputmode="decimal" data-set-kg="${i}.${j}" value="${s.kg != null ? kgTxt(s.kg) : ""}" placeholder="0" ${editable ? "" : "disabled"}><small>kg</small></label>` : ""}
      ${e.obj ? `<label class="set-c"><span class="sr-only">Repeticiones de la serie ${j + 1}</span><input inputmode="numeric" data-set-r="${i}.${j}" value="${s.r != null ? s.r : ""}" placeholder="${e.obj}" class="${s.ok && (s.r || 0) < e.obj ? "corto" : ""}" ${editable ? "" : "disabled"}><small>repes</small></label>` : `<span class="set-t">${esc(e.txt)}</span>`}
      <button class="set-ok" type="button" data-set-ok="${i}.${j}" aria-pressed="${s.ok}" aria-label="Serie ${j + 1} hecha" ${editable ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg></button></div>`).join("");
    return `<li class="ej2 ${cols}${hechas === e.series.length && hechas ? " hecho" : ""}" data-ej-i="${i}">
      <div class="ej-cab">
        <button class="ej-foto" type="button" data-como="${e.id}" aria-label="Cómo se hace: ${esc(x.nombre)}"><img src="${foto(e.id)}" alt="" width="76" height="76" loading="lazy"></button>
        <div class="ej-txt"><b>${esc(x.nombre)}${e.extra ? ' <i class="extra">sumado</i>' : ""}</b>
          <span>${e.series.length} × ${esc(e.txt)} · ${descTxt(e.desc)}</span>
          ${x.kg && ult ? `<small class="ult">La última vez: <b>${kgTxt(ult.kg)} kg</b> (${hace(ult.fecha)})</small>` : ""}</div>
        ${editable ? `<button class="ej-edit" type="button" data-editar="${i}" aria-label="Cambiar series, repeticiones o descanso de ${esc(x.nombre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg></button>` : ""}
      </div>
      <div class="sets">${filas}</div>
      <div class="ej-pie">${editable ? `<span class="series-acc"><button class="serie-btn" type="button" data-menos-serie="${i}" aria-label="Quitar la última serie de ${esc(x.nombre)}" ${e.series.length > 1 ? "" : "disabled"}>− Serie</button><button class="serie-btn" type="button" data-mas-serie="${i}" aria-label="Sumar una serie a ${esc(x.nombre)}" ${e.series.length < 12 ? "" : "disabled"}>+ Serie</button></span>` : `<span class="mute">${hechas} de ${e.series.length} series</span>`}<button class="link" type="button" data-como="${e.id}">Cómo se hace</button></div>
    </li>`;
  }
  function pintarEntrenar() {
    if (!trabajo) cargarTrabajo();
    if (diaVer == null || diaVer >= c.plan.dias.length) diaVer = trabajo.dia;
    const cont = $('[data-pant="entrenar"]'), terminado = !!c.hoy.terminado, esHoy = diaVer === trabajo.dia;
    const abierto = new Set($$("details[open]", cont).map(x => x.dataset.det));
    let cuerpo;
    if (!esHoy) {
      // Mirando otro día del plan: se puede elegir para hoy si todavía no empezó
      const d = c.plan.dias[diaVer], otro = { dia: diaVer, ejs: d.ej.map(x => nuevoEj(x.id, { series: x.series, obj: x.obj, txt: x.txt, desc: x.descanso })) };
      cuerpo = `<div class="aviso-dia">${terminado ? `<p>Hoy ya terminaste <b>${esc(c.plan.dias[trabajo.dia].nombre)}</b>. Este día te toca otra vez.</p>`
        : empezado() ? `<p>Hoy ya empezaste <b>${esc(c.plan.dias[trabajo.dia].nombre)}</b>: terminalo y la próxima hacés este.</p>`
        : `<p>Hoy te toca <b>${esc(c.plan.dias[trabajo.dia].nombre)}</b>. ¿Preferís hacer este?</p><button class="btn btn-lima btn-chico" type="button" data-hacer-dia="${diaVer}">Hoy hago ${esc(d.nombre)}</button>`}</div>
        <ol class="ejs2">${otro.ejs.map((e, i) => tarjetaEj(e, i, false)).join("")}</ol>`;
    } else if (terminado) {
      const r = c.hoy.resumen || {};
      cuerpo = `<div class="tarjeta dia-listo"><p class="t-tit">Día terminado ✓</p><h2 class="ancha">+${c.hoy.pl} PL</h2>
        <p class="desglose">${r.pl ? desglose(r) : ""}</p><p class="mute">${r.hechos || 0} ejercicios · ${r.repes || 0} repes${r.volumen ? ` · ${r.volumen.toLocaleString("es-AR")} kg levantados` : ""}</p>
        <p class="ayuda">Mañana seguís con el día ${(trabajo.dia + 1) % c.plan.dias.length + 1}. Mirá cómo venís en Progreso.</p></div>
        <ol class="ejs2">${trabajo.ejs.map((e, i) => tarjetaEj(e, i, false)).join("")}</ol>`;
    } else {
      const prev = cuentasDia(trabajo);
      cuerpo = `<ol class="ejs2">${trabajo.ejs.map((e, i) => tarjetaEj(e, i, true)).join("")}</ol>
        <button class="btn btn-borde btn-ancho" type="button" data-sumar-ej>+ Sumar un ejercicio</button>
        <div class="terminar" data-terminar-caja>${terminarHtml(prev)}</div>`;
    }
    cont.innerHTML = `
      <header class="e-cab"><p class="t-tit">Tu plan · ${esc(c.plan.nombre)}</p><p class="mute">${esc(c.plan.resumen)}</p></header>
      <div class="dias" role="group" aria-label="Días del plan">${c.plan.dias.map((x, i) => `<button type="button" data-dia="${i}" aria-pressed="${i === diaVer}"><small>Día ${i + 1}${i === trabajo.dia ? " · hoy" : ""}</small>${esc(x.nombre)}</button>`).join("")}</div>
      ${cuerpo}
      <p class="e-pie">Terminar el día <b>+${c.pl.dia} PL</b> (piernas <b>+${c.pl.dia + c.pl.piernas}</b>) · cada ejercicio completo <b>+${c.pl.ejercicio}</b> · repes y kilos suman más · récord <b>+${c.pl.record}</b>. Si hacés menos repes de las que tocan, esa serie cuenta la mitad.</p>
      <h2 class="sub-tit ancha">Formas de entrenar</h2>
      <div class="formas">${c.plan.formas.map(f => `<details data-det="f-${f.id}"${abierto.has("f-" + f.id) ? " open" : ""}><summary>${esc(f.titulo)}</summary><p>${esc(f.texto)}</p></details>`).join("")}</div>
      <p class="ayuda">Es una guía general: tu profe la ajusta a vos. Si algo duele, pará y consultá.</p>`;
  }
  function terminarHtml(prev) {
    return `<button class="btn btn-lima btn-ancho btn-terminar" type="button" data-terminar ${prev.hechos ? "" : "disabled"}>Terminé el día${prev.hechos ? ` · +${prev.total} PL` : ""}</button>
      <p class="desglose">${prev.hechos ? desglose(prev) : "Tachá las series que vas haciendo (✓) y al final tocá «Terminé el día». Se puede una vez por día."}</p>`;
  }
  // Después de un cambio en una serie: solo se repinta lo que cambió (no se pierde el teclado ni la posición)
  function refrescarEj(i) {
    const li = $(`[data-ej-i="${i}"]`), e = trabajo.ejs[i];
    if (!li || !e) return;
    const hechas = e.series.filter(s => s.ok).length;
    li.classList.toggle("hecho", !!hechas && hechas === e.series.length);
    e.series.forEach((s, j) => {
      const f = $(`[data-fila="${i}.${j}"]`, li); if (!f) return;
      f.classList.toggle("ok", s.ok);
      $("[data-set-ok]", f).setAttribute("aria-pressed", String(s.ok));
      const r = $("[data-set-r]", f); if (r) r.classList.toggle("corto", s.ok && (s.r || 0) < e.obj);
    });
    const caja = $("[data-terminar-caja]"); if (caja) caja.innerHTML = terminarHtml(cuentasDia(trabajo));
  }
  function tocarSerie(btn) {
    const [i, j] = btn.dataset.setOk.split(".").map(Number), e = trabajo.ejs[i], s = e.series[j];
    // Antes de tachar, toma lo que haya escrito en los cuadros
    const f = btn.closest(".set"), kg = $("[data-set-kg]", f), r = $("[data-set-r]", f);
    if (kg) s.kg = numero(kg.value, .5); if (r) s.r = numero(r.value, 1);
    s.ok = !s.ok;
    refrescarEj(i); guardarTrabajo();
    // Descanso después de cada serie (salvo la última del día)
    const quedan = trabajo.ejs.some(x => x.series.some(y => !y.ok));
    if (s.ok && e.desc && quedan) descanso(e.desc);
    if (s.ok && navigator.vibrate) navigator.vibrate(30);
  }
  const numero = (v, paso) => { const n = Math.round(Number(String(v).replace(",", ".")) / paso) * paso; return String(v).trim() && Number.isFinite(n) && n >= 0 ? n : null; };
  function escribirSerie(inp) {
    const [i, j] = (inp.dataset.setKg || inp.dataset.setR).split(".").map(Number), s = trabajo.ejs[i].series[j];
    if (inp.dataset.setKg) s.kg = numero(inp.value, .5); else s.r = numero(inp.value, 1);
    // Los kilos de una serie se copian a las de abajo que todavía no hizo (casi siempre son los mismos)
    if (inp.dataset.setKg) trabajo.ejs[i].series.forEach((x, k) => { if (k > j && !x.ok) { x.kg = s.kg; const o = $(`[data-set-kg="${i}.${k}"]`); if (o && document.activeElement !== o) o.value = s.kg != null ? kgTxt(s.kg) : ""; } });
    refrescarEj(i); guardarTrabajo();
  }
  // Cambiar series, repeticiones o descanso (o quitarlo de hoy)
  function hojaEditar(i) {
    const e = trabajo.ejs[i], x = ej(e.id);
    abrirHoja(`<h2 id="hoja-tit">${esc(x.nombre)}</h2><p class="mute">Cambialo como lo hagas hoy. Más series, más descansos.</p>
      <div class="ajustes-ej" data-editando="${i}">
        <div class="paso"><span>Series</span><button type="button" data-paso="series" data-d="-1" aria-label="Una serie menos">−</button><b data-v="series">${e.series.length}</b><button type="button" data-paso="series" data-d="1" aria-label="Una serie más">+</button></div>
        ${e.obj ? `<div class="paso"><span>Repes por serie</span><button type="button" data-paso="obj" data-d="-1" aria-label="Una repetición menos">−</button><b data-v="obj">${e.obj}</b><button type="button" data-paso="obj" data-d="1" aria-label="Una repetición más">+</button></div>` : `<p class="ayuda">Este ejercicio va por tiempo: ${esc(e.txt)} por serie.</p>`}
        <div class="paso"><span>Descanso</span><button type="button" data-paso="desc" data-d="-15" aria-label="15 segundos menos">−</button><b data-v="desc">${minSeg(e.desc)}</b><button type="button" data-paso="desc" data-d="15" aria-label="15 segundos más">+</button></div>
      </div>
      <button class="btn btn-lima btn-ancho" type="button" data-hoja-cerrar>Listo</button>
      <button class="btn btn-borde btn-ancho quitar-ej" type="button" data-quitar-ej="${i}">Quitar de hoy</button>`);
  }
  function pasoEditar(btn) {
    const i = +$("[data-editando]").dataset.editando, e = trabajo.ejs[i], d = +btn.dataset.d;
    if (btn.dataset.paso === "series") {
      const n = Math.max(1, Math.min(12, e.series.length + d));
      while (e.series.length < n) { const u = e.series[e.series.length - 1] || {}; e.series.push({ kg: u.kg != null ? u.kg : null, r: e.obj, ok: false }); }
      while (e.series.length > n) e.series.pop();
      $('[data-v="series"]').textContent = n;
    } else if (btn.dataset.paso === "obj") {
      e.obj = Math.max(1, Math.min(100, e.obj + d)); e.txt = String(e.obj);
      e.series.forEach(s => { if (!s.ok) s.r = e.obj; });
      $('[data-v="obj"]').textContent = e.obj;
    } else {
      e.desc = Math.max(0, Math.min(600, e.desc + d));
      $('[data-v="desc"]').textContent = minSeg(e.desc);
    }
    guardarTrabajo(); pintarEntrenar();
  }
  // Sumar un ejercicio (si hizo de más): todos los del gimnasio, por grupo y con buscador
  function hojaSumar(filtro = "") {
    const q = filtro.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const lista = c.catalogo.filter(x => !q || (x.nombre + " " + x.grupo).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q));
    const grupos = [...new Set(lista.map(x => x.grupo))];
    const html = grupos.map(g => `<p class="cat-g">${esc(g)}</p><ul class="cat">${lista.filter(x => x.grupo === g).map(x => `<li><button type="button" class="cat-ej" data-sumar="${x.id}"><img src="${foto(x.id)}" alt="" width="52" height="52" loading="lazy"><span>${esc(x.nombre)}</span><b aria-hidden="true">+</b></button></li>`).join("")}</ul>`).join("") || '<p class="ayuda">No hay ejercicios con ese nombre.</p>';
    if (!$("[data-cat-lista]")) abrirHoja(`<h2 id="hoja-tit">Sumar un ejercicio</h2><div class="campo"><label for="cat-q" class="sr-only">Buscar un ejercicio</label><input id="cat-q" class="entrada" data-cat-q placeholder="Buscar: press, sentadilla, plancha…" autocomplete="off"></div><div data-cat-lista></div>`);
    $("[data-cat-lista]").innerHTML = html;
  }
  // Cómo se hace: las fotos del movimiento (se alternan), los pasos, el consejo y el video
  function hojaComo(id) {
    const x = ej(id);
    abrirHoja(`<h2 id="hoja-tit">${esc(x.nombre)}</h2><p class="mute">${esc(x.grupo)}</p>
      <div class="demo" aria-label="Fotos del movimiento"><img src="${foto(id, 0)}" alt="${esc(x.nombre)}: posición inicial" width="480" height="320"><img src="${foto(id, 1)}" alt="${esc(x.nombre)}: posición final" width="480" height="320"></div>
      <ol class="pasos">${x.como.map(p => `<li>${esc(p)}</li>`).join("")}</ol><p class="tip">💡 ${esc(x.tip)}</p>
      ${x.video ? `<button type="button" class="video video-tapa" data-video="${esc(x.video)}" data-video-tit="Video: cómo hacer ${esc(x.nombre)}"><img src="https://i.ytimg.com/vi/${esc(x.video)}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy"><span class="play" aria-hidden="true"></span><span class="sr-only">Ver el video de cómo hacer ${esc(x.nombre)}</span></button>`
        : `<a class="btn btn-borde btn-ancho" href="https://www.youtube.com/results?search_query=${encodeURIComponent("cómo hacer " + x.nombre)}" target="_blank" rel="noopener">Ver videos de cómo se hace</a>`}
      <p class="creditos">Fotos: free-exercise-db (dominio público)${x.video ? " · Video: YouTube" : ""}. Tu profe te corrige la técnica en la sala.</p>`);
  }
  async function terminarDia() {
    const prev = cuentasDia(trabajo);
    if (!prev.hechos) return;
    if (!confirm(`¿Terminaste por hoy? Se guarda tu día y sumás +${prev.total} PL. Se puede una sola vez por día.`)) return;
    clearTimeout(tGuardar);
    const b = $("[data-terminar]"); if (b) b.disabled = true;
    await cola;   // que termine de guardar lo anterior
    const r = await accion({ accion: "terminar-dia", detalle: trabajo });
    if (!r) { if (b) b.disabled = false; return; }
    try { localStorage.removeItem(claveTrabajo()); } catch (_) { /* nada */ }
    finDescanso(false);
    trabajo = c.hoy.detalle; pintarEntrenar(); scrollTo({ top: 0 });
    celebrar(`¡Día terminado! +${r.terminado.pl} PL${r.terminado.resumen.records.length ? ` · ${r.terminado.resumen.records.length === 1 ? "¡récord!" : r.terminado.resumen.records.length + " récords"}` : ""}`);
  }

  // Temporizador del descanso entre series (arriba de las pestañas; suena y vibra al terminar)
  let tDesc = 0, finDesc = 0, totalDesc = 0, audio = null;
  function descanso(seg) {
    clearTimeout(tDesc);
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (_) { audio = null; }
    totalDesc = seg; finDesc = Date.now() + seg * 1000;
    const b = $("[data-descanso]");
    b.hidden = false; b.classList.remove("fin"); document.documentElement.classList.add("con-descanso");
    tic();
  }
  function tic() {
    const falta = Math.max(0, Math.ceil((finDesc - Date.now()) / 1000));
    $("[data-d-tiempo]").textContent = Math.floor(falta / 60) + ":" + String(falta % 60).padStart(2, "0");
    $("[data-d-barra]").style.setProperty("--p", Math.min(100, 100 - falta / Math.max(1, totalDesc) * 100) + "%");
    if (falta <= 0) { finDescanso(true); return; }
    tDesc = setTimeout(tic, 250);
  }
  function finDescanso(sonar) {
    clearTimeout(tDesc);
    const b = $("[data-descanso]");
    if (!sonar) { b.hidden = true; document.documentElement.classList.remove("con-descanso"); return; }
    b.classList.add("fin"); $("[data-d-tiempo]").textContent = "¡Vamos!";
    pitido();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    tDesc = setTimeout(() => finDescanso(false), 2500);
  }
  function pitido() {
    if (!audio) return;
    try {
      [0, .25].forEach(t0 => {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + t0;
        o.frequency.value = 880; g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .2);
      });
    } catch (_) { /* sin sonido */ }
  }
  function celebrar(txt) {
    toast(txt, 3200);
    const el = document.createElement("div"); el.className = "festejo"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * .08}s;--r:${i * 40}deg"></i>`).join("");
    document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([60, 40, 60]);
  }

  // ---------- Progreso ----------
  function grafico(puntos, unidad) {
    if (puntos.length < 2) return `<p class="ayuda">Anotá al menos dos veces para ver la curva.</p>`;
    const W = 320, H = 130, m = 24;
    const vs = puntos.map(p => p.v), min = Math.min(...vs), max = Math.max(...vs), rango = max - min || 1;
    const x = i => m + i * (W - 2 * m) / (puntos.length - 1), y = v => H - m - (v - min) / rango * (H - 2 * m);
    const linea = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de ${unidad}: de ${vs[0]} a ${vs[vs.length - 1]}">
      <polyline points="${linea}" fill="none" stroke="var(--lima)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${puntos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="var(--negro)" stroke="var(--lima)" stroke-width="2"/>`).join("")}
      <text x="${x(0)}" y="${H - 4}" class="g-txt">${fecha(puntos[0].f)}</text><text x="${x(puntos.length - 1)}" y="${H - 4}" class="g-txt" text-anchor="end">${fecha(puntos[puntos.length - 1].f)}</text>
      <text x="${x(0)}" y="${y(vs[0]) - 8}" class="g-val">${String(vs[0]).replace(".", ",")}</text><text x="${x(puntos.length - 1)}" y="${y(vs[vs.length - 1]) - 8}" class="g-val" text-anchor="end">${String(vs[vs.length - 1]).replace(".", ",")}</text></svg>`;
  }
  function pintarProgreso() {
    const nombres = {};
    c.plan.dias.forEach(d => d.ej.forEach(x => { nombres[x.id] = x.nombre; }));
    const recs = Object.entries(c.progreso).filter(([, l]) => l.length).map(([ej, l]) => ({ ej, l, max: Math.max(...l.map(x => x.kg)) }));
    const ultPeso = c.medidas[c.medidas.length - 1];
    $('[data-pant="progreso"]').innerHTML = `
      <div class="tarjeta"><p class="t-tit">Tu peso ${ultPeso ? `<span>${String(ultPeso.peso).replace(".", ",")} kg</span>` : ""}</p>
        ${grafico(c.medidas.map(m => ({ f: m.fecha, v: m.peso })), "tu peso")}
        <form class="fila peso-form" data-form-peso><label class="sr-only" for="p-peso">Tu peso de hoy en kilos</label><input class="entrada" id="p-peso" inputmode="decimal" placeholder="Tu peso de hoy (kg)"><button class="btn btn-lima btn-chico" type="submit">Anotar</button></form>
      </div>
      <div class="tarjeta"><p class="t-tit">Tus récords</p>
        ${recs.length ? `<ul class="recs">${recs.map(r => `<li><div><b>${esc(nombres[r.ej] || r.ej.replace(/-/g, " "))}</b><span class="mute">${r.l.length} ${r.l.length === 1 ? "vez" : "veces"} anotado</span></div><b class="lima">${String(r.max).replace(".", ",")} kg</b>${grafico(r.l.map(x => ({ f: x.fecha, v: x.kg })), "kilos")}</li>`).join("")}</ul>` : `<p class="ayuda">Anotá los kilos en cada ejercicio y acá vas a ver cómo subís.</p>`}
      </div>
      <div class="tarjeta"><p class="t-tit">Tus entrenamientos <span>${c.socio.diasTerminados} días</span></p>
        ${diasHtml(c.entrenos)}
      </div>`;
  }

  // ---------- Perfil ----------
  function pintarPerfil() {
    const s = c.socio, r = s.rango;
    const prev = { ...s, nombre: s.apodo || s.nombre, rango: s.mostrarRango ? s.rango : null, verTag: s.mostrarTag };
    const mio = s.clan ? c.clanes.find(x => x.id === s.clan.id) : null;
    $('[data-pant="perfil"]').innerHTML = `
      <div class="perfil-hero" style="--c:${r.color}">
        <div class="ph-foto">${avatar(s, 108)}<label class="ph-cam" title="Cambiar foto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span class="sr-only">Cambiar foto</span><input class="sr-only" type="file" accept="image/*" data-foto></label></div>
        <p class="ph-nombre">${nombreCon(prev)}</p>
        <p class="mute">${esc(s.nombreCompleto)} · DNI ${esc(s.dni)}</p>
        <div class="ph-rango">${emblema(r, 40)}<span><b style="color:${r.color}">${esc(r.nombre)}</b><small>Puesto ${s.puesto} de ${s.de}</small></span></div>
        <dl class="ph-stats"><div><dt>PL</dt><dd>${s.pl.toLocaleString("es-AR")}</dd></div><div><dt>Días entrenados</dt><dd>${s.diasTerminados}</dd></div><div><dt>Récords</dt><dd>${s.records}</dd></div></dl>
        ${s.foto ? '<button class="link" type="button" data-quitar-foto>Quitar la foto</button>' : ""}
      </div>
      <form class="tarjeta" data-form-perfil>
        <p class="t-tit">Cómo te ven</p>
        <div class="campo"><label for="pf-apodo">Tu nombre en la app</label><input id="pf-apodo" name="apodo" maxlength="20" value="${esc(s.apodo)}" autocomplete="nickname"></div>
        <label class="interruptor"><span>Mostrar mi rango<small class="ayuda"> en el chat y el ranking (${esc(r.nombre)})</small></span><input type="checkbox" name="mostrarRango" ${s.mostrarRango ? "checked" : ""}><span class="int-pista"></span></label>
        <label class="interruptor${s.clan ? "" : " apagado"}"><span>Mostrar el tag de mi clan<small class="ayuda"> ${s.clan ? `al lado de tu nombre: <b class="tag-clan">[${esc(s.clan.tag)}]</b>` : "(cuando estés en un clan)"}</small></span><input type="checkbox" name="mostrarTag" ${s.mostrarTag ? "checked" : ""} ${s.clan ? "" : "disabled"}><span class="int-pista"></span></label>
        <button class="btn btn-lima btn-chico" type="submit">Guardar</button>
      </form>
      <div class="tarjeta clan-perfil">
        <p class="t-tit">Tu clan</p>
        ${mio ? `<div class="cp-mio"><span class="clan-tag">${esc(mio.tag)}</span><div><h3 class="ancha">${esc(mio.nombre)}</h3><p class="mute">${mio.miembros}/10 miembros · ${mio.pl.toLocaleString("es-AR")} PL entre todos${mio.lider === s.id ? " · sos el líder" : ""}</p></div></div>
          <div class="fila"><button class="btn btn-lima btn-chico" type="button" data-abrir-chat="clan">Chat del clan</button><button class="btn btn-borde btn-chico" type="button" data-ir-clanes>Ver el clan</button><button class="link" type="button" data-clan-salir>Salir del clan</button></div>`
        : `<p class="mute">Unite a un clan: tenés su chat, su tag al lado de tu nombre y compiten en el ranking de clanes.</p>
          <ul class="clanes">${c.clanes.slice(0, 5).map(x => `<li><span class="ch-ico clan" aria-hidden="true">${esc(x.tag)}</span><span class="rk-nom"><b>${esc(x.nombre)}</b><small>${x.miembros}/10 · ${x.pl.toLocaleString("es-AR")} PL</small></span><button class="btn btn-borde btn-chico" type="button" data-clan-unir="${x.id}" ${x.miembros >= 10 ? "disabled" : ""}>${x.miembros >= 10 ? "Completo" : "Unirme"}</button></li>`).join("") || "<li>Todavía no hay clanes.</li>"}</ul>
          ${crearClanHtml()}`}
      </div>
      <div class="tarjeta">
        <p class="t-tit">Tu objetivo</p>
        <p>Plan <b>${esc(s.plan)}</b> · entrenás para <b>${esc(c.plan.nombre.toLowerCase())}</b>.</p>
        <div class="campo"><label for="pf-obj">Cambiar de objetivo (cambia tu plan y tus metas)</label>
          <select id="pf-obj" data-objetivo>${c.objetivos.map(o => `<option value="${o.id}" ${o.id === s.objetivo ? "selected" : ""}>${esc(o.nombre)}</option>`).join("")}</select></div>
      </div>
      <div class="tarjeta">
        <p class="t-tit">Avisos y app</p>
        ${notifHtml()}
        ${instalada() ? '<p class="mute app-ok">✓ Tenés la app instalada en este celular.</p>' : pedidoInstalar || esIOS ? '<button class="btn btn-borde btn-chico btn-ancho" type="button" data-instalar>Instalar la app en el celular</button>' : '<p class="ayuda">Para instalarla, abrila desde Chrome (Android) o Safari (iPhone) y elegí "Instalar" o "Agregar a inicio".</p>'}
      </div>
      <form class="tarjeta" data-form-pin>
        <p class="t-tit">Tu PIN (app y tablet)</p>
        <div class="dos"><div class="campo"><label for="pf-pin1">PIN actual</label><input id="pf-pin1" name="actual" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></div>
        <div class="campo"><label for="pf-pin2">PIN nuevo</label><input id="pf-pin2" name="nuevo" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>
        <button class="btn btn-borde btn-chico" type="submit">Cambiar PIN</button>
      </form>
      <button class="btn btn-borde btn-ancho salir" type="button" data-salir>Salir de la cuenta</button>
      <p class="nota-demo">Demo: es un gimnasio de prueba solo para vos (se borra en 24 horas). Mirá cómo lo ve el personal en el <a class="link" href="/panel/">panel</a> y probá la <a class="link" href="/tablet/">tablet de la entrada</a>.</p>`;
  }
  // Crear un clan: desde Oro IV (antes se ve bloqueado, con cuánto le falta)
  function crearClanHtml() {
    const s = c.socio;
    if (!s.puedeCrearClan) return `<div class="clan-bloq"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><p><b>Crear un clan</b> se desbloquea en <b>Oro IV</b>. Te faltan <b class="lima">${s.faltaClan} PL</b>: mientras, unite a uno.</p></div>`;
    return `<form class="crear-clan" data-form-clan><p class="sub-chico">Crear un clan</p>
      <div class="dos-c"><div class="campo"><label for="cl-nom">Nombre</label><input id="cl-nom" name="nombre" maxlength="24" placeholder="Los Madrugadores"></div>
      <div class="campo"><label for="cl-tag">Tag</label><input id="cl-tag" name="tag" maxlength="3" placeholder="MDR" autocapitalize="characters" class="tag-input"></div></div>
      <button class="btn btn-lima btn-chico" type="submit">Crear clan</button></form>`;
  }

  // ---------- Avisos: la campanita, las notificaciones del celular y la app instalada ----------
  // El permiso de notificaciones se pide solo cuando el socio toca "Activar". En iPhone andan con la app instalada.
  const pushPosible = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const deB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), x => x.charCodeAt(0));
  const ICONO = { vence: "💳", vencida: "💳", volver: "💪", clase: "📅", bienvenida: "👋", dia: "🔥" };
  let pushActiva = false, pedidoInstalar = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedidoInstalar = e; if (c) pintar(); });
  addEventListener("appinstalled", () => { pedidoInstalar = null; toast("¡Listo! La app quedó instalada en tu celular."); if (c) pintar(); });

  // ¿Este celular ya tiene los avisos activados? (y, si es otro gimnasio u otra cuenta, se lo cuenta al servidor)
  async function revisarPush() {
    if (!pushPosible() || Notification.permission !== "granted") return;
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      pushActiva = !!sub;
      const k = "pulso-push|" + GYM + "|" + c.socio.id;
      if (sub && leer(k, "") !== sub.endpoint) { await api("/api/socio", { metodo: "POST", cuerpo: { accion: "push-alta", sub: sub.toJSON() } }); guardar(k, sub.endpoint); }
      pintar();
    } catch (_) { /* nada */ }
  }
  async function activarAvisos() {
    if (!pushPosible()) { toast(esIOS && !instalada() ? "En iPhone, primero instalá la app: tocá Compartir y «Agregar a inicio». Después activá los avisos desde ahí." : "Este navegador no deja recibir avisos. Probá con Chrome.", 6500); return; }
    if (!c.push.publica) { toast("Los avisos al celular todavía no están listos en este gimnasio. Igual te llegan a la campanita.", 5000); return; }
    if (await Notification.requestPermission() !== "granted") { toast("Sin permiso no te podemos avisar. Si cambiás de idea, habilitalo en los ajustes del navegador.", 6000); return; }
    try {
      const reg = await navigator.serviceWorker.ready, clave = deB64u(c.push.publica);
      let sub;
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }); }
      catch (_) { const vieja = await reg.pushManager.getSubscription(); if (vieja) await vieja.unsubscribe(); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }); }
      if (await accion({ accion: "push-alta", sub: sub.toJSON() }, "¡Listo! Te vamos a avisar al celular.")) { pushActiva = true; guardar("pulso-push|" + GYM + "|" + c.socio.id, sub.endpoint); pintar(); }
    } catch (_) { toast("No se pudieron activar los avisos en este celular. Probá de nuevo.", 5000); }
  }
  async function desactivarAvisos() {
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) { await accion({ accion: "push-baja", sub: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
    } catch (_) { /* nada */ }
    pushActiva = false; pintar(); toast("Listo: no te llegan más avisos al celular (siguen en la campanita).");
  }
  function notifHtml() {
    if (pushActiva) return `<div class="notif on"><p><b>Avisos al celular: activados</b><small>Te llegan aunque tengas la app cerrada.</small></p><button class="link" type="button" data-avisos-off>Desactivar</button></div>`;
    return `<div class="notif"><p><b>Recibí los avisos en el celular</b><small>Tu cuota, tus clases y un mensaje por día para entrenar.</small></p><button class="btn btn-lima btn-chico" type="button" data-avisos-on>Activar</button></div>`;
  }
  // El mensaje del día (el mismo que le llega al celular a la mañana)
  function diaHtml() {
    const m = c.mensajeDia;
    return `<div class="tarjeta dia-msj"><p class="t-tit">Para hoy</p><p class="dm-tit">${esc(m.titulo)}</p><p>${esc(m.texto)}</p>
      ${pushActiva || leer("pulso-avisos-no", "") === GYM ? "" : `<div class="dm-pie"><span>¿Te lo mandamos cada mañana al celu?</span><button class="btn btn-lima btn-chico" type="button" data-avisos-on>Activar avisos</button><button class="link" type="button" data-avisos-no>Ahora no</button></div>`}</div>`;
  }
  // Instalarla: en Android con el botón (el navegador la instala); en iPhone, los pasos de Safari
  function instalarHtml() {
    if (instalada() || !(pedidoInstalar || esIOS) || leer("pulso-instalar-no", "") === GYM) return "";
    return `<div class="tarjeta instalar"><div class="in-ico" aria-hidden="true"><img src="/assets/icons/pulso-192.png" alt="" width="52" height="52"></div>
      <div><p class="t-tit">Instalá la app</p><p>Queda con su ícono en el celular, abre al toque y sin la barra del navegador.</p>
      <div class="fila"><button class="btn btn-lima btn-chico" type="button" data-instalar>Instalar</button><button class="link" type="button" data-instalar-no>Ahora no</button></div></div></div>`;
  }
  async function instalar() {
    if (pedidoInstalar) { pedidoInstalar.prompt(); const r = await pedidoInstalar.userChoice.catch(() => null); if (r && r.outcome === "accepted") pedidoInstalar = null; pintar(); return; }
    abrirHoja(`<h2 id="hoja-tit">Instalala en tu iPhone</h2><ol class="pasos"><li>Abrí esta página en <b>Safari</b>.</li><li>Tocá el botón <b>Compartir</b> (el cuadrado con la flecha para arriba).</li>
      <li>Elegí <b>Agregar a inicio</b> y después <b>Agregar</b>.</li><li>Abrila desde el ícono de PULSO: ya podés activar los avisos.</li></ol><button class="btn btn-lima btn-ancho" type="button" data-hoja-cerrar>Listo</button>`);
  }
  function hojaAvisos() {
    const a = c.avisos.lista;
    abrirHoja(`<h2 id="hoja-tit">Avisos</h2>${notifHtml()}
      <ul class="avisos">${a.map(x => `<li class="${x.leido ? "" : "nuevo"}"><span class="av-ico" aria-hidden="true">${ICONO[x.tipo] || "🔔"}</span><div><b>${esc(x.titulo)}</b><p>${esc(x.texto)}</p><small>${cuando(x.creado)}</small></div></li>`).join("")
        || '<li class="vacio">Todavía no tenés avisos. Cuando el gimnasio te mande uno, aparece acá.</li>'}</ul>`);
    if (c.avisos.sinLeer) accion({ accion: "avisos-leidos" });
  }

  // ---------- Hoja (pagos, profes, personas) ----------
  function abrirHoja(html) {
    $("[data-hoja-in]").innerHTML = html;
    const h = $("[data-hoja]"), v = $("[data-velo]");
    h.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { h.classList.add("on"); v.classList.add("on"); });
    setTimeout(() => { const b = $("[data-hoja-in] button, [data-hoja-in] a", h); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  function cerrarHoja() {
    const h = $("[data-hoja]"), v = $("[data-velo]");
    if (h.hidden) return;
    h.classList.remove("on"); v.classList.remove("on");
    setTimeout(() => { h.hidden = true; v.hidden = true; }, 250);
  }
  function hojaPagar() {
    const s = c.socio, desc = { 1: 0, 3: .10, 6: .15 };
    const monto = m => Math.round(c.precios[s.plan] * (1 - desc[m]) / 100) * 100 * m;
    abrirHoja(`<h2 id="hoja-tit">Pagar la cuota</h2><p class="mute">Plan ${esc(s.plan)}. Se suma desde que vence${s.cuota.estado === "vencida" ? " (como ya venció, desde hoy)" : ""}.</p>
      <div class="opciones">${[1, 3, 6].map(m => `<button class="opcion" type="button" data-pagar-meses="${m}"><b>${m === 1 ? "1 mes" : m + " meses"}</b><span>${plata(monto(m))}${desc[m] ? ` <i class="lima">−${desc[m] * 100}%</i>` : ""}</span></button>`).join("")}</div>
      <p class="ayuda">Pagás con Mercado Pago (tarjeta, débito o dinero en cuenta). La cuota se corre sola.</p>`);
  }
  function hojaProfes() {
    abrirHoja(`<h2 id="hoja-tit">Profe personal</h2><p class="mute">Te arma el plan, te corrige en la sala y te sigue por chat. ${plata(c.profePrecio)} por mes.</p>
      <ul class="personas">${c.profes.map(p => `<li><div class="persona">${avatar(p, 48)}<div><b>${esc(p.completo)}</b><span class="mute">${esc(p.especialidad)}</span></div></div>
        <button class="btn btn-lima btn-chico" type="button" data-contratar="${p.id}">Elegir</button></li>`).join("")}</ul>`);
  }

  // ---------- Comunidad ----------
  let comVista = "chats", vistos = leer("pulso-chat-visto", {}), resumen = null;
  const claveVisto = canal => GYM + "|" + (c ? c.socio.id : 0) + "|" + canal;
  const sinLeer = ch => ch.ultimo && ch.ultimo.de !== (c && c.socio.id) && ch.ultimo.creado > (vistos[claveVisto(ch.pedido)] || "");
  async function revisarChats() {
    if (!ses) return;
    const r = await api("/api/chat?resumen=1");
    if (r.ok) {
      const antes = resumen; resumen = r.datos;
      // Un aviso nuevo del gimnasio (o leído en otro celular): se trae la cuenta y, si es nuevo, se muestra
      const av = resumen.avisos, maxId = Math.max(0, ...c.avisos.lista.map(a => a.id));
      if (av && (av.sinLeer !== c.avisos.sinLeer || (av.ultimo || 0) > maxId)) {
        const rc = await api("/api/socio");
        if (rc.ok) { c = rc.datos; pintar(); const nuevo = c.avisos.lista[0]; if (nuevo && nuevo.id > maxId && !nuevo.leido) toast(`🔔 ${nuevo.titulo}`, 4500); }
      }
      $("[data-punto-com]").hidden = !resumen.canales.some(sinLeer);
      if (antes && tab !== "comunidad" && !abiertoChat) {
        // Un mensaje nuevo del clan o de un privado avisa (el general solo marca el punto)
        const previo = ch => ((antes.canales.find(a => a.pedido === ch.pedido) || {}).ultimo || {}).id;
        const nuevo = resumen.canales.find(ch => ch.tipo !== "general" && sinLeer(ch) && ch.ultimo.id !== previo(ch));
        if (nuevo) toast(`${nuevo.ultimo.autor ? nuevo.ultimo.autor.nombre : ""}: ${nuevo.ultimo.texto.slice(0, 60)}`, 3500);
      }
      if (tab === "comunidad" && comVista === "chats") pintarChats();
    }
  }
  async function pintarComunidad() {
    $$("[data-com]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.com === comVista)));
    $$("[data-com-vista]").forEach(v => { v.hidden = v.dataset.comVista !== comVista; });
    if (comVista === "chats") { pintarChats(); revisarChats(); }
    if (comVista === "ranking") pintarRanking();
    if (comVista === "clanes") pintarClanes();
  }
  function pintarChats() {
    const v = $('[data-com-vista="chats"]');
    if (!resumen) { v.innerHTML = '<p class="ayuda">Cargando chats…</p>'; return; }
    const ico = ch => ch.tipo === "dm" ? avatar(ch.persona, 46) : `<span class="ch-ico ${ch.tipo}" aria-hidden="true">${ch.tipo === "general" ? "#" : esc((c.socio.clan || {}).tag || "")}</span>`;
    v.innerHTML = `<ul class="chats">${resumen.canales.map(ch => `<li><button type="button" class="chat-fila${sinLeer(ch) ? " nuevo" : ""}" data-abrir-chat="${esc(ch.pedido)}">
        ${ico(ch)}<span class="cf-txt"><b>${ch.tipo === "dm" ? nombreCon(ch.persona) : esc(ch.titulo)}</b><small>${ch.ultimo ? (ch.ultimo.borrado ? "Mensaje borrado" : `${ch.ultimo.de === c.socio.id ? "Vos" : esc(ch.ultimo.autor ? ch.ultimo.autor.nombre : "")}: ${esc(ch.ultimo.texto)}`) : (ch.tipo === "general" ? "Todo el gimnasio" : "Todavía no hay mensajes")}</small></span>
        <span class="cf-hora">${ch.ultimo ? cuando(ch.ultimo.creado) : ""}${sinLeer(ch) ? '<i class="punto-n" aria-label="sin leer"></i>' : ""}</span></button></li>`).join("")}</ul>
      ${c.socio.clan ? "" : `<p class="ayuda">Unite a un clan (en Clanes) y tenés el chat del clan.</p>`}
      <button class="btn btn-borde btn-ancho" type="button" data-nuevo-privado>Mensaje privado</button>
      ${resumen.silenciado ? `<p class="nota-demo">El gimnasio te silenció en el chat hasta las ${P.hora(resumen.silenciado)}.</p>` : ""}`;
  }
  async function pintarRanking(verClanes) {
    const v = $('[data-com-vista="ranking"]');
    const r = await api("/api/socio?ver=ranking");
    if (!r.ok) { v.innerHTML = `<p class="ayuda">${esc(r.datos.error || "No se pudo cargar.")}</p>`; return; }
    const d = r.datos;
    v.innerHTML = `<div class="tarjeta ranking-yo">${emblema(c.socio.rango, 56)}<div><p>Estás en el puesto <b class="lima">${d.yo}</b> de ${d.ranking.length}</p><p class="mute">${esc(c.socio.rango.nombre)} · ${c.socio.pl} PL</p></div></div>
      <div class="seg" role="group" aria-label="Ranking"><button type="button" data-rk="socios" aria-pressed="${!verClanes}">Socios</button><button type="button" data-rk="clanes" aria-pressed="${!!verClanes}">Clanes</button></div>
      ${verClanes ? `<ol class="rk">${d.clanes.map((x, i) => `<li class="${i < 3 ? "top" : ""}${c.socio.clan && c.socio.clan.id === x.id ? " yo" : ""}"><span class="rk-n">${i + 1}</span><span class="ch-ico clan" aria-hidden="true">${esc(x.tag)}</span><span class="rk-nom"><b>${esc(x.nombre)}</b><small>${x.miembros} miembros</small></span><b class="rk-pl">${x.pl.toLocaleString("es-AR")} PL</b></li>`).join("")}</ol>`
      : `<ol class="rk">${d.ranking.map(x => `<li class="${x.puesto <= 3 ? "top" : ""}${x.id === c.socio.id ? " yo" : ""}"><span class="rk-n">${x.puesto}</span>${avatar(x, 38)}<span class="rk-nom"><b>${x.clan && x.verTag !== false ? `<span class="tag-clan">[${esc(x.clan.tag)}]</span> ` : ""}${esc(x.nombre)}</b><small style="color:${x.rango.color}">${esc(x.rango.nombre)}${x.dueno ? " · Dueño" : ""}${x.profe ? " · Profe" : ""}</small></span>${emblema(x.rango, 34)}<b class="rk-pl">${x.pl.toLocaleString("es-AR")}</b></li>`).join("")}</ol>`}
      <p class="ayuda">Ligas: Hierro, Bronce, Plata, Oro, Platino, Esmeralda y Diamante (cada una con divisiones IV a I), Maestro y Retador: los 3 Maestros con más PL.</p>`;
  }
  async function pintarClanes() {
    const v = $('[data-com-vista="clanes"]');
    const r = await api("/api/socio?ver=clanes");
    if (!r.ok) { v.innerHTML = `<p class="ayuda">${esc(r.datos.error || "No se pudo cargar.")}</p>`; return; }
    const d = r.datos;
    if (d.mio) {
      v.innerHTML = `<div class="tarjeta clan-mio"><span class="clan-tag">${esc(d.mio.tag)}</span><h2 class="ancha">${esc(d.mio.nombre)}</h2><p class="mute">${d.mio.miembros}/10 miembros · ${d.mio.pl.toLocaleString("es-AR")} PL entre todos</p>
        <ul class="miembros">${d.miembros.map(m => `<li>${avatar(m, 38)}<span><b>${esc(m.nombre)}${m.lider ? ' <i class="rol rol-dueno">Líder</i>' : ""}</b><small style="color:${m.rango.color}">${esc(m.rango.nombre)}</small></span>${emblema(m.rango, 30)}</li>`).join("")}</ul>
        <div class="fila"><button class="btn btn-lima btn-chico" type="button" data-abrir-chat="clan">Chat del clan</button><button class="btn btn-borde btn-chico" type="button" data-clan-salir>Salir del clan</button></div></div>
        <p class="ayuda">Los PL del clan son la suma de los de todos: entrenen juntos para subir en el ranking de clanes.</p>`;
      return;
    }
    v.innerHTML = `<p class="ayuda">Unite a un clan para tener su chat y su tag de 3 letras al lado de tu nombre.</p>
      <ul class="clanes">${d.clanes.map(x => `<li><span class="ch-ico clan" aria-hidden="true">${esc(x.tag)}</span><span class="rk-nom"><b>${esc(x.nombre)}</b><small>${x.miembros}/10 · ${x.pl.toLocaleString("es-AR")} PL</small></span><button class="btn btn-borde btn-chico" type="button" data-clan-unir="${x.id}" ${x.miembros >= 10 ? "disabled" : ""}>${x.miembros >= 10 ? "Completo" : "Unirme"}</button></li>`).join("") || "<li>Todavía no hay clanes: creá el primero.</li>"}</ul>
      <div class="tarjeta">${crearClanHtml()}</div>`;
  }
  async function hojaPersonas() {
    abrirHoja(`<h2 id="hoja-tit">Mensaje privado</h2><p class="ayuda">Cargando…</p>`);
    const r = await api("/api/socio?ver=personas");
    if (!r.ok) return;
    $("[data-hoja-in]").innerHTML = `<h2 id="hoja-tit">Mensaje privado</h2><ul class="personas">${r.datos.personas.map(p => `<li><button type="button" class="persona persona-btn" data-abrir-chat="dm:${p.id}">${avatar(p, 44)}<span><b>${nombreCon(p)}</b>${p.especialidad ? `<span class="mute">${esc(p.especialidad)}</span>` : ""}</span></button></li>`).join("")}</ul>`;
  }

  // ---------- Chat abierto ----------
  let abiertoChat = null, msjs = [], tChat = 0, ultimoCreado = "";
  async function abrirChat(pedido) {
    cerrarHoja();
    abiertoChat = pedido; msjs = []; ultimoCreado = "";
    const v = $("[data-chatv]");
    $("[data-chat-tit]").textContent = "Cargando…"; $("[data-chat-sub]").textContent = ""; $("[data-chat-av]").innerHTML = "";
    $("[data-chat-log]").innerHTML = "";
    v.hidden = false; document.documentElement.classList.add("con-chat");
    await cargarChat(true);
    setTimeout(() => { if (matchMedia("(min-width: 720px)").matches) $("#chat-txt").focus(); else $("[data-chat-cerrar]").focus(); }, 50);
  }
  function cerrarChat() {
    abiertoChat = null; clearTimeout(tChat);
    $("[data-chatv]").hidden = true; document.documentElement.classList.remove("con-chat");
    if (tab === "comunidad") { revisarChats(); }
  }
  async function cargarChat(primera) {
    clearTimeout(tChat);
    const pedido = abiertoChat;
    if (!pedido) return;
    const r = await api(`/api/chat?canal=${encodeURIComponent(pedido)}${ultimoCreado ? "&desde=" + encodeURIComponent(ultimoCreado) : ""}`);
    if (abiertoChat !== pedido) return;
    if (r.status === 401) { salir(true); return; }
    if (!r.ok) { toast(r.datos.error || "No se pudo abrir el chat."); cerrarChat(); return; }
    const d = r.datos;
    if (primera) {
      $("[data-chat-tit]").textContent = d.titulo;
      const p = d.persona;
      $("[data-chat-sub]").textContent = pedido === "general" ? "Todo el gimnasio" : pedido === "clan" ? "Tu clan"
        : p ? [p.dueno && "Dueño", p.profe && "Profe", p.clan && `[${p.clan.tag}]`, p.rango && p.rango.nombre].filter(Boolean).join(" · ") || "Mensaje privado" : "Mensaje privado";
      $("[data-chat-av]").innerHTML = d.persona ? avatar(d.persona, 40) : `<span class="ch-ico ${pedido === "general" ? "general" : "clan"}" aria-hidden="true">${pedido === "general" ? "#" : esc((c.socio.clan || {}).tag || "")}</span>`;
    }
    const ids = new Set(msjs.map(m => m.id));
    d.mensajes.forEach(m => { if (!ids.has(m.id)) msjs.push(m); });
    const borr = new Set(d.borrados);
    msjs.forEach(m => { if (borr.has(m.id)) { m.borrado = true; m.texto = ""; } });
    if (msjs.length) ultimoCreado = msjs[msjs.length - 1].creado;
    const nuevos = d.mensajes.length || d.borrados.length;
    if (primera || nuevos) pintarMensajes(primera);
    vistos[claveVisto(pedido)] = ultimoCreado || new Date().toISOString(); guardar("pulso-chat-visto", vistos);
    const sil = c.socio.silenciado || (resumen && resumen.silenciado);
    $("[data-chat-silencio]").hidden = !sil;
    if (sil) $("[data-chat-silencio]").textContent = `El gimnasio te silenció en el chat hasta las ${P.hora(sil)}.`;
    $("#chat-txt").disabled = !!sil; $(".chatv-enviar").disabled = !!sil;
    tChat = setTimeout(() => cargarChat(false), document.hidden ? 15000 : 3500);
  }
  function pintarMensajes(saltar) {
    const log = $("[data-chat-log]");
    const cerca = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    let antes = null;
    log.innerHTML = msjs.map(m => {
      const yo = m.de === c.socio.id, junto = antes && antes.de === m.de && Date.parse(m.creado) - Date.parse(antes.creado) < 5 * 60e3;
      antes = m;
      if (m.borrado) return `<li class="m m-borrado${yo ? " m-yo" : ""}"><p>Mensaje borrado por el gimnasio</p></li>`;
      return `<li class="m${yo ? " m-yo" : ""}${junto ? " junto" : ""}">${!yo && !junto ? avatar(m.autor, 34) : !yo ? '<span class="av-lugar"></span>' : ""}
        <div class="m-burbuja">${!yo && !junto ? `<p class="m-autor">${nombreCon(m.autor)}</p>` : ""}<p>${esc(m.texto)}</p><time datetime="${esc(m.creado)}">${P.hora(m.creado)}</time></div></li>`;
    }).join("") || `<li class="chat-vacio">Todavía no hay mensajes. ¡Escribí el primero!</li>`;
    if (saltar || cerca) log.scrollTop = log.scrollHeight;
  }
  async function enviarChat(e) {
    e.preventDefault();
    const inp = $("#chat-txt"), txt = inp.value.trim();
    if (!txt || !abiertoChat) return;
    inp.value = "";
    msjs.push({ id: "tmp" + Date.now(), de: c.socio.id, texto: txt, creado: new Date().toISOString(), enviando: true });
    pintarMensajes(true);
    const r = await api("/api/chat", { metodo: "POST", cuerpo: { canal: abiertoChat, texto: txt } });
    msjs = msjs.filter(m => !m.enviando);
    if (!r.ok) { pintarMensajes(true); inp.value = txt; toast(r.datos.error || "No se pudo mandar."); return; }
    cargarChat(false);
  }

  // ---------- Eventos ----------
  function initEventos() {
    $("[data-form-entrar]").addEventListener("submit", entrar);
    $("[data-completar-demo]").addEventListener("click", () => { $("#e-dni").value = "35123456"; $("#e-pin").value = "1234"; $("[data-form-entrar] button[type=submit]").focus(); });
    document.addEventListener("click", async e => {
      if (e.target.closest("[data-avisos]")) { hojaAvisos(); return; }
      if (e.target.closest("[data-avisos-on]")) { activarAvisos(); return; }
      if (e.target.closest("[data-avisos-off]")) { desactivarAvisos(); return; }
      if (e.target.closest("[data-avisos-no]")) { guardar("pulso-avisos-no", GYM); pintarInicio(); return; }
      if (e.target.closest("[data-instalar]")) { instalar(); return; }
      if (e.target.closest("[data-instalar-no]")) { guardar("pulso-instalar-no", GYM); pintarInicio(); return; }
      const t = e.target.closest("[data-tab]"); if (t) { irA(t.dataset.tab); return; }
      const ti = e.target.closest("[data-tab-ir]"); if (ti) { cerrarHoja(); irA(ti.dataset.tabIr); return; }
      const d = e.target.closest("[data-dia]"); if (d) { diaVer = +d.dataset.dia; pintarEntrenar(); return; }
      const so = e.target.closest("[data-set-ok]"); if (so && !so.disabled) { tocarSerie(so); return; }
      // Quitar la última serie (si ya estaba hecha, pregunta antes: se pierden sus kilos y repes)
      const mn = e.target.closest("[data-menos-serie]"); if (mn) { const x = trabajo.ejs[+mn.dataset.menosSerie], u = x.series[x.series.length - 1]; if (x.series.length > 1 && (!u.ok || confirm(`La serie ${x.series.length} ya está hecha. ¿La quitás igual?`))) { x.series.pop(); guardarTrabajo(); pintarEntrenar(); } return; }
      const ms = e.target.closest("[data-mas-serie]"); if (ms) { const x = trabajo.ejs[+ms.dataset.masSerie], u = x.series[x.series.length - 1] || {}; if (x.series.length < 12) { x.series.push({ kg: u.kg != null ? u.kg : null, r: x.obj, ok: false }); guardarTrabajo(); pintarEntrenar(); } return; }
      const ed = e.target.closest("[data-editar]"); if (ed) { hojaEditar(+ed.dataset.editar); return; }
      const pe = e.target.closest("[data-paso]"); if (pe) { pasoEditar(pe); return; }
      const qe = e.target.closest("[data-quitar-ej]"); if (qe) { const x = trabajo.ejs[+qe.dataset.quitarEj]; if (confirm(`¿Quitar ${ej(x.id).nombre} de hoy?`)) { trabajo.ejs.splice(+qe.dataset.quitarEj, 1); guardarTrabajo(); cerrarHoja(); pintarEntrenar(); pintarInicio(); } return; }
      if (e.target.closest("[data-sumar-ej]")) { hojaSumar(); setTimeout(() => { const q = $("[data-cat-q]"); if (q && matchMedia("(min-width: 720px)").matches) q.focus(); }, 80); return; }
      const sm = e.target.closest("[data-sumar]"); if (sm) { const id = sm.dataset.sumar; trabajo.ejs.push(nuevoEj(id, { ...porDefecto(ej(id)), extra: true })); guardarTrabajo(); cerrarHoja(); pintarEntrenar(); pintarInicio(); toast(`Sumaste ${ej(id).nombre}.`); setTimeout(() => { const li = $(`[data-ej-i="${trabajo.ejs.length - 1}"]`); if (li) li.scrollIntoView({ block: "center", behavior: "smooth" }); }, 300); return; }
      const co = e.target.closest("[data-como]"); if (co) { hojaComo(co.dataset.como); return; }
      // El video de YouTube se carga recién al tocar la foto (así abrir "Cómo se hace" no baja medio mega)
      const vi = e.target.closest("[data-video]"); if (vi) { const v = document.createElement("div"); v.className = "video"; v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vi.dataset.video)}?rel=0&amp;modestbranding=1&amp;playsinline=1&amp;autoplay=1" title="${esc(vi.dataset.videoTit)}" allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`; vi.replaceWith(v); v.firstChild.focus(); return; }
      const hd = e.target.closest("[data-hacer-dia]"); if (hd) { trabajo = armarDia(+hd.dataset.hacerDia); diaVer = trabajo.dia; guardarTrabajo(); pintarEntrenar(); pintarInicio(); toast(`Listo: hoy hacés ${c.plan.dias[trabajo.dia].nombre}.`); return; }
      if (e.target.closest("[data-terminar]")) { terminarDia(); return; }
      if (e.target.closest("[data-ir-clanes]")) { comVista = "clanes"; irA("comunidad"); return; }
      const dm = e.target.closest("[data-d-mas]"); if (dm) { finDesc = Math.max(Date.now() + 1000, finDesc + +dm.dataset.dMas * 1000); totalDesc = Math.max(totalDesc, Math.ceil((finDesc - Date.now()) / 1000)); clearTimeout(tDesc); tic(); return; }
      if (e.target.closest("[data-d-saltar]")) { finDescanso(false); return; }
      if (e.target.closest("[data-ver-clases]")) { clasesDia = -1; hojaClases(); return; }
      const cd = e.target.closest("[data-cl-dia]"); if (cd) { clasesDia = +cd.dataset.clDia; pintarClases(); return; }
      const rs = e.target.closest("[data-reservar]"); if (rs) { rs.disabled = true; const [f, h] = rs.dataset.reservar.split("|"); await reservar(f, h, rs.dataset.espera === "1"); return; }
      const cc = e.target.closest("[data-cancelar-clase]"); if (cc) { cc.disabled = true; await cancelarClase(+cc.dataset.cancelarClase); cc.disabled = false; return; }
      if (e.target.closest("[data-pagar-cuota]")) { hojaPagar(); return; }
      const pm = e.target.closest("[data-pagar-meses]"); if (pm) { pm.disabled = true; const r = await accion({ accion: "pagar-cuota", meses: +pm.dataset.pagarMeses }); if (r && r.link) location.href = r.link; else pm.disabled = false; return; }
      if (e.target.closest("[data-ver-profes]")) { hojaProfes(); return; }
      const ct = e.target.closest("[data-contratar]"); if (ct) { ct.disabled = true; const r = await accion({ accion: "profe", id: +ct.dataset.contratar }); if (r && r.link) location.href = r.link; else ct.disabled = false; return; }
      const ac = e.target.closest("[data-abrir-chat]"); if (ac) { abrirChat(ac.dataset.abrirChat); return; }
      const cm = e.target.closest("[data-com]"); if (cm) { comVista = cm.dataset.com; pintarComunidad(); return; }
      const rk = e.target.closest("[data-rk]"); if (rk) { pintarRanking(rk.dataset.rk === "clanes"); return; }
      if (e.target.closest("[data-nuevo-privado]")) { hojaPersonas(); return; }
      const cu = e.target.closest("[data-clan-unir]"); if (cu) { const r = await accion({ accion: "clan-unir", id: +cu.dataset.clanUnir }, "¡Listo! Ya sos parte del clan."); if (r) { pintarClanes(); revisarChats(); } return; }
      if (e.target.closest("[data-clan-salir]")) { if (confirm("¿Salir del clan?")) { const r = await accion({ accion: "clan-salir" }, "Saliste del clan."); if (r) { pintarClanes(); revisarChats(); } } return; }
      if (e.target.closest("[data-quitar-foto]")) { await accion({ accion: "perfil", apodo: c.socio.apodo, mostrarRango: c.socio.mostrarRango, mostrarTag: c.socio.mostrarTag, foto: "" }, "Foto quitada."); return; }
      if (e.target.closest("[data-salir]")) { salir(); return; }
      if (e.target.closest("[data-hoja-cerrar]") || e.target.matches("[data-velo]")) { cerrarHoja(); return; }
      if (e.target.closest("[data-chat-cerrar]")) { cerrarChat(); return; }
    });
    document.addEventListener("change", async e => {
      if (e.target.matches("[data-objetivo]")) {
        const o = e.target.value;
        if (await accion({ accion: "objetivo", objetivo: o }, "Listo: tu plan y tus metas cambiaron.")) { try { localStorage.removeItem(claveTrabajo()); } catch (_) { /* nada */ } trabajo = null; diaVer = null; pintar(); }
        return;
      }
      if (e.target.matches("[data-foto]")) {
        const a = e.target.files && e.target.files[0];
        if (!a) return;
        try { const nueva = await P.achicarFoto(a); await accion({ accion: "perfil", apodo: c.socio.apodo, mostrarRango: c.socio.mostrarRango, mostrarTag: c.socio.mostrarTag, foto: nueva }, "¡Foto nueva!"); }
        catch (err) { toast(err.message); }
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.matches("[data-set-kg], [data-set-r]")) { e.preventDefault(); e.target.blur(); }
      if (e.key === "Escape") { if (!$("[data-hoja]").hidden) cerrarHoja(); else if (abiertoChat) cerrarChat(); }
    });
    document.addEventListener("submit", async e => {
      const f = e.target;
      if (f.matches("[data-form-peso]")) { e.preventDefault(); const v = $("#p-peso").value.replace(",", "."); if (await accion({ accion: "peso", kg: v }, "Peso anotado.")) $("#p-peso").value = ""; }
      if (f.matches("[data-form-perfil]")) { e.preventDefault(); await accion({ accion: "perfil", apodo: f.apodo.value, mostrarRango: f.mostrarRango.checked, mostrarTag: f.mostrarTag.checked }, "Perfil guardado."); }
      if (f.matches("[data-form-pin]")) { e.preventDefault(); if (await accion({ accion: "pin", actual: f.actual.value, nuevo: f.nuevo.value }, "PIN cambiado: usalo en la app y en la tablet.")) f.reset(); }
      if (f.matches("[data-form-clan]")) { e.preventDefault(); const r = await accion({ accion: "clan-crear", nombre: f.nombre.value, tag: f.tag.value }, "¡Clan creado! Invitá a los demás."); if (r) { pintarClanes(); revisarChats(); } }
    });
    $("[data-chat-form]").addEventListener("submit", enviarChat);
    document.addEventListener("input", e => {
      if (e.target.matches(".tag-input")) e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (e.target.matches("[data-set-kg], [data-set-r]")) escribirSerie(e.target);
      if (e.target.matches("[data-cat-q]")) hojaSumar(e.target.value);
    });
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden || !ses) return;
      const r = await api("/api/socio"); if (r.ok) { c = r.datos; pintar(); }
      revisarChats(); if (abiertoChat) cargarChat(false);
    });
    setInterval(() => { if (ses && !document.hidden) revisarChats(); }, 20000);
  }

  async function boot() {
    initEventos();
    if (!ses) { mostrarEntrar(); return; }
    const r = await api("/api/socio");
    if (!r.ok) { if (r.status === 401) { ses = null; guardar("pulso-sesion", null); } mostrarEntrar(); if (r.status !== 401) toast(r.datos.error || "No pudimos cargar tu cuenta."); return; }
    c = r.datos; arrancar();
    const ch = P.params.get("chat"); if (ch) abrirChat(ch);
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
