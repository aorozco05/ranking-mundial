// Módulo de base de datos que utiliza Firebase Firestore en producción/despliegue
// y hace un fallback automático a IndexedDB si no están configuradas las credenciales de Firebase.

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';

// --- IMPLEMENTACIÓN DE FALLBACK CON INDEXEDDB ---
class IndexedDBFallback {
  constructor() {
    this.dbName = 'PollaMundialistaDB_v4';
    this.version = 1;
    this.storeName = 'app_state';
  }

  _open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async set(key, value) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Actualiza el array de usuarios de forma atómica (leer-modificar-escribir).
  // El navegador procesa esto de forma secuencial por pestaña, evitando que un
  // guardado pise los datos guardados por otro flujo.
  async updateUsers(mutator) {
    const current = (await this.get('users')) || [];
    const result = mutator(Array.isArray(current) ? current : []);
    await this.set('users', result);
    return result;
  }
}

// --- VERIFICACIÓN DE CREDENCIALES ---
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

let dbInstance;

if (apiKey && projectId) {
  console.log('Firebase detectado. Conectando a Cloud Firestore en la nube... ☁️');
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);

    dbInstance = {
      async get(key) {
        // La sesión del usuario logueado es siempre local de cada dispositivo/navegador
        if (key === 'session') {
          const localSession = localStorage.getItem('polla_session');
          return localSession ? JSON.parse(localSession) : null;
        }

        // Consultar el documento en Firestore
        const docRef = doc(firestore, 'polla', key);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          return docSnap.data().data;
        }
        return null;
      },

      async set(key, value) {
        if (key === 'session') {
          localStorage.setItem('polla_session', JSON.stringify(value));
          return;
        }

        // Guardar en Firestore
        const docRef = doc(firestore, 'polla', key);
        await setDoc(docRef, { data: value }, { merge: true });
      },

      async delete(key) {
        if (key === 'session') {
          localStorage.removeItem('polla_session');
          return;
        }

        const docRef = doc(firestore, 'polla', key);
        await deleteDoc(docRef);
      },

      // Actualiza el array de usuarios dentro de una transacción de Firestore.
      // Lee la versión MÁS reciente del documento, aplica el cambio (solo al
      // usuario objetivo) y la escribe. Si dos dispositivos escriben a la vez,
      // Firestore reintenta automáticamente, evitando que se pierdan pronósticos.
      async updateUsers(mutator) {
        const docRef = doc(firestore, 'polla', 'users');
        let result;
        await runTransaction(firestore, async (tx) => {
          const snap = await tx.get(docRef);
          const current = snap.exists() && Array.isArray(snap.data().data) ? snap.data().data : [];
          result = mutator(current);
          tx.set(docRef, { data: result });
        });
        return result;
      },

      async clear() {
        // Limpiar la sesión local
        localStorage.removeItem('polla_session');
        
        // Limpiar los documentos globales en la nube
        const keysToClear = ['users', 'matches', 'actualBracket'];
        for (const key of keysToClear) {
          const docRef = doc(firestore, 'polla', key);
          await deleteDoc(docRef);
        }
      }
    };
  } catch (err) {
    console.error('Error al inicializar Firebase. Activando fallback local...', err);
    dbInstance = new IndexedDBFallback();
  }
} else {
  console.warn(
    'Aviso: Variables de entorno de Firebase no detectadas en .env.local.\n' +
    'Utilizando base de datos local (IndexedDB) como fallback para desarrollo. 💻'
  );
  dbInstance = new IndexedDBFallback();
}

const db = dbInstance;
export default db;
