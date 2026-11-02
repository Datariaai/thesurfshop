# thesurfshop.ar

Cliente de Dataria. Venta de boardshorts vintage (Billabong, Quiksilver). Instagram: [@thesurfshop.ar](https://www.instagram.com/thesurfshop.ar/).

## Qué hay

| Parte | Archivo | Estado |
|---|---|---|
| Sistema de stock | `stock.html` | Listo. Funciona en modo prueba hasta conectar Firebase |
| Página pública | — | Pendiente (se hace después) |

Es HTML, CSS y JS sin compilar: no hay que instalar nada. Se publica tal cual (Vercel o Firebase Hosting).

## Sistema de stock (`stock.html`)

- Lista de modelos con el stock de cada talle. Se puede buscar y filtrar: con stock, poco stock y agotados.
- Al tocar un modelo, cada talle tiene **−** (vendí uno) y **+** (entró uno).
- Al tocar el número de un talle se cargan varias unidades de una: "Entraron", "Vendí" o "Hay en total" (corrige el número).
- Después de cada operación aparece **Deshacer** durante 5 segundos.
- No deja vender más de lo que hay.
- Movimientos: el historial por día, con lo vendido y lo que entró hoy.
- Crear, editar y borrar modelos (nombre, marca, color, precio, talles y foto).
- En el celular se puede agregar a la pantalla de inicio y abre como una app.
- Si se corta la señal sigue funcionando, y sincroniza cuando vuelve.

### Datos (Firestore)

- `modelos/{id}`: `nombre, marca, color, precio, fotos[], fotoData, orden, talles: { "32": 3, ... }`
- `movimientos/{id}`: `modeloId, modelo, talle, delta, tipo (venta|ingreso|ajuste), fecha, quien`

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
