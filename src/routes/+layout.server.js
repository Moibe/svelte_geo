import { obtenerFlags } from '$lib/server/flags.js'

/**
 * Datos que el servidor le pasa a la pagina para poder renderizar la PRIMERA
 * pantalla ya decidida.
 *
 * El idioma lo resolvio hooks.server.js (es tambien quien inyecta el
 * <html lang>, y tener dos lugares calculandolo es como se llega a que el
 * atributo diga una cosa y el texto muestre otra).
 *
 * Los flags vienen del cache de Firestore. Antes de esto, safeMode arrancaba
 * en null y la primera pantalla SIEMPRE era un spinner de "Cargando...",
 * incluso para quien ya tenia la config resuelta.
 */
export async function load({ locals }) {
  return {
    idioma: locals.idioma,
    flags: await obtenerFlags(),
  }
}
