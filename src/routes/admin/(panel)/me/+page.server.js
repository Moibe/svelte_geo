import { fail } from '@sveltejs/kit'
import {
  buscarUsuarioPorId,
  cambiarPassword,
  cerrarOtrasSesiones,
  verificarPassword,
} from '$lib/server/auth.js'

/** Largo mínimo. No se piden mayúsculas ni símbolos: obligan a contraseñas
 *  cortas y memorizables como "Perro1!" en vez de una frase larga, que es más
 *  fuerte. Lo que de verdad ayuda es el largo. */
const LARGO_MINIMO = 10

export const actions = {
  default: async ({ request, locals }) => {
    const datos = await request.formData()
    const actual = String(datos.get('actual') ?? '')
    const nueva = String(datos.get('nueva') ?? '')
    const repetida = String(datos.get('repetida') ?? '')

    const cuenta = buscarUsuarioPorId(locals.usuario.id)

    // Se pide la contraseña actual aunque ya haya sesión: si alguien deja la
    // sesión abierta en una máquina ajena, sin este paso cualquiera que pase
    // podría cambiarla y quedarse con la cuenta.
    if (!verificarPassword(actual, cuenta?.passwordHash ?? null)) {
      return fail(400, { error: 'La contraseña actual no es correcta' })
    }

    if (nueva.length < LARGO_MINIMO) {
      return fail(400, { error: `La nueva tiene que tener al menos ${LARGO_MINIMO} caracteres` })
    }

    if (nueva !== repetida) {
      return fail(400, { error: 'La nueva y su repetición no coinciden' })
    }

    if (nueva === actual) {
      return fail(400, { error: 'La nueva es igual a la actual' })
    }

    cambiarPassword(cuenta.id, nueva)

    // Se cierran las demás sesiones: cambiar la contraseña no serviria para el
    // caso en que uno cambia porque sospecha que alguien mas tiene acceso, ya
    // que una sesion ya creada no depende de la contrasena. La actual se
    // conserva para no echar de la pagina a quien acaba de cambiarla.
    cerrarOtrasSesiones(cuenta.id, locals.sesion.id)

    return { ok: true }
  },
}
