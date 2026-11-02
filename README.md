# thesurfshop.ar

Cliente de Dataria. Venta de boardshorts vintage (Billabong, Quiksilver). Instagram: [@thesurfshop.ar](https://www.instagram.com/thesurfshop.ar/).

## Qué hay

| Parte | Archivo | Estado |
|---|---|---|
| Sistema de stock | `stock.html` | Listo. Funciona en modo prueba hasta conectar Firebase |
| Página pública | — | Pendiente (se hace después) |

Es HTML, CSS y JS sin compilar: no hay que instalar nada. Se publica tal cual (Vercel o Firebase Hosting).

## Sistema de stock (`stock.html`)

Panel a la izquierda (en el celular se abre con ☰) con cuatro módulos:

- **Stock**: resumen (unidades, modelos, agotados, valor del stock) y una tabla con cada modelo y la cantidad por talle. El encabezado queda fijo al bajar. En el celular se ve como tarjetas. Desde acá se crean y editan modelos.
- **Ingresos**: entrada de mercadería. Motivos: Compra a proveedor, Devolución de cliente, Ajuste de inventario.
- **Egresos**: salida de mercadería. Motivos: Venta, Falla / daño, Ajuste de inventario. En una venta, cada modelo lleva su precio por unidad.
- **Ventas**: se arma solo con los egresos de motivo "Venta". Muestra lo facturado, las unidades, la cantidad de ventas y el ticket promedio, y el detalle por modelo (unidades, talles vendidos, precio promedio, facturado y última venta). Se puede ver hoy, los últimos 7 días, este mes o todo.

**Registrar un ingreso o egreso** (solo desde su módulo): 1) motivo, 2) uno o varios modelos, cada uno con la cantidad de cada talle, 3) nota opcional.
- En un ingreso se puede agregar un talle que el modelo no tenía, y crear un modelo nuevo sin salir del cartel.
- En un egreso no deja sacar más de lo que hay, y los talles sin stock aparecen apagados.
- Después de registrar aparece **Deshacer** durante 7 segundos, que deshace la operación completa.

Si se corta la señal sigue funcionando, y sincroniza cuando vuelve.

### Datos (Firestore)

- `modelos/{id}`: `nombre, marca, color, precio, fotos[], fotoData, orden, talles: { "32": 3, ... }`
- `movimientos/{id}`: `opId, modeloId, modelo, talle, delta, tipo (alta = ingreso | baja = egreso), motivo, nota, precio, fecha, quien`. Cada renglón de una operación es un movimiento; todos comparten el `opId`.

Las fotos nuevas se guardan achicadas (unos 60 KB) adentro del modelo, así no hace falta Firebase Storage (que es pago).

Los 15 modelos iniciales salen de las fotos que mandó el cliente (`js/catalogo-inicial.js`, fotos en `img/fotos/`). Arrancan con stock 0 y con nombres provisorios que el cliente puede cambiar.

## Conectar Firebase (una sola vez)

1. Entrar a https://console.firebase.google.com y crear el proyecto `thesurfshop`. Analytics no hace falta.
2. **Firestore Database**: Crear base de datos → modo producción → ubicación `southamerica-east1` (San Pablo).
3. **Authentication**: Comenzar → Correo electrónico/contraseña → Habilitar. Después, en Usuarios → Agregar usuario, crear el email y la contraseña del cliente.
4. **Reglas**: en Firestore → Reglas, pegar el contenido de `firestore.rules`, reemplazando `CAMBIAR-POR-EL-EMAIL-DEL-CLIENTE@gmail.com` por el email del paso 3, y publicar.
5. **App web**: Configuración del proyecto → Tus apps → `</>` → registrar. Copiar los datos de `firebaseConfig` en `js/firebase-config.js`.
6. Entrar a `stock.html` con ese usuario y tocar **"Cargar los 15 modelos de las fotos"**.
7. Si se publica en un dominio propio, agregarlo en Authentication → Configuración → Dominios autorizados.

## Probar en la compu

Abrir `stock.html` con doble clic: funciona en modo prueba.

Con Firebase conectado, el ingreso con usuario no funciona abriendo el archivo directo (Firebase solo acepta páginas publicadas). Para probarlo en la compu: `python -m http.server 5173` y abrir http://localhost:5173/stock.html.

## Material original

Las fotos originales y el logo en PDF están en `_material/`, que no se sube al repo. Van a Google Drive → "Dataria - Medios".
