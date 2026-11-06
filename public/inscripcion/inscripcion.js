// Inscripción online de PULSO en 5 pasos: plan → objetivo → profe (opcional) → datos y PIN → pagar con Mercado Pago.
// Al pagar, la cuenta queda activa (app del socio y tablet de la entrada). Viene con el plan elegido en la web (?plan=&periodo=).
(function () {
  "use strict";
  const P = window.Pulso, { $, $$, esc, plata } = P;
  const GYM = P.gym();
  const DESC = { 1: 0, 3: .10, 6: .15 }, TXT = { 1: "mensual", 3: "por 3 meses", 6: "por 6 meses" };
  const PLANES = { Clases: "12 clases grupales por mes", Full: "Sala libre + todas las clases + rutina con control", Sala: "Musculación libre todos los días" };
  let info = null, paso = 1;
  const f = () => $("[data-form]");
  const sel = n => { const x = f().querySelector(`[name="${n}"]:checked`); return x ? x.value : ""; };
  const cuota = (plan, m) => Math.round(info.precios[plan] * (1 - DESC[m]) / 100) * 100 * m;

  function pintarPlanes() {
    const m = +sel("periodo") || 1, elegido = sel("plan") || P.params.get("plan") || "Full";
    $("[data-planes]").innerHTML = ["Clases", "Full", "Sala"].map(p => `<label class="i-op${p === "Full" ? " top" : ""}"><input type="radio" name="plan" value="${p}" ${p === elegido ? "checked" : ""}>
      <span><b>${p}</b><small>${esc(PLANES[p])}</small></span><span class="i-precio">${plata(cuota(p, m) / m)}<small>/mes${m > 1 ? ` · ${plata(cuota(p, m))} en total` : ""}</small></span></label>`).join("");
  }
  function pintarOpciones() {
    $("[data-objetivos]").innerHTML = info.objetivos.map((o, i) => `<label class="i-op"><input type="radio" name="objetivo" value="${o.id}" ${o.id === (P.params.get("objetivo") || "musculo") ? "checked" : ""}><span><b>${esc(o.nombre)}</b><small>${esc(o.resumen)}</small></span></label>`).join("");
    $("[data-profes]").innerHTML = `<label class="i-op"><input type="radio" name="profe" value="" checked><span><b>Sin profe por ahora</b><small>Entreno con el plan de la app (lo podés sumar después).</small></span></label>` +
      info.profes.map(p => `<label class="i-op"><input type="radio" name="profe" value="${p.id}"><span class="i-profe">${P.avatar(p, 44)}<span><b>${esc(p.completo)}</b><small>${esc(p.especialidad)}</small></span></span><span class="i-precio">+${plata(info.profePrecio)}<small>/mes</small></span></label>`).join("");
  }
  function total() {
    const m = +sel("periodo"), plan = sel("plan"), profe = sel("profe");
    return cuota(plan, m) + (profe ? info.profePrecio * m : 0);
  }
  function pintarResumen() {
    const m = +sel("periodo"), plan = sel("plan"), obj = info.objetivos.find(o => o.id === sel("objetivo")), pr = info.profes.find(p => String(p.id) === sel("profe"));
    $("[data-resumen]").innerHTML = `
      <div><dt>Plan</dt><dd>${esc(plan)} · ${TXT[m]}</dd><dd class="i-m">${plata(cuota(plan, m))}</dd></div>
      ${pr ? `<div><dt>Profe personal</dt><dd>${esc(pr.completo)}</dd><dd class="i-m">${plata(info.profePrecio * m)}</dd></div>` : ""}
      <div><dt>Objetivo</dt><dd>${esc(obj ? obj.nombre : "")}</dd></div>
      <div><dt>Socio</dt><dd>${esc(f().nombre.value.trim())} · DNI ${esc(f().dni.value.replace(/\D/g, ""))}</dd></div>
      <div class="i-total"><dt>Total</dt><dd class="i-m">${plata(total())}</dd></div>`;
  }

  function errores(lista) {
    const e = $("[data-errores]");
    e.innerHTML = lista.map(x => `<li>${esc(x)}</li>`).join(""); e.hidden = !lista.length;
    if (lista.length) e.scrollIntoView({ block: "nearest" });
  }
  function validar() {
    const v = [];
    if (paso === 1 && !sel("plan")) v.push("Elegí un plan.");
    if (paso === 4) {
      const x = f();
      if (x.nombre.value.trim().split(" ").filter(Boolean).length < 2) v.push("Escribí tu nombre y apellido.");
      if (x.dni.value.replace(/\D/g, "").length < 7) v.push("Revisá el DNI (solo números).");
      const t = x.tel.value.replace(/\D/g, "");
      if (t.length < 8 || t.length > 15) v.push("Revisá el WhatsApp, con característica (ej.: 343 412 3456).");
      if (!/^\d{4,6}$/.test(x.pin.value)) v.push("El PIN tiene que tener de 4 a 6 números.");
      else if (x.pin.value !== x.pin2.value) v.push("Los dos PIN no coinciden.");
    }
    errores(v);
    return !v.length;
  }
  function ir(n) {
    paso = n;
    $$("[data-paso]").forEach(s => { s.hidden = +s.dataset.paso !== n; });
    $$(".i-pasos li").forEach(li => { const p = +li.dataset.p; li.classList.toggle("hecho", p < n); if (p === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    $("[data-atras]").hidden = n === 1;
    $("[data-seguir]").textContent = n === 5 ? `Pagar ${plata(total())}` : "Seguir";
    if (n === 5) pintarResumen();
    errores([]);
    scrollTo({ top: 0, behavior: "smooth" });
    const foco = $(`[data-paso="${n}"] input:checked, [data-paso="${n}"] input`);
    if (foco && n !== 5) setTimeout(() => foco.focus({ preventScroll: true }), 300);
  }
  async function pagar() {
    const x = f(), b = $("[data-seguir]");
    b.disabled = true; b.textContent = "Preparando el pago…";
    const r = await P.api("/api/inscripcion", { metodo: "POST", cuerpo: {
      gym: GYM, plan: sel("plan"), periodo: +sel("periodo"), objetivo: sel("objetivo"), profe: sel("profe") || null,
      nombre: x.nombre.value, dni: x.dni.value, tel: x.tel.value, pin: x.pin.value,
    } });
    if (!r.ok) { b.disabled = false; b.textContent = `Pagar ${plata(total())}`; errores(r.datos.errores || [r.datos.error || "No pudimos seguir. Probá de nuevo."]); return; }
    location.href = r.datos.link;
  }

  async function boot() {
    const r = await P.api("/api/inscripcion?gym=" + GYM);
    if (!r.ok) { errores([r.datos.error || "No pudimos cargar los planes. Probá de nuevo."]); return; }
    info = r.datos;
    const per = P.params.get("periodo");
    if (["1", "3", "6"].includes(per)) f().querySelector(`[name="periodo"][value="${per}"]`).checked = true;
    pintarPlanes(); pintarOpciones();
    f().addEventListener("change", e => { if (e.target.name === "periodo") pintarPlanes(); });
    f().addEventListener("submit", e => { e.preventDefault(); if (!validar()) return; if (paso < 5) ir(paso + 1); else pagar(); });
    $("[data-atras]").addEventListener("click", () => ir(Math.max(1, paso - 1)));
    $$(".i-pasos li").forEach(li => li.addEventListener("click", () => { const p = +li.dataset.p; if (p < paso) ir(p); }));
    ir(1);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
