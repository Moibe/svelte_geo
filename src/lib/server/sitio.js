import { env } from '$env/dynamic/private'

/**
 * Datos de quien responde por el sitio, para la política de privacidad.
 *
 * Salen de variables de entorno del servidor y no están escritos en el código:
 * son datos personales o de una empresa, y cambiarlos no debería requerir tocar
 * ni recompilar nada.
 *
 * Se leen de `$env/dynamic/private` y NO de `$env/dynamic/public` a propósito:
 * con el prefijo PUBLIC_ SvelteKit los publica en /_app/env.js, o sea que salen en
 * todas las páginas aunque solo la política los necesite. Los lee solo el
 * servidor, y solo los manda al navegador la propia política (ver
 * routes/[[lang=lang]]/privacy/+page.server.js).
 */

/**
 * Correo de contacto (PRIVACY_CONTACT_EMAIL).
 *
 * Devuelve null si no está configurado o no parece un correo. Eso APAGA la
 * página de privacidad entera (ruta, enlaces y sitemap): la política dice que
 * los derechos se ejercen escribiendo a ese contacto, y publicarla sin contacto
 * sería publicar una promesa sin a quién dirigirla.
 */
export function contactoPublico() {
  const correo = (env.PRIVACY_CONTACT_EMAIL || '').trim()

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : null
}

/**
 * Nombre de la persona o empresa responsable (PRIVACY_OPERATOR_NAME).
 *
 * Opcional: si está, la política lo muestra junto al contacto; si no, la
 * política sale sin esa línea (no apaga nada). Una política de privacidad
 * completa dice quién es el responsable, pero ese dato solo lo puede poner
 * quien lo es.
 */
export function responsablePublico() {
  const nombre = (env.PRIVACY_OPERATOR_NAME || '').trim().slice(0, 200)

  return nombre || null
}
