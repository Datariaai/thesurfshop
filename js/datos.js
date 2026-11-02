// Capa de datos: misma interfaz para Firebase (real) y para el modo prueba (localStorage).
//
// modelos/{id}:     { nombre, marca, color, precio, fotos[], fotoData, orden, talles: { "32": 3, ... } }
// movimientos/{id}: { modeloId, modelo, talle, delta, tipo: venta|ingreso|ajuste, fecha, quien }

// Script común (sin módulos) para que funcione abriendo el HTML directo desde la carpeta.
(function () {
const firebaseConfig = window.TSS_FIREBASE || {};
const { CATALOGO_INICIAL } = window.TSS;

const MODO_PRUEBA = !firebaseConfig.apiKey;

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

// ---------------------------------------------------------------- modo prueba

function crearDemo() {
  const CLAVE = 'tss-demo-v1';
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

  return {
    onModelos(cb) { subsModelos.add(cb); queueMicrotask(guardar); return () => subsModelos.delete(cb); },
    onMovimientos(cb) { subsMovs.add(cb); queueMicrotask(guardar); return () => subsMovs.delete(cb); },
    onUsuario(cb) { subsUsuario.add(cb); queueMicrotask(() => cb(estado.usuario)); return () => subsUsuario.delete(cb); },

    async entrar(email) {
      estado.usuario = { email: email || 'prueba@thesurfshop.ar' };
      guardar(); subsUsuario.forEach(cb => cb(estado.usuario));
    },
    async salir() {
      estado.usuario = null;
      guardar(); subsUsuario.forEach(cb => cb(null));
    },

    async mover(modelo, talle, delta, tipo) {
      const m = estado.modelos[modelo.id];
      m.talles[talle] = (m.talles[talle] || 0) + delta;
      const mov = { id: id(), modeloId: modelo.id, modelo: m.nombre, talle, delta, tipo,
                    fecha: Date.now(), quien: estado.usuario?.email || '' };
      estado.movs.unshift(mov);
      estado.movs = estado.movs.slice(0, 500);
      guardar();
      return mov.id;
    },

    async deshacer(movId) {
      const mov = estado.movs.find(x => x.id === movId);
      if (!mov) return;
      const m = estado.modelos[mov.modeloId];
      if (m) m.talles[mov.talle] = (m.talles[mov.talle] || 0) - mov.delta;
      estado.movs = estado.movs.filter(x => x.id !== movId);
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
      const q = query(colMovs, orderBy('fecha', 'desc'), limit(400));
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
    async mover(modelo, talle, delta, tipo) {
      const batch = writeBatch(db);
      const movRef = doc(colMovs);
      batch.update(doc(colModelos, modelo.id), new FieldPath('talles', talle), increment(delta));
      batch.set(movRef, {
        modeloId: modelo.id, modelo: modelo.nombre, talle, delta, tipo,
        fecha: serverTimestamp(), quien: auth.currentUser?.email || '',
      });
      batch.commit().catch(e => dispatchEvent(new CustomEvent('tss-error', { detail: e })));
      return movRef.id;
    },

    async deshacer(movId) {
      const movRef = doc(colMovs, movId);
      const snap = await getDoc(movRef);
      if (!snap.exists()) return;
      const mov = snap.data();
      const batch = writeBatch(db);
      batch.update(doc(colModelos, mov.modeloId), new FieldPath('talles', mov.talle), increment(-mov.delta));
      batch.delete(movRef);
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
  MODO_PRUEBA, ordenarTalles, totalModelo, fotoPrincipal,
  datos: MODO_PRUEBA ? Promise.resolve(crearDemo()) : crearFirebase(),
});
})();
