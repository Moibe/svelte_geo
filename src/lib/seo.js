import { IDIOMAS, quitarPrefijoIdioma } from './idiomas.js'

/**
 * Helpers PUROS de SEO: canonical y hreflang a partir de un path.
 *
 * Son puros (sin tocar `window`, el store de i18n ni la request) para poder
 * probarlos solos y usarlos igual desde el <head> de una página y desde el
 * sitemap.xml. Que las dos cosas salgan de la MISMA función importa: si el
 * sitemap y los <link rel="alternate"> de la página dijeran cosas distintas,
 * Google desconfía de ambos.
 */

/** Códigos de locale de Open Graph (idioma_TERRITORIO). */
export const LOCALE_OG = {
  es: 'es_LA',
  en: 'en_US',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  ar: 'ar_AR',
}

/**
 * Forma normal de un path en cuanto a las secuencias %XX (RFC 3986, 6.2.2): las
 * que escriben un carácter NO reservado (letras, dígitos, "-", ".", "_", "~") se
 * reducen al propio carácter, y las demás quedan con los hex en mayúsculas.
 *
 * SvelteKit decodifica el path para enrutar, así que `/%65s` llega a la página
 * `/es`, pero el resto del sitio (idioma, canonical, hreflang, X-Robots-Tag) lee
 * el path TAL CUAL: la misma página salía con canonical y alternativas a URLs que
 * dan 404, y `/%61pi/flags` escapaba de las cabeceras de /api. El hook responde
 * con un redirect a esta forma normal, así que existe una sola URL por página.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function normalizarPorcentajes(pathname) {
  return String(pathname).replace(/%([0-9a-fA-F]{2})/g, (secuencia, hex) => {
    const caracter = String.fromCharCode(Number.parseInt(hex, 16))

    return /[A-Za-z0-9\-._~]/.test(caracter) ? caracter : `%${hex.toUpperCase()}`
  })
}

/**
 * A dónde redirigir un path para que exista una sola URL por página, o null si no hay que
 * redirigir (ya está en su forma normal, o la redirección no sería segura).
 *
 * NO se redirige un path que empieza por «//» (ni «/\»): escrito en la cabecera Location, el
 * navegador lo lee como una URL de OTRO sitio (`//evil.com/es` → https://evil.com/es), o sea
 * una redirección abierta con el dominio de esta página. Sin redirigir, esos paths siguen su
 * curso normal y dan 404.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
export function redireccionDeNormalizacion(pathname) {
  const normalizado = normalizarPorcentajes(pathname)

  if (normalizado === pathname) return null
  if (/^[/\\]{2}/.test(normalizado)) return null

  return normalizado
}

/** Sin barra final, salvo la raíz: /es/ y /es son la misma página. */
export function normalizarRuta(pathname) {
  const ruta = String(pathname || '/')
  const conBarra = ruta.startsWith('/') ? ruta : '/' + ruta

  return conBarra.length > 1 ? conBarra.replace(/\/+$/, '') || '/' : conBarra
}

/**
 * URL canónica de una página: ella misma.
 *
 * Cada idioma es canónico de sí mismo (/es es el canonical de /es). Poner el
 * canonical de todos apuntando a un solo idioma le diría a Google que las
 * traducciones son duplicados de esa y las sacaría del índice.
 */
export function canonica(origen, pathname) {
  return origen + normalizarRuta(pathname)
}

/**
 * Las versiones de una misma página en cada idioma, más x-default.
 *
 * x-default apunta a la ruta sin prefijo (la raíz, que decide el idioma por
 * cookie o navegador), que es justo lo que el atributo significa: "la versión
 * para quien no encaja en ningún idioma de la lista".
 *
 * La lista es RECÍPROCA a propósito: cada versión lista a todas, incluida ella
 * misma. Si /es listara a /en pero /en no listara a /es, Google ignora el par.
 *
 * @param {string} origen   p.ej. https://geoservices.space
 * @param {string} pathname p.ej. /es/privacy
 * @returns {{hreflang: string, href: string}[]}
 */
export function alternativas(origen, pathname) {
  const base = quitarPrefijoIdioma(normalizarRuta(pathname))

  const porIdioma = IDIOMAS.map((l) => ({
    hreflang: l,
    href: origen + (base === '/' ? `/${l}` : `/${l}${base}`),
  }))

  return [...porIdioma, { hreflang: 'x-default', href: origen + base }]
}

/**
 * JSON listo para meter dentro de <script type="application/ld+json">.
 *
 * Cada "<" se reemplaza por su secuencia unicode de seis caracteres (la que
 * cualquier parser de JSON vuelve a leer como "<"): el JSON va incrustado en
 * HTML, y una cadena que contuviera "</script>" cerraría la etiqueta antes de
 * tiempo (y dejaría el resto como HTML inyectado).
 */
export function jsonSeguroParaHtml(objeto) {
  return JSON.stringify(objeto).replace(/</g, '\\u003c')
}
