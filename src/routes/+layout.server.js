/**
 * Pasa a la pagina el idioma que hooks.server.js ya resolvio para esta request.
 *
 * Se resuelve en el hook y no aca porque el hook es tambien quien inyecta el
 * <html lang>, y tener dos lugares distintos calculando el idioma es como se
 * llega a que el atributo diga una cosa y el texto muestre otra.
 */
export function load({ locals }) {
  return { idioma: locals.idioma }
}
