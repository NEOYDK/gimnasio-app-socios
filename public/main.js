(function () {
  "use strict";

  const data = window.__BRAND__ || {};
  const $ = (s, sc) => (sc || document).querySelector(s);
  const $$ = (s, sc) => Array.from((sc || document).querySelectorAll(s));
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  const wa = (num, text) => "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  const pesos = n => "$ " + Math.round(n).toLocaleString("es-AR");
  const dos = n => String(n).padStart(2, "0");

  // Horario del gimnasio: lunes a viernes de 7 a 22, sábados de 9 a 13 (0 = domingo)
  const ABRE = { 1: [7, 22], 2: [7, 22], 3: [7, 22], 4: [7, 22], 5: [7, 22], 6: [9, 13] };
  const CLASES = {
    Funcional: { min: 50, cupo: 16 }, Cross: { min: 50, cupo: 14 }, Spinning: { min: 45, cupo: 12 },
    Box: { min: 60, cupo: 12 }, Movilidad: { min: 45, cupo: 15 }
  };
  const LMV = [["07:00", "Cross", "Martín"], ["08:00", "Funcional", "Caro"], ["10:00", "Movilidad", "Lu"], ["18:00", "Funcional", "Caro"], ["19:00", "Cross", "Martín"], ["20:00", "Box", "Nico"]];
  const MJ = [["07:00", "Funcional", "Caro"], ["08:00", "Spinning", "Lu"], ["09:00", "Funcional", "Caro"], ["18:30", "Spinning", "Lu"], ["19:30", "Movilidad", "Lu"], ["20:00", "Cross", "Martín"]];
  // La misma grilla que usa el sistema (lib/clases.js): los socios reservan desde la app
  const AGENDA = { 1: LMV, 2: MJ, 3: LMV, 4: MJ, 5: LMV.concat([["21:00", "Cross", "Martín"]]), 6: [["09:30", "Funcional", "Caro"], ["10:30", "Spinning", "Lu"], ["11:30", "Box", "Nico"]] };
  const DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const minutos = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fechaTxt = d => DIA_LARGO[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);

  // Lugares de ejemplo: salen siempre iguales para el mismo día y clase (no cambian al recargar)
  function ocupados(fecha, hora, clase) {
    const clave = fecha.toDateString() + hora + clase;
    let h = 2166136261;
    for (let i = 0; i < clave.length; i++) { h ^= clave.charCodeAt(i); h = Math.imul(h, 16777619); }
    const azar = ((h >>> 0) % 1000) / 1000;
    const cupo = CLASES[clase].cupo;
    const pico = minutos(hora) >= 18 * 60 ? 0.25 : 0;  // a la tarde se llenan más (el mismo cálculo que lib/clases.js)
    return Math.min(cupo, Math.round(cupo * (0.3 + pico + azar * 0.45)));
  }
  function lugar(fecha, hora, clase) {
    const libres = CLASES[clase].cupo - ocupados(fecha, hora, clase);
    if (libres <= 0) return { txt: "Completo", clase: "lleno", libres: 0 };
    return { txt: libres === 1 ? "Queda 1" : "Quedan " + libres, clase: libres <= 3 ? "pocos" : "", libres };
  }

  function initLinks() {
    $$("[data-maker]").forEach(a => { a.href = wa(data.makerWhatsapp, data.makerText); a.target = "_blank"; a.rel = "noopener"; });
    $$("[data-wa-contacto]").forEach(a => { a.href = wa(data.whatsapp, "¡Hola! Quiero info para entrenar en PULSO."); a.target = "_blank"; a.rel = "noopener"; });
  }

  // "Abierto ahora · cierra a las 22" o "Cerrado · abre mañana a las 7"
  function initAbierto() {
    const caja = $("[data-abierto]"), txt = $("[data-abierto-txt]");
    if (!caja || !txt) return;
    const ahora = new Date(), dia = ahora.getDay(), min = ahora.getHours() * 60 + ahora.getMinutes();
    const hoy = ABRE[dia];
    if (hoy && min >= hoy[0] * 60 && min < hoy[1] * 60) { txt.textContent = "Abierto ahora · cierra a las " + hoy[1] + " h"; return; }
    caja.classList.add("cerrado");
    if (hoy && min < hoy[0] * 60) { txt.textContent = "Cerrado · hoy abre a las " + hoy[0] + " h"; return; }
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7;
      if (ABRE[d]) { txt.textContent = "Cerrado · abre " + (i === 1 ? "mañana" : "el " + DIA_LARGO[d]) + " a las " + ABRE[d][0] + " h"; return; }
    }
  }

  // Próximos días con clases (hoy incluido si quedan): 6 pestañas
  function proximosDias() {
    const dias = [], d = new Date();
    d.setHours(0, 0, 0, 0);
    while (dias.length < 6) {
      if (AGENDA[d.getDay()]) dias.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dias;
  }
  const esHoy = d => d.toDateString() === new Date().toDateString();
  const yaEmpezo = (fecha, hora) => esHoy(fecha) && minutos(hora) <= new Date().getHours() * 60 + new Date().getMinutes();

  // Horarios: pestañas de días y clases con los lugares que quedan. "Reservar" lleva a la app (se reserva con la cuenta de socio)
  function initAgenda() {
    const tabs = $("[data-dias]"), slots = $("[data-slots]");
    if (!tabs || !slots) return;
    const dias = proximosDias();
    tabs.innerHTML = "";
    const pintar = i => {
      $$("button", tabs).forEach((b, j) => { b.setAttribute("aria-selected", j === i ? "true" : "false"); b.tabIndex = j === i ? 0 : -1; });
      const fecha = dias[i];
      slots.innerHTML = "";
      AGENDA[fecha.getDay()].forEach(c => {
        const [hora, clase, profe] = c;
        const l = lugar(fecha, hora, clase), paso = yaEmpezo(fecha, hora);
        const li = document.createElement("li");
        li.className = "slot" + (paso ? " pasada" : "") + (!paso && !l.libres ? " completa" : "");
        li.innerHTML = '<b></b><div class="slot-info"><strong></strong><small></small></div><div class="slot-acc"><em class="cupo"></em></div>';
        li.querySelector("b").textContent = hora;
        li.querySelector("strong").textContent = clase;
        li.querySelector("small").textContent = profe + " · " + CLASES[clase].min + " min";
        const cupo = li.querySelector(".cupo");
        cupo.textContent = paso ? "Ya empezó" : l.txt;
        if (paso) cupo.classList.add("lleno"); else if (l.clase) cupo.classList.add(l.clase);
        if (!paso) {
          // Completa: en la app queda en lista de espera (si alguien cancela, el lugar es suyo)
          const a = document.createElement("a");
          a.className = "btn btn-lima btn-sm"; a.href = "/app/";
          a.textContent = l.libres ? "Reservar" : "Lista de espera";
          a.setAttribute("aria-label", (l.libres ? "Reservar " : "Anotarme en la lista de espera de ") + clase + " de las " + hora + " en la app");
          li.querySelector(".slot-acc").appendChild(a);
        }
        slots.appendChild(li);
      });
    };
    dias.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab");
      b.innerHTML = "<span></span><b></b>";
      b.children[0].textContent = esHoy(d) ? "Hoy" : DIA_CORTO[d.getDay()];
      b.children[1].textContent = d.getDate();
      b.setAttribute("aria-label", (esHoy(d) ? "Hoy, " : "") + fechaTxt(d));
      b.addEventListener("click", () => pintar(i));
      b.addEventListener("keydown", e => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const j = (i + (e.key === "ArrowRight" ? 1 : dias.length - 1)) % dias.length;
        pintar(j); tabs.children[j].focus();
      });
      tabs.appendChild(b);
    });
    // Si hoy ya no quedan clases, arranca en el día siguiente
    const primero = AGENDA[dias[0].getDay()].some(c => !yaEmpezo(dias[0], c[0])) ? 0 : 1;
    pintar(primero);
  }

  // Planes: el precio por mes cambia según se pague por 1, 3 o 6 meses
  const DESCUENTO = { 1: 0, 3: 0.10, 6: 0.15 };
  const PERIODO_TXT = { 1: "mensual", 3: "trimestral", 6: "semestral" };
  function initPlanes() {
    const grupo = $("[data-periodo]");
    const planes = $$("[data-plan]");
    if (!planes.length) return;
    const meses = () => +((grupo && $("input:checked", grupo)) || { value: 1 }).value;
    const pintar = animar => {
      const n = meses(), d = DESCUENTO[n];
      planes.forEach(p => {
        const base = +p.dataset.precio;
        const mes = Math.round(base * (1 - d) / 100) * 100;
        const el = $("[data-precio-mes]", p), tot = $("[data-precio-total]", p);
        el.textContent = pesos(mes);
        tot.textContent = n === 1 ? "Pagás mes a mes" : "Pagás " + pesos(mes * n) + " cada " + n + " meses · ahorrás " + pesos((base - mes) * n);
        if (animar) { el.classList.remove("precio-cambia"); void el.offsetWidth; el.classList.add("precio-cambia"); }
        // Inscripción online con el plan y el período ya elegidos
        $("[data-plan-insc]", p).href = "/inscripcion/?plan=" + p.dataset.plan + "&periodo=" + n;
      });
    };
    if (grupo) $$("input", grupo).forEach(i => i.addEventListener("change", () => pintar(true)));
    pintar(false);
    const dudas = $("[data-wa-planes]");
    if (dudas) { dudas.href = wa(data.whatsapp, "¡Hola! Tengo una consulta sobre los planes de PULSO."); dudas.target = "_blank"; dudas.rel = "noopener"; }
  }

  // Las ligas de la app (los emblemas los dibuja lib/pulso.js)
  function initLigas() {
    const ol = $("[data-ligas]");
    if (!ol || !window.Pulso) return;
    const L = [["Hierro", "#9a958f"], ["Bronce", "#cd8752"], ["Plata", "#bcc8d1"], ["Oro", "#f3c24f"], ["Platino", "#45c9b8"], ["Esmeralda", "#35d27b"], ["Diamante", "#7fa9ff"], ["Maestro", "#bb82ff"], ["Retador", "#ff6060"]];
    ol.innerHTML = L.map(([nombre, color], nivel) => "<li>" + window.Pulso.emblema({ nivel, nombre, color }, 64) + "<span>" + nombre + "</span></li>").join("");
  }

  // ¿Qué plan te conviene? 3 preguntas y una recomendación, con el botón para inscribirse con ese plan
  function initTest() {
    const test = $("[data-test]"), res = $("[data-test-res]");
    if (!test || !res) return;
    const v = n => (test.querySelector("[name=" + n + "]:checked") || {}).value;
    test.addEventListener("change", () => {
      const obj = v("obj"), dias = v("dias"), modo = v("modo");
      if (!obj || !dias || !modo) return;
      let plan = "Full", por = "";
      if (modo === "solo") { plan = "Sala"; por = "Te gusta entrenar a tu ritmo: con la sala libre y una rutina armada por un profe vas a avanzar rápido."; }
      else if (modo === "clases" && dias !== "5") { plan = "Clases"; por = "Con 12 clases por mes cubrís " + (dias === "2" ? "tus 2 días" : "3 días") + " por semana y entrenás con grupo, que motiva más."; }
      else { por = "Vas a venir seguido y querés de todo: con el Full tenés la sala y todas las clases, sin límite."; }
      if (obj === "musculo" && plan === "Clases") { plan = "Full"; por = "Para ganar músculo te conviene sumar la sala a las clases: el Full tiene las dos y una rutina con control cada mes."; }
      const clases = obj === "bajar" ? "spinning y funcional" : obj === "musculo" ? "cross" : "funcional";
      res.innerHTML = "<h4></h4><p></p><div class=\"test-acc\"></div>";
      res.querySelector("h4").textContent = "Te conviene el plan " + plan;
      res.querySelector("p").textContent = por + (plan === "Sala" ? "" : " Las clases que más te van a servir: " + clases + ".");
      const acc = res.querySelector(".test-acc");
      const a1 = document.createElement("a");
      a1.className = "btn btn-lima"; a1.href = "/inscripcion/?plan=" + plan + "&periodo=1"; a1.textContent = "Inscribirme con el plan " + plan;
      const a2 = document.createElement("a");
      a2.className = "btn btn-line"; a2.textContent = "Consultar el plan " + plan;
      a2.href = wa(data.whatsapp, "¡Hola! Hice el test de la web y me recomendó el plan " + plan + " de PULSO. ¿Me pasás más info?");
      a2.target = "_blank"; a2.rel = "noopener";
      acc.append(a1, a2);
      res.hidden = false;
    });
  }

  function boot() {
    document.documentElement.classList.remove("no-js");
    safe(initLinks, "initLinks");
    safe(initAbierto, "initAbierto");
    safe(initAgenda, "initAgenda");
    safe(initPlanes, "initPlanes");
    safe(initLigas, "initLigas");
    safe(initTest, "initTest");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
