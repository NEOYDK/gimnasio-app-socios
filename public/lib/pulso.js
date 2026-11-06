// Lo común de las pantallas de PULSO (app del socio, panel, tablet, inscripción y pago):
// el gimnasio de prueba de esta visita, pedidos al servidor, avisos, fotos de perfil y los emblemas de los rangos.
(function () {
  "use strict";
  const $ = (s, sc) => (sc || document).querySelector(s);
  const $$ = (s, sc) => Array.from((sc || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = n => "$ " + Math.round(n).toLocaleString("es-AR");
  const leer = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* modo privado */ } };
  const TZ = "America/Argentina/Buenos_Aires";
  const hora = iso => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
  const fecha = (ymd, largo) => { const [a, m, d] = String(ymd).slice(0, 10).split("-").map(Number); return largo ? new Date(a, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) : d + "/" + m; };
  const cuando = iso => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60e3);
    if (min < 1) return "recién"; if (min < 60) return `hace ${min} min`;
    const hoy = new Date().toLocaleDateString("es-AR", { timeZone: TZ }), dia = new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ });
    return dia === hoy ? hora(iso) : new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: TZ }) + " " + hora(iso);
  };

  // ---------- El gimnasio de prueba de esta visita (lo comparten la web, la app, el panel y la tablet) ----------
  const params = new URLSearchParams(location.search);
  let GYM = params.get("gym");
  if (/^[a-z0-9]{6,16}$/.test(GYM || "")) guardar("pulso-gym", GYM);
  else {
    GYM = leer("pulso-gym", "");
    if (!/^[a-z0-9]{6,16}$/.test(GYM)) { GYM = [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, "0")).join(""); guardar("pulso-gym", GYM); }
  }

  async function api(ruta, { metodo = "GET", cuerpo, cabeceras = {} } = {}) {
    try {
      const r = await fetch(ruta, { method: metodo, headers: { "Content-Type": "application/json", ...cabeceras }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, datos: d };
    } catch (_) { return { ok: false, status: 0, datos: { error: "Sin conexión. Revisá internet y probá de nuevo." } }; }
  }

  let tToast = 0;
  function toast(t, ms = 2600) {
    let el = $("[data-toast]");
    if (!el) { el = document.createElement("p"); el.className = "toast"; el.setAttribute("data-toast", ""); el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    clearTimeout(tToast); tToast = setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; }, 300); }, ms);
  }

  // ---------- Avatar: la foto o las iniciales sobre un color fijo para cada persona ----------
  const COLORES = ["#2f6f4f", "#6b3fa0", "#a0522d", "#2b5c8a", "#8a2b4f", "#5a6b1f", "#1f6b6b", "#7a4a1f"];
  function avatar(p, tam = 40) {
    if (!p) return `<span class="av" style="--t:${tam}px"></span>`;
    if (p.foto) return `<img class="av" src="${esc(p.foto)}" alt="" width="${tam}" height="${tam}" style="--t:${tam}px">`;
    const ini = String(p.nombre || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
    return `<span class="av" style="--t:${tam}px;background:${COLORES[(p.id || 0) % COLORES.length]}" aria-hidden="true">${esc(ini)}</span>`;
  }

  // Foto de perfil: se recorta cuadrada y se achica a 256 px en el mismo celular (así pesa poco)
  function achicarFoto(archivo, lado = 256) {
    return new Promise((ok, mal) => {
      if (!archivo || !/^image\//.test(archivo.type)) return mal(new Error("Elegí una imagen."));
      const url = URL.createObjectURL(archivo), img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = lado;
        const m = Math.min(img.naturalWidth, img.naturalHeight);
        c.getContext("2d").drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
        URL.revokeObjectURL(url);
        let d = c.toDataURL("image/webp", .82);
        if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", .82);
        ok(d);
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No pudimos leer esa imagen.")); };
      img.src = url;
    });
  }

  // ---------- Emblemas de los rangos (dibujados, sin archivos) ----------
  const mezcla = (hex, con, p) => {
    const a = hex.match(/\w\w/g).map(x => parseInt(x, 16)), b = con === "b" ? [255, 255, 255] : [0, 0, 0];
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * p).toString(16).padStart(2, "0")).join("");
  };
  let nEmb = 0;
  function emblema(r, tam = 56) {
    if (!r) return "";
    const id = "emb" + (++nEmb), c = r.color, claro = mezcla(c, "b", .5), oscuro = mezcla(c, "n", .45), hondo = mezcla(c, "n", .72);
    const n = r.nivel;
    const chevron = y => `<path d="M30 ${y} 40 ${y + 6} 50 ${y}" fill="none" stroke="${claro}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    let adentro = "";
    if (n === 0) adentro = `<path d="M31 40h18" stroke="${claro}" stroke-width="4" stroke-linecap="round"/>`;
    else if (n === 1) adentro = chevron(37);
    else if (n === 2) adentro = chevron(32) + chevron(42);
    else if (n === 3) adentro = `<path d="M40 27l3.6 7.6 8.2 1-6 5.7 1.5 8.2L40 45.6l-7.3 3.9 1.5-8.2-6-5.7 8.2-1z" fill="${claro}"/>`;
    else if (n === 4) adentro = `<path d="M40 27 50 40 40 53 30 40z" fill="${claro}"/><path d="M40 27v26M30 40h20" stroke="${oscuro}" stroke-width="1.2"/>`;
    else if (n === 5) adentro = `<path d="M35 28h10l5 5v14l-5 5H35l-5-5V33z" fill="${claro}"/><path d="M37 32h6l3 3v10l-3 3h-6l-3-3V35z" fill="none" stroke="${oscuro}" stroke-width="1.2"/>`;
    else adentro = `<path d="M30 35 35 29h10l5 6-10 18z" fill="${claro}"/><path d="M30 35h20M35 29l3 6 2 18M45 29l-3 6-2 18" fill="none" stroke="${oscuro}" stroke-width="1.1"/>`;
    const alas = n >= 7 ? `<g fill="url(#${id}a)" stroke="${hondo}" stroke-width="1"><path d="M19 24C8 26 3 37 5 52c4-6 8-8 14-8z"/><path d="M61 24c11 2 16 13 14 28-4-6-8-8-14-8z"/></g>
      <g stroke="${claro}" stroke-width="1.2" fill="none" opacity=".75"><path d="M17 30c-5 3-8 9-8 16M18 36c-4 2-5 6-5 9M63 30c5 3 8 9 8 16M62 36c4 2 5 6 5 9"/></g>` : "";
    const corona = n === 8 ? `<path d="M29 13 31 3l5 6 4-8 4 8 5-6 2 10z" fill="#ffd34d" stroke="#8a6200" stroke-width="1"/>` : "";
    return `<svg class="emb" viewBox="0 0 80 76" width="${tam}" height="${Math.round(tam * .95)}" role="img" aria-label="${esc(r.nombre)}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient>
      <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient></defs>
      ${alas}<path d="M40 10 62 18v20c0 16-10 26-22 32-12-6-22-16-22-32V18z" fill="url(#${id})" stroke="${hondo}" stroke-width="1.5"/>
      <path d="M40 17 55 22.5V38c0 12-7 19.5-15 24-8-4.5-15-12-15-24V22.5z" fill="${hondo}" stroke="${claro}" stroke-width="1.2" opacity=".92"/>
      ${adentro}${corona}</svg>`;
  }
  // "[PSD] Tomás" con el rango al lado (para chats y listas)
  function nombreCon(p, conRango = true) {
    if (!p) return "";
    // El tag del clan solo si la persona eligió mostrarlo (verTag)
    return `${p.clan && p.verTag !== false ? `<b class="tag-clan">[${esc(p.clan.tag)}]</b> ` : ""}<span class="n">${esc(p.nombre)}</span>${p.dueno ? ' <i class="rol rol-dueno">Dueño</i>' : ""}${p.profe ? ' <i class="rol rol-profe">Profe</i>' : ""}${conRango && p.rango ? ` <i class="tag-rango" style="--c:${p.rango.color}">${esc(p.rango.tag)}</i>` : ""}`;
  }

  window.Pulso = { $, $$, esc, plata, leer, guardar, hora, fecha, cuando, gym: () => GYM, api, toast, avatar, achicarFoto, emblema, nombreCon, params };
})();
