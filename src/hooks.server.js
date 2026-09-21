import { COOKIE_IDIOMA, esRTL, resolverIdiomaDeRequest } from '$lib/idiomas.js'

/**
 * Resuelve el idioma de cada request y lo refleja en el <html> del HTML que se
 * manda.
 *
 * Por qué acá y no en un componente: el <html> vive en app.html, fuera del
 * árbol de Svelte, así que ningún componente puede tocar sus atributos durante
 * el SSR. transformPageChunk es el único punto donde se puede.
 *
 * Qué arregla: app.html declaraba `lang="en"` fijo para todos, y el árabe
 * aplicaba dir="rtl" sobre <main> en vez de sobre <html>. Un usuario árabe
 * recibía un documento que decía ser inglés y de izquierda a derecha — algo
 * que leen los lectores de pantalla y los buscadores, no solo el layout.
 */
export async function handle({ event, resolve }) {
  const idioma = resolverIdiomaDeRequest({
    cookie: event.cookies.get(COOKIE_IDIOMA),
    pathname: event.url.pathname,
    acceptLanguage: event.request.headers.get('accept-language'),
  })

  // Se deja en locals para que +layout.server.js lo pase a la página sin tener
  // que volver a resolverlo.
  event.locals.idioma = idioma

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('<html lang="en">', `<html lang="${idioma}" dir="${esRTL(idioma) ? 'rtl' : 'ltr'}">`),
  })
}
