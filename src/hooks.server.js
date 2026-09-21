import { COOKIE_IDIOMA, esRTL, resolverIdiomaDeRequest } from '$lib/idiomas.js'
import { COOKIE_SESION, borrarCookieDeSesion, ponerCookieDeSesion, validarTokenDeSesion } from '$lib/server/auth.js'

/**
 * Se corre en cada request, antes de cualquier load.
 *
 * Hace dos cosas: resuelve el idioma (y lo refleja en el <html>) y rellena
 * locals.usuario desde la cookie de sesión, para que las rutas del panel no
 * tengan que repetir esa lógica.
 */
export async function handle({ event, resolve }) {
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
      // La sesión se renueva sola cuando le queda poco; la cookie tiene que
      // acompañar esa fecha o el navegador la tiraría antes que el servidor.
      ponerCookieDeSesion(event.cookies, token, sesion.expiraEn)
    } else {
      // Token vencido, inválido o de una cuenta borrada: se limpia para que el
      // navegador no lo siga mandando en cada request.
      event.locals.usuario = null
      borrarCookieDeSesion(event.cookies)
    }
  } else {
    event.locals.usuario = null
  }

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="en">', `<html lang="${idioma}" dir="${esRTL(idioma) ? 'rtl' : 'ltr'}">`),
  })
}
