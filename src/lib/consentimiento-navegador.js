import { MARCA_RECARGA_POR_CONSENTIMIENTO, analiticaPermitida, publicidadPermitida } from './consentimiento.js'

/**
 * Lo que el resto de la aplicación necesita saber del consentimiento, leído de donde lo
 * dejó el script de arranque (`window.__consent`, ver consentimiento-arranque.js).
 *
 * SOLO para el navegador. Son funciones comunes y no estado reactivo a propósito: las
 * usan módulos que no son componentes (el registro de conversiones, el almacenamiento)
 * y, en el servidor, un valor compartido entre visitantes sería un error. Lo reactivo
 * (el aviso en pantalla) vive en consent.svelte.js, una instancia por documento.
 */

/**
 * El estado actual: si esta visita pide consentimiento y qué eligió la persona.
 *
 * Si el script de arranque no corrió (un bloqueador, un error, una página que no lo
 * lleva) se asume lo MÁS ESTRICTO: región regulada y sin elección. Equivocarse hacia ahí
 * cuesta un registro de analítica; equivocarse hacia el otro lado, guardar datos de
 * alguien que no lo permitió.
 *
 * @returns {{ requerido: boolean, decision: {a: boolean, p: boolean}|null }}
 */
export function estadoDelNavegador() {
  const c = typeof window !== 'undefined' ? window.__consent : undefined

  if (!c || typeof c !== 'object') return { requerido: true, decision: null }

  // La COOKIE es la fuente de verdad: la elección de esta página es una copia en memoria que otra
  // pestaña puede haber dejado vieja. Se contrasta ANTES de contestar, así ninguna acción que pide
  // permiso (registrar actividad, guardar en el dispositivo) usa un permiso que ya se retiró.
  // Ver `sincronizar` en consentimiento-arranque.js.
  try {
    c.sincronizar?.()
  } catch {
    // Contrastar es un refuerzo: si falla, se usa la copia de esta página.
  }

  return { requerido: c.requerido !== false, decision: c.decision ?? null }
}

/** ¿Se puede medir el uso (Google Analytics, el registro propio de actividad)? */
export function analiticaOk() {
  const { requerido, decision } = estadoDelNavegador()

  return analiticaPermitida(requerido, decision)
}

/** ¿Se puede usar la publicidad (Google Ads)? */
export function publicidadOk() {
  const { requerido, decision } = estadoDelNavegador()

  return publicidadPermitida(requerido, decision)
}

/** ¿La persona permitió AL MENOS algo (analítica o publicidad)? */
export function algunaOk() {
  return analiticaOk() || publicidadOk()
}

/**
 * Ejecuta `accion` ya mismo si hay permiso de analítica y, si no, la deja esperando
 * a que la persona lo dé durante esta visita. Sirve para lo que se registra "una vez
 * al llegar" (la visita, un anuncio) y que, con el aviso en pantalla, ocurriría antes
 * de que se pueda contestar: sin esto, quien acepta a los cinco segundos no dejaría
 * rastro de que llegó.
 *
 * Si el permiso nunca llega, la acción no se ejecuta nunca. Devuelve una función que
 * cancela la espera.
 *
 * `clave` (opcional) identifica la espera: si ya hay UNA en espera con esa clave, no se agrega otra
 * (la primera manda). Sin esto, cada vez que se montara la portada sin que la persona hubiera
 * contestado quedaría una espera más, y al aceptar saldrían todas juntas, duplicadas.
 *
 * @param {() => void} accion
 * @param {string} [clave]
 * @returns {() => void}
 */
export function cuandoHayAnalitica(accion, clave) {
  if (analiticaOk()) {
    accion()
    return () => {}
  }

  if (typeof window === 'undefined') return () => {}

  if (clave && enEspera.has(clave)) return enEspera.get(clave)

  const cancelar = () => {
    window.removeEventListener('consent:cambio', alCambiar)
    if (clave && enEspera.get(clave) === cancelar) enEspera.delete(clave)
  }
  const alCambiar = () => {
    if (!analiticaOk()) return

    cancelar()
    accion()
  }

  window.addEventListener('consent:cambio', alCambiar)
  if (clave) enEspera.set(clave, cancelar)

  return cancelar
}

/** Las esperas con clave que siguen pendientes (solo existe en el navegador: ahí se llama). */
const enEspera = new Map()

/**
 * Marca que la página se va a recargar A PROPÓSITO por un cambio de consentimiento. Quien registra
 * cierres y recargas (page_close, page_refresh) la lee para no anotar como actividad de la persona
 * algo que provocó el aviso. Vive en sessionStorage: solo en esa pestaña, y se borra al consumirla.
 */
export function marcarRecargaPorConsentimiento() {
  try {
    sessionStorage.setItem(MARCA_RECARGA_POR_CONSENTIMIENTO, '1')
  } catch {
    // Sin sessionStorage la recarga se anota como una cualquiera: es solo ruido en una fila.
  }
}

/** ¿Hay una recarga por consentimiento en curso? (No la borra: la usa el cierre de la página.) */
export function hayRecargaPorConsentimiento() {
  try {
    return sessionStorage.getItem(MARCA_RECARGA_POR_CONSENTIMIENTO) === '1'
  } catch {
    return false
  }
}

/** ¿Esta carga viene de una recarga por consentimiento? La lee Y la borra. */
export function consumirRecargaPorConsentimiento() {
  try {
    const hay = sessionStorage.getItem(MARCA_RECARGA_POR_CONSENTIMIENTO) === '1'
    sessionStorage.removeItem(MARCA_RECARGA_POR_CONSENTIMIENTO)

    return hay
  } catch {
    return false
  }
}
