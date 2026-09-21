import { obtenerFlags } from '$lib/server/flags.js'
import { observarPaisPorIP } from '$lib/server/geoSombra.js'

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
export async function load({ locals, getClientAddress }) {
  // MODO SOMBRA: se calcula el pais por IP pero NO se usa, solo se registra
  // para poder compararlo unos dias antes de confiarle la fuente de verdad.
  // Deliberadamente SIN await: es observacion y no debe sumarle ni un
  // milisegundo de espera a la pagina. El .catch evita que un rechazo quede
  // sin manejar y tumbe el proceso.
  observarPaisPorIP(getClientAddress()).catch(() => {})

  return {
    idioma: locals.idioma,
    flags: await obtenerFlags(),
  }
}
