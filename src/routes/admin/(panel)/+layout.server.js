import { redirect } from '@sveltejs/kit'

/**
 * Guard de todo el panel.
 *
 * Va en el layout de un GRUPO de rutas —(panel)— y no en cada pagina a
 * proposito: asi una pagina nueva del panel queda protegida por el solo hecho
 * de crearse dentro del grupo, sin que nadie tenga que acordarse de agregarle
 * el chequeo. Olvidarse de eso es como se filtran los paneles.
 *
 * El grupo tambien es lo que deja /admin/login FUERA del guard sin tener que
 * compararlo por string: los parentesis no aparecen en la URL, pero si separan
 * el arbol de layouts. Un `if (pathname !== "/admin/login")` habria funcionado
 * igual hoy y se habria roto en silencio el dia que alguien renombre la ruta.
 */
export function load({ locals, url }) {
  if (!locals.usuario) {
    // Se conserva a donde iba para volver ahi despues del login.
    redirect(303, `/admin/login?volver=${encodeURIComponent(url.pathname + url.search)}`)
  }

  return { usuario: locals.usuario }
}
