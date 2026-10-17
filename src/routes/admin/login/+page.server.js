import { fail, redirect } from '@sveltejs/kit'
import {
  buscarUsuarioPorNombre,
  crearSesion,
  generarTokenDeSesion,
  ponerCookieDeSesion,
  verificarPassword,
} from '$lib/server/auth.js'
import { rutaInterna } from '$lib/rutaInterna.js'

/**
 * Si ya hay sesion, no tiene sentido mostrar el formulario. El destino viene de la query, asi que
 * se valida igual que en la accion: /admin/login?volver=https://otro-sitio no puede sacar de aqui.
 */
export function load({ locals, url }) {
  if (locals.usuario) {
    redirect(303, rutaInterna(url.searchParams.get('volver')))
  }
}

export const actions = {
  default: async ({ request, cookies, url }) => {
    const datos = await request.formData()
    const usuario = String(datos.get('usuario') ?? '').trim()
    const password = String(datos.get('password') ?? '')

    if (!usuario || !password) {
      return fail(400, { usuario, error: 'Falta el usuario o la contrasena' })
    }

    const cuenta = buscarUsuarioPorNombre(usuario)

    // El mismo mensaje para "no existe" y "contrasena mala", y se verifica
    // igual cuando la cuenta no existe: si se respondiera distinto, o mas
    // rapido, se podria averiguar que usuarios existen probando nombres.
    const valida = verificarPassword(password, cuenta?.passwordHash ?? null)

    if (!cuenta || !valida) {
      return fail(400, { usuario, error: 'Usuario o contrasena incorrectos' })
    }

    const token = generarTokenDeSesion()
    const { expiraEn } = crearSesion(token, cuenta.id)
    ponerCookieDeSesion(cookies, token, expiraEn)

    // El destino viene de la query, asi que se valida que sea una ruta interna:
    // sin esto, /admin/login?volver=https://otro-sitio seria un redirect
    // abierto, util para phishing con un dominio que el usuario reconoce.
    redirect(303, rutaInterna(url.searchParams.get('volver')))
  },
}
