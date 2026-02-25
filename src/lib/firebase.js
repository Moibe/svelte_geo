import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { log, warn, error } from './logger.js';

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
      log('🔧 Configuración cargada:', data);
      return data['safe-mode'] || false;
    }
    
    warn('⚠️ No existe documento de configuración, usando false por defecto');
    return false;
  } catch (err) {
    error('❌ Error al cargar configuración:', err);
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
      log('🔄 Configuración actualizada:', data);
      callback(data['safe-mode'] || false);
    } else {
      callback(false);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios:', err);
    callback(false);
  });
}

/**
 * Obtiene la configuración de Stripe Mode desde Firestore
 * @returns {Promise<boolean>} true = producción, false = sandbox/test
 */
export async function getStripeModeConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-stripe');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      return data.prod || false;
    }
    
    warn('⚠️ No existe configuración de Stripe, usando SANDBOX por defecto');
    return false; // Default a sandbox por seguridad
  } catch (err) {
    error('❌ Error al cargar Stripe Mode:', err);
    return false; // Default a sandbox si falla
  }
}

/**
 * Escucha cambios en tiempo real de la configuración de Stripe Mode
 * @param {Function} callback - Función a llamar cuando cambie (recibe boolean: true=prod, false=sandbox)
 * @returns {Function} Función para detener la escucha
 */
export function onStripeModeChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-stripe');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const isProd = data.prod || false;
      log('💳 Stripe Mode actualizado:', isProd ? 'PRODUCTION' : 'SANDBOX');
      callback(isProd);
    } else {
      callback(false); // Default a sandbox
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de Stripe Mode:', err);
    callback(false);
  });
}

/**
 * Obtiene la configuración de tiempos de espera del modal desde Firestore
 * @returns {Promise<{waitSafe: number, waitProd: number}>} Tiempos en segundos
 */
export async function getModalWaitConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-wait');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      log('⏱️ Tiempos de espera cargados:', data);
      return {
        waitSafe: data['wait-safe'] || 30,
        waitProd: data['wait-prod'] || 30
      };
    }
    
    warn('⚠️ No existe configuración de tiempos, usando 30s por defecto');
    return { waitSafe: 30, waitProd: 30 };
  } catch (err) {
    error('❌ Error al cargar tiempos de espera:', err);
    return { waitSafe: 30, waitProd: 30 };
  }
}

/**
 * Escucha cambios en tiempo real de los tiempos de espera del modal
 * @param {Function} callback - Función a llamar cuando cambien (recibe {waitSafe, waitProd})
 * @returns {Function} Función para detener la escucha
 */
export function onModalWaitChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-wait');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const waitConfig = {
        waitSafe: data['wait-safe'] || 30,
        waitProd: data['wait-prod'] || 30
      };
      log('⏱️ Tiempos actualizados:', waitConfig);
      callback(waitConfig);
    } else {
      callback({ waitSafe: 30, waitProd: 30 });
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de tiempos:', err);
    callback({ waitSafe: 30, waitProd: 30 });
  });
}

/**
 * Obtiene la configuración de venta (si se muestra el modal de compra)
 * @returns {Promise<boolean>} true = mostrar modal, false = nunca mostrar
 */
export async function getSellConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-sell');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      const sellEnabled = data.sell !== undefined ? data.sell : true;
      log('💰 Venta de modal:', sellEnabled ? 'ACTIVADA' : 'DESACTIVADA');
      return sellEnabled;
    }
    
    warn('⚠️ No existe configuración de venta, activando modal por defecto');
    return true; // Default a mostrar modal
  } catch (err) {
    error('❌ Error al cargar configuración de venta:', err);
    return true; // Default a mostrar modal si falla
  }
}

/**
 * Escucha cambios en tiempo real de la configuración de venta
 * @param {Function} callback - Función a llamar cuando cambie (recibe boolean)
 * @returns {Function} Función para detener la escucha
 */
export function onSellChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-sell');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const sellEnabled = data.sell !== undefined ? data.sell : true;
      log('💰 Configuración de venta actualizada:', sellEnabled ? 'ACTIVADA' : 'DESACTIVADA');
      callback(sellEnabled);
    } else {
      callback(true); // Default a mostrar modal
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de venta:', err);
    callback(true);
  });
}

/**
 * Obtiene el Payment Method Configuration (PMC) de Stripe desde Firestore
 * @returns {Promise<string|null>} ID del PMC o null si no existe
 */
export async function getPMCConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-stripe');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      const pmc = data.PMC || null;
      log('💳 PMC cargado:', pmc || 'no configurado');
      return pmc;
    }
    
    return null;
  } catch (err) {
    error('❌ Error al cargar PMC:', err);
    return null;
  }
}

/**
 * Escucha cambios en tiempo real del Payment Method Configuration (PMC)
 * @param {Function} callback - Función a llamar cuando cambie (recibe string|null)
 * @returns {Function} Función para detener la escucha
 */
export function onPMCChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-stripe');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const pmc = data.PMC || null;
      log('💳 PMC actualizado:', pmc || 'no configurado');
      callback(pmc);
    } else {
      callback(null);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de PMC:', err);
    callback(null);
  });
}

/**
 * Obtiene la configuración de verbose (si se muestran logs en consola)
 * @returns {Promise<boolean>} true = mostrar logs, false = ocultar logs
 */
export async function getVerboseConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-verbose');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      const verboseEnabled = data.verbose !== undefined ? data.verbose : true;
      return verboseEnabled;
    }
    
    return true; // Default a mostrar logs en desarrollo
  } catch (err) {
    error('❌ Error al cargar configuración verbose:', err);
    return true; // Default a mostrar logs si falla
  }
}

/**
 * Escucha cambios en tiempo real de la configuración verbose
 * @param {Function} callback - Función a llamar cuando cambie (recibe boolean)
 * @returns {Function} Función para detener la escucha
 */
export function onVerboseChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-verbose');
  
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const verboseEnabled = data.verbose !== undefined ? data.verbose : true;
      callback(verboseEnabled);
    } else {
      callback(true); // Default a mostrar logs
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de verbose:', err);
    callback(true);
  });
}
