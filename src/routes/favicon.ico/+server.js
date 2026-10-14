import icono from '$lib/assets/favicon.ico?inline'

/**
 * /favicon.ico, servido desde código y no desde static/.
 *
 * Los archivos de static/ los sirve sirv, que saca el Content-Type de mrmime, y
 * mrmime no conoce la extensión .ico: la respuesta salía con la cabecera vacía.
 * Los navegadores la olfatean y funciona, pero una cabecera vacía en un archivo
 * que además piden los rastreadores a ciegas no tiene por qué quedarse así.
 *
 * `?inline` entrega el archivo como data URL en base64; los bytes salen de ahí.
 */
const bytes = Buffer.from(icono.slice(icono.indexOf(',') + 1), 'base64')

export function GET() {
  return new Response(bytes, {
    headers: {
      'content-type': 'image/x-icon',
      'cache-control': 'public, max-age=86400',
    },
  })
}
