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
 * Orden: preferencia explícita (cookie) > path de campaña > Accept-Language
 * > inglés. Es el mismo orden que usa el cliente, salvo que allá la
 * preferencia explícita puede venir de localStorage.
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
    normalizarIdioma(cookie) ||
    idiomaDeRuta(pathname) ||
    idiomaDeAcceptLanguage(acceptLanguage) ||
    IDIOMA_POR_DEFECTO
  )
}
