import { IDIOMAS } from '$lib/idiomas.js'
import { alternativas } from '$lib/seo.js'
import { contactoPublico } from '$lib/server/sitio.js'

/**
 * Sitemap con las alternativas por idioma (xhtml:link). Sale de las mismas
 * funciones que los <link rel="alternate"> del <head> de cada página, para que
 * ninguno pueda contradecir al otro.
 *
 * Cada página pública se publica en los seis idiomas (/es, /es/privacy…) y, sin
 * prefijo, en la raíz (/ y /privacy), que decide el idioma por cookie o
 * navegador y es el x-default de las demás.
 *
 * El panel (/admin) y la API no están a propósito: no deben indexarse.
 *
 * No lleva <lastmod>: no hay una fecha de modificación real por página, y un
 * valor inventado (la hora de la request, por ejemplo) hace que Google deje de
 * fiarse del campo.
 */
export function GET({ url }) {
  const origen = url.origin

  // La política de privacidad solo existe si hay contacto configurado.
  const paginas = contactoPublico() ? ['/', '/privacy'] : ['/']

  const urls = paginas.flatMap((base) => {
    const versiones = [
      ...IDIOMAS.map((l) => origen + (base === '/' ? `/${l}` : `/${l}${base}`)),
      origen + base,
    ]
    // Todas las versiones de la misma página comparten la misma lista de
    // alternativas (la relación tiene que ser recíproca).
    const enlaces = alternativas(origen, base)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
      .join('\n')

    return versiones.map((loc) => `  <url>\n    <loc>${loc}</loc>\n${enlaces}\n  </url>`)
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
