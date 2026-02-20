import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Obtiene la configuración de Safe Mode desde Firestore
 * @returns {Promise<boolean>} Estado del Safe Mode
 */
export async function getSafeModeConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-modes');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      console.log('🔧 Configuración cargada:', data);
      return data['safe-mode'] || false;
    }
    
    console.warn('⚠️ No existe documento de configuración, usando false por defecto');
    return false;
  } catch (error) {
    console.error('❌ Error al cargar configuración:', error);
    return false;
  }
}

/**
 * Escucha cambios en tiempo real de la configuración de Safe Mode
 * @param {Function} callback - Función a llamar cuando cambie la configuración
 * @returns {Function} Función para detener la escucha
 */
export function onSafeModeChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-modes');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      console.log('🔄 Configuración actualizada:', data);
      callback(data['safe-mode'] || false);
    } else {
      callback(false);
    }
  }, (error) => {
    console.error('❌ Error al escuchar cambios:', error);
    callback(false);
  });
}
