/**
 * Sincronización del catálogo de precios (static/product-details*.json) con Stripe.
 *
 * Esta parte es PURA: recibe el catálogo, el producto y sus precios activos ya leídos, y
 * devuelve qué cambiaría. No habla con Stripe ni toca archivos (eso lo hace
 * fetch-product-details.js), para poder probarla con datos inventados.
 *
 * Por qué se sincroniza y no se regenera: el catálogo no se puede reconstruir solo desde
 * Stripe. La relación «código telefónico -> moneda» (170 entradas por nivel, con las de ISO
 * como KZ o CA para países que comparten código) la decidimos nosotros, y los apodos de los
 * precios en Stripe no son un dato fiable para deducirla. Lo que Stripe sí sabe es el precio
 * vigente de cada moneda, así que por cada entrada existente se refresca su precio y nada más.
 * Nunca agrega ni quita entradas.
 *
 * Los precios de Stripe son inmutables: «cambiar un precio» es crear uno nuevo y archivar el
 * viejo. Por eso el cambio normal es una entrada cuyo `priceId` ya no está activo: se
 * reemplaza por el único precio activo de esa misma moneda.
 */
import { toMajorUnits } from '../src/lib/currency.js'

const DESCRIPCION_POR_DEFECTO = 'Acceso a Mapa Completo'

/**
 * Monedas de TRES decimales en Stripe (el importe va en milésimas). src/lib/currency.js no las
 * convierte bien, así que aquí se rechazan en vez de adivinar: hoy el catálogo no tiene ninguna.
 */
const TRES_DECIMALES = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd'])

/**
 * El importe en unidades de la moneda, como texto: «1780» para JPY 1780, «8.99» para USD 899,
 * «100» para MXN 10000. Respeta las monedas sin subunidad (lo que el script viejo no hacía).
 * Lanza si el importe no es utilizable o la moneda es de tres decimales.
 *
 * @param {number} unitAmount - price.unit_amount tal cual viene de Stripe
 * @param {string} moneda     - price.currency
 * @returns {string}
 */
export function cifraDeImporte(unitAmount, moneda) {
  const codigo = String(moneda || '').toLowerCase()
  if (TRES_DECIMALES.has(codigo)) {
    throw new Error(`${codigo.toUpperCase()} es una moneda de tres decimales: revisar a mano`)
  }

  const valor = toMajorUnits(unitAmount, codigo)
  if (valor === null) throw new Error('el precio no trae un importe utilizable')

  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2)
}

/**
 * El campo `formatted` del catálogo: símbolo y cifra sin código de moneda («$200», «¥1780»).
 *
 * Es un texto de respaldo (el modal calcula el suyo desde unit_amount), así que solo importa que
 * la CIFRA sea la correcta. Si la que ya tiene la entrada lo es, se conserva tal cual; si no, se
 * corrige solo la cifra y se respeta el símbolo que ya traía («L11» pasa a «L1100», no a
 * «ALL1100»). Reescribir símbolos sin razón («TWD365» por «NT$365») solo llenaría de ruido la
 * lista de cambios. Únicamente cuando el texto no trae cifra se genera uno con Intl.
 *
 * @param {string|undefined} actual - el `formatted` que ya tiene la entrada
 * @param {number} unitAmount
 * @param {string} moneda
 * @returns {string}
 */
export function etiquetaDeImporte(actual, unitAmount, moneda) {
  const cifra = cifraDeImporte(unitAmount, moneda)

  // La primera cifra del texto, sin separadores de miles: «Bs.40» -> «40», «L£51500000» -> «51500000».
  const encontrada = typeof actual === 'string' ? actual.match(/\d[\d.,]*/) : null
  if (encontrada) {
    return encontrada[0].replace(/,/g, '') === cifra ? actual : actual.replace(encontrada[0], cifra)
  }

  const codigo = String(moneda).toUpperCase()
  let simbolo = codigo
  try {
    const partes = new Intl.NumberFormat('en-US', { style: 'currency', currency: codigo, currencyDisplay: 'narrowSymbol' }).formatToParts(0)
    simbolo = partes.find((p) => p.type === 'currency')?.value || codigo
  } catch {
    // Moneda que Intl no conoce: el código sirve de símbolo.
  }
  return `${simbolo}${cifra}`
}

/**
 * ¿Es un precio de prueba (el de los 10 pesos del modo `price-testing`)? Nunca debe quedar en
 * el catálogo ni ser candidato a reemplazar a un precio real: cobraría la prueba a todo el mundo.
 *
 * @param {{id: string, nickname?: string|null}} precio
 * @param {Set<string>} idsDePrueba - ids conocidos de precios de prueba (VITE_STRIPE_TEST_PRICE_ID)
 */
export function esPrecioDePrueba(precio, idsDePrueba) {
  return idsDePrueba.has(precio.id) || /\btest\b/i.test(precio.nickname || '')
}

/**
 * Qué cambiaría en un catálogo para ponerlo al día con Stripe.
 *
 * @param {object} args
 * @param {Record<string, any>} args.catalogo - contenido actual del JSON (no se modifica)
 * @param {{id: string, name: string, description?: string|null}} args.producto - el producto en Stripe
 * @param {Array<{id: string, currency: string, unit_amount: number|null, nickname?: string|null, recurring?: any}>} args.precios
 *        - los precios ACTIVOS de ese producto
 * @param {Set<string>} [args.idsDePrueba]
 * @returns {{
 *   catalogo: Record<string, any>,
 *   cambios: Array<{codigo: string, moneda: string, campos: Array<{campo: string, de: any, a: any}>}>,
 *   errores: Array<{codigo: string, problema: string, detalle: string}>,
 *   sinUsar: Array<object>,
 * }} `catalogo` es la copia ya actualizada (la entrada con error queda como estaba)
 */
export function planificar({ catalogo, producto, precios, idsDePrueba = new Set() }) {
  const nuevo = structuredClone(catalogo)
  const cambios = []
  const errores = []

  const activos = new Map(precios.map((p) => [p.id, p]))

  // Candidatos a reemplazar un precio archivado: los activos de cada moneda, sin los de prueba.
  const candidatos = new Map()
  for (const p of precios) {
    if (p.recurring || esPrecioDePrueba(p, idsDePrueba)) continue
    const moneda = String(p.currency).toLowerCase()
    if (!candidatos.has(moneda)) candidatos.set(moneda, [])
    candidatos.get(moneda).push(p)
  }

  const usados = new Set()

  for (const [codigo, entrada] of Object.entries(nuevo)) {
    if (!entrada || typeof entrada !== 'object' || !entrada.price || !entrada.priceId) {
      errores.push({ codigo, problema: 'entrada-incompleta', detalle: 'la entrada no trae priceId o price' })
      continue
    }

    const moneda = String(entrada.price.currency || '').toLowerCase()
    let precio = activos.get(entrada.priceId)

    if (!precio) {
      const lista = candidatos.get(moneda) || []
      if (lista.length === 0) {
        errores.push({ codigo, problema: 'sin-precio-activo', detalle: `${entrada.priceId} ya no está activo y no hay otro precio activo en ${moneda.toUpperCase()}` })
        continue
      }
      if (lista.length > 1) {
        errores.push({ codigo, problema: 'ambiguo', detalle: `${entrada.priceId} ya no está activo y hay ${lista.length} candidatos en ${moneda.toUpperCase()} (${lista.map((p) => p.id).join(', ')}): archiva los que sobren en Stripe` })
        continue
      }
      precio = lista[0]
    } else if (esPrecioDePrueba(precio, idsDePrueba)) {
      errores.push({ codigo, problema: 'precio-de-prueba', detalle: `el catálogo apunta al precio de prueba ${precio.id}` })
      continue
    } else if (String(precio.currency).toLowerCase() !== moneda) {
      errores.push({ codigo, problema: 'moneda-distinta', detalle: `la entrada dice ${moneda.toUpperCase()} y ${precio.id} es ${String(precio.currency).toUpperCase()}` })
      continue
    }

    let formatted
    try {
      formatted = etiquetaDeImporte(entrada.price.formatted, precio.unit_amount, precio.currency)
    } catch (error) {
      errores.push({ codigo, problema: 'importe', detalle: `${precio.id}: ${error.message}` })
      continue
    }

    usados.add(precio.id)

    const campos = []
    const poner = (objeto, clave, valor, nombre) => {
      if ((objeto[clave] ?? null) !== valor) {
        if (nombre) campos.push({ campo: nombre, de: objeto[clave] ?? null, a: valor })
        objeto[clave] = valor
      }
    }

    // `price.id` siempre acompaña a `priceId`: no se lista aparte.
    poner(entrada, 'priceId', precio.id, 'priceId')
    poner(entrada.price, 'id', precio.id)
    poner(entrada.price, 'unit_amount', precio.unit_amount, 'importe')
    poner(entrada.price, 'currency', String(precio.currency).toLowerCase(), 'moneda')
    poner(entrada.price, 'formatted', formatted, 'texto')
    poner(entrada.price, 'nickname', precio.nickname ?? null, 'apodo')

    entrada.product ??= {}
    poner(entrada.product, 'id', producto.id, 'producto')
    poner(entrada.product, 'name', producto.name, 'nombre del producto')
    poner(entrada.product, 'description', producto.description || entrada.product.description || DESCRIPCION_POR_DEFECTO, 'descripción')

    if (campos.length > 0) cambios.push({ codigo, moneda, campos })
  }

  // Precios activos que ninguna entrada usa (monedas que ningún país cubre todavía).
  const sinUsar = precios.filter((p) => !usados.has(p.id) && !p.recurring && !esPrecioDePrueba(p, idsDePrueba))

  return { catalogo: nuevo, cambios, errores, sinUsar }
}

/**
 * Cómo está escrito un archivo hoy, para volver a escribirlo igual (el árbol de trabajo está en
 * CRLF): con los mismos saltos de línea y con o sin salto al final. Así, un catálogo sin cambios
 * se reescribe idéntico byte a byte y git no ve nada.
 *
 * @param {string} texto
 */
export function estiloDe(texto) {
  return { crlf: texto.includes('\r\n'), saltoFinal: texto.endsWith('\n') }
}

/**
 * @param {object} catalogo
 * @param {{crlf: boolean, saltoFinal: boolean}} estilo
 */
export function serializar(catalogo, estilo) {
  let texto = JSON.stringify(catalogo, null, 2)
  if (estilo.saltoFinal) texto += '\n'
  return estilo.crlf ? texto.replace(/\n/g, '\r\n') : texto
}
