/**
 * Destinos de redirección que se leen de la query (`?volver=`): solo valen las rutas INTERNAS.
 *
 * Una ruta interna empieza por UNA sola «/». Se rechazan «//otro-sitio» y «/\otro-sitio»
 * (los navegadores leen la barra invertida como una barra, así que ambas son una URL de OTRO
 * dominio), cualquier URL con esquema («https://…», «javascript:…») y los caracteres de control
 * (un salto de línea o un tabulador dentro de la ruta los quitan los navegadores al interpretar la
 * URL, y «/\t/otro-sitio» acabaría siendo «//otro-sitio»).
 *
 * @param {string|null|undefined} valor lo que llegó en la query
 * @param {string} [respaldo] a dónde ir si el valor no sirve
 * @returns {string}
 */
export function rutaInterna(valor, respaldo = '/admin') {
  if (typeof valor !== 'string') return respaldo
  if (!/^\/(?![/\\])/.test(valor)) return respaldo
  // Solo ASCII imprimible y sin espacios: lo demás tiene que ir codificado (%XX). Un «€» o un separador de
  // línea Unicode sin codificar revienta la cabecera Location (500), y los de control los quitan los navegadores.
  if (/[^\u0021-\u007e]/.test(valor)) return respaldo

  return valor
}
