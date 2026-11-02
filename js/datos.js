// Capa de datos: misma interfaz para Firebase (real) y para el modo local (localStorage), que se usa mientras no esté Firebase.
//
// modelos/{id}:     { nombre, marca, color, precio, fotos[], fotoData, orden, talles: { "32": 3, ... } }
// movimientos/{id}: { opId, modeloId, modelo, talle, delta, tipo: alta|baja, nota, precio, costo, fecha, quien }
//   tipo alta = ingreso de mercadería (lleva costo por unidad), baja = egreso / venta (lleva precio por unidad).

// Script común (sin módulos) para que funcione abriendo el HTML directo desde la carpeta.
(function () {
const firebaseConfig = window.TSS_FIREBASE || {};
const { CATALOGO_INICIAL } = window.TSS;

const MODO_LOCAL = !firebaseConfig.apiKey;

const ORDEN_LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'U'];

function ordenarTalles(talles) {
  const peso = t => {
    if (/^\d+(\.\d+)?$/.test(t)) return [0, parseFloat(t)];
    const i = ORDEN_LETRAS.indexOf(t.toUpperCase());
    return i >= 0 ? [1, i] : [2, t];
  };
  return [...talles].sort((a, b) => {
    const [ga, va] = peso(a), [gb, vb] = peso(b);
    return ga - gb || (va < vb ? -1 : va > vb ? 1 : 0);
  });
}

const totalModelo = m => Object.values(m.talles || {}).reduce((s, n) => s + (n || 0), 0);

const fotoPrincipal = m => m.fotoData || (m.fotos && m.fotos[0]) || 'img/logo.webp';

const ordenarModelos = lista =>
  lista.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre));

// ---------------------------------------------------------------- modo local (sin Firebase)

function crearDemo() {
  const CLAVE = 'tss-demo-v3';
  const subsModelos = new Set();
  const subsMovs = new Set();
  const subsUsuario = new Set();

  let estado;
  try { estado = JSON.parse(localStorage.getItem(CLAVE)); } catch { estado = null; }
  if (!estado) {
    estado = { modelos: {}, movs: [], usuario: null };
    CATALOGO_INICIAL.forEach(m => { estado.modelos[m.id] = structuredClone(m); });
  }

  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin espacio o bloqueado */ }
    const modelos = ordenarModelos(Object.entries(estado.modelos).map(([id, m]) => ({ ...m, id })));
    subsModelos.forEach(cb => cb(modelos));
    subsMovs.forEach(cb => cb(estado.movs.map(x => ({ ...x, fecha: new Date(x.fecha) }))));
  };

  // Otra pestaña (por ejemplo la tienda abierta al lado) se entera de los cambios.
  addEventListener('storage', e => {
    if (e.key !== CLAVE) return;
    try { estado = JSON.parse(e.newValue) || estado; } catch { return; }
    guardar();
  });

  const id = () => Math.random().toString(36).slice(2, 10);
  const SESION = 'tss-sesion';
  try { estado.usuario = JSON.parse(sessionStorage.getItem(SESION)); } catch { estado.usuario = null; }

  return {
    onModelos(cb) { subsModelos.add(cb); queueMicrotask(guardar); return () => subsModelos.delete(cb); },
    onMovimientos(cb) { subsMovs.add(cb); queueMicrotask(guardar); return () => subsMovs.delete(cb); },
    onUsuario(cb) { subsUsuario.add(cb); queueMicrotask(() => cb(estado.usuario)); return () => subsUsuario.delete(cb); },

    async entrar() {
      estado.usuario = { email: '' };
      try { sessionStorage.setItem(SESION, JSON.stringify(estado.usuario)); } catch { /* bloqueado */ }
      subsUsuario.forEach(cb => cb(estado.usuario));
    },
    async salir() {
      estado.usuario = null;
      try { sessionStorage.removeItem(SESION); } catch { /* bloqueado */ }
      subsUsuario.forEach(cb => cb(null));
    },

    // Una operación (ingreso o egreso) puede tener varios renglones: modelo + talle + cantidad (+ precio).
    // Todos quedan con el mismo opId y se deshacen juntos.
    async registrar({ tipo, motivo = '', nota = '', lineas }) {
      const opId = id();
      const fecha = Date.now();
      const ids = [];
      for (const l of lineas) {
        const m = estado.modelos[l.modelo.id];
        m.talles[l.talle] = (m.talles[l.talle] || 0) + l.delta;
        const mov = { id: id(), opId, modeloId: l.modelo.id, modelo: m.nombre, talle: l.talle, delta: l.delta,
                      tipo, motivo, nota, precio: l.precio ?? null, costo: l.costo ?? null, fecha, quien: estado.usuario?.email || '' };
        estado.movs.unshift(mov);
        ids.push(mov.id);
      }
      estado.movs = estado.movs.slice(0, 3000);
      guardar();
      return ids;
    },

    async deshacer(ids) {
      for (const movId of ids) {
        const mov = estado.movs.find(x => x.id === movId);
        if (!mov) continue;
        const m = estado.modelos[mov.modeloId];
        if (m) m.talles[mov.talle] = (m.talles[mov.talle] || 0) - mov.delta;
        estado.movs = estado.movs.filter(x => x.id !== movId);
      }
      guardar();
    },

    async guardarModelo(modeloId, datos) {
      const nuevoId = modeloId || id();
      estado.modelos[nuevoId] = { ...(estado.modelos[nuevoId] || {}), ...structuredClone(datos) };
      guardar();
      return nuevoId;
    },

    async borrarModelo(modeloId) {
      delete estado.modelos[modeloId];
      guardar();
    },

    // Solo agrega los que faltan: nunca pisa stock ya cargado.
    async cargarIniciales() {
      CATALOGO_INICIAL.forEach(m => { if (!estado.modelos[m.id]) estado.modelos[m.id] = structuredClone(m); });
      guardar();
    },
  };
}

// ---------------------------------------------------------------- Firebase

async function crearFirebase() {
  const V = 'https://www.gstatic.com/firebasejs/10.14.1';
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${V}/firebase-app.js`),
    import(`${V}/firebase-firestore.js`),
    import(`${V}/firebase-auth.js`),
  ]);
  const {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, onSnapshot, query, orderBy, limit, writeBatch, increment,
    serverTimestamp, FieldPath, setDoc, updateDoc, deleteDoc, getDoc,
  } = fs;

  const app = initializeApp(firebaseConfig);
  // Caché local: la carga se ve al instante y funciona aunque se corte la señal.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const auth = au.getAuth(app);
  await au.setPersistence(auth, au.browserLocalPersistence);

  const colModelos = collection(db, 'modelos');
  const colMovs = collection(db, 'movimientos');

  return {
    onModelos(cb, alError) {
      return onSnapshot(colModelos, snap => {
        cb(ordenarModelos(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
      }, alError);
    },

    onMovimientos(cb, alError) {
      const q = query(colMovs, orderBy('fecha', 'desc'), limit(3000));
      return onSnapshot(q, snap => {
        cb(snap.docs.map(d => {
          const x = d.data({ serverTimestamps: 'estimate' });
          return { ...x, id: d.id, fecha: x.fecha?.toDate?.() || new Date() };
        }));
      }, alError);
    },

    onUsuario(cb) { return au.onAuthStateChanged(auth, u => cb(u ? { email: u.email } : null)); },
    entrar(email, clave) { return au.signInWithEmailAndPassword(auth, email, clave); },
    salir() { return au.signOut(auth); },

    // Sin await a propósito en el commit: la caché local actualiza la pantalla al instante
    // y Firebase sincroniza atrás (también si no hay señal en ese momento).
    async registrar({ tipo, motivo = '', nota = '', lineas }) {
      const batch = writeBatch(db);
      const opId = doc(colMovs).id;
      const ids = [];
      for (const l of lineas) {
        const movRef = doc(colMovs);
        batch.update(doc(colModelos, l.modelo.id), new FieldPath('talles', l.talle), increment(l.delta));
        batch.set(movRef, {
          opId, modeloId: l.modelo.id, modelo: l.modelo.nombre, talle: l.talle, delta: l.delta,
          tipo, motivo, nota, precio: l.precio ?? null, costo: l.costo ?? null,
          fecha: serverTimestamp(), quien: auth.currentUser?.email || '',
        });
        ids.push(movRef.id);
      }
      batch.commit().catch(e => dispatchEvent(new CustomEvent('tss-error', { detail: e })));
      return ids;
    },

    async deshacer(ids) {
      const snaps = await Promise.all(ids.map(movId => getDoc(doc(colMovs, movId))));
      const batch = writeBatch(db);
      for (const snap of snaps) {
        if (!snap.exists()) continue;
        const mov = snap.data();
        batch.update(doc(colModelos, mov.modeloId), new FieldPath('talles', mov.talle), increment(-mov.delta));
        batch.delete(snap.ref);
      }
      batch.commit().catch(e => dispatchEvent(new CustomEvent('tss-error', { detail: e })));
    },

    // Al editar se usa update: reemplaza el mapa de talles entero (así se pueden sacar talles).
    async guardarModelo(modeloId, datos) {
      if (modeloId) { await updateDoc(doc(colModelos, modeloId), datos); return modeloId; }
      const ref = doc(colModelos);
      await setDoc(ref, datos);
      return ref.id;
    },

    async borrarModelo(modeloId) {
      await deleteDoc(doc(colModelos, modeloId));
    },

    // Solo agrega los que faltan: nunca pisa stock ya cargado.
    async cargarIniciales(idsExistentes = []) {
      const batch = writeBatch(db);
      CATALOGO_INICIAL.filter(m => !idsExistentes.includes(m.id))
        .forEach(({ id, ...m }) => batch.set(doc(colModelos, id), m));
      await batch.commit();
    },
  };
}

Object.assign(window.TSS, {
  MODO_LOCAL, ordenarTalles, totalModelo, fotoPrincipal,
  datos: MODO_LOCAL ? Promise.resolve(crearDemo()) : crearFirebase(),
});
})();
