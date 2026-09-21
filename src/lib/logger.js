/**
 * Logger condicional controlado por configuración verbose de Firebase
 * Cuando verbose=false, no se muestran logs (versión producción)
 * Cuando verbose=true, se muestran todos los logs (desarrollo/debug)
 */

import { writable } from 'svelte/store';

// Store de Svelte para compartir el estado verbose entre módulos
export const verboseStore = writable(true); // Default true para desarrollo

let isVerbose = true;

// Suscribirse a cambios del store
verboseStore.subscribe(value => {
  isVerbose = value;
});

/**
 * console.log condicional
 */
export function log(...args) {
  if (isVerbose) {
    console.log(...args);
  }
}

/**
 * console.warn condicional
 */
export function warn(...args) {
  if (isVerbose) {
    console.warn(...args);
  }
}

/**
 * console.error — SIEMPRE se imprime, sin importar el flag verbose.
 *
 * Antes estaba condicionado a isVerbose, lo que significa que apagar verbose
 * en Firestore también apagaba los errores: la app podía estar fallando en
 * silencio y la consola se veía limpia. Un error es justamente lo que uno
 * quiere ver cuando decidió bajar el ruido.
 */
export function error(...args) {
  console.error(...args);
}
