import { error } from '@sveltejs/kit'
import { contactoPublico, responsablePublico } from '$lib/server/sitio.js'

/**
 * La política de privacidad solo existe si hay un correo de contacto
 * configurado: dice que los derechos de acceso y eliminación se ejercen
 * escribiendo a ese contacto, y sin contacto sería una promesa sin a quién
 * dirigirla. Mientras no lo haya, la ruta responde 404 como cualquier otra que
 * no existe, y ni el pie de página ni el sitemap la mencionan.
 *
 * El correo y el nombre del responsable los manda al navegador SOLO esta página
 * (el resto del sitio únicamente sabe si la política existe).
 */
export function load() {
  const contacto = contactoPublico()

  if (!contacto) {
    error(404, 'Not found')
  }

  return { contacto, responsable: responsablePublico() }
}
