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
 * console.error condicional
 * Nota: Los errores siempre se muestran para debugging crítico
 * Puedes cambiar esto si quieres ocultarlos también
 */
export function error(...args) {
  if (isVerbose) {
    console.error(...args);
  }
}
