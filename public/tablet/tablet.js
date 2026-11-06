// Tablet de la entrada de PULSO: DNI → PIN → entra (verde, con su rango y lo que le toca hoy) o no entra.
// Al irse, el mismo DNI y PIN marcan la salida (con lo que entrenó y lo que sumó hoy).
// Con la cuota vencida muestra un QR: el socio lo escanea con su celular, paga y la tablet lo deja pasar sola.
// Se usa con el dedo o con un teclado (números, Borrar y Enter). Vuelve sola al inicio.
(function () {
  "use strict";
  const P = window.Pulso;
  const { $, $$, esc, plata, emblema, avatar, fecha } = P;
  const GYM = P.gym();
  let paso = "dni", dni = "", pin = "", tVolver = 0, tCobro = 0, enviando = false;

  function pintarIngreso() {
    $("[data-t-tit]").textContent = paso === "dni" ? "Entrá o salí con tu DNI" : "Ahora tu PIN";
    $("[data-t-sub]").textContent = paso === "dni" ? "Al llegar y al irte. Escribilo sin puntos y tocá Seguir." : "Los 4 números de tu cuenta (los mismos de la app).";
    $("[data-t-valor]").textContent = paso === "dni" ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "•".repeat(pin.length);
    $("[data-t-ok]").textContent = paso === "dni" ? "Seguir" : "Listo";
    $("[data-t-ok]").disabled = paso === "dni" ? dni.length < 7 : pin.length < 4;
    $("[data-t-volver]").hidden = paso === "dni";
    $("[data-t-pantalla]").classList.toggle("pin", paso === "pin");
  }
  function inicio() {
    clearTimeout(tVolver); clearTimeout(tCobro);
    paso = "dni"; dni = ""; pin = "";
    $('[data-paso="resultado"]').hidden = true; $('[data-paso="ingresar"]').hidden = false;
    document.body.className = "tablet";
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // que Enter no vuelva a tocar "Listo"
    pintarIngreso();
  }
  function tecla(t) {
    if ($('[data-paso="ingresar"]').hidden) return;
    if (t === "borrar") { if (paso === "dni") dni = dni.slice(0, -1); else pin = pin.slice(0, -1); }
    else if (t === "ok") { if (paso === "dni" && dni.length >= 7) { paso = "pin"; pin = ""; } else if (paso === "pin" && pin.length >= 4) { entrar(); return; } }
    else if (/^\d$/.test(t)) { if (paso === "dni" && dni.length < 9) dni += t; else if (paso === "pin" && pin.length < 6) pin += t; }
    pintarIngreso();
    clearTimeout(tVolver); tVolver = setTimeout(inicio, 45000);   // si alguien deja a medias, vuelve solo
  }

  async function entrar() {
    if (enviando) return;
    enviando = true; $("[data-t-ok]").disabled = true;
    const r = await P.api("/api/tablet", { metodo: "POST", cuerpo: { gym: GYM, dni, pin } });
    enviando = false;
    if (!r.ok) { mostrar("mal", `<h1 class="ancha">No se pudo</h1><p>${esc(r.datos.error || "Probá de nuevo.")}</p>`, 5000); return; }
    const d = r.datos;
    if (d.salida) return despedida(d);
    if (d.yaAdentro) return mostrar("ok", `<div class="t-ico t-ico-ok" aria-hidden="true">✓</div><h1 class="ancha">Ya entraste</h1><p>${esc(d.nombre)}, registramos tu entrada a las ${esc(d.desde)}. Cuando te vayas, poné tu DNI otra vez para marcar la salida.</p>`, 6000);
    if (d.ok) return bienvenida(d);
    if (d.motivo === "vencida") return vencida(d);
    if (d.motivo === "bloqueo") return mostrar("mal", `<div class="t-ico" aria-hidden="true">✕</div><h1 class="ancha">Muchos intentos</h1><p>${esc(d.texto)}</p>`, 8000);
    mostrar("mal", `<div class="t-ico" aria-hidden="true">✕</div><h1 class="ancha">${esc(d.motivo === "datos" ? "No coincide" : d.texto)}</h1><p>${esc(d.motivo === "datos" ? "El DNI o el PIN no son correctos. Probá de nuevo o pedí ayuda en recepción." : "Pasá por recepción.")}</p>`, 5000);
  }
  function mostrar(clase, html, volverEn) {
    const res = $('[data-paso="resultado"]');
    $('[data-paso="ingresar"]').hidden = true;
    res.innerHTML = html + `<button class="btn btn-borde t-listo" type="button" data-t-listo>Listo</button>`;
    res.hidden = false;
    document.body.className = "tablet t-" + clase;
    clearTimeout(tVolver); if (volverEn) tVolver = setTimeout(inicio, volverEn);
    setTimeout(() => { const b = $("[data-t-listo]"); if (b) b.focus(); }, 50);
  }
  function bienvenida(d) {
    const r = d.rango;
    mostrar("ok", `<div class="t-bien">${emblema(r, 150)}<div>
      <p class="t-hola">¡Adelante, ${esc(d.nombre)}!</p>
      <h1 class="ancha" style="color:${r.color}">${esc(r.nombre)}</h1>
      ${d.pl ? `<p class="t-pl">+${d.pl} PL por venir hoy</p>` : `<p class="t-pl">Ya habías entrado hoy</p>`}
      ${d.clases && d.clases.length ? d.clases.map(c => `<p class="t-clase">Tu clase: <b>${esc(c.clase)} a las ${esc(c.hora)}</b> con ${esc(c.profe)}</p>`).join("") : `<p>Hoy te toca: <b>${esc(d.hoyToca)}</b></p>`}
      ${d.finPausa ? `<p class="t-aviso">¡Volviste! Terminamos la pausa de tu cuota: ahora vence el ${fecha(d.vence)}.</p>` : `<p class="mute">Cuota al día hasta el ${fecha(d.vence)}${d.dias <= 5 ? ` · <b class="t-aviso">vence en ${d.dias} día${d.dias === 1 ? "" : "s"}</b>` : ""}</p>`}</div></div>`, 6500);
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (_) { /* nada */ }
  }
  // Al irse: cuánto entrenó, lo que sumó hoy y cuántas veces vino esta semana
  function despedida(d) {
    const h = Math.floor(d.minutos / 60), m = d.minutos % 60, tiempo = h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
    mostrar("chau", `<div class="t-chau-in"><p class="t-hola">¡Hasta la próxima, ${esc(d.nombre)}!</p>
      <h1 class="ancha">Entrenaste ${esc(tiempo)}</h1>
      <p class="mute">Entraste a las ${esc(d.desde)} · salida marcada</p>
      ${d.plHoy ? `<p class="t-pl">Hoy sumaste +${d.plHoy} PL</p>` : ""}
      <p>Esta semana viniste <b>${d.semana} ${d.semana === 1 ? "vez" : "veces"}</b>${d.semana >= 3 ? ". ¡Gran semana! 🔥" : "."}</p></div>`, 6000);
    try { if (navigator.vibrate) navigator.vibrate([40, 60, 40]); } catch (_) { /* nada */ }
  }
  async function vencida(d) {
    const link = location.origin + d.link;
    mostrar("vencida", `<div class="t-venc"><div>
      <div class="t-ico" aria-hidden="true">!</div>
      <h1 class="ancha">Tu cuota venció</h1>
      <p>${esc(d.nombre)}, venció el ${fecha(d.vence)}. Para entrar, pagala ahora con tu celular:</p>
      <p class="t-monto">${plata(d.monto)}</p>
      <ol class="t-pasos"><li>Abrí la cámara y escaneá el código.</li><li>Pagá con Mercado Pago.</li><li>Esta pantalla te deja pasar sola.</li></ol>
      <p class="mute">¿Preferís efectivo o transferencia? Pasá por recepción.</p></div>
      <div><div class="qr" data-t-qr></div><p class="t-esperando" data-t-esperando><i></i>Esperando el pago…</p>
      <a class="link" href="${esc(d.link)}" target="_blank" rel="noopener">Abrir el pago en esta pantalla (demo)</a></div></div>`, 120000);
    try { const q = window.qrcode(0, "M"); q.addData(link); q.make(); $("[data-t-qr]").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true, alt: "Código QR para pagar la cuota" }); }
    catch (_) { $("[data-t-qr]").textContent = "Pagá en recepción."; }
    const c = d.link.split("c=")[1];
    const mirar = async () => {
      const r = await P.api(`/api/cobro?gym=${GYM}&c=${encodeURIComponent(c)}`);
      if (r.ok && r.datos.estado === "pagado") {
        const e = await P.api("/api/tablet", { metodo: "POST", cuerpo: { gym: GYM, dni, pin } });
        if (e.ok && e.datos.ok) { bienvenida(e.datos); P.toast("¡Pago recibido! Cuota al día.", 3500); return; }
      }
      if (document.body.classList.contains("t-vencida")) tCobro = setTimeout(mirar, 3000);
    };
    tCobro = setTimeout(mirar, 3000);
  }

  function reloj() {
    $("[data-reloj]").textContent = new Date().toLocaleString("es-AR", { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
  }

  function boot() {
    $$("[data-tecla]").forEach(b => b.addEventListener("click", () => tecla(b.dataset.tecla)));
    $("[data-t-volver]").addEventListener("click", () => { paso = "dni"; pin = ""; pintarIngreso(); });
    document.addEventListener("click", e => { if (e.target.closest("[data-t-listo]")) inicio(); });
    addEventListener("keydown", e => {
      if (e.key === "Enter") e.preventDefault();   // con el teclado, Enter es Seguir/Entrar (no el botón que tenga el foco)
      if ($('[data-paso="ingresar"]').hidden) { if (e.key === "Enter" || e.key === "Escape") inicio(); return; }
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === "Backspace") tecla("borrar");
      else if (e.key === "Enter") tecla("ok");
      else if (e.key === "Escape") inicio();
    });
    reloj(); setInterval(reloj, 20000);
    inicio();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
