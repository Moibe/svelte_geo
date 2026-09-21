import { redirect } from '@sveltejs/kit'
import { COOKIE_SESION, borrarCookieDeSesion, invalidarSesion } from '$lib/server/auth.js'
import { createHash } from 'node:crypto'

/**
 * Cierra la sesion.
 *
 * Borra la fila en la base ADEMAS de la cookie: borrar solo la cookie deja el
 * token vivo del lado del servidor, asi que alguien que lo hubiera copiado
 * podria seguir usandolo.
 */
export function POST({ cookies }) {
  const token = cookies.get(COOKIE_SESION)

  if (token) {
    invalidarSesion(createHash('sha256').update(token).digest('hex'))
  }

  borrarCookieDeSesion(cookies)
  redirect(303, '/admin/login')
}
