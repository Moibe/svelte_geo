import { eq, sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { flags } from './db/schema.js'

/**
 * Los flags, ahora en la base local de la app.
 *
 * ---
 *
 * POR QUÉ YA NO ES UN CACHE
 *
 * La versión anterior sondeaba Firestore cada 60s y guardaba el resultado en
 * RAM, porque cada lectura era un viaje a otro proveedor. Ahora la fuente es un
 * archivo en el mismo disco: leer es cuestión de microsegundos, así que no hay
 * nada que cachear — y desaparecen de un saque el sondeo, la antigüedad del
 * cache, el riesgo de servir valores viejos y todo el modo de falla que eso
 * traía.
 *
 * El efecto secundario más grande es que el SDK de Firebase deja de hacer falta
 * en el cliente: eran ~400 KB de JavaScript que cada visitante se bajaba.
 */

/**
 * Valores con los que se renderiza si la base todavía no tiene un flag.
 * Son los que estaban vivos en Firestore al migrar, no los del código viejo
 * (que en varios casos decían otra cosa).
 */
export const FLAGS_POR_DEFECTO = {
  safeMode: false,
  sellEnabled: true,
  isProductionMode: false,
  priceLevel: 200,
  priceTesting: false,
  priceTest: null,
  pmc: null,
  pmcTest: null,
  waitSafe: 30,
  waitProd: 30,
  mapWaitTime: 30,
  mapInteractionEnabled: false,
  mapWaitEnabled: false,
  sellPopEnabled: false,
  phoneSearchEnabled: false,
  verbose: true,
}

/**
 * De clave en la base al nombre que usa la app.
 * Tenerlo en UN lugar evita que el panel y la app llamen distinto a lo mismo.
 */
const NOMBRES = {
  'safe-mode': 'safeMode',
  sell: 'sellEnabled',
  'stripe-prod': 'isProductionMode',
  'price-level': 'priceLevel',
  'price-testing': 'priceTesting',
  'price-test': 'priceTest',
  pmc: 'pmc',
  'pmc-test': 'pmcTest',
  'wait-safe': 'waitSafe',
  'wait-prod': 'waitProd',
  'map-wait-time': 'mapWaitTime',
  'map-interaction': 'mapInteractionEnabled',
  'map-wait': 'mapWaitEnabled',
  'sell-pop': 'sellPopEnabled',
  'phone-search': 'phoneSearchEnabled',
  verbose: 'verbose',
}

/** Una fila cruda de la tabla -> su valor ya tipado. */
function parsear(fila) {
  try {
    return JSON.parse(fila.valor)
  } catch {
    console.error(`[flags] valor no parseable en "${fila.clave}": ${fila.valor}`)
    return null
  }
}

/** Los flags tal como los consume la app. */
export function obtenerFlags() {
  const filas = db.select().from(flags).all()

  const resultado = { ...FLAGS_POR_DEFECTO }

  for (const fila of filas) {
    const nombre = NOMBRES[fila.clave]
    if (!nombre) continue // flag en la base que el código todavía no usa

    const valor = parsear(fila)
    if (valor !== null) resultado[nombre] = valor
  }

  return resultado
}

/** Las filas completas, para armar el formulario del panel. */
export function obtenerFilasDeFlags() {
  return db
    .select()
    .from(flags)
    .orderBy(flags.orden)
    .all()
    .map((fila) => ({ ...fila, valor: parsear(fila) }))
}

/**
 * Guarda un flag. Valida el tipo contra lo que declara la fila, así el panel
 * no puede meter un texto donde la app espera un número.
 *
 * @returns {string|null} mensaje de error, o null si salió bien
 */
export function guardarFlag(clave, valorCrudo) {
  const [fila] = db.select().from(flags).where(eq(flags.clave, clave)).all()

  if (!fila) return `No existe el flag "${clave}"`

  let valor

  if (fila.tipo === 'boolean') {
    valor = valorCrudo === true || valorCrudo === 'true' || valorCrudo === 'on'
  } else if (fila.tipo === 'number') {
    valor = Number(valorCrudo)
    if (!Number.isFinite(valor)) return `"${fila.etiqueta}" tiene que ser un número`
  } else {
    valor = valorCrudo === null || valorCrudo === undefined ? '' : String(valorCrudo)
  }

  db.update(flags)
    .set({ valor: JSON.stringify(valor), actualizadoEn: sql`(datetime('now'))` })
    .where(eq(flags.clave, clave))
    .run()

  return null
}

/**
 * Invierte un flag booleano leyendo su valor ACTUAL de la base.
 *
 * Existe en vez de "mandá el valor invertido desde el formulario" porque ese
 * valor lo calcula el cliente al renderizar, y puede llegar viejo: si alguien
 * aprieta el interruptor mientras la pantalla todavía se está refrescando por
 * un guardado anterior, manda el valor de antes y el cambio no se aplica — el
 * interruptor se ve "pegado" sin ningún error. Decidiéndolo acá, el estado que
 * manda es el de la base y no hay nada que se pueda quedar viejo.
 *
 * @returns {{error: string}|{valor: boolean}}
 */
export function alternarFlag(clave) {
  const [fila] = db.select().from(flags).where(eq(flags.clave, clave)).all()

  if (!fila) return { error: `No existe el flag "${clave}"` }
  if (fila.tipo !== 'boolean') return { error: `"${fila.etiqueta}" no es un interruptor` }

  const valor = !parsear(fila)

  db.update(flags)
    .set({ valor: JSON.stringify(valor), actualizadoEn: sql`(datetime('now'))` })
    .where(eq(flags.clave, clave))
    .run()

  return { valor }
}

/**
 * Marca de versión de la configuración: el momento del cambio más reciente.
 *
 * La usa el endpoint que avisa a las pestañas abiertas. Antes eso lo hacía el
 * onSnapshot de Firestore; acá alcanza con comparar esta marca, sin mantener
 * ninguna conexión abierta contra la base.
 */
export function versionDeFlags() {
  const [fila] = db
    .select({ maximo: sql`MAX(actualizado_en)` })
    .from(flags)
    .all()

  return fila?.maximo ?? ''
}
