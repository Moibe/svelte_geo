/**
 * Reglas PURAS del consentimiento de cookies: qué visitantes son de una región
 * que exige pedirlo, cómo se guarda y se lee la elección, y qué estado de Consent
 * Mode de Google corresponde a cada elección.
 *
 * Son puras (sin `window`, sin `document`, sin la request) para usarlas igual
 * desde el servidor (hooks.server.js), desde el script de arranque que se inserta
 * en el <head> (consentimiento-arranque.js), desde los componentes y desde las
 * pruebas. Ver COOKIES.md para el diseño completo.
 */

/** Nombre de la cookie propia donde se recuerda la elección. */
export const COOKIE_CONSENTIMIENTO = 'cookie_consent'

/**
 * Versión del formato Y del texto del aviso. Si cambian las finalidades o lo que
 * se activa con cada opción, se sube: las elecciones guardadas con otra versión
 * se ignoran y se vuelve a preguntar.
 */
export const VERSION_CONSENTIMIENTO = 1

/** Cuánto se recuerda la elección. Seis meses: lo que piden las autoridades de varios países. */
export const VIGENCIA_DIAS = 180

/**
 * Marca (en sessionStorage) de que la página se está recargando A PROPÓSITO porque cambió el
 * consentimiento (retirar un permiso con Google ya cargado): quien registra cierres y recargas
 * (page_close, page_refresh) la lee para NO anotar como actividad de la persona algo que provocó
 * el aviso. Vive solo en la pestaña y se borra al leerla.
 */
export const MARCA_RECARGA_POR_CONSENTIMIENTO = 'recarga_por_consentimiento'

/** Nombre del canal con el que las pestañas del mismo navegador se avisan que cambió la elección. */
export const CANAL_CONSENTIMIENTO = 'cookie_consent'

const SEGUNDOS_POR_DIA = 86400

/**
 * Cuánto puede adelantarse la fecha de una elección guardada respecto del reloj de quien la lee,
 * antes de darla por inválida. La cookie la fecha quien la escribe (el navegador al aceptar, el
 * servidor al renovarla) y la lee el otro: un equipo con el reloj atrasado ve «del futuro» la que
 * renovó el servidor, y sin margen la descartaría y volvería a preguntar (y a recargar) en cada
 * visita. Una semana cubre los relojes mal puestos de verdad y sigue rechazando fechas absurdas.
 */
export const TOLERANCIA_RELOJ_SEGUNDOS = 7 * SEGUNDOS_POR_DIA

/**
 * Países cuyos visitantes se tratan como "región regulada": hay que pedirles
 * consentimiento ANTES de activar analítica y publicidad.
 *
 * - Unión Europea (27), Espacio Económico Europeo (IS, LI, NO) y Reino Unido (GB):
 *   la ePrivacy / el RGPD y la PECR / UK GDPR.
 * - Suiza (CH): fuera de la UE, pero tiene su propia ley y la política de consentimiento
 *   de Google también la cubre; el sitio tiene versión en alemán y francés.
 * - Dependencias y territorios que aplican esas mismas reglas: Gibraltar (GI), Jersey (JE),
 *   Guernsey (GG), Isla de Man (IM), Åland (AX), Svalbard (SJ) y las regiones
 *   ultraperiféricas con código ISO propio (Guayana Francesa GF, Guadalupe GP, Martinica
 *   MQ, Reunión RE, Mayotte YT, San Martín MF).
 *
 * Excedernos es barato (un banner de más a alguien que no lo necesitaba); quedarnos
 * cortos no.
 */
export const PAISES_REGULADOS = new Set([
  // UE-27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEE (no UE)
  'IS', 'LI', 'NO',
  // Reino Unido y Suiza
  'GB', 'CH',
  // Dependencias y regiones ultraperiféricas
  'GI', 'JE', 'GG', 'IM', 'AX', 'SJ', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF',
])

/**
 * Zonas horarias que delatan a un visitante de la región regulada: todas las de
 * Europa más las de territorios ultramarinos y atlánticos que pertenecen a la UE.
 * "Europe/" incluye a Rusia, Turquía o Ucrania, que NO están en la región: un
 * banner de más ahí no hace daño.
 *
 * Ojo con Chipre: es de la UE pero su zona IANA es `Asia/Nicosia` (y `Asia/Famagusta`), y
 * los navegadores la reportan así incluso cuando el sistema dice `Europe/Nicosia`. Sin estas
 * dos entradas el prefijo "Asia/" de PREFIJOS_ZONA_FUERA la daba por "fuera de la región".
 * consentimiento.test.js recorre las zonas de TODOS los países de PAISES_REGULADOS (tabla
 * zone.tab de IANA) para que ningún país se quede sin cubrir.
 */
export const PREFIJOS_ZONA_REGULADA = ['Europe/']
export const ZONAS_REGULADAS = [
  'Asia/Nicosia', 'Asia/Famagusta',
  'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Reykjavik',
  'Africa/Ceuta', 'Arctic/Longyearbyen',
  'America/Cayenne', 'America/Guadeloupe', 'America/Martinique', 'America/Marigot',
  'Indian/Reunion', 'Indian/Mayotte',
]

/**
 * Prefijos de zona horaria que, sin ninguna de las zonas anteriores, dicen con
 * seguridad "no estoy en la región". UTC, Etc/* y las zonas vacías no dicen nada
 * (los navegadores que protegen la huella digital devuelven UTC): quedan como
 * "no sé".
 */
export const PREFIJOS_ZONA_FUERA = ['America/', 'Asia/', 'Australia/', 'Pacific/', 'Antarctica/', 'Africa/', 'Indian/', 'Atlantic/', 'US/', 'Canada/', 'Mexico/', 'Brazil/', 'Chile/']

/**
 * Con `?cookies=preview` en la URL el aviso se muestra desde CUALQUIER país: es la
 * forma de verlo y probarlo sin una VPN. No cambia nada más (ni da acceso a nada: solo
 * quien lo escribe en su propia URL ve su propio aviso). Es el patrón de una expresión
 * regular y no la regex misma porque el script de arranque (consentimiento-arranque.js)
 * viaja como texto y tiene que reconstruirla; así servidor y navegador comparten UNA
 * sola definición.
 */
export const PATRON_VISTA_PREVIA = '[?&]cookies=preview(&|$)'

/**
 * ¿La query string pide la vista previa del aviso?
 * @param {string|null|undefined} search p. ej. '?cookies=preview'
 */
export function esVistaPrevia(search) {
  return new RegExp(PATRON_VISTA_PREVIA).test(String(search ?? ''))
}

/**
 * ¿Un país (código ISO de dos letras) es de la región regulada?
 * @param {string|null|undefined} pais
 * @returns {'si'|'no'|'?'} '?' cuando no se pudo saber el país
 */
export function regionDePais(pais) {
  if (!pais || typeof pais !== 'string') return '?'

  const codigo = pais.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(codigo)) return '?'

  return PAISES_REGULADOS.has(codigo) ? 'si' : 'no'
}

/**
 * ¿Una zona horaria IANA es de la región regulada?
 * @param {string|null|undefined} zona p. ej. 'Europe/Berlin'
 * @returns {'si'|'no'|'?'}
 */
export function regionDeZonaHoraria(zona) {
  if (!zona || typeof zona !== 'string') return '?'

  if (ZONAS_REGULADAS.includes(zona) || PREFIJOS_ZONA_REGULADA.some((p) => zona.startsWith(p))) return 'si'
  if (PREFIJOS_ZONA_FUERA.some((p) => zona.startsWith(p))) return 'no'

  return '?'
}

/**
 * Combina las dos señales (país por IP, que decide el servidor, y zona horaria del
 * navegador) en una sola respuesta: ¿hay que pedir consentimiento?
 *
 * Es una UNIÓN conservadora: basta que UNA señal diga "región regulada". Una VPN
 * cambia la IP pero no la zona horaria del equipo (un alemán con VPN de EE. UU. sigue
 * en Europe/Berlin), y un reloj mal puesto no cambia la IP. Solo cuando NINGUNA señal
 * sabe (IP desconocida y zona UTC o vacía) se pide consentimiento por si acaso.
 *
 * Una elección guardada y vigente SIEMPRE cuenta como «hay que respetarla»: quien ya contestó
 * (por ejemplo «Rechazar todo» desde Alemania) y vuelve con una IP o una zona que dicen «fuera»
 * (una VPN, una red móvil mal ubicada, un navegador que esconde la zona) no pierde su elección en
 * silencio: una señal más débil no puede anular una respuesta explícita.
 *
 * @param {'si'|'no'|'?'} porIp
 * @param {'si'|'no'|'?'} porZona
 * @param {boolean} [hayDecisionGuardada]
 * @returns {boolean} true = hay que pedir consentimiento
 */
export function requiereConsentimiento(porIp, porZona, hayDecisionGuardada = false) {
  if (hayDecisionGuardada) return true
  if (porIp === 'si' || porZona === 'si') return true
  if (porIp === 'no' || porZona === 'no') return false

  return true
}

/**
 * Lee la elección guardada en la cookie. Devuelve null si no hay, si no se puede
 * leer, si es de otra versión o si ya venció: en cualquiera de esos casos hay que
 * volver a preguntar.
 *
 * @param {string|null|undefined} valor valor crudo de la cookie (puede venir codificado)
 * @param {number} [ahora] segundos desde 1970 (para pruebas)
 * @returns {{v: number, a: boolean, p: boolean, t: number}|null}
 */
export function leerDecision(valor, ahora = Math.floor(Date.now() / 1000)) {
  if (!valor) return null

  try {
    const bruto = JSON.parse(decodeURIComponent(String(valor)))

    if (!bruto || typeof bruto !== 'object') return null
    if (bruto.v !== VERSION_CONSENTIMIENTO) return null
    if (typeof bruto.t !== 'number' || !Number.isFinite(bruto.t)) return null
    // De otra época: venció, o viene del futuro (reloj mal puesto o cookie manipulada).
    if (bruto.t > ahora + TOLERANCIA_RELOJ_SEGUNDOS) return null
    if (ahora - bruto.t > VIGENCIA_DIAS * SEGUNDOS_POR_DIA) return null

    return { v: bruto.v, a: bruto.a === 1 || bruto.a === true, p: bruto.p === 1 || bruto.p === true, t: bruto.t }
  } catch {
    return null
  }
}

/**
 * El valor de la cookie para una elección: JSON compacto y codificado.
 *
 * @param {{analitica: boolean, publicidad: boolean}} eleccion
 * @param {number} [ahora] segundos desde 1970 (para pruebas)
 * @returns {string}
 */
export function serializarDecision({ analitica, publicidad }, ahora = Math.floor(Date.now() / 1000)) {
  return encodeURIComponent(
    JSON.stringify({ v: VERSION_CONSENTIMIENTO, a: analitica ? 1 : 0, p: publicidad ? 1 : 0, t: ahora })
  )
}

/** Atributos de la cookie de la elección (duración fija, solo del propio sitio). */
export function atributosCookie(https = true) {
  return `; Path=/; Max-Age=${VIGENCIA_DIAS * SEGUNDOS_POR_DIA}; SameSite=Lax${https ? '; Secure' : ''}`
}

/**
 * Extrae el valor de una cookie de un encabezado `Cookie` / de `document.cookie`.
 * @param {string|null|undefined} cabecera
 * @param {string} nombre
 * @returns {string|null}
 */
export function valorDeCookie(cabecera, nombre) {
  if (!cabecera) return null

  for (const parte of String(cabecera).split(';')) {
    const i = parte.indexOf('=')
    if (i === -1) continue
    if (parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim()
  }

  return null
}

/**
 * El estado de Consent Mode v2 de Google que corresponde a una situación.
 *
 *  - Sin región regulada: todo concedido (como siempre fue).
 *  - Región regulada sin elección: todo denegado salvo lo necesario.
 *  - Con elección: analítica → analytics_storage; publicidad → ad_storage,
 *    ad_user_data y ad_personalization.
 *
 * functionality_storage y security_storage quedan concedidos siempre: guardan cosas
 * estrictamente necesarias y no pasan por el aviso.
 *
 * @param {boolean} requerido ¿región regulada?
 * @param {{a: boolean, p: boolean}|null} decision
 */
export function estadoConsentModeGoogle(requerido, decision) {
  const conceder = (si) => (si ? 'granted' : 'denied')
  const analitica = !requerido || Boolean(decision?.a)
  const publicidad = !requerido || Boolean(decision?.p)

  return {
    ad_storage: conceder(publicidad),
    ad_user_data: conceder(publicidad),
    ad_personalization: conceder(publicidad),
    analytics_storage: conceder(analitica),
    functionality_storage: 'granted',
    personalization_storage: conceder(publicidad),
    security_storage: 'granted',
  }
}

/**
 * ¿Se pueden activar la analítica / la publicidad?
 * @param {boolean} requerido
 * @param {{a: boolean, p: boolean}|null} decision
 */
export function analiticaPermitida(requerido, decision) {
  return !requerido || Boolean(decision?.a)
}
export function publicidadPermitida(requerido, decision) {
  return !requerido || Boolean(decision?.p)
}
