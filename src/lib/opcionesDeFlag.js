/**
 * Flags que NO son un número o un texto libre sino una elección entre DOS valores
 * conocidos, y que el panel dibuja como un interruptor (no como un campo que se mueve
 * con flechitas). Viven en el código y no en la base: la tabla `flags` sigue guardando el
 * valor tal cual (100, 200…), así que la app que lo lee no cambia.
 *
 * Es un módulo PURO (sin base de datos ni SvelteKit) para poder probarlo con `node --test`.
 */

/**
 * clave del flag -> sus dos opciones, en el orden en que se dibujan: la primera a la
 * izquierda (interruptor apagado) y la segunda a la derecha (encendido).
 *
 * @type {Record<string, [{valor: number|string, etiqueta: string}, {valor: number|string, etiqueta: string}]>}
 */
export const OPCIONES_DE_FLAG = {
  // Qué catálogo de Stripe se usa: ver getProductDetailsByCountry y /api/precio.
  'price-level': [
    { valor: 100, etiqueta: 'Barato' },
    { valor: 200, etiqueta: 'Original' },
  ],
}

/**
 * ¿Este valor es una de las dos opciones?
 * @param {Array<{valor: unknown}>} opciones
 * @param {unknown} valor
 */
export function opcionPermitida(opciones, valor) {
  return opciones.some((opcion) => opcion.valor === valor)
}

/**
 * La opción a la que pasa el interruptor. Desde la SEGUNDA vuelve a la primera; desde la
 * primera —o desde cualquier valor que no sea una de las dos, por ejemplo uno viejo que
 * alguien escribió a mano en la base— pasa a la segunda.
 *
 * @param {Array<{valor: unknown}>} opciones
 * @param {unknown} actual
 */
export function siguienteOpcion(opciones, actual) {
  const [primera, segunda] = opciones

  return actual === segunda.valor ? primera.valor : segunda.valor
}
