import { obtenerFlags } from '$lib/server/flags.js'
import { observarPaisPorIP } from '$lib/server/geoSombra.js'

/**
 * Datos que el servidor le pasa a la pagina para renderizar la PRIMERA
 * pantalla ya decidida.
 *
 * El idioma y el usuario los resolvio hooks.server.js.
 *
 * Los flags ya NO se esperan: salen de la base local, o sea de un archivo en
 * el mismo disco. Antes esto era un await contra un cache de Firestore que a
 * su vez sondeaba otro proveedor.
 */
export function load({ locals, getClientAddress }) {
  // MODO SOMBRA: se calcula el pais por IP pero NO se usa, solo se registra
  // para poder compararlo unos dias antes de confiarle la fuente de verdad.
  //
  // TODO el bloque va dentro de un try: getClientAddress() LANZA cuando
  // ADDRESS_HEADER esta configurado y la request no trae ese header, que es el
  // caso de cualquier peticion que no pase por nginx — por ejemplo el health
  // check que pega directo a 127.0.0.1:3900. Sin este try, esa excepcion
  // rompia el load y devolvia 500. Observar no puede afectar la respuesta.
  try {
    // Sin await: no debe sumarle ni un milisegundo de espera a la pagina.
    observarPaisPorIP(getClientAddress()).catch(() => {})
  } catch {
    // Request sin cabecera de proxy: no hay IP de visitante que observar.
  }

  return {
    idioma: locals.idioma,
    usuario: locals.usuario,
    flags: obtenerFlags(),
  }
}
