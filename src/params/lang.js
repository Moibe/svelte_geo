// Matcher de los 6 idiomas que la app entiende en el path.
//
// Hoy /es /en /pt /fr /de /ar devuelven 200 SOLO por el
// `try_files $uri $uri/ /index.html` de nginx, que ademas sirve la app para
// CUALQUIER ruta inexistente (incluido /robots.txt). Con adapter-node eso
// desaparece, asi que la ruta opcional [[lang=lang]] preserva lo que de verdad
// se usaba — y lo demas pasa a dar 404, que es lo correcto.
//
// i18n.js getLanguageFromPath() lee estos mismos seis.
const IDIOMAS = new Set(['es', 'en', 'pt', 'fr', 'de', 'ar'])

/** @param {string} param */
export function match(param) {
  return IDIOMAS.has(param)
}
