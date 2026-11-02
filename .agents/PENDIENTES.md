# PENDIENTES — thesurfshop.ar
**Ultima actualizacion:** 2-nov-2026
**Estado:** Activo
**Que es:** ERP de stock de boardshorts vintage (Billabong / Quiksilver) para thesurfshop.ar, pensado para celular. La página pública se hace después.
**Donde vive:** repo `https://github.com/Datariaai/thesurfshop` (público) | publicado en `https://datariaai.github.io/thesurfshop/` (GitHub Pages, rama `sistema-stock`)

## 2-nov-2026 — Felipe

### Hecho
- ERP en `stock.html` con los colores del logo (amarillo flúor y rosa sobre azul océano). Panel izquierdo con 4 módulos:
  - **Stock:** tabla por modelo y talle con el encabezado fijo; en el celular, un casillero por talle con la cantidad grande. KPIs: unidades, agotados, costo del stock y valor de venta. Crear y editar modelos (con costo, precio y foto).
  - **Ingresos:** varios modelos y talles por carga, con costo por unidad y talle. Se pueden agregar talles nuevos ("+ otro") y crear un modelo nuevo desde el mismo cartel. El último costo queda en el modelo y se sugiere.
  - **Egresos:** cada egreso es una venta, con precio por talle. Solo deja tocar los talles con stock y no deja sacar más de lo que hay.
  - **Ventas:** se arma sola con los egresos (facturado, unidades, ventas, ticket promedio, detalle por modelo; hoy / 7 días / mes / todo).
  - Deshacer durante 7 segundos después de cada carga.
- 15 modelos iniciales armados con las fotos del cliente (`js/catalogo-inicial.js`, `img/fotos/`). Arrancan con stock 0 y nombres provisorios.
- Entrada con un solo botón "Entrar" mientras no esté Firebase. Con Firebase, la entrada pide email y contraseña.
- PR #1: https://github.com/Datariaai/thesurfshop/pull/1 (sin mergear; lo mergea Imanol).
- El repo se pasó a **público** y se publicó con GitHub Pages desde `sistema-stock` (como mpcatering de Felipe), para tener un link y mandarlo por WhatsApp. `index.html` redirige a `stock.html`.

### Pendiente
- [ ] **Firebase:** crear el proyecto, pasar el email de la clienta, poner los datos en `js/firebase-config.js` y el email en `firestore.rules` (pasos en el README). Hasta entonces cada navegador guarda su propio stock (localStorage): sirve para mostrar, no para trabajar.
- [ ] Al conectar Firebase, agregar `datariaai.github.io` (o el dominio final) en Authentication → Dominios autorizados.
- [ ] Imanol: decidir si el repo queda público con GitHub Pages o vuelve a privado con Vercel (es una excepción a la regla de repos privados de los clientes).
- [ ] Confirmar con la clienta los nombres de los 15 modelos (los inventamos) y los talles (pusimos 28 a 38).
- [ ] Página pública de la tienda (cuando esté, va en `index.html`, que hoy redirige al ERP).
- [ ] Idea ofrecida a Felipe: ganancia (precio − costo) por modelo en Ventas. No pedida todavía.

### Trampas
- Los JS son scripts comunes (no módulos) para que `stock.html` abra con doble clic. No pasarlos a `type="module"`.
- El modo sin Firebase guarda en `localStorage` con la clave `tss-demo-v3`; la sesión dura lo que la pestaña (`sessionStorage`).
- Cada push a `sistema-stock` republica el link en 1-2 minutos. Si se mergea a `main`, hay que cambiar la rama de GitHub Pages a `main`.
- Desde Claude Code, crear repos o cambiar la visibilidad lo bloquea el clasificador de permisos: hay que pasarle los comandos a Felipe para que los pegue en la terminal. El `git push` normal sí anda.
- Los originales pesados (fotos de WhatsApp, capturas, logo en PDF) están en `_material/`, que no se sube. Falta pasarlos a Drive → "Dataria - Medios".
