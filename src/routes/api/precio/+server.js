import { error, json } from '@sveltejs/kit'
import { resolverPrecio } from '$lib/server/precios.js'

/**
 * Precio para un pais y nivel: GET /api/precio?pais=%2B52&nivel=100
 *
 * Reemplaza el fetch del catalogo entero que hacia el navegador. Devuelve la
 * MISMA forma de objeto que antes (priceId, product, price) para que el modal
 * no tenga que cambiar.
 *
 * Si no hay precio devuelve 404 y NO un precio inventado: el modal muestra el
 * error y deshabilita la compra. Vender en la moneda equivocada es peor que no
 * vender.
 */
export function GET({ url }) {
  const pais = url.searchParams.get('pais')
  const nivel = Number(url.searchParams.get('nivel')) || 200

  if (!pais) error(400, 'Falta el parametro pais')

  const resultado = resolverPrecio(pais, nivel)

  if (!resultado) error(404, `Sin precio para ${pais} en el nivel ${nivel}`)

  return json({ ...resultado.detalles, _exacto: resultado.exacto })
}
