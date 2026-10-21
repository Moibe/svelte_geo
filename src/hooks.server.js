import { noscriptDeGoogle, scriptDeArranque } from '$lib/consentimiento-arranque.js'
import { COOKIE_CONSENTIMIENTO, esVistaPrevia, leerDecision, valorDeCookie } from '$lib/consentimiento.js'
import { COOKIE_IDIOMA, esRTL, resolverIdiomaDeRequest } from '$lib/idiomas.js'
import { redireccionDeNormalizacion } from '$lib/seo.js'
import { COOKIE_SESION, borrarCookieDeSesion, ponerCookieDeSesion, validarTokenDeSesion } from '$lib/server/auth.js'
import { obtenerFlags } from '$lib/server/flags.js'
import { paisDeIp, precargarGeoip } from '$lib/server/pais.js'

/**
 * Google Tag Manager. Es un identificador PÚBLICO: viaja en el HTML a todo el mundo.
 * Ya no está escrito en app.html porque quien lo carga ahora es el script de
 * consentimiento (ver $lib/consentimiento-arranque.js), que decide si hay permiso.
 */
const GTM_ID = 'GTM-WJ8WCDZN'

/**
 * Corre UNA vez al arrancar el servidor, antes de la primera request: deja cargada
 * la base de países por IP. Sin esto, las primeras páginas después de cada reinicio
 * saldrían con el país "desconocido", y para el aviso de cookies "no sé" es lo
 * mismo que "pídelo por si acaso".
 */
export async function init() {
  await precargarGeoip()
}

/**
 * Se corre en cada request, antes de cualquier load.
 *
 * Hace tres cosas: resuelve el idioma (y lo refleja en el <html>), rellena
 * locals.usuario desde la cookie de sesión (para que las rutas del panel no tengan
 * que repetir esa lógica) y deja en locals.consentimiento lo que el aviso de
 * cookies necesita saber de quien visita.
 */
export async function handle({ event, resolve }) {
  // ── Una sola URL por página ───────────────────────────────────────────────
  // SvelteKit decodifica el path para enrutar: /%65s llega a la página /es. Pero
  // el idioma, el canonical, los hreflang y las reglas de más abajo leen el path
  // TAL CUAL, así que esa URL salía con alternativas que dan 404, y /%61pi/flags
  // escapaba del X-Robots-Tag de /api. Cualquier path escrito con %XX de
  // caracteres no reservados se redirige a su forma normal. Solo en GET y HEAD: un
  // POST (los form actions del panel) no se puede redirigir sin perder el cuerpo.
  const pathNormalizado = redireccionDeNormalizacion(event.url.pathname)

  if (pathNormalizado !== null && ['GET', 'HEAD'].includes(event.request.method)) {
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

  // ── Consentimiento de cookies ─────────────────────────────────────────────
  // Solo las páginas públicas: el panel lo usa el dueño del sitio (no se mide ni se
  // le pide nada) y la API no devuelve HTML.
  //
  // El país sale de la IP con una base LOCAL (ver $lib/server/pais.js). getClientAddress()
  // LANZA si ADDRESS_HEADER está configurado y la request no trae esa cabecera, que es
  // el caso de cualquier petición que no pase por nginx (el health check pegándole
  // directo a 127.0.0.1:3900, por ejemplo): se trata como "IP desconocida".
  //
  // Esto va en locals, que es POR REQUEST. Nada de esto puede vivir en una variable de
  // módulo ni en un store compartido: en el servidor las requests se atienden
  // intercaladas y le pintarían el aviso de uno a otro visitante.
  const conConsentimiento = !esApi && !esPanel

  if (conConsentimiento) {
    let ip = null

    try {
      ip = event.getClientAddress()
    } catch {
      // Sin IP de visitante: la región queda en "no sé".
    }

    const { iso, region } = paisDeIp(ip)

    event.locals.pais = iso
    event.locals.consentimiento = {
      regionIp: region,
      // Se lee de la cabecera cruda (con el valor aún codificado), igual que en el navegador.
      decision: leerDecision(valorDeCookie(event.request.headers.get('cookie'), COOKIE_CONSENTIMIENTO)),
      vistaPrevia: esVistaPrevia(event.url.search),
    }
  } else {
    event.locals.pais = null
    event.locals.consentimiento = null
  }

  const consentimiento = event.locals.consentimiento
  const regionIp = consentimiento?.regionIp
  // Se arman al reemplazar (solo las páginas HTML llevan los marcadores), no por cada request.
  // El nivel de precio vigente (100/200) viaja a la capa de datos de Analytics para poder comparar niveles.
  const nivelDePrecio = () => {
    try {
      return obtenerFlags().priceLevel
    } catch {
      return null
    }
  }
  const scriptConsentimiento = () => (consentimiento ? scriptDeArranque({ regionIp, gtmId: GTM_ID, nivelDePrecio: nivelDePrecio() }) : '')
  // El <noscript> de GTM solo para quien SEGURO está fuera de la región regulada: sin
  // JavaScript no hay forma de pedir consentimiento ni de leer la zona horaria.
  // (Ni para quien ya tiene una elección guardada: puede ser un rechazo hecho desde otra IP.)
  const noscriptConsentimiento = () => (regionIp === 'no' && !consentimiento?.decision ? noscriptDeGoogle(GTM_ID) : '')

  const respuesta = await resolve(event, {
    // Los reemplazos de los marcadores usan una FUNCIÓN y no un texto: en el texto, un `$&` o
    // un `$'` dentro del script se interpretaría como un patrón de String.replace.
    transformPageChunk: ({ html }) =>
      html
        .replace('<html lang="en">', `<html lang="${idioma}" dir="${esRTL(idioma) ? 'rtl' : 'ltr'}">`)
        .replace('%consent.script%', () => scriptConsentimiento())
        .replace('%consent.noscript%', () => noscriptConsentimiento()),
  })

  // Las páginas dependen de la cookie de idioma y de Accept-Language (en la raíz
  // el idioma sale de ahí). Sin declararlo, una caché intermedia que guarde la
  // respuesta de `/` para un visitante podría servírsela a otro con otro idioma.
  // Solo a los documentos HTML: el JSON de la API, el sitemap o el favicon no
  // cambian con el idioma, y un Vary de más les quita aciertos de caché.
  if (respuesta.headers.get('content-type')?.includes('text/html')) {
    try {
      respuesta.headers.append('vary', 'Accept-Language, Cookie')

      // Además, lo que lleva la página depende de la IP de quien la pide (el aviso de
      // cookies y si se carga Google). Una caché compartida no puede reutilizarla entre
      // visitantes; el navegador de cada quien sí.
      if (conConsentimiento) respuesta.headers.set('cache-control', 'private')
    } catch {
      // Cabeceras inmutables (la respuesta de un fetch reenviado tal cual): no
      // es una página de este sitio, no lleva el Vary y no hace falta.
    }
  }

  return respuesta
}
