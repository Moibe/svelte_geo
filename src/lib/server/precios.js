import catalogo200 from '../../../static/product-details.json'
import catalogo100 from '../../../static/product-details-100.json'

/**
 * Catalogo de precios de Stripe, resuelto EN EL SERVIDOR.
 *
 * Antes el navegador se bajaba el archivo entero para usar UNA entrada:
 * 25.7 KB del catalogo de $200 o 48.8 KB del de $100, en cada visita que
 * abriera el modal. Ahora el servidor manda solo el precio que toca.
 *
 * Los JSON se importan desde static/ en vez de duplicarlos: siguen siendo el
 * mismo unico archivo que regenera `npm run fetch-product-details`, y siguen
 * sirviendose en /product-details.json por si algo externo los consume. Vite
 * los inlinea en el bundle del servidor, asi que no hay lectura de disco en
 * tiempo de request.
 */

const CATALOGOS = {
  100: catalogo100,
  200: catalogo200,
}

/** Pais de respaldo del catalogo, igual que el que ya usaba el cliente. */
const PAIS_RESPALDO = '+52'

/**
 * Detalles del producto para un pais y nivel de precio.
 *
 * Devuelve null cuando no hay nada que cobrar, en vez de inventar un precio:
 * el modal muestra el error y deshabilita la compra. Es la misma leccion que
 * el fallback silencioso a Mexico de stripe.js, que ante CUALQUIER fallo
 * cobraba MXN con price_id de produccion a un cliente de cualquier pais.
 *
 * @param {string} pais  - codigo telefonico, ej '+52'
 * @param {number} nivel - 100 o 200
 * @returns {{detalles: object, exacto: boolean}|null}
 */
export function resolverPrecio(pais, nivel) {
  const catalogo = CATALOGOS[nivel] || CATALOGOS[200]

  const exacto = Boolean(catalogo[pais])
  const detalles = catalogo[pais] || catalogo[PAIS_RESPALDO]

  if (!detalles || !detalles.priceId) return null

  return { detalles, exacto }
}
