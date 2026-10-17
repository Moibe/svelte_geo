import { countryCodeMap } from '$lib/geoLocation.js'

/**
 * OBSOLETO: ya nadie lo importa. El modo sombra terminó cuando la portada pasó a usar el país que
 * resuelve el servidor (ver `ubicacionDeArranque` en $lib/geoLocation.js y +layout.server.js); esta
 * línea de log, una por visita en registros de pm2 que no rotan, ya no hace falta. Se puede borrar el archivo.
 *
 * Anota en el log del servidor el país con el que se resolvió cada página, en MODO
 * SOMBRA: el servidor lo calcula pero la página NO lo usa para elegir idioma, mapa ni
 * precio (eso sigue saliendo del navegador). Sirve para ver, unos días, la distribución
 * de países que ve el servidor antes de confiarle más decisiones.
 *
 * Antes esto consultaba a GeoJS desde el servidor por cada visita y anotaba la IP
 * COMPLETA junto al resultado. Ahora el país sale de la base local de DB-IP (ver
 * ./pais.js, que ya hace falta para el aviso de cookies), así que:
 *
 *   - la IP de la persona deja de salir del servidor hacia un tercero para esto, y
 *   - el log guarda solo el PAÍS, no la IP. Una línea por visita, que los registros de
 *     pm2 no rotan: con la IP completa era un padrón de visitantes creciendo sin tope.
 *
 * La IP y el país no se guardan juntos en ningún lado.
 *
 * @param {string|null|undefined} iso país ISO de dos letras, o null si no se pudo saber
 */
export function observarPais(iso) {
  const lada = iso ? countryCodeMap[iso] : null

  console.log(`GEO_SHADOW iso=${iso || 'nulo'} lada=${lada || 'sin_mapeo'}`)
}
