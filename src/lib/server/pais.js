import { env } from '$env/dynamic/private'
import { regionDePais } from '$lib/consentimiento.js'
import { crearLectorGeoip } from './geoip.js'

/**
 * País de un visitante a partir de su IP, con la base local de DB-IP.
 *
 * La base es un archivo que NO vive en el repositorio (pesa ~8 MB y se renueva cada
 * mes): lo descarga y lo mantiene scripts/actualizar-geoip.sh, que corre desde el
 * cron del servidor. Esta ruta es la que ese script usa por defecto en el droplet;
 * GEOIP_DB_PATH la cambia sin tocar código. Sin el archivo (desarrollo local, un
 * servidor nuevo) todo sigue funcionando: el país sale como "no sé" y el aviso de
 * cookies se decide solo con la zona horaria del navegador (ver consentimiento.js).
 */
const RUTA_POR_DEFECTO = '/root/data/geoip/dbip-country-lite.mmdb'

/** Lo que el lector cuenta de sí mismo va al log del proceso, con un prefijo fácil de buscar. */
function registrar(evento) {
  const { tipo, ruta, ...resto } = evento
  const detalle = Object.entries(resto)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(' ')
  const linea = `GEOIP ${tipo} ruta=${ruta}${detalle ? ` ${detalle}` : ''}`

  // Lo que pide atención del dueño va por warn; el funcionamiento normal, por log.
  if (['recarga_rechazada', 'sin_archivo', 'base_vieja', 'error_inesperado'].includes(tipo)) {
    console.warn(linea)
  } else {
    console.log(linea)
  }
}

let lector = null

function obtenerLector() {
  lector ??= crearLectorGeoip({
    ruta: env.GEOIP_DB_PATH || RUTA_POR_DEFECTO,
    onEvento: registrar,
  })

  return lector
}

/**
 * Carga la base antes de la primera request (se llama desde el hook `init`).
 * Sin esto las primeras páginas después de cada arranque saldrían con el país
 * "desconocido", que para el aviso de cookies es lo mismo que "pídelo por si acaso".
 */
export function precargarGeoip() {
  return obtenerLector().recargarAhora()
}

/**
 * El país de una IP y si ese país exige pedir consentimiento (ver consentimiento.js).
 * Una sola consulta a la base para las dos respuestas.
 *
 * @param {string|null|undefined} ip
 * @returns {{ iso: string|null, region: 'si'|'no'|'?' }} sin país (iso null) la región es '?':
 *   sin base, IP privada o inválida
 */
export function paisDeIp(ip) {
  const { estado, iso } = obtenerLector().pais(ip)

  return estado === 'ok' ? { iso, region: regionDePais(iso) } : { iso: null, region: '?' }
}

/** Estado de la base, para diagnóstico. */
export function saludGeoip() {
  return obtenerLector().salud()
}
