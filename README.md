# Gimnasio: web, app de socios y panel

Inscripción y pago online, app para los socios con plan, ejercicios, reservas de clases y rangos, tablet de ingreso con DNI y panel del personal con cuotas y cobros con QR.

**Probala en vivo:** https://gimnasio-demo-ydk.pages.dev

## Qué tiene

- App instalable (PWA)
- Reservas con cupo
- Cobro con QR
- Panel del personal

## Tecnologías

- HTML, CSS y JavaScript propios, sin plantillas ni frameworks
- Cloudflare Pages (servida desde la red de Cloudflare, con HTTPS)
- Cloudflare Workers y base de datos D1 (SQLite) para la parte del servidor
- Pensada primero para el celular y probada con pruebas automáticas (Playwright)

## Qué hay en este repositorio

La parte que ve el cliente, en `public/`. La lógica del servidor queda en un repositorio privado.

---

Hecho por Julian, de **Yardak**: webs, tiendas, apps y sistemas para negocios de Paraná, Entre Ríos.
https://yardak.pages.dev
