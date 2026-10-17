import { obtenerFlags } from '$lib/server/flags.js'
import { contactoPublico } from '$lib/server/sitio.js'

/**
 * Datos que el servidor le pasa a la pagina para renderizar la PRIMERA
 * pantalla ya decidida.
 *
 * El idioma, el usuario y lo del consentimiento de cookies los resolvio
 * hooks.server.js.
 *
 * Los flags ya NO se esperan: salen de la base local, o sea de un archivo en
 * el mismo disco. Antes esto era un await contra un cache de Firestore que a
 * su vez sondeaba otro proveedor.
 */
export function load({ locals }) {
  const consentimiento = locals.consentimiento

  return {
    idioma: locals.idioma,
    usuario: locals.usuario,
    // El pais del visitante (ISO de dos letras) que el servidor resolvio por la IP de la peticion con
    // su base local, o null si no se pudo saber (IP privada, sin base). La portada lo usa para el
    // precio, el idioma inicial y los registros, en lugar de preguntarle a GeoJS desde el navegador al
    // cargar. Solo viaja la conclusion (un pais), nunca la IP. null en el panel y la API.
    pais: locals.pais ?? null,
    flags: obtenerFlags(),
    // Solo si hay contacto configurado el sitio enlaza su política de privacidad
    // (ver contactoPublico). Se manda un booleano y NO el correo: el correo sale
    // únicamente en la propia política, no en el HTML de cada página.
    conPrivacidad: Boolean(contactoPublico()),
    // Lo que el aviso de cookies necesita para pintarse YA EN EL SERVIDOR igual que en el
    // navegador (si no, al hidratar saltaría). null en el panel, que no lleva aviso.
    // Ojo: la IP no viaja, solo la conclusión ("la región pide consentimiento").
    consentimiento: consentimiento
      ? {
          regionIp: consentimiento.regionIp,
          vistaPrevia: consentimiento.vistaPrevia,
          decision: consentimiento.decision
            ? { analitica: consentimiento.decision.a, publicidad: consentimiento.decision.p }
            : null,
        }
      : null,
  }
}
