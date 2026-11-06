// Panel del personal de PULSO (aparte de la web de inscripción): lo de hoy (quién entró y salió por la tablet, cuotas vencidas
// de la última semana que se pueden sacar de la lista, recordatorios que también le llegan a la app del socio,
// clases de hoy con quién reservó y quién vino, socios para recuperar y cuotas por vencer con su WhatsApp listo, números),
// socios (cobrar en efectivo, transferencia o con QR, pausar la cuota, roles dueño/profe, profe personal, PL, silenciar, PIN),
// cobros del mes, comunidad (moderar chats, clanes y ranking) y ajustes (precios, links de la app y la tablet).
// Demo: es el gimnasio de prueba de esta visita (el mismo código que usan la app y la tablet en este navegador).
(function () {
  "use strict";
  const P = window.Pulso;
  const { $, $$, esc, plata, fecha, cuando, toast, avatar, emblema, nombreCon } = P;
  const GYM = P.gym();
  let est = null, tab = "hoy", filtro = "todos", busca = "", tPoll = 0, conocidosIng = null, conocidasSal = null, detalle = null, tCobro = 0, entreno = null;
  const DESC = { 1: 0, 3: .10, 6: .15 }, PER = { 1: "1 mes", 3: "3 meses", 6: "6 meses" };
  const cuota = (plan, m) => Math.round(est.gym.precios[plan] * (1 - DESC[m]) / 100) * 100 * m;
  const porId = id => est.socios.find(s => s.id === +id);
  const tel = t => { let d = String(t || "").replace(/\D/g, ""); if (d.startsWith("0")) d = d.slice(1); return d.startsWith("54") ? d : d.length === 10 ? "549" + d : d; };

  async function cargar() {
    clearTimeout(tPoll);
    const r = await P.api("/api/panel?gym=" + GYM);
    if (r.ok) aplicar(r.datos); else if (r.status) toast(r.datos.error || "No pudimos actualizar el panel.");
    tPoll = setTimeout(cargar, document.hidden ? 20000 : 5000);
  }
  async function hacer(cuerpo, okTxt) {
    const r = await P.api("/api/panel", { metodo: "POST", cuerpo: { gym: GYM, ...cuerpo }, cabeceras: { "X-Panel": "1" } });
    if (!r.ok) { toast(r.datos.error || "No se pudo. Probá de nuevo."); return null; }
    aplicar(r.datos.estado);
    if (okTxt) toast(okTxt);
    return r.datos;
  }
  function aplicar(d) {
    // Quién entró por la tablet mientras el panel está abierto: aviso arriba
    const ids = new Set(d.ingresosHoy.map(i => i.id)), sal = new Set(d.ingresosHoy.filter(i => i.salida).map(i => i.id));
    if (conocidosIng) {
      const nuevo = d.ingresosHoy.find(i => !conocidosIng.has(i.id)), sale = d.ingresosHoy.find(i => i.salida && !conocidasSal.has(i.id));
      if (nuevo || sale) {
        const av = $("[data-aviso-ingreso]");
        av.className = "aviso-ingreso" + (nuevo && !nuevo.ok ? " mal" : !nuevo ? " sale" : "");
        av.textContent = nuevo ? (nuevo.ok ? `Entró ${nuevo.nombre} (${nuevo.hora})` : `${nuevo.nombre} quiso entrar con la cuota vencida`) : `Salió ${sale.nombre} (${sale.salida})`;
        av.hidden = false; av.classList.remove("on"); void av.offsetWidth; av.classList.add("on");
        setTimeout(() => { av.hidden = true; }, 5000);
      }
    }
    conocidosIng = ids; conocidasSal = sal;
    est = d;
    $("[data-cargando]").hidden = true;
    const venc = d.resumen.vencidas, b = $("[data-badge-vencidas]");
    b.textContent = venc; b.hidden = !venc;
    pintar();
  }
  function pintar() {
    if (!est) return;
    // No le borro lo que está escribiendo
    const v = $(`[data-vista="${tab}"]`);
    if (v.contains(document.activeElement) && document.activeElement.matches("input, select, textarea")) { if (tab === "hoy") pintarHoy(); return; }
    ({ hoy: pintarHoy, socios: pintarSocios, cobros: pintarCobros, comunidad: pintarComunidad, ajustes: pintarAjustes })[tab]();
    const hoja = $("[data-hoja-in]"), foco = document.activeElement;
    if (detalle && !$("[data-hoja]").hidden && $("[data-detalle]", hoja) && !(hoja.contains(foco) && foco.matches("input, select, textarea"))) pintarDetalle();
  }
  function irA(t, sinHistorial) {
    if (!sinHistorial && t !== tab) history.pushState({ tab: t }, "", "#" + t);   // "atrás" vuelve a la pestaña anterior
    tab = t;
    $$("[data-vista]").forEach(s => { s.hidden = s.dataset.vista !== t; });
    $$("[data-tab]").forEach(b => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    scrollTo({ top: 0 });
    pintar();
  }

  // ---------- Hoy ----------
  function barras(datos, etiqueta, valor, fmt) {
    const max = Math.max(1, ...datos.map(valor)), W = 320, H = 150, n = datos.length, a = (W - 20) / n;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(datos.map(x => etiqueta(x) + ": " + fmt(valor(x))).join(", "))}">
      ${datos.map((x, i) => { const h = Math.max(2, valor(x) / max * (H - 42)); return `<rect x="${10 + i * a + a * .18}" y="${H - 22 - h}" width="${a * .64}" height="${h}" rx="4" class="${i === n - 1 ? "b-ultima" : "b"}"/>
        <text x="${10 + i * a + a / 2}" y="${H - 6}" text-anchor="middle">${esc(etiqueta(x))}</text>${valor(x) ? `<text x="${10 + i * a + a / 2}" y="${H - 28 - h}" text-anchor="middle" class="valor">${esc(fmt(valor(x)))}</text>` : ""}`; }).join("")}</svg>`;
  }
  // WhatsApp con el mensaje ya escrito (lo manda el personal desde su celular o WhatsApp Web)
  const wa = (s, txt) => `https://wa.me/${tel(s.tel)}?text=${encodeURIComponent(txt)}`;
  const primero = s => (s.apodo || s.nombre.split(" ")[0]);
  const MSJ = {
    vencida: s => `¡Hola ${primero(s)}! Te escribimos de PULSO: tu cuota venció el ${fecha(s.vence)}. La podés pagar desde la app o en recepción. ¡Te esperamos!`,
    vence: s => `¡Hola ${primero(s)}! Te recordamos que tu cuota de PULSO vence el ${fecha(s.vence)}. La podés pagar desde la app (o en recepción) y seguís sumando PL 💪`,
    volver: s => `¡Hola ${primero(s)}! ¿Cómo andás? Te extrañamos en PULSO 💪 Hace ${s.sinVenir} días que no te vemos. Si querés, te armamos un plan para volver de a poco. ¡Te esperamos!`,
  };
  const abiertos = () => new Set($$("[data-vista] details[open][data-k]").map(d => d.dataset.k));
  function clasesHoyHtml(abierto) {
    if (!est.clasesHoy.length) return '<li class="vacio">Hoy no hay clases.</li>';
    return est.clasesHoy.map(c => {
      const lleno = c.ocupados >= c.cupo, resto = c.deEjemplo - c.ejemplo.length;
      const reales = c.reservas.map(x => `<li><b>${esc(x.nombre)}</b> ${x.vino ? '<span class="lima">✓ vino</span>' : c.termino ? '<span class="rojo">no vino</span>' : '<span class="mute">reservó en la app</span>'}</li>`).join("");
      return `<li class="${c.termino ? "cl-pasada" : ""}"><span class="hora">${esc(c.hora)}</span><span><b>${esc(c.clase)} · ${esc(c.profe)}</b>
        <small><span class="${lleno ? "naranja" : ""}">${c.ocupados}/${c.cupo} lugares</span>${c.espera.length ? ` · ${c.espera.length} en espera` : ""}${c.termino ? " · terminó" : c.empezo ? " · en curso" : ""}</small>
        </span><details data-k="cl-${esc(c.hora)}"${abierto.has("cl-" + c.hora) ? " open" : ""}><summary>Quiénes</summary><ul class="quienes">${reales}${c.ejemplo.map(n => `<li>${esc(n)} <span class="mute">(ejemplo)</span></li>`).join("")}${resto > 0 ? `<li class="mute">y ${resto} más</li>` : ""}${c.espera.length ? `<li class="mute">En espera: ${c.espera.map(esc).join(", ")}</li>` : ""}</ul></details></li>`;
    }).join("");
  }
  function pintarHoy() {
    const r = est.resumen, porV = est.socios.filter(s => s.activo && s.cuota.estado === "por-vencer");
    // Vencidas: en "Hoy", las de los últimos días (las más viejas o las que se sacaron de la lista, en Socios > Vencidas)
    const venc = est.socios.filter(s => s.activo && s.cuota.estado === "vencida" && s.diasVencida <= est.vencidasDias && !s.vencidaOculta).sort((a, b) => a.diasVencida - b.diasVencida);
    const avisado = (s, tipo) => s.avisadoHoy.includes(tipo) ? ` · <span class="lima">avisado hoy</span>` : "";
    const recup = est.recuperar.map(porId).filter(Boolean), ab = abiertos();
    const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const horas = Array.from({ length: 16 }, (_, i) => i + 7).map(h => ({ h, n: r.porHora[h] || 0 }));
    $('[data-vista="hoy"]').innerHTML = `
      <div class="v-head"><h1 class="v-tit">Hoy <span>${fecha(est.hoy, true)}</span></h1><button class="btn btn-borde btn-chico" type="button" data-simular-ingreso>Simular un ingreso</button></div>
      <div class="kpis">
        <article class="kpi"><p>Socios al día</p><b>${r.activos}</b><small>${r.porVencer} vencen esta semana${r.pausadas ? ` · ${r.pausadas} en pausa` : ""}</small></article>
        <article class="kpi kpi-alerta"><p>Cuotas vencidas</p><b>${r.vencidas}</b><small>esta semana${r.vencidasTodas > r.vencidas ? ` · ${r.vencidasTodas} en total` : " · no pueden entrar"}</small></article>
        <article class="kpi"><p>Cobrado este mes</p><b>${plata(r.cobradoMes)}</b><small>${r.cobrosMes} cobros</small></article>
        <article class="kpi"><p>Entraron hoy</p><b>${r.ingresosHoy}</b><small>${r.adentro} adentro ahora${r.rebotadosHoy ? ` · ${r.rebotadosHoy} rebotados` : ""}</small></article>
      </div>
      <div class="dos">
        <article class="caja"><h2 class="c-tit">Entraron hoy <small>(en vivo, desde la tablet: entrada y salida)</small></h2>
          <ul class="lista">${est.ingresosHoy.slice(0, 12).map(i => { const s = porId(i.socio); return `<li>${avatar(s ? { ...s, nombre: s.nombre } : null, 36)}<span><b>${esc(i.nombre)}</b><small>${!i.ok ? (i.motivo === "vencida" ? "No entró: cuota vencida" : "No entró") : i.salida ? `Entró ${esc(i.hora)} · salió ${esc(i.salida)}` : i.adentro ? `Adentro desde las ${esc(i.hora)}` : `Entró ${esc(i.hora)} · no marcó la salida`}</small></span>${i.ok && i.adentro ? '<span class="estado e-al-dia">Adentro</span>' : `<span class="hora ${i.ok ? "" : "mal"}">${esc(i.salida || i.hora)}</span>`}</li>`; }).join("") || '<li class="vacio">Todavía no entró nadie hoy. Probá la <a class="link" href="/tablet/" target="_blank" rel="noopener">tablet</a>.</li>'}</ul></article>
        <article class="caja"><h2 class="c-tit">Cuotas vencidas <small>(${venc.length} de los últimos ${est.vencidasDias} días)</small></h2>
          <ul class="lista">${venc.map(s => `<li>${avatar(s, 36)}<span><b>${esc(s.nombre)}</b><small>Venció el ${fecha(s.vence)} · hace ${s.diasVencida} día${s.diasVencida === 1 ? "" : "s"}${avisado(s, "vencida")}</small></span>
            <span class="acc"><button class="btn btn-lima btn-chico" type="button" data-ver="${s.id}">Cobrar</button><a class="btn btn-borde btn-chico" target="_blank" rel="noopener" href="${wa(s, MSJ.vencida(s))}" data-recordar="vencida" data-socio="${s.id}" aria-label="Recordarle a ${esc(s.nombre)} que pague (le llega a la app y por WhatsApp)">Recordar</a><button class="quitar" type="button" data-ocultar-vencida="${s.id}" aria-label="Sacar a ${esc(s.nombre)} de esta lista" title="Sacar de la lista">✕</button></span></li>`).join("") || '<li class="vacio">No hay cuotas vencidas esta semana. 🎉</li>'}
          ${r.vencidasTodas > venc.length ? `<li class="sep"><button class="link" type="button" data-filtro-ir="vencidas">Ver las ${r.vencidasTodas} vencidas (con las de hace más de ${est.vencidasDias} días y las que sacaste)</button></li>` : ""}
          ${porV.length ? `<li class="sep">Vencen esta semana: avisales antes y renuevan sin cortar</li>${porV.map(s => `<li>${avatar(s, 36)}<span><b>${esc(s.nombre)}</b><small>Vence el ${fecha(s.vence)} · plan ${esc(s.plan)}${avisado(s, "vence")}</small></span>
            <span class="acc"><a class="btn btn-borde btn-chico" target="_blank" rel="noopener" href="${wa(s, MSJ.vence(s))}" data-recordar="vence" data-socio="${s.id}" aria-label="Recordarle a ${esc(s.nombre)} que vence la cuota (le llega a la app y por WhatsApp)">Recordar</a></span></li>`).join("")}` : ""}</ul>
          <p class="ayuda">"Recordar" le manda el aviso a la app (y al celular, si activó las notificaciones) y abre el WhatsApp con el mensaje escrito.</p></article>
      </div>
      <div class="dos">
        <article class="caja"><h2 class="c-tit">Clases de hoy <small>(reservas desde la app)</small></h2><ul class="lista clases-hoy">${clasesHoyHtml(ab)}</ul></article>
        <article class="caja"><h2 class="c-tit">Para recuperar <small>(${recup.length}: hace ${est.sinVenirDias} días o más que no vienen)</small></h2>
          <ul class="lista">${recup.slice(0, 8).map(s => `<li>${avatar(s, 36)}<span><b>${esc(s.nombre)}</b><small>Hace ${s.sinVenir} días que no viene · plan ${esc(s.plan)}${avisado(s, "volver")}</small></span>
            <span class="acc"><a class="btn btn-borde btn-chico" target="_blank" rel="noopener" href="${wa(s, MSJ.volver(s))}" data-recordar="volver" data-socio="${s.id}" aria-label="Escribirle a ${esc(s.nombre)} (le llega a la app y por WhatsApp)">Escribirle</a></span></li>`).join("") || '<li class="vacio">Todos vienen seguido. 💪</li>'}
            ${recup.length > 8 ? `<li class="sep"><button class="link" type="button" data-filtro-ir="recuperar">Ver los ${recup.length}</button></li>` : ""}</ul>
          <p class="ayuda">Un mensaje en la primera semana sin venir es lo que más ayuda a que no dejen.</p></article>
      </div>
      <div class="dos">
        <article class="caja"><h2 class="c-tit">Cobrado por mes <small>(el último va en curso)</small></h2><div class="grafico">${barras(r.porMes, x => MES[+x.mes.slice(5) - 1], x => x.total, v => v >= 1e6 ? "$ " + (v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M" : "$ " + Math.round(v / 1000) + " mil")}</div></article>
        <article class="caja"><h2 class="c-tit">Horarios más llenos <small>(últimos 14 días)</small></h2><div class="grafico">${barras(horas, x => x.h, x => x.n, v => String(v))}</div></article>
      </div>`;
  }

  // ---------- Socios ----------
  const CUOTA_TXT = { "al-dia": "Al día", "por-vencer": "Por vencer", vencida: "Vencida", pendiente: "Sin pagar", pausada: "En pausa" };
  function pintarSocios() {
    const q = busca.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const lista = est.socios.filter(s => {
      if (filtro === "vencidas" && !(s.activo && s.cuota.estado === "vencida")) return false;
      if (filtro === "por-vencer" && s.cuota.estado !== "por-vencer") return false;
      if (filtro === "personal" && !(s.dueno || s.profe)) return false;
      if (filtro === "silenciados" && !s.silenciado) return false;
      if (filtro === "pausadas" && s.cuota.estado !== "pausada") return false;
      if (filtro === "recuperar" && !est.recuperar.includes(s.id)) return false;
      if (filtro !== "bajas" && !s.activo && s.cuota.estado !== "pendiente") return false;
      if (filtro === "bajas" && s.activo) return false;
      if (!q) return true;
      return (s.nombre + " " + s.apodo + " " + s.dni + " " + (s.clan ? s.clan.tag : "")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q);
    }).sort((a, b) => (b.dueno - a.dueno) || (b.profe - a.profe) || a.nombre.localeCompare(b.nombre));
    const v = $('[data-vista="socios"]');
    const enfocado = document.activeElement && document.activeElement.matches("[data-buscar]");
    v.innerHTML = `
      <div class="v-head"><h1 class="v-tit">Socios <span>${est.socios.filter(s => s.activo).length}</span></h1><button class="btn btn-lima btn-chico" type="button" data-alta>+ Nuevo socio</button></div>
      <div class="buscar"><label class="sr-only" for="buscar">Buscar por nombre, DNI o clan</label><input id="buscar" class="entrada" data-buscar placeholder="Buscar por nombre, DNI o clan" value="${esc(busca)}"></div>
      <div class="filtros" role="group" aria-label="Filtrar">${[["todos", "Todos"], ["vencidas", "Vencidas"], ["por-vencer", "Por vencer"], ["recuperar", "Para recuperar"], ["pausadas", "En pausa"], ["personal", "Dueños y profes"], ["silenciados", "Silenciados"], ["bajas", "Bajas"]].map(([k, t]) => `<button type="button" data-filtro="${k}" aria-pressed="${filtro === k}">${t}</button>`).join("")}</div>
      <ul class="socios">${lista.map(s => `<li><button type="button" class="socio" data-ver="${s.id}">
        ${avatar(s, 44)}<span class="s-txt"><b>${s.clan ? `<span class="tag-clan">[${esc(s.clan.tag)}]</span> ` : ""}${esc(s.nombre)}</b><small>${[s.dueno && "Dueño", s.profe && "Profe"].filter(Boolean).map(r => `<span class="lima">${r}</span> · `).join("")}${esc(s.plan)} · ${esc(s.objetivoNombre)}${s.profeNombre ? " · profe " + esc(s.profeNombre.split(" ")[0]) : ""}${s.profe && s.alumnos ? ` · ${s.alumnos} alumno${s.alumnos === 1 ? "" : "s"}` : ""}</small></span>
        <span class="s-der">${emblema(s.rango, 30)}<span class="estado e-${s.cuota.estado}">${CUOTA_TXT[s.cuota.estado]}${s.cuota.estado !== "pendiente" && s.vence ? " · " + fecha(s.vence) : ""}</span>${s.bloqueado ? '<span class="estado e-vencida">PIN frenado</span>' : ""}</span></button></li>`).join("") || '<li class="vacio">No hay socios con ese filtro.</li>'}</ul>`;
    if (enfocado) { const i = $("[data-buscar]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  // ---------- Hoja ----------
  function abrirHoja(html) {
    $("[data-hoja-in]").innerHTML = html;
    const h = $("[data-hoja]"), v = $("[data-velo]");
    h.hidden = false; v.hidden = false;
    requestAnimationFrame(() => { h.classList.add("on"); v.classList.add("on"); });
    setTimeout(() => { const b = $("[data-hoja-cerrar]"); if (b) b.focus({ preventScroll: true }); }, 60);
  }
  function cerrarHoja() {
    clearTimeout(tCobro); detalle = null;
    const h = $("[data-hoja]"), v = $("[data-velo]");
    if (h.hidden) return;
    h.classList.remove("on"); v.classList.remove("on");
    setTimeout(() => { h.hidden = true; v.hidden = true; }, 250);
  }

  // Cómo entrena (para el profe): se pide al abrir la sección y queda guardado mientras la ficha está abierta
  const kgN = n => (Math.round(n * 10) / 10).toLocaleString("es-AR"), kg = n => kgN(n) + " kg";
  async function cargarEntreno() {
    const id = detalle;
    if (!id || (entreno && entreno.id === id)) return;
    entreno = { id, d: null };
    const r = await P.api(`/api/panel?gym=${GYM}&entrenos=${id}`);
    if (detalle !== id) return;
    entreno = { id, d: r.ok ? r.datos : { error: (r.datos && r.datos.error) || "No se pudieron traer sus días. Cerrá la ficha y abrila de nuevo." } };
    const caja = $("[data-entreno]"); if (caja) caja.innerHTML = entrenoHtml(new Set($$("[data-hoja-in] details[open]").map(d => d.dataset.sec)));
  }
  function entrenoHtml(ab) {
    const d = entreno && entreno.id === detalle ? entreno.d : null;
    if (!d) return '<p class="mute">Trayendo sus días…</p>';
    if (d.error) return `<p class="aviso-mal">${esc(d.error)}</p>`;
    const series = e => e.series.map(y => y.kg && y.r ? `${kgN(y.kg)}×${y.r}` : y.r ? `${y.r}` : "✓").join(" · ");
    return `<p>En los últimos 30 días vino <b>${d.vino30}</b> ${d.vino30 === 1 ? "vez" : "veces"} y terminó <b>${d.dias30}</b> ${d.dias30 === 1 ? "día" : "días"} de entrenamiento en la app.</p>
      ${d.progreso.length ? `<p class="d-sub">Progreso en kilos <small>(con cuánto empezó → su mejor marca)</small></p>
      <ul class="d-prog">${d.progreso.map(x => `<li><span>${esc(x.nombre)}</span><span class="d-kg">${kg(x.primero)} → <b>${kg(x.mejor)}</b>${x.mejor > x.primero ? ` <span class="lima">+${kgN(x.mejor - x.primero)}</span>` : ""}<small>${x.veces} ${x.veces === 1 ? "vez" : "veces"} · mejor el ${fecha(x.fechaMejor)}</small></span></li>`).join("")}</ul>` : ""}
      <p class="d-sub">Últimos días</p>
      ${d.dias.length ? `<ul class="d-dias">${d.dias.map(x => { const r = x.resumen || {}, rec = (r.records || []).length; return `<li><details data-sec="dia-${esc(x.fecha)}"${ab.has("dia-" + x.fecha) ? " open" : ""}><summary><span><b>${esc(x.nombre)}</b><small>${fecha(x.fecha)} · ${r.hechos || x.ejs.length} ejercicios · ${r.repes || 0} repes${r.volumen ? ` · ${r.volumen.toLocaleString("es-AR")} kg` : ""}${rec ? ` · ${rec === 1 ? "1 récord" : rec + " récords"}` : ""}</small></span><b class="lima">+${x.pl} PL</b></summary>
        <ul class="d-ejs">${x.ejs.map(e => `<li><span>${esc(e.nombre)}</span><small>${series(e)}${e.obj && e.series.some(y => (y.r || 0) < e.obj) ? ' <i class="ambar">(menos repes)</i>' : ""}</small></li>`).join("")}</ul></details></li>`; }).join("")}</ul>`
        : '<p class="mute">Todavía no terminó ningún día en la app.</p>'}
      <p class="ayuda">Lo anota el socio en la app, serie por serie: kilos × repeticiones. Sirve para ver si sube de peso, si llega a las repes y si viene seguido.</p>`;
  }

  // Detalle de un socio: todo lo que el personal puede hacer
  function verSocio(id) { detalle = +id; entreno = null; abrirHoja('<div data-detalle></div>'); pintarDetalle(); }
  function pintarDetalle() {
    const s = porId(detalle);
    if (!s) { cerrarHoja(); return; }
    const profes = est.socios.filter(p => p.profe && p.id !== s.id);
    const abiertos = new Set($$("[data-hoja-in] details[open]").map(d => d.dataset.sec));
    const sec = (id, tit, html, abierto) => `<details class="sec" data-sec="${id}"${abierto || abiertos.has(id) ? " open" : ""}><summary>${tit}</summary><div class="sec-in">${html}</div></details>`;
    $("[data-detalle]").innerHTML = `
      <div class="d-cab">${avatar(s, 64)}<div><h2 id="hoja-tit">${esc(s.nombre)}</h2><p class="mute">${nombreCon({ ...s, nombre: s.apodo || s.nombre.split(" ")[0] })}</p>
        <p class="mute">DNI ${esc(s.dni)} · ${s.tel ? `<a class="link" target="_blank" rel="noopener" href="https://wa.me/${tel(s.tel)}">${esc(s.tel)}</a>` : "sin WhatsApp"}</p></div></div>
      <div class="d-cuota e-${s.cuota.estado}"><b>${CUOTA_TXT[s.cuota.estado]}</b><span>${s.cuota.estado === "pendiente" ? "La inscripción todavía no está paga" : `${s.cuota.estado === "pausada" ? `${esc(s.cuota.motivo || "Pausa")} hasta el ${fecha(s.cuota.hasta)} · ` : ""}Plan ${esc(s.plan)} · vence el ${fecha(s.vence)}${s.cuota.dias != null && s.cuota.dias >= 0 ? ` (en ${s.cuota.dias} días)` : ""}`}</span></div>
      ${sec("cobrar", "Cobrar la cuota", `<div class="seg" role="radiogroup" aria-label="Meses">${[1, 3, 6].map(m => `<label><input type="radio" name="meses" value="${m}" ${m === 1 ? "checked" : ""}><span>${PER[m]}</span></label>`).join("")}</div>
        <p class="d-monto" data-monto>${plata(cuota(s.plan, 1))}</p>
        <div class="fila"><button class="btn btn-lima btn-chico" type="button" data-cobrar="Efectivo">Efectivo</button><button class="btn btn-borde btn-chico" type="button" data-cobrar="Transferencia">Transferencia</button><button class="btn btn-borde btn-chico" type="button" data-cobrar-qr>QR (paga con el celu)</button></div>
        <p class="ayuda">La cuota se corre desde que vence (o desde hoy si ya venció).</p>`, s.cuota.estado === "vencida" || s.cuota.estado === "por-vencer")}
      ${sec("pausa", s.cuota.estado === "pausada" ? "Pausa de la cuota · activa" : "Pausar la cuota (vacaciones o lesión)", s.cuota.estado === "pausada"
        ? `<p>Pausada por <b>${esc((s.cuota.motivo || "otro motivo").toLowerCase())}</b> hasta el ${fecha(s.cuota.hasta)}. Si vuelve antes, al entrar por la tablet la pausa termina sola.</p><button class="btn btn-borde btn-chico" type="button" data-pausa-quitar>Quitar la pausa ahora</button><p class="ayuda">Al quitarla se le sacan al vencimiento los días que no usó.</p>`
        : ["al-dia", "por-vencer"].includes(s.cuota.estado)
          ? `<div class="dos-c"><div class="campo"><label for="d-pdias">Días</label><select id="d-pdias" data-pausa-dias><option value="7">7 días</option><option value="15" selected>15 días</option><option value="30">30 días</option></select></div>
            <div class="campo"><label for="d-pmot">Motivo</label><select id="d-pmot" data-pausa-motivo><option>Vacaciones</option><option>Lesión</option><option>Viaje</option><option>Otro</option></select></div></div>
            <button class="btn btn-borde btn-chico" type="button" data-pausar>Pausar la cuota</button><p class="ayuda">El vencimiento se corre esos días: no pierde lo que pagó. Mejor una pausa que una baja.</p>`
          : `<p class="mute">Para pausarla, la cuota tiene que estar al día.</p>`)}
      ${sec("rango", `Rango · ${esc(s.rango.nombre)} · ${s.pl.toLocaleString("es-AR")} PL`, `<div class="d-rango">${emblema(s.rango, 64)}<div><b style="color:${s.rango.color}">${esc(s.rango.nombre)}</b><p class="mute">${s.pl.toLocaleString("es-AR")} PL${s.rango.falta != null ? ` · le faltan ${s.rango.falta} para ${esc(s.rango.siguiente)}` : ""}</p></div></div>
        <div class="fila d-pl"><label class="sr-only" for="d-pl">PL para sumar o restar</label><input class="entrada" id="d-pl" inputmode="numeric" placeholder="Ej.: 50 o -20" data-pl-valor><input class="entrada" placeholder="Motivo (opcional)" maxlength="60" data-pl-motivo aria-label="Motivo"><button class="btn btn-borde btn-chico" type="button" data-pl-ajustar>Aplicar</button></div>
        <p class="ayuda">Los PL se ganan solos entrenando (ejercicios, metas, récords y venir). Acá podés premiar o corregir.</p>`)}
      ${s.dueno ? "" : sec("entreno", "Entrenamiento · días, kilos y repes", `<div data-entreno>${entrenoHtml(abiertos)}</div>`)}
      ${sec("avisos", `Avisos a la app${s.pushActivo ? " · notificaciones activadas" : ""}`, `<div class="fila"><button class="btn btn-borde btn-chico" type="button" data-recordar="${s.cuota.estado === "vencida" ? "vencida" : "vence"}" data-socio="${s.id}">Recordarle la cuota</button><button class="btn btn-borde btn-chico" type="button" data-recordar="volver" data-socio="${s.id}">"Te extrañamos"</button></div>
        <p class="ayuda">${s.pushActivo ? "Le llega como notificación al celular y queda en la campanita de la app." : "Todavía no activó las notificaciones: lo ve en la campanita de la app cuando la abre."}${s.avisadoHoy.length ? ` Hoy ya le mandaste ${s.avisadoHoy.length === 1 ? "un aviso" : s.avisadoHoy.length + " avisos"}.` : ""}</p>
        ${s.vencidaOculta ? `<p class="mute">La sacaste de la lista de vencidas de "Hoy". <button class="link" type="button" data-ocultar-vencida="${s.id}" data-volver="1">Volver a mostrarla</button></p>` : ""}`)}
      ${sec("profe", s.profeNombre ? `Profe personal · ${esc(s.profeNombre)}` : "Profe personal", `${s.profeNombre ? `<p>Entrena con <b>${esc(s.profeNombre)}</b> hasta el ${fecha(s.profeVence)}.</p>` : `<p class="mute">No tiene profe personal (${plata(est.gym.profePrecio)} por mes).</p>`}
        <div class="campo"><label for="d-profe">Profe</label><select id="d-profe" data-profe-sel>${profes.map(p => `<option value="${p.id}" ${p.id === s.profeId ? "selected" : ""}>${esc(p.nombre)} · ${esc(p.especialidad || "Profe")}</option>`).join("")}</select></div>
        <div class="fila"><button class="btn btn-borde btn-chico" type="button" data-profe-qr>Cobrar 1 mes con QR</button><button class="btn btn-borde btn-chico" type="button" data-profe-asignar>Asignar 1 mes (ya pagó)</button>${s.profeNombre ? '<button class="link" type="button" data-profe-quitar>Quitar</button>' : ""}</div>`)}
      ${sec("rol", "Rol en el gimnasio", `<label class="interruptor"><span>Dueño <small class="ayuda">(maneja el panel)</small></span><input type="checkbox" data-rol-dueno ${s.dueno ? "checked" : ""}><span class="int-pista"></span></label>
        <label class="interruptor"><span>Profe <small class="ayuda">(aparece para elegir como profe personal)</small></span><input type="checkbox" data-rol-profe ${s.profe ? "checked" : ""}><span class="int-pista"></span></label>
        <div class="campo"><label for="d-esp">Especialidad (si es profe)</label><input id="d-esp" data-rol-esp maxlength="40" value="${esc(s.especialidad)}" placeholder="Ej.: Funcional y running"></div>
        <button class="btn btn-borde btn-chico" type="button" data-rol-guardar>Guardar rol</button>
        <p class="ayuda">En el chat aparece con la etiqueta de Dueño o Profe.</p>`)}
      ${sec("chat", s.silenciado ? "Chat · silenciado" : "Chat", `${s.silenciado ? `<p>Silenciado hasta las ${P.hora(s.silenciado)} del ${new Date(s.silenciado).toLocaleDateString("es-AR")}.</p>` : `<p class="mute">Puede escribir en el general, su clan y privados.</p>`}
        <div class="fila">${s.silenciado ? '<button class="btn btn-borde btn-chico" type="button" data-silenciar="0">Quitar el silencio</button>' : [1, 24, 168].map(h => `<button class="btn btn-borde btn-chico" type="button" data-silenciar="${h}">Silenciar ${h === 1 ? "1 hora" : h === 24 ? "1 día" : "7 días"}</button>`).join("")}</div>`)}
      ${sec("cuenta", "Cuenta y acceso", `<div class="fila">${s.adentro ? '<button class="btn btn-borde btn-chico" type="button" data-salida>Marcar que salió</button>' : '<button class="btn btn-borde btn-chico" type="button" data-ingreso>Marcar que entró</button>'}<button class="btn btn-borde btn-chico" type="button" data-pin>Nuevo PIN</button>${s.activo && !s.dueno ? '<button class="btn btn-borde btn-chico" type="button" data-baja>Dar de baja</button>' : ""}</div>
        ${s.bloqueado ? '<p class="aviso-mal">Está frenado por poner mal el PIN 5 veces. Dale un PIN nuevo para destrabarlo.</p>' : ""}
        <p class="ayuda">Con el DNI y el PIN entra a la app y en la tablet. Último ingreso: ${s.ultimoIngreso ? cuando(s.ultimoIngreso) + (s.sinVenir >= 2 ? ` (hace ${s.sinVenir} días)` : "") : "—"}.</p>`, s.bloqueado)}`;
  }
  function mesesElegidos() { const x = $('[data-hoja-in] [name="meses"]:checked'); return x ? +x.value : 1; }

  // QR de cobro: el socio lo escanea, paga y el panel lo ve
  function mostrarQR(cobro, titulo, socio) {
    clearTimeout(tCobro);
    const link = location.origin + cobro.link;
    abrirHoja(`<h2 id="hoja-tit">${esc(titulo)}</h2><p class="mute">${esc(socio.nombre)} lo escanea con la cámara del celular y paga con Mercado Pago.</p>
      <div class="qr" data-qr></div><p class="d-esperando" data-esperando><i></i>Esperando el pago…</p>
      <p class="qr-link"><a class="link" href="${esc(cobro.link)}" target="_blank" rel="noopener">Abrir el link de pago</a> <button class="link" type="button" data-copiar="${esc(link)}">Copiar</button></p>
      <p class="nota-demo">Demo: abrí el link (o escanealo con tu celu) y tocá Pagar: no se cobra nada.</p>`);
    try { const q = window.qrcode(0, "M"); q.addData(link); q.make(); $("[data-qr]").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: "Código QR para pagar" }); } catch (_) { $("[data-qr]").textContent = link; }
    const c = cobro.link.split("c=")[1];
    const mirar = async () => {
      const r = await P.api(`/api/cobro?gym=${GYM}&c=${encodeURIComponent(c)}`);
      if (r.ok && r.datos.estado === "pagado") {
        $("[data-esperando]").innerHTML = `<b class="lima">✓ ¡Pagado! ${plata(r.datos.monto)}</b>`;
        $("[data-esperando]").classList.add("pagado");
        toast("¡Pago recibido!"); cargar();
        return;
      }
      if (!$("[data-hoja]").hidden && $("[data-esperando]")) tCobro = setTimeout(mirar, 3000);
    };
    tCobro = setTimeout(mirar, 3000);
  }

  function formAlta() {
    detalle = null;
    abrirHoja(`<h2 id="hoja-tit">Nuevo socio</h2><p class="mute">Alta en el mostrador: queda con la cuota paga y un PIN para la app y la tablet. (También se pueden inscribir solos desde la web.)</p>
      <form data-form-alta novalidate>
        <div class="campo"><label for="a-nom">Nombre y apellido</label><input id="a-nom" name="nombre" maxlength="50" autocomplete="off"></div>
        <div class="dos-c"><div class="campo"><label for="a-dni">DNI</label><input id="a-dni" name="dni" inputmode="numeric" maxlength="10"></div>
        <div class="campo"><label for="a-tel">WhatsApp</label><input id="a-tel" name="tel" inputmode="tel" maxlength="25"></div></div>
        <div class="dos-c"><div class="campo"><label for="a-plan">Plan</label><select id="a-plan" name="plan">${est.planes.map(p => `<option ${p === "Full" ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="campo"><label for="a-meses">Paga</label><select id="a-meses" name="meses"><option value="1">1 mes</option><option value="3">3 meses (−10%)</option><option value="6">6 meses (−15%)</option></select></div></div>
        <div class="dos-c"><div class="campo"><label for="a-obj">Objetivo</label><select id="a-obj" name="objetivo">${est.objetivos.map(o => `<option value="${o.id}" ${o.id === "musculo" ? "selected" : ""}>${esc(o.nombre)}</option>`).join("")}</select></div>
        <div class="campo"><label for="a-medio">Cómo paga</label><select id="a-medio" name="medio"><option>Efectivo</option><option>Transferencia</option></select></div></div>
        <p class="d-monto" data-monto-alta></p>
        <button class="btn btn-lima btn-ancho" type="submit">Dar de alta y cobrar</button>
      </form>`);
    const f = $("[data-form-alta]"), monto = () => { $("[data-monto-alta]").textContent = "Total: " + plata(cuota(f.plan.value, +f.meses.value)); };
    f.addEventListener("change", monto); monto();
    setTimeout(() => f.nombre.focus(), 80);
  }

  // ---------- Cobros ----------
  function pintarCobros() {
    const r = est.resumen, mes = est.hoy.slice(0, 7);
    const pend = est.cobros.filter(c => c.estado === "pendiente");
    const delMes = est.cobros.filter(c => c.estado === "pagado" && new Date(Date.parse(c.pagado) - 3 * 3600e3).toISOString().slice(0, 7) === mes);
    const total = Object.values(r.porMedio).reduce((a, x) => a + x, 0) || 1;
    $('[data-vista="cobros"]').innerHTML = `
      <h1 class="v-tit">Cobros <span>${new Date(est.hoy + "T12:00:00").toLocaleDateString("es-AR", { month: "long" })}</span></h1>
      <div class="kpis kpis-3"><article class="kpi"><p>Cobrado este mes</p><b>${plata(r.cobradoMes)}</b><small>${r.cobrosMes} cobros</small></article>
        ${Object.entries(r.porMedio).sort((a, b) => b[1] - a[1]).map(([m, v]) => `<article class="kpi"><p>${esc(m)}</p><b>${plata(v)}</b><small>${Math.round(v / total * 100)}% del mes</small></article>`).join("")}</div>
      ${pend.length ? `<article class="caja"><h2 class="c-tit">Esperando el pago <small>(QR o link enviados)</small></h2><ul class="lista">${pend.map(c => `<li><span><b>${esc(c.nombre)}</b><small>${esc(c.detalle)} · ${cuando(c.creado)}</small></span><b>${plata(c.monto)}</b><span class="acc"><button class="link" type="button" data-anular="${c.id}">Anular</button></span></li>`).join("")}</ul></article>` : ""}
      <article class="caja"><div class="c-head"><h2 class="c-tit">Cobrado este mes</h2><button class="btn btn-borde btn-chico" type="button" data-csv>Descargar planilla</button></div>
        <ul class="lista cobros">${delMes.map(c => `<li><span><b>${esc(c.nombre)}</b><small>${esc(c.detalle)}</small></span><span class="c-der"><b>${plata(c.monto)}</b><small>${esc((c.medio || "").replace(" (prueba)", ""))} · ${cuando(c.pagado)}</small></span></li>`).join("") || '<li class="vacio">Todavía no hay cobros este mes.</li>'}</ul></article>`;
  }

  // Planilla de cobros del mes (se abre con Excel o Google Sheets)
  function planilla() {
    const mes = est.hoy.slice(0, 7), CONC = { cuota: "Cuota", profe: "Profe personal", inscripcion: "Inscripción" };
    const filas = est.cobros.filter(c => c.estado === "pagado" && new Date(Date.parse(c.pagado) - 3 * 3600e3).toISOString().slice(0, 7) === mes);
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "﻿" + [["Fecha", "Socio", "Concepto", "Detalle", "Medio", "Monto"].map(q).join(";"),
      ...filas.map(c => [new Date(c.pagado).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }), c.nombre, CONC[c.concepto] || c.concepto, c.detalle, (c.medio || "").replace(" (prueba)", ""), c.monto].map(q).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `cobros-pulso-${mes}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Planilla descargada: ${filas.length} cobros.`);
  }

  // ---------- Comunidad ----------
  function pintarComunidad() {
    const sil = est.socios.filter(s => s.silenciado);
    const top = [...est.socios].filter(s => s.activo).sort((a, b) => b.pl - a.pl).slice(0, 10);
    $('[data-vista="comunidad"]').innerHTML = `
      <h1 class="v-tit">Comunidad</h1>
      <div class="dos">
        <article class="caja"><h2 class="c-tit">Moderar el chat <small>(general y clanes; los privados no se ven)</small></h2>
          <ul class="msjs">${est.mensajes.map(m => { const s = porId(m.de); return `<li class="${m.borrado ? "borrado" : ""}">${avatar(s, 34)}<div><p class="m-quien"><b>${esc(m.autor)}</b> <span class="mute">en ${esc(m.canal)} · ${cuando(m.creado)}</span></p><p>${m.borrado ? "<i>Borrado: </i>" : ""}${esc(m.texto)}</p></div>
            <button class="link" type="button" data-borrar-msj="${m.id}" data-volver="${m.borrado ? 1 : 0}">${m.borrado ? "Restaurar" : "Borrar"}</button></li>`; }).join("") || '<li class="vacio">Todavía no hay mensajes.</li>'}</ul>
          ${sil.length ? `<p class="ayuda">Silenciados: ${sil.map(s => `<button class="link" type="button" data-ver="${s.id}">${esc(s.nombre)}</button>`).join(", ")}</p>` : ""}</article>
        <div>
          <article class="caja"><h2 class="c-tit">Ranking</h2>
            <ol class="rk">${top.map((s, i) => `<li><span class="rk-n">${i + 1}</span>${emblema(s.rango, 30)}<button type="button" class="rk-nom" data-ver="${s.id}"><b>${s.clan ? `<span class="tag-clan">[${esc(s.clan.tag)}]</span> ` : ""}${esc(s.nombre)}</b><small style="color:${s.rango.color}">${esc(s.rango.nombre)}${s.dueno ? " · Dueño" : ""}${s.profe ? " · Profe" : ""}</small></button><b class="rk-pl">${s.pl.toLocaleString("es-AR")}</b></li>`).join("")}</ol></article>
          <article class="caja"><h2 class="c-tit">Clanes <small>(${est.clanes.length})</small></h2>
            <ul class="lista">${est.clanes.map(c => `<li><span class="clan-ico">${esc(c.tag)}</span><span><b>${esc(c.nombre)}</b><small>${c.miembros}/10 · líder ${esc(c.lider)} · ${c.pl.toLocaleString("es-AR")} PL</small></span><span class="acc"><button class="link" type="button" data-borrar-clan="${c.id}" data-nombre="${esc(c.nombre)}">Borrar</button></span></li>`).join("") || '<li class="vacio">No hay clanes.</li>'}</ul></article>
        </div>
      </div>`;
  }

  // ---------- Ajustes ----------
  function pintarAjustes() {
    const app = location.origin + "/app/?gym=" + GYM, tablet = location.origin + "/tablet/?gym=" + GYM, insc = location.origin + "/inscripcion/?gym=" + GYM;
    $('[data-vista="ajustes"]').innerHTML = `
      <h1 class="v-tit">Ajustes</h1>
      <div class="dos">
        <form class="caja" data-form-precios><h2 class="c-tit">Precios por mes</h2>
          ${est.planes.map(p => `<div class="campo"><label for="pr-${p}">Plan ${p}</label><input id="pr-${p}" name="${p}" inputmode="numeric" value="${est.gym.precios[p]}"></div>`).join("")}
          <div class="campo"><label for="pr-profe">Profe personal</label><input id="pr-profe" name="profe" inputmode="numeric" value="${est.gym.profePrecio}"></div>
          <p class="ayuda">Pagando 3 meses: −10%. Pagando 6 meses: −15%. Los nuevos precios se ven al instante en la web, la app y la tablet.</p>
          <button class="btn btn-lima btn-chico" type="submit">Guardar precios</button></form>
        <div>
          <article class="caja"><h2 class="c-tit">La tablet de la entrada</h2><p class="mute">Abrí este link en la tablet y dejala en la puerta: cada socio entra con su DNI y su PIN.</p>
            <p class="qr-link">${esc(tablet)}</p><div class="fila"><a class="btn btn-borde btn-chico" href="${esc(tablet)}" target="_blank" rel="noopener">Abrir la tablet</a><button class="btn btn-borde btn-chico" type="button" data-qr-link="${esc(tablet)}" data-qr-tit="La tablet de la entrada">QR</button></div></article>
          <article class="caja"><h2 class="c-tit">La app de los socios</h2><p class="mute">Se instala en el celular. Compartila por WhatsApp o en tu Instagram.</p>
            <p class="qr-link">${esc(app)}</p><div class="fila"><button class="btn btn-borde btn-chico" type="button" data-qr-link="${esc(app)}" data-qr-tit="Abrí la app en tu celular">Probar con mi celu (QR)</button><a class="btn btn-borde btn-chico" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Bajate la app de PULSO: " + app)}">WhatsApp</a></div></article>
          <article class="caja"><h2 class="c-tit">Inscripción online</h2><p class="mute">El link para que se inscriban y paguen solos.</p><p class="qr-link">${esc(insc)}</p></article>
          <article class="caja"><h2 class="c-tit">Mensaje del día</h2><p class="mute">Todos los días, desde las 9, a los socios que activaron las notificaciones les llega un mensaje para motivarlos: su clase de hoy, cuántos días hace que no vienen o su racha de la semana. A los que ya vinieron, a los que pausaron la cuota y a los que no se inscribieron no les llega.</p>
            <button class="btn btn-borde btn-chico" type="button" data-aviso-dia>Mandarlo ahora (para probar)</button></article>
          <article class="caja peligro"><h2 class="c-tit">Empezar de cero</h2><p class="mute">Borra este gimnasio de prueba y arma uno nuevo con los datos de ejemplo.</p><button class="btn btn-borde btn-chico" type="button" data-reiniciar>Empezar de cero</button></article>
        </div>
      </div>
      <p class="nota-demo">Demo: este gimnasio de prueba es solo tuyo y se borra a las 24 horas. En tu gimnasio, el panel se abre con la clave del dueño y los datos quedan guardados.</p>`;
  }

  // ---------- Eventos ----------
  function initEventos() {
    // "toggle" no sube por el documento: se escucha en la captura
    document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches('details[data-sec="entreno"]') && e.target.open) cargarEntreno(); }, true);
    document.addEventListener("click", async e => {
      const t = e.target.closest("[data-tab]"); if (t) { irA(t.dataset.tab); return; }
      const ver = e.target.closest("[data-ver]"); if (ver) { verSocio(ver.dataset.ver); return; }
      if (e.target.closest("[data-hoja-cerrar]") || e.target.matches("[data-velo]")) { cerrarHoja(); return; }
      const fl = e.target.closest("[data-filtro]"); if (fl) { filtro = fl.dataset.filtro; pintarSocios(); return; }
      const fi = e.target.closest("[data-filtro-ir]"); if (fi) { filtro = fi.dataset.filtroIr; irA("socios"); return; }
      if (e.target.closest("[data-alta]")) { formAlta(); return; }
      if (e.target.closest("[data-simular-ingreso]")) { const r = await hacer({ accion: "simular-ingreso" }); if (r) toast(`${r.salio ? "Salió" : "Entró"} ${r.nombre} por la tablet.`); return; }
      // "Recordar": el aviso va a la app (y al celular); si es un link de WhatsApp, además se abre con el mensaje escrito
      const rc = e.target.closest("[data-recordar]"); if (rc) {
        const quien = porId(rc.dataset.socio), r = await hacer({ accion: "recordar", socio: +rc.dataset.socio, tipo: rc.dataset.recordar });
        if (r && quien) toast(r.enviados ? `Le llegó el aviso al celular de ${quien.nombre}.` : `El aviso quedó en la app de ${quien.nombre} (no activó las notificaciones del celu).`, 4000);
        return;
      }
      const ov = e.target.closest("[data-ocultar-vencida]"); if (ov) { const v = ov.dataset.volver === "1"; await hacer({ accion: "ocultar-vencida", socio: +ov.dataset.ocultarVencida, volver: v }, v ? "Vuelve a aparecer en la lista de vencidas." : "Listo: la sacaste de la lista (sigue en Socios > Vencidas)."); return; }
      if (e.target.closest("[data-aviso-dia]")) { const r = await hacer({ accion: "aviso-del-dia" }); if (r) toast(r.enviados ? `Mensaje del día mandado a ${r.enviados} celular${r.enviados === 1 ? "" : "es"}.` : "Nadie activó todavía las notificaciones en este gimnasio de prueba: activalas en la app (Perfil) y probá de nuevo.", 5000); return; }
      const s = detalle ? porId(detalle) : null;
      const cb = e.target.closest("[data-cobrar]"); if (cb && s) { const m = mesesElegidos(); if (await hacer({ accion: "cobrar", socio: s.id, medio: cb.dataset.cobrar, meses: m }, `Cobrado: ${plata(cuota(s.plan, m))} en ${cb.dataset.cobrar.toLowerCase()}.`)) pintarDetalle(); return; }
      if (e.target.closest("[data-cobrar-qr]") && s) { const m = mesesElegidos(); const r = await hacer({ accion: "cobro-qr", socio: s.id, meses: m }); if (r) mostrarQR(r.cobro, `Cuota ${s.plan} · ${PER[m]} · ${plata(cuota(s.plan, m))}`, s); return; }
      if (e.target.closest("[data-profe-qr]") && s) { const p = $("[data-profe-sel]").value; const r = await hacer({ accion: "cobro-qr", concepto: "profe", socio: s.id, profe: p, meses: 1 }); if (r) mostrarQR(r.cobro, `Profe personal · 1 mes · ${plata(est.gym.profePrecio)}`, s); return; }
      if (e.target.closest("[data-profe-asignar]") && s) { await hacer({ accion: "asignar-profe", socio: s.id, profe: $("[data-profe-sel]").value, meses: 1 }, "Profe asignado: ya aparece en su app."); return; }
      if (e.target.closest("[data-profe-quitar]") && s) { await hacer({ accion: "asignar-profe", socio: s.id, profe: 0 }, "Le quitaste el profe personal."); return; }
      if (e.target.closest("[data-pl-ajustar]") && s) { const d = $("[data-pl-valor]").value.replace(/[^\d-]/g, ""); if (await hacer({ accion: "puntos", socio: s.id, delta: d, motivo: $("[data-pl-motivo]").value }, `Listo: ${+d > 0 ? "+" : ""}${d} PL.`)) { $("[data-pl-valor]").value = ""; } return; }
      if (e.target.closest("[data-rol-guardar]") && s) { await hacer({ accion: "rol", socio: s.id, dueno: $("[data-rol-dueno]").checked, profe: $("[data-rol-profe]").checked, especialidad: $("[data-rol-esp]").value }, "Rol guardado."); return; }
      if (e.target.closest("[data-pausar]") && s) { const d = +$("[data-pausa-dias]").value; await hacer({ accion: "pausar", socio: s.id, dias: d, motivo: $("[data-pausa-motivo]").value }, `Cuota pausada ${d} días: el vencimiento se corrió.`); return; }
      if (e.target.closest("[data-pausa-quitar]") && s) { await hacer({ accion: "quitar-pausa", socio: s.id }, "Pausa terminada."); return; }
      const si = e.target.closest("[data-silenciar]"); if (si && s) { const h = +si.dataset.silenciar; await hacer({ accion: "silenciar", socio: s.id, horas: h }, h ? "Silenciado: no puede escribir en los chats." : "Ya puede escribir de nuevo."); return; }
      if (e.target.closest("[data-ingreso]") && s) {
        let r = await P.api("/api/panel", { metodo: "POST", cuerpo: { gym: GYM, accion: "ingreso", socio: s.id }, cabeceras: { "X-Panel": "1" } });
        const vencida = r.status === 409 && /vencida/.test(r.datos.error || "");
        if (vencida && confirm(r.datos.error + "\n\n¿Dejarlo pasar igual?")) r = await P.api("/api/panel", { metodo: "POST", cuerpo: { gym: GYM, accion: "ingreso", socio: s.id, forzar: true }, cabeceras: { "X-Panel": "1" } });
        if (r.ok) { aplicar(r.datos.estado); toast(`Ingreso de ${s.nombre} anotado.`); } else if (!vencida) toast(r.datos.error || "No se pudo.");
        return;
      }
      if (e.target.closest("[data-salida]") && s) { await hacer({ accion: "salida", socio: s.id }, `Salida de ${s.nombre} anotada.`); return; }
      if (e.target.closest("[data-pin]") && s) { if (!confirm(`¿Darle un PIN nuevo a ${s.nombre}? El viejo deja de andar.`)) return; const r = await hacer({ accion: "pin", socio: s.id }); if (r) abrirHoja(`<h2 id="hoja-tit">PIN nuevo de ${esc(s.nombre)}</h2><p class="pin-grande">${esc(r.pin)}</p><p class="mute">Pasáselo: con su DNI y este PIN entra a la app y en la tablet. Lo puede cambiar desde la app.</p><button class="btn btn-lima btn-ancho" type="button" data-hoja-cerrar>Listo</button>`); return; }
      if (e.target.closest("[data-baja]") && s) { if (confirm(`¿Dar de baja a ${s.nombre}?`)) { if (await hacer({ accion: "baja", socio: s.id }, "Dado de baja.")) cerrarHoja(); } return; }
      const an = e.target.closest("[data-anular]"); if (an) { await hacer({ accion: "anular-cobro", id: +an.dataset.anular }, "Cobro anulado."); return; }
      const bm = e.target.closest("[data-borrar-msj]"); if (bm) { const v = bm.dataset.volver === "1"; await hacer({ accion: "borrar-mensaje", id: +bm.dataset.borrarMsj, volver: v }, v ? "Mensaje restaurado." : "Mensaje borrado: ya no se ve en la app."); return; }
      const bc = e.target.closest("[data-borrar-clan]"); if (bc) { if (confirm(`¿Borrar el clan ${bc.dataset.nombre}? Sus miembros quedan sin clan.`)) await hacer({ accion: "borrar-clan", id: +bc.dataset.borrarClan }, "Clan borrado."); return; }
      const ql = e.target.closest("[data-qr-link]"); if (ql) {
        abrirHoja(`<h2 id="hoja-tit">${esc(ql.dataset.qrTit)}</h2><div class="qr" data-qr></div><p class="qr-link">${esc(ql.dataset.qrLink)}</p>`);
        try { const q = window.qrcode(0, "M"); q.addData(ql.dataset.qrLink); q.make(); $("[data-qr]").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: "Código QR" }); } catch (_) { /* nada */ }
        return;
      }
      if (e.target.closest("[data-csv]")) { planilla(); return; }
      const cp = e.target.closest("[data-copiar]"); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copiar); toast("Link copiado."); } catch (_) { toast(cp.dataset.copiar); } return; }
      if (e.target.closest("[data-reiniciar]")) { if (confirm("¿Borrar este gimnasio de prueba y empezar de cero?")) { conocidosIng = null; await hacer({ accion: "reiniciar" }, "Listo: gimnasio nuevo con los datos de ejemplo."); } }
    });
    document.addEventListener("change", e => {
      if (e.target.matches('[data-hoja-in] [name="meses"]') && detalle) { const s = porId(detalle); $("[data-monto]").textContent = plata(cuota(s.plan, mesesElegidos())); }
    });
    document.addEventListener("input", e => { if (e.target.matches("[data-buscar]")) { busca = e.target.value; pintarSocios(); } });
    document.addEventListener("submit", async e => {
      const f = e.target;
      if (f.matches("[data-form-alta]")) {
        e.preventDefault();
        const r = await hacer({ accion: "alta", nombre: f.nombre.value, dni: f.dni.value, tel: f.tel.value, plan: f.plan.value, meses: +f.meses.value, objetivo: f.objetivo.value, medio: f.medio.value });
        if (r) abrirHoja(`<h2 id="hoja-tit">¡Listo, ya es socio!</h2><p>${esc(f.nombre.value)} quedó con la cuota paga. Su PIN para la app y la tablet:</p><p class="pin-grande">${esc(r.pin)}</p><p class="mute">Con su DNI y este PIN entra. Lo puede cambiar desde la app.</p><button class="btn btn-lima btn-ancho" type="button" data-hoja-cerrar>Listo</button>`);
      }
      if (f.matches("[data-form-precios]")) {
        e.preventDefault();
        const datos = { accion: "precios", profe: f.profe.value.replace(/\D/g, "") };
        est.planes.forEach(p => { datos[p] = f[p].value.replace(/\D/g, ""); });
        f.querySelector("button").focus();
        await hacer(datos, "Precios guardados.");
      }
    });
    addEventListener("keydown", e => { if (e.key === "Escape") cerrarHoja(); });
    addEventListener("popstate", () => { const h = location.hash.slice(1); cerrarHoja(); irA(["hoy", "socios", "cobros", "comunidad", "ajustes"].includes(h) ? h : "hoy", true); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(); });
    $$("[data-link-app]").forEach(a => { a.href = "/app/?gym=" + GYM; });
    $$("[data-link-tablet]").forEach(a => { a.href = "/tablet/?gym=" + GYM; });
  }

  function boot() {
    initEventos();
    const t = P.params.get("tab") || location.hash.slice(1);
    tab = ["hoy", "socios", "cobros", "comunidad", "ajustes"].includes(t) ? t : "hoy";
    $$("[data-vista]").forEach(s => { s.hidden = s.dataset.vista !== tab; });
    $$("[data-tab]").forEach(b => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    cargar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
