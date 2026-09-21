import { doc, getDoc } from 'firebase/firestore'
import { db } from '$lib/firebase.js'

/**
 * Cache en memoria de los flags de Firestore, para que el servidor pueda
 * renderizar la primera pantalla ya decidida en vez de mandar un spinner.
 *
 * ---
 *
 * POR QUÉ SE SONDEA Y NO SE USA onSnapshot (esto es deliberado)
 *
 * Lo natural sería poner un onSnapshot por documento y tener el cache siempre
 * fresco. No se hace, y el motivo importa: un stream gRPC persistente dentro de
 * un proceso pm2 que corre meses se puede congelar por un blip de red o por un
 * token vencido SIN lanzar error y SIN escribir en el log. Los flags quedarían
 * clavados en RAM y los toggles dejarían de funcionar en silencio — que es
 * exactamente la falla que este cache viene a evitar, reintroducida por el
 * cache.
 *
 * Un sondeo periódico no tiene ese modo de falla: si una lectura falla, se
 * sabe, se registra y /api/health lo expone.
 *
 * Y el costo de sondear es bajo porque el cache NO necesita estar al día al
 * segundo: solo tiene que estar bien para el PRIMER PAINT. El cliente conserva
 * sus onSnapshot, así que cambiar un flag desde la consola de Firebase sigue
 * llegando al instante a todas las sesiones abiertas. Lo único que tarda hasta
 * un intervalo es lo que ve alguien que entra justo en esa ventana.
 */

const COLECCION = 'configuraciones'
const DOCUMENTOS = ['geo-modes', 'geo-stripe', 'geo-wait', 'geo-sell', 'geo-verbose']

/** Cada cuánto se refresca el cache. */
const INTERVALO_MS = 60_000

/**
 * Valores con los que se renderiza si Firestore todavía no respondió o falló.
 * Son los MISMOS defaults que ya usaba el cliente, para que un fallo del cache
 * degrade exactamente al comportamiento anterior y no a otro distinto.
 */
export const FLAGS_POR_DEFECTO = {
  safeMode: false,
  isProductionMode: false, // sandbox por seguridad
  sellEnabled: true,
  priceLevel: 200,
  waitSafe: 30,
  waitProd: 30,
}

let cache = { ...FLAGS_POR_DEFECTO }
let actualizadoEn = null
let ultimoError = null
let cargaInicial = null
let temporizador = null

/** Traduce los documentos crudos a los flags que necesita el primer paint. */
function mapear(docs) {
  const modes = docs['geo-modes'] || {}
  const stripe = docs['geo-stripe'] || {}
  const wait = docs['geo-wait'] || {}
  const sell = docs['geo-sell'] || {}

  return {
    safeMode: modes['safe-mode'] || false,
    isProductionMode: stripe.prod || false,
    sellEnabled: sell.sell !== undefined ? sell.sell : true,
    priceLevel: stripe['price-level'] || 200,
    waitSafe: wait['wait-safe'] || 30,
    waitProd: wait['wait-prod'] || 30,
  }
}

async function refrescar() {
  try {
    const leidos = await Promise.all(
      DOCUMENTOS.map(async (id) => {
        const snap = await getDoc(doc(db, COLECCION, id))
        return [id, snap.exists() ? snap.data() : null]
      })
    )

    cache = mapear(Object.fromEntries(leidos))
    actualizadoEn = Date.now()
    ultimoError = null
  } catch (err) {
    // El cache anterior se CONSERVA a propósito: unos flags de hace un minuto
    // son mejores que los defaults. Lo que no se toca es `actualizadoEn`, así
    // que /api/health delata que el cache se está quedando viejo.
    ultimoError = String(err?.message || err)
    console.error('[flags] no se pudo refrescar el cache de Firestore:', ultimoError)
  }
}

/**
 * Flags para renderizar. En el primer request tras un arranque espera la
 * lectura inicial; después devuelve el cache al instante.
 *
 * Esa espera es lo que evita que el primer visitante después de un deploy
 * reciba los defaults en vez de la configuración real.
 */
export async function obtenerFlags() {
  if (!cargaInicial) {
    cargaInicial = refrescar()

    // unref() para que este temporizador no mantenga vivo el proceso al apagarlo.
    temporizador = setInterval(refrescar, INTERVALO_MS)
    if (typeof temporizador.unref === 'function') temporizador.unref()
  }

  await cargaInicial

  return cache
}

/** Estado del cache, para /api/health. */
export function estadoDelCache() {
  return {
    actualizadoEn: actualizadoEn ? new Date(actualizadoEn).toISOString() : null,
    antiguedadSegundos: actualizadoEn ? Math.round((Date.now() - actualizadoEn) / 1000) : null,
    intervaloSegundos: INTERVALO_MS / 1000,
    ultimoError,
  }
}
