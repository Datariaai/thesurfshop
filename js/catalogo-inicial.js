// Modelos armados a partir de las fotos que mandó el cliente (01/11/2026).
// Arrancan con stock 0: se cargan desde /stock.html.
// Los nombres son provisorios: el cliente los puede cambiar desde "Editar modelo".

export const TALLES_BASE = ['28', '30', '32', '34', '36', '38'];

const f = (...n) => n.map(i => `img/fotos/${String(i).padStart(2, '0')}.jpg`);

export const CATALOGO_INICIAL = [
  { id: 'bb-gold-dots',       nombre: 'Gold Dots',          marca: 'Billabong',  color: 'Negro y dorado',      fotos: f(0, 13, 16, 11) },
  { id: 'bb-pinstripe-azul',  nombre: 'Pinstripe',          marca: 'Billabong',  color: 'Azul marino rayado',  fotos: f(3, 4, 5, 6) },
  { id: 'bb-pinstripe-rojo',  nombre: 'Pinstripe Red',      marca: 'Billabong',  color: 'Rojo rayado',         fotos: f(12, 7, 8, 9) },
  { id: 'bb-dots-gris',       nombre: 'Dots',               marca: 'Billabong',  color: 'Gris',                fotos: f(10, 19, 20, 1, 2, 24) },
  { id: 'bb-x',               nombre: 'X Gold',             marca: 'Billabong',  color: 'Negro',               fotos: f(22, 46) },
  { id: 'bb-lines',           nombre: 'Lines',              marca: 'Billabong',  color: 'Negro con líneas',    fotos: f(14, 15) },
  { id: 'bb-azul',            nombre: 'Electric Blue',      marca: 'Billabong',  color: 'Azul francia',        fotos: f(40, 21, 17, 18, 41) },
  { id: 'bb-navy',            nombre: 'Navy',               marca: 'Billabong',  color: 'Azul oscuro',         fotos: f(37, 39) },
  { id: 'bb-camo-gris',       nombre: 'Camo',               marca: 'Billabong',  color: 'Camuflado gris',      fotos: f(26, 23, 25) },
  { id: 'bb-camo-blanco',     nombre: 'Camo Snow',          marca: 'Billabong',  color: 'Camuflado blanco',    fotos: f(27, 28, 29, 30, 31) },
  { id: 'bb-camo-arena',      nombre: 'Camo Sand',          marca: 'Billabong',  color: 'Camuflado arena',     fotos: f(38, 45) },
  { id: 'bb-blanco',          nombre: 'White',              marca: 'Billabong',  color: 'Blanco',              fotos: f(34) },
  { id: 'bb-australia',       nombre: 'Australia',          marca: 'Billabong',  color: 'Negro, blanco y rojo', fotos: f(42, 43, 44, 47) },
  { id: 'qs-turquesa',        nombre: 'Turquoise',          marca: 'Quiksilver', color: 'Gris y turquesa',     fotos: f(32, 33) },
  { id: 'qs-black-gold',      nombre: 'Black & Gold',       marca: 'Quiksilver', color: 'Negro y dorado',      fotos: f(35, 36) },
].map((m, i) => ({
  ...m,
  precio: null,
  orden: i,
  talles: Object.fromEntries(TALLES_BASE.map(t => [t, 0])),
}));
