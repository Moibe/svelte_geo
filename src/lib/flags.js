import { browser } from '$app/environment'
import { log, warn } from './logger.js'

/**
 * Los flags, del lado del cliente.
 *
 * Reemplaza a firebase.js. La interfaz pública es la MISMA de antes
 * (getXConfig / onXChange) a propósito: así los ~26 sitios que ya los usaban
 * en +page.svelte y Modal.svelte no cambian una línea, y el cambio de fuente
 * queda contenido en este archivo.
 *
 * ---
 *
 * SONDEO EN VEZ DE onSnapshot
 *
 * Firestore empujaba los cambios por un canal abierto. Acá se pregunta cada
 * pocos segundos, mandando la versión que ya se tiene: si no cambió nada la
 * respuesta son unas decenas de bytes. El intercambio vale la pena porque a
 * cambio se fueron ~400 KB de SDK de Firebase del bundle de CADA visitante.
 *
 * El sondeo se pausa cuando la pestaña no está visible, que es la mayor parte
 * del tiempo en un móvil, y se dispara una consulta inmediata al volver: así
 * alguien que retoma la pestaña ve el estado al día sin esperar el intervalo.
 */

const INTERVALO_MS = 10_000

/** Valores iniciales; los reemplaza el servidor en cuanto la página carga. */
let actuales = {}
let version = null
let arrancado = false
let temporizador = null

/** nombre del flag -> Set de callbacks */
const suscriptores = new Map()

/** Resuelve cuando ya hay al menos una lectura. */
let listo
let marcarListo
function reiniciarEspera() {
  listo = new Promise((res) => {
    marcarListo = res
  })
}
reiniciarEspera()

/**
 * Siembra los valores que ya vinieron renderizados del servidor.
 *
 * Sin esto, la primera pregunta al endpoint tardaría un viaje de red y durante
 * ese rato getXConfig() devolvería nada — justo el parpadeo que el render en
 * servidor vino a eliminar.
 *
 * @param {Record<string, unknown>} iniciales
 */
export function sembrarFlags(iniciales) {
  if (!iniciales) return

  actuales = { ...iniciales }
  marcarListo()
}

function aplicar(nuevos) {
  const cambiados = []

  for (const [nombre, valor] of Object.entries(nuevos)) {
    // Comparación por JSON para que los objetos no cuenten como cambio en cada
    // sondeo solo por ser referencias distintas.
    if (JSON.stringify(actuales[nombre]) !== JSON.stringify(valor)) {
      actuales[nombre] = valor
      cambiados.push(nombre)
    }
  }

  for (const nombre of cambiados) {
    for (const cb of suscriptores.get(nombre) ?? []) {
      try {
        cb(actuales[nombre])
      } catch (err) {
        warn(`Error en el suscriptor de "${nombre}":`, err)
      }
    }
  }

  if (cambiados.length) log('🔄 Flags actualizados:', cambiados.join(', '))
}

async function consultar() {
  try {
    const url = version ? `/api/flags?version=${encodeURIComponent(version)}` : '/api/flags'
    const respuesta = await fetch(url)

    if (!respuesta.ok) return

    const datos = await respuesta.json()
    version = datos.version

    if (!datos.sinCambios) aplicar(datos.flags)

    marcarListo()
  } catch {
    // Un fallo de red acá no puede romper nada: se conservan los valores que
    // ya había y se reintenta en el próximo ciclo.
  }
}

function programar() {
  if (temporizador) clearInterval(temporizador)
  temporizador = setInterval(consultar, INTERVALO_MS)
}

/** Arranca el sondeo. Idempotente: llamarlo de más no duplica temporizadores. */
export function iniciarFlags() {
  if (!browser || arrancado) return
  arrancado = true

  consultar()
  programar()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(temporizador)
      temporizador = null
    } else {
      consultar() // al volver, el estado al día sin esperar el intervalo
      programar()
    }
  })
}

// ── API genérica ────────────────────────────────────────────────────────────

/** Valor actual de un flag, esperando la primera lectura si hace falta. */
export async function obtenerFlag(nombre) {
  if (browser) iniciarFlags()
  await listo
  return actuales[nombre]
}

/** Se suscribe a los cambios de un flag. Devuelve la función para cortar. */
export function alCambiarFlag(nombre, callback) {
  if (!suscriptores.has(nombre)) suscriptores.set(nombre, new Set())
  suscriptores.get(nombre).add(callback)

  if (browser) iniciarFlags()

  return () => suscriptores.get(nombre)?.delete(callback)
}

// ── Compatibilidad: mismos nombres y formas que tenía firebase.js ───────────
// Se conservan para que los sitios de llamada no cambien. Lo único que cambió
// es de dónde salen los datos.

export const getSafeModeConfig = () => obtenerFlag('safeMode')
export const onSafeModeChange = (cb) => alCambiarFlag('safeMode', cb)

export const getStripeModeConfig = () => obtenerFlag('isProductionMode')
export const onStripeModeChange = (cb) => alCambiarFlag('isProductionMode', cb)

export const getSellConfig = () => obtenerFlag('sellEnabled')
export const onSellChange = (cb) => alCambiarFlag('sellEnabled', cb)

export const getPriceLevelConfig = () => obtenerFlag('priceLevel')
export const onPriceLevelChange = (cb) => alCambiarFlag('priceLevel', cb)

export const getMapInteractionConfig = () => obtenerFlag('mapInteractionEnabled')
export const onMapInteractionChange = (cb) => alCambiarFlag('mapInteractionEnabled', cb)

export const getSellPopConfig = () => obtenerFlag('sellPopEnabled')
export const onSellPopChange = (cb) => alCambiarFlag('sellPopEnabled', cb)

export const getPhoneSearchConfig = () => obtenerFlag('phoneSearchEnabled')
export const onPhoneSearchChange = (cb) => alCambiarFlag('phoneSearchEnabled', cb)

export const getVerboseConfig = () => obtenerFlag('verbose')
export const onVerboseChange = (cb) => alCambiarFlag('verbose', cb)

/** Los dos tiempos de espera del modal, como un objeto (igual que antes). */
export async function getModalWaitConfig() {
  return { waitSafe: await obtenerFlag('waitSafe'), waitProd: await obtenerFlag('waitProd') }
}

export function onModalWaitChange(callback) {
  const emitir = () => callback({ waitSafe: actuales.waitSafe, waitProd: actuales.waitProd })
  const a = alCambiarFlag('waitSafe', emitir)
  const b = alCambiarFlag('waitProd', emitir)
  return () => {
    a()
    b()
  }
}

/** El flag de permanencia en mapa y su tiempo, juntos (igual que antes). */
export async function getMapWaitConfig() {
  return { enabled: await obtenerFlag('mapWaitEnabled'), waitTime: await obtenerFlag('mapWaitTime') }
}

export function onMapWaitChange(callback) {
  const emitir = () => callback({ enabled: actuales.mapWaitEnabled, waitTime: actuales.mapWaitTime })
  const a = alCambiarFlag('mapWaitEnabled', emitir)
  const b = alCambiarFlag('mapWaitTime', emitir)
  return () => {
    a()
    b()
  }
}

/**
 * PMC según el modo de Stripe. Devuelve el string o null, como antes.
 * @param {boolean} isProductionMode
 */
export async function getPMCConfig(isProductionMode = true) {
  return (await obtenerFlag(isProductionMode ? 'pmc' : 'pmcTest')) || null
}

export function onPMCChange(callback, isProductionMode = true) {
  const nombre = isProductionMode ? 'pmc' : 'pmcTest'
  return alCambiarFlag(nombre, (valor) => callback(valor || null))
}

/**
 * price_id de prueba, o null si la prueba está apagada.
 * Mantiene la regla de antes: solo devuelve el id si el switch está encendido.
 */
export async function getPriceTestConfig() {
  const activo = await obtenerFlag('priceTesting')
  const priceId = await obtenerFlag('priceTest')
  return activo && priceId ? priceId : null
}

export function onPriceTestChange(callback) {
  const emitir = () => {
    const activo = actuales.priceTesting
    const priceId = actuales.priceTest
    callback(activo && priceId ? priceId : null)
  }
  const a = alCambiarFlag('priceTesting', emitir)
  const b = alCambiarFlag('priceTest', emitir)
  return () => {
    a()
    b()
  }
}
