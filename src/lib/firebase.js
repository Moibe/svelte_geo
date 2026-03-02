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
 * Obtiene la configuración de map-interaction desde Firestore
 * Documento: geo-conversiones, campo: map-interaction (boolean)
 * @returns {Promise<boolean>}
 */
export async function getMapInteractionConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-conversiones');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      return data['map-interaction'] || false;
    }
    return false;
  } catch (err) {
    error('❌ Error al cargar map-interaction:', err);
    return false;
  }
}

/**
 * Escucha cambios en tiempo real de map-interaction
 * @param {Function} callback
 * @returns {Function} Función para detener la escucha
 */
export function onMapInteractionChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-conversiones');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data['map-interaction'] || false);
    } else {
      callback(false);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de map-interaction:', err);
    callback(false);
  });
}

/**
 * Obtiene la configuración de map-wait desde Firestore.
 * Documento: geo-conversiones, campos: map-wait (boolean), map-wait-time (number, segundos)
 * @returns {Promise<{ enabled: boolean, waitTime: number }>}
 */
export async function getMapWaitConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-conversiones');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      return {
        enabled: data['map-wait'] || false,
        waitTime: typeof data['map-wait-time'] === 'number' ? data['map-wait-time'] : 30,
      };
    }
    return { enabled: false, waitTime: 30 };
  } catch (err) {
    error('❌ Error al cargar map-wait:', err);
    return { enabled: false, waitTime: 30 };
  }
}

/**
 * Escucha cambios en tiempo real de map-wait y map-wait-time
 * @param {Function} callback - recibe { enabled, waitTime }
 * @returns {Function} Función para detener la escucha
 */
export function onMapWaitChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-conversiones');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback({
        enabled: data['map-wait'] || false,
        waitTime: typeof data['map-wait-time'] === 'number' ? data['map-wait-time'] : 30,
      });
    } else {
      callback({ enabled: false, waitTime: 30 });
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de map-wait:', err);
    callback({ enabled: false, waitTime: 30 });
  });
}

/**
 * Obtiene la configuración de phone-search desde Firestore.
 * Documento: geo-conversiones, campo: phone-search (boolean)
 * @returns {Promise<boolean>}
 */
export async function getPhoneSearchConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-conversiones');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      return data['phone-search'] || false;
    }
    return false;
  } catch (err) {
    error('❌ Error al cargar phone-search:', err);
    return false;
  }
}

/**
 * Escucha cambios en tiempo real de phone-search
 * @param {Function} callback
 * @returns {Function} Función para detener la escucha
 */
export function onPhoneSearchChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-conversiones');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data['phone-search'] || false);
    } else {
      callback(false);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de phone-search:', err);
    callback(false);
  });
}

/**
 * Obtiene la configuración de sell-pop desde Firestore.
 * Documento: geo-conversiones, campo: sell-pop (boolean)
 * @returns {Promise<boolean>}
 */
export async function getSellPopConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-conversiones');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      return data['sell-pop'] || false;
    }
    return false;
  } catch (err) {
    error('❌ Error al cargar sell-pop:', err);
    return false;
  }
}

/**
 * Escucha cambios en tiempo real de sell-pop
 * @param {Function} callback
 * @returns {Function} Función para detener la escucha
 */
export function onSellPopChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-conversiones');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data['sell-pop'] || false);
    } else {
      callback(false);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de sell-pop:', err);
    callback(false);
  });
}

// true si estamos en entorno local de desarrollo (npm run dev)
const isDev = import.meta.env.DEV;

/**
 * Obtiene el price ID de prueba y si está activo desde Firestore
 * Campos en geo-stripe: 'price-test' (string) y 'price-testing' (boolean)
 * @returns {Promise<string|null>} price ID override o null si está desactivado
 */
export async function getPriceTestConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-stripe');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const data = configSnap.data();
      const isActive = data['price-testing'] || false;
      const priceId = data['price-test'] || null;
      return isActive && priceId ? priceId : null;
    }
    return null;
  } catch (err) {
    error('❌ Error al cargar price-test:', err);
    return null;
  }
}

/**
 * Escucha cambios en tiempo real del price ID de prueba para producción
 * @param {Function} callback
 * @returns {Function} Función para detener la escucha
 */
export function onPriceTestChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-stripe');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const isActive = data['price-testing'] || false;
      const priceId = data['price-test'] || null;
      callback(isActive && priceId ? priceId : null);
    } else {
      callback(null);
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de price-test:', err);
    callback(null);
  });
}

/**
 * Obtiene la configuración de verbose (si se muestran logs en consola)
 * Lee 'verbose-dev' en desarrollo y 'verbose-prod' en producción
 * @returns {Promise<boolean>} true = mostrar logs, false = ocultar logs
 */
export async function getVerboseConfig() {
  try {
    const configRef = doc(db, 'configuraciones', 'geo-verbose');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      const data = configSnap.data();
      const field = isDev ? 'verbose-dev' : 'verbose-prod';
      const verboseEnabled = data[field] !== undefined ? data[field] : true;
      return verboseEnabled;
    }
    
    return true; // Default a mostrar logs si no existe el documento
  } catch (err) {
    error('❌ Error al cargar configuración verbose:', err);
    return true; // Default a mostrar logs si falla
  }
}

/**
 * Escucha cambios en tiempo real de la configuración verbose
 * Lee 'verbose-dev' en desarrollo y 'verbose-prod' en producción
 * @param {Function} callback - Función a llamar cuando cambie (recibe boolean)
 * @returns {Function} Función para detener la escucha
 */
export function onVerboseChange(callback) {
  const configRef = doc(db, 'configuraciones', 'geo-verbose');
  const field = isDev ? 'verbose-dev' : 'verbose-prod';

  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const verboseEnabled = data[field] !== undefined ? data[field] : true;
      callback(verboseEnabled);
    } else {
      callback(true); // Default a mostrar logs
    }
  }, (err) => {
    error('❌ Error al escuchar cambios de verbose:', err);
    callback(true);
  });
}
