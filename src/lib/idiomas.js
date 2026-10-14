/**
 * Mitad PURA de la internacionalización: la lista de idiomas y cómo se
 * normaliza un texto a uno de ellos.
 *
 * No importa svelte-i18n ni toca `window`, `navigator` ni `localStorage` a
 * propósito: así el servidor puede resolver el idioma de una request sin
 * arrastrar el store de i18n ni los seis diccionarios.
 *
 * La mitad de navegador vive en i18n.js.
 */

/** Los idiomas que la app tiene traducidos. */
export const IDIOMAS = ['es', 'en', 'pt', 'fr', 'de', 'ar']

/** Idiomas que se escriben de derecha a izquierda. */
const RTL = new Set(['ar'])

export const IDIOMA_POR_DEFECTO = 'en'

/** Nombre de la cookie donde se guarda la preferencia explícita del usuario. */
export const COOKIE_IDIOMA = 'preferred_language'

/**
 * ¿Este idioma se escribe de derecha a izquierda?
 * @param {string} lang
 */
export function esRTL(lang) {
  return RTL.has(lang)
}

/**
 * Normaliza un texto de idioma a uno soportado, o null.
 *
 * Acepta las formas que llegan de verdad: 'es', 'es-MX', 'ES_mx'.
 * @param {string|null|undefined} texto
 * @returns {string|null}
 */
export function normalizarIdioma(texto) {
  if (!texto) return null

  const codigo = String(texto).trim().toLowerCase().split(/[-_]/)[0]

  return IDIOMAS.includes(codigo) ? codigo : null
}

/**
 * Idioma indicado por el path, si lo hay: /es, /ar, /pt/lo-que-sea.
 * @param {string} pathname
 * @returns {string|null}
 */
export function idiomaDeRuta(pathname) {
  const primerSegmento = String(pathname || '').split('/')[1]

  return normalizarIdioma(primerSegmento)
}

/**
 * Mejor idioma de una cabecera Accept-Language, respetando los factores q.
 *
 * Se parsea a mano en vez de tomar el primero: un navegador puede mandar
 * `fr;q=0.2, es;q=0.9` y quedarse con el primero daría francés cuando el
 * usuario prefiere español.
 *
 * @param {string|null|undefined} cabecera
 * @returns {string|null}
 */
export function idiomaDeAcceptLanguage(cabecera) {
  if (!cabecera) return null

  const candidatos = String(cabecera)
    .split(',')
    .map((parte) => {
      const [etiqueta, ...params] = parte.trim().split(';')
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
      return { etiqueta, q: q ? Number.parseFloat(q.slice(2)) : 1 }
    })
    .filter((c) => Number.isFinite(c.q))
    .sort((a, b) => b.q - a.q)

  for (const { etiqueta } of candidatos) {
    const idioma = normalizarIdioma(etiqueta)
    if (idioma) return idioma
  }

  return null
}

/**
 * Resuelve el idioma de una request en el SERVIDOR.
 *
 * Orden: idioma de la URL > preferencia explícita (cookie) > Accept-Language
 * > inglés.
 *
 * La URL va PRIMERO, y no es un detalle: cada idioma tiene su propia URL
 * (/es, /pt…) y el HTML, el <html lang>, el canonical y los hreflang le
 * prometen a los buscadores que esa URL está en ese idioma. Si una cookie
 * pudiera pisarla, la misma URL mostraría idiomas distintos según quién la
 * abra: un visitante con la cookie en inglés vería /es en inglés, y quien
 * comparta ese enlace estaría compartiendo algo que no dice lo que promete.
 * Los buscadores no mandan cookie, así que para ellos esto ya era así; la
 * incoherencia era solo para personas.
 *
 * Solo en la raíz (/), que no declara idioma, deciden la cookie y las
 * preferencias del navegador.
 *
 * NO usa navigator.language: en Node esa propiedad EXISTE (v22 la define) y
 * devuelve el locale del PROCESO, o sea el del droplet. No lanza error —
 * simplemente serviría el idioma del servidor a todo el mundo, en silencio.
 *
 * @param {{ cookie?: string|null, pathname?: string, acceptLanguage?: string|null }} req
 * @returns {string}
 */
export function resolverIdiomaDeRequest({ cookie, pathname, acceptLanguage }) {
  return (
    idiomaDeRuta(pathname) ||
    normalizarIdioma(cookie) ||
    idiomaDeAcceptLanguage(acceptLanguage) ||
    IDIOMA_POR_DEFECTO
  )
}

/**
 * Quita el prefijo de idioma de un path: /es/privacy -> /privacy, /es -> /.
 * Un path sin prefijo se devuelve igual.
 *
 * Compara el PRIMER SEGMENTO completo y no con startsWith: /estado o /endpoint
 * empiezan con "es" y "en" y no son idiomas.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function quitarPrefijoIdioma(pathname) {
  const ruta = String(pathname || '/')
  const [, primero, ...resto] = ruta.split('/')

  if (primero && IDIOMAS.includes(primero.toLowerCase())) {
    return '/' + resto.join('/')
  }

  return ruta.startsWith('/') ? ruta : '/' + ruta
}

/**
 * El mismo path pero en otro idioma: (/privacy, 'pt') -> /pt/privacy,
 * (/es, 'en') -> /en. La raíz se escribe /en y no /en/.
 *
 * @param {string} pathname
 * @param {string} lang
 * @returns {string}
 */
export function rutaEnIdioma(pathname, lang) {
  const base = quitarPrefijoIdioma(pathname)

  return base === '/' ? `/${lang}` : `/${lang}${base}`
}
