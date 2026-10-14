import { COOKIE_IDIOMA, esRTL, resolverIdiomaDeRequest } from '$lib/idiomas.js'
import { normalizarPorcentajes } from '$lib/seo.js'
import { COOKIE_SESION, borrarCookieDeSesion, ponerCookieDeSesion, validarTokenDeSesion } from '$lib/server/auth.js'

/**
 * Se corre en cada request, antes de cualquier load.
 *
 * Hace dos cosas: resuelve el idioma (y lo refleja en el <html>) y rellena
 * locals.usuario desde la cookie de sesión, para que las rutas del panel no
 * tengan que repetir esa lógica.
 */
export async function handle({ event, resolve }) {
  // ── Una sola URL por página ───────────────────────────────────────────────
  // SvelteKit decodifica el path para enrutar: /%65s llega a la página /es. Pero
  // el idioma, el canonical, los hreflang y las reglas de más abajo leen el path
  // TAL CUAL, así que esa URL salía con alternativas que dan 404, y /%61pi/flags
  // escapaba del X-Robots-Tag de /api. Cualquier path escrito con %XX de
  // caracteres no reservados se redirige a su forma normal. Solo en GET y HEAD: un
  // POST (los form actions del panel) no se puede redirigir sin perder el cuerpo.
  const pathNormalizado = normalizarPorcentajes(event.url.pathname)

  if (pathNormalizado !== event.url.pathname && ['GET', 'HEAD'].includes(event.request.method)) {
    return new Response(null, {
      status: 308,
      headers: { location: pathNormalizado + event.url.search },
    })
  }

  // ── Idioma ────────────────────────────────────────────────────────────────
  // El <html> vive en app.html, fuera del árbol de Svelte, así que ningún
  // componente puede tocar sus atributos durante el SSR: transformPageChunk es
  // el único punto donde se puede.
  //
  // Qué arregla: app.html declaraba `lang="en"` fijo para todos, y el árabe
  // aplicaba dir="rtl" sobre <main> en vez de sobre <html>. Un usuario árabe
  // recibía un documento que decía ser inglés y de izquierda a derecha — algo
  // que leen los lectores de pantalla y los buscadores, no solo el layout.
  const idioma = resolverIdiomaDeRequest({
    cookie: event.cookies.get(COOKIE_IDIOMA),
    pathname: event.url.pathname,
    acceptLanguage: event.request.headers.get('accept-language'),
  })

  event.locals.idioma = idioma

  // ── Sesión ────────────────────────────────────────────────────────────────
  const token = event.cookies.get(COOKIE_SESION)

  if (token) {
    const { sesion, usuario } = validarTokenDeSesion(token)

    if (usuario) {
      event.locals.usuario = usuario
      // El id de la sesión actual queda disponible para poder distinguirla de
      // las demás: al cambiar la contraseña se cierran todas menos esta.
      event.locals.sesion = sesion
      // La sesión se renueva sola cuando le queda poco; la cookie tiene que
      // acompañar esa fecha o el navegador la tiraría antes que el servidor.
      ponerCookieDeSesion(event.cookies, token, sesion.expiraEn)
    } else {
      // Token vencido, inválido o de una cuenta borrada: se limpia para que el
      // navegador no lo siga mandando en cada request.
      event.locals.usuario = null
      event.locals.sesion = null
      borrarCookieDeSesion(event.cookies)
    }
  } else {
    event.locals.usuario = null
    event.locals.sesion = null
  }

  // ── Cabeceras para buscadores y cachés ────────────────────────────────────
  const ruta = event.url.pathname
  const esApi = ruta.startsWith('/api/')
  const esPanel = ruta === '/admin' || ruta.startsWith('/admin/')

  // El panel y la API nunca deben indexarse. Se manda como cabecera y no solo
  // como <meta>, porque la API devuelve JSON, que no tiene <head>. (No se
  // anuncian en robots.txt a propósito: listar /admin ahí le diría a cualquiera
  // dónde está.)
  if (esPanel || esApi) {
    event.setHeaders({ 'x-robots-tag': 'noindex, nofollow' })
  }

  const respuesta = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="en">', `<html lang="${idioma}" dir="${esRTL(idioma) ? 'rtl' : 'ltr'}">`),
  })

  // Las páginas dependen de la cookie de idioma y de Accept-Language (en la raíz
  // el idioma sale de ahí). Sin declararlo, una caché intermedia que guarde la
  // respuesta de `/` para un visitante podría servírsela a otro con otro idioma.
  // Solo a los documentos HTML: el JSON de la API, el sitemap o el favicon no
  // cambian con el idioma, y un Vary de más les quita aciertos de caché.
  if (respuesta.headers.get('content-type')?.includes('text/html')) {
    try {
      respuesta.headers.append('vary', 'Accept-Language, Cookie')
    } catch {
      // Cabeceras inmutables (la respuesta de un fetch reenviado tal cual): no
      // es una página de este sitio, no lleva el Vary y no hace falta.
    }
  }

  return respuesta
}
