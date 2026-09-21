import { fail } from '@sveltejs/kit'
import { alternarFlag, guardarFlag, obtenerFilasDeFlags } from '$lib/server/flags.js'

export function load() {
  return { filas: obtenerFilasDeFlags() }
}

export const actions = {
  /**
   * Guarda un solo flag.
   *
   * Uno por uno y no el formulario entero a propósito: así un toggle se aplica
   * al instante sin tener que apretar "guardar", y un valor inválido en un
   * campo no impide guardar los demás. Para los flags —que son interruptores de
   * producción— importa más que el cambio sea inmediato y evidente que agrupar.
   */
  guardar: async ({ request }) => {
    const datos = await request.formData()
    const clave = String(datos.get('clave') ?? '')
    const valor = datos.get('valor')

    const error = guardarFlag(clave, valor)

    if (error) return fail(400, { clave, error })

    return { clave, guardado: true }
  },

  /**
   * Invierte un interruptor.
   *
   * No recibe el valor nuevo: lo decide el servidor leyendo el actual. Si el
   * valor viniera del formulario podria llegar viejo —el cliente lo calcula al
   * renderizar— y el interruptor quedaria "pegado" sin ningun error visible.
   */
  alternar: async ({ request }) => {
    const datos = await request.formData()
    const clave = String(datos.get('clave') ?? '')

    const resultado = alternarFlag(clave)

    if (resultado.error) return fail(400, { clave, error: resultado.error })

    return { clave, guardado: true, valor: resultado.valor }
  },
}
