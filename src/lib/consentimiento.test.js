import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAISES_REGULADOS,
  TOLERANCIA_RELOJ_SEGUNDOS,
  VERSION_CONSENTIMIENTO,
  VIGENCIA_DIAS,
  analiticaPermitida,
  atributosCookie,
  esVistaPrevia,
  estadoConsentModeGoogle,
  leerDecision,
  publicidadPermitida,
  regionDePais,
  regionDeZonaHoraria,
  requiereConsentimiento,
  serializarDecision,
  valorDeCookie,
} from './consentimiento.js'

const DIA = 86400
const AHORA = 1_800_000_000

test('la región regulada incluye la UE-27, el EEE, el Reino Unido y Suiza', () => {
  const UE = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']

  assert.equal(UE.length, 27)
  for (const pais of [...UE, 'IS', 'LI', 'NO', 'GB', 'CH']) {
    assert.equal(regionDePais(pais), 'si', pais)
  }
})

test('los países donde está el público del sitio NO piden consentimiento', () => {
  for (const pais of ['MX', 'US', 'CO', 'AR', 'CL', 'PE', 'BR', 'EC', 'GT', 'CA', 'JP', 'IN', 'AU', 'EG']) {
    assert.equal(regionDePais(pais), 'no', pais)
  }
})

test('esVistaPrevia: solo el parámetro exacto cookies=preview, en cualquier posición de la query', () => {
  for (const si of ['?cookies=preview', '?a=1&cookies=preview', '?cookies=preview&a=1', '?utm=x&cookies=preview&z=2']) {
    assert.equal(esVistaPrevia(si), true, si)
  }
  for (const no of ['', null, undefined, '?cookies=previews', '?xcookies=preview', '?cookies=', '?cookie=preview', '?a=cookies=preview', '/preview']) {
    assert.equal(esVistaPrevia(no), false, String(no))
  }
})

test('regionDePais acepta minúsculas y dice "no sé" ante lo que no es un país', () => {
  assert.equal(regionDePais('de'), 'si')
  assert.equal(regionDePais(' gb '), 'si')
  for (const raro of [null, undefined, '', 'D', 'DEU', '12', 42, {}]) {
    assert.equal(regionDePais(raro), '?', String(raro))
  }
})

test('no hay códigos duplicados ni en minúsculas en la lista de países', () => {
  for (const pais of PAISES_REGULADOS) assert.match(pais, /^[A-Z]{2}$/)
})

test('regionDeZonaHoraria: Europa y los territorios de la UE son "sí"; América y Asia son "no"', () => {
  for (const zona of ['Europe/Berlin', 'Europe/London', 'Europe/Madrid', 'Europe/Zurich', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Africa/Ceuta', 'America/Cayenne', 'Indian/Reunion', 'Indian/Mayotte']) {
    assert.equal(regionDeZonaHoraria(zona), 'si', zona)
  }
  for (const zona of ['America/Mexico_City', 'America/Bogota', 'America/New_York', 'America/Sao_Paulo', 'Asia/Tokyo', 'Australia/Sydney', 'Africa/Cairo', 'Indian/Maldives', 'Pacific/Auckland', 'Atlantic/Bermuda']) {
    assert.equal(regionDeZonaHoraria(zona), 'no', zona)
  }
})

/**
 * Las zonas horarias IANA (zone.tab) de CADA país de la región regulada, más los alias que los
 * navegadores canonizan a otro nombre. La zona horaria es la segunda señal del aviso: un país
 * cuyas zonas no den "si" quedaría sin cobertura cuando la IP no lo delata (VPN, IP sin dato).
 * Así se perdió Chipre: su zona es Asia/Nicosia y el prefijo "Asia/" decía "fuera".
 */
const ZONAS_POR_PAIS = {
  AT: ['Europe/Vienna'], BE: ['Europe/Brussels'], BG: ['Europe/Sofia'], HR: ['Europe/Zagreb'],
  CY: ['Asia/Nicosia', 'Asia/Famagusta', 'Europe/Nicosia'], CZ: ['Europe/Prague'], DK: ['Europe/Copenhagen'],
  EE: ['Europe/Tallinn'], FI: ['Europe/Helsinki'], FR: ['Europe/Paris'], DE: ['Europe/Berlin', 'Europe/Busingen'],
  GR: ['Europe/Athens'], HU: ['Europe/Budapest'], IE: ['Europe/Dublin'], IT: ['Europe/Rome'], LV: ['Europe/Riga'],
  LT: ['Europe/Vilnius'], LU: ['Europe/Luxembourg'], MT: ['Europe/Malta'], NL: ['Europe/Amsterdam'], PL: ['Europe/Warsaw'],
  PT: ['Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores'], RO: ['Europe/Bucharest'], SK: ['Europe/Bratislava'],
  SI: ['Europe/Ljubljana'], ES: ['Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary'], SE: ['Europe/Stockholm'],
  IS: ['Atlantic/Reykjavik'], LI: ['Europe/Vaduz'], NO: ['Europe/Oslo'], GB: ['Europe/London'], CH: ['Europe/Zurich'],
  GI: ['Europe/Gibraltar'], JE: ['Europe/Jersey'], GG: ['Europe/Guernsey'], IM: ['Europe/Isle_of_Man'],
  AX: ['Europe/Mariehamn'], SJ: ['Arctic/Longyearbyen'], GF: ['America/Cayenne'], GP: ['America/Guadeloupe'],
  MQ: ['America/Martinique'], RE: ['Indian/Reunion'], YT: ['Indian/Mayotte'], MF: ['America/Marigot'],
}

test('la tabla de zonas del test cubre EXACTAMENTE los países de la región regulada', () => {
  assert.deepEqual(Object.keys(ZONAS_POR_PAIS).sort(), [...PAISES_REGULADOS].sort())
})

test('TODA zona horaria de un país regulado cuenta como región regulada, tal cual y como la canoniza el navegador', () => {
  for (const [pais, zonas] of Object.entries(ZONAS_POR_PAIS)) {
    for (const zona of zonas) {
      assert.equal(regionDeZonaHoraria(zona), 'si', `${pais}: ${zona}`)

      // Los navegadores devuelven el nombre CANÓNICO: Europe/Nicosia sale como Asia/Nicosia.
      const canonica = new Intl.DateTimeFormat('en-US', { timeZone: zona }).resolvedOptions().timeZone
      assert.equal(regionDeZonaHoraria(canonica), 'si', `${pais}: ${zona} se canoniza a ${canonica}`)
    }
  }
})

test('Chipre sin IP identificable pide consentimiento (la zona horaria basta)', () => {
  for (const zona of ['Asia/Nicosia', 'Asia/Famagusta', 'Europe/Nicosia']) {
    assert.equal(requiereConsentimiento('?', regionDeZonaHoraria(zona)), true, zona)
    assert.equal(requiereConsentimiento('no', regionDeZonaHoraria(zona)), true, zona + ' con VPN')
  }
})

test('regionDeZonaHoraria: UTC y lo vacío no dicen nada', () => {
  // Los navegadores que protegen la huella digital (Tor, Firefox con resistFingerprinting)
  // devuelven UTC para todo el mundo.
  for (const zona of ['UTC', 'Etc/UTC', 'GMT', 'Etc/GMT+5', '', null, undefined]) {
    assert.equal(regionDeZonaHoraria(zona), '?', String(zona))
  }
})

test('requiereConsentimiento: basta UNA señal de región regulada; con ninguna señal se pide por si acaso', () => {
  const casos = [
    // porIp, porZona, esperado
    ['si', 'si', true],
    ['si', 'no', true], // un alemán... o un mexicano de viaje con el reloj mal: la IP manda
    ['no', 'si', true], // VPN de EE. UU. con el equipo en Europe/Berlin
    ['si', '?', true],
    ['?', 'si', true],
    ['no', 'no', false],
    ['no', '?', false], // IP de México y navegador en UTC: no hay motivo para el banner
    ['?', 'no', false], // IP desconocida pero zona de América: tampoco
    ['?', '?', true], // nadie sabe: se pide por si acaso
  ]

  for (const [porIp, porZona, esperado] of casos) {
    assert.equal(requiereConsentimiento(porIp, porZona), esperado, `${porIp} + ${porZona}`)
    // Con una elección guardada y vigente, SIEMPRE se respeta: una señal débil no la anula.
    assert.equal(requiereConsentimiento(porIp, porZona, true), true, `${porIp} + ${porZona} + elección guardada`)
  }
})

test('leerDecision tolera un reloj atrasado hasta TOLERANCIA_RELOJ_SEGUNDOS y no más', () => {
  const cookie = (t) => serializarDecision({ analitica: true, publicidad: true }, t)

  assert.equal(leerDecision(cookie(AHORA + 3 * 86400), AHORA)?.a, true)
  assert.equal(leerDecision(cookie(AHORA + TOLERANCIA_RELOJ_SEGUNDOS), AHORA)?.a, true)
  assert.equal(leerDecision(cookie(AHORA + TOLERANCIA_RELOJ_SEGUNDOS + 60), AHORA), null)
})

test('la elección se guarda y se lee de vuelta', () => {
  const valor = serializarDecision({ analitica: true, publicidad: false }, AHORA)

  assert.deepEqual(leerDecision(valor, AHORA), { v: VERSION_CONSENTIMIENTO, a: true, p: false, t: AHORA })
  assert.deepEqual(leerDecision(serializarDecision({ analitica: false, publicidad: false }, AHORA), AHORA), { v: VERSION_CONSENTIMIENTO, a: false, p: false, t: AHORA })
  // El valor es seguro para ir en una cabecera Cookie: nada de ; , espacios ni comillas.
  assert.match(valor, /^[A-Za-z0-9%._~-]+$/)
})

test('una elección vencida, futura, de otra versión o ilegible se ignora', () => {
  const buena = serializarDecision({ analitica: true, publicidad: true }, AHORA)
  assert.ok(leerDecision(buena, AHORA + (VIGENCIA_DIAS - 1) * DIA))

  // Venció.
  assert.equal(leerDecision(buena, AHORA + (VIGENCIA_DIAS + 1) * DIA), null)
  // Viene del futuro (reloj mal puesto o cookie manipulada).
  assert.equal(leerDecision(serializarDecision({ analitica: true, publicidad: true }, AHORA + 30 * DIA), AHORA), null)
  // Otra versión del aviso: se vuelve a preguntar.
  const otraVersion = encodeURIComponent(JSON.stringify({ v: VERSION_CONSENTIMIENTO + 1, a: 1, p: 1, t: AHORA }))
  assert.equal(leerDecision(otraVersion, AHORA), null)
  // Ilegible o incompleta.
  for (const mal of [null, undefined, '', 'basura', '%E0%A4%A', 'null', '1', '[]', encodeURIComponent('{"v":1}'), encodeURIComponent('{"v":1,"a":1,"p":1,"t":"ayer"}')]) {
    assert.equal(leerDecision(mal, AHORA), null, String(mal))
  }
})

test('valorDeCookie encuentra la cookie entre otras y no confunde nombres parecidos', () => {
  const cabecera = 'preferred_language=es; cookie_consent_extra=1; cookie_consent=ABC%7B; _ga=GA1.1.2'

  assert.equal(valorDeCookie(cabecera, 'cookie_consent'), 'ABC%7B')
  assert.equal(valorDeCookie(cabecera, 'preferred_language'), 'es')
  assert.equal(valorDeCookie(cabecera, 'no_existe'), null)
  assert.equal(valorDeCookie('', 'cookie_consent'), null)
  assert.equal(valorDeCookie(null, 'cookie_consent'), null)
})

test('la cookie dura lo mismo que la vigencia y solo lleva Secure en https', () => {
  assert.match(atributosCookie(true), new RegExp(`Max-Age=${VIGENCIA_DIAS * DIA}`))
  assert.match(atributosCookie(true), /SameSite=Lax; Secure$/)
  assert.doesNotMatch(atributosCookie(false), /Secure/)
})

test('Consent Mode: fuera de la región todo concedido, como siempre fue', () => {
  const estado = estadoConsentModeGoogle(false, null)

  assert.ok(Object.values(estado).every((v) => v === 'granted'))
})

test('Consent Mode: en la región regulada y sin elección todo denegado salvo lo necesario', () => {
  assert.deepEqual(estadoConsentModeGoogle(true, null), {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'denied',
    security_storage: 'granted',
  })
})

test('Consent Mode: cada elección activa SOLO lo suyo', () => {
  const soloAnalitica = estadoConsentModeGoogle(true, { a: true, p: false })
  assert.equal(soloAnalitica.analytics_storage, 'granted')
  assert.equal(soloAnalitica.ad_storage, 'denied')
  assert.equal(soloAnalitica.ad_user_data, 'denied')
  assert.equal(soloAnalitica.ad_personalization, 'denied')

  const soloPublicidad = estadoConsentModeGoogle(true, { a: false, p: true })
  assert.equal(soloPublicidad.analytics_storage, 'denied')
  assert.equal(soloPublicidad.ad_storage, 'granted')
  assert.equal(soloPublicidad.ad_user_data, 'granted')
  assert.equal(soloPublicidad.ad_personalization, 'granted')

  const todo = estadoConsentModeGoogle(true, { a: true, p: true })
  assert.ok(Object.values(todo).every((v) => v === 'granted'))

  const nada = estadoConsentModeGoogle(true, { a: false, p: false })
  assert.equal(nada.analytics_storage, 'denied')
  assert.equal(nada.ad_storage, 'denied')
})

test('analiticaPermitida y publicidadPermitida: libres fuera de la región, con elección dentro', () => {
  assert.equal(analiticaPermitida(false, null), true)
  assert.equal(publicidadPermitida(false, null), true)

  assert.equal(analiticaPermitida(true, null), false)
  assert.equal(publicidadPermitida(true, null), false)
  assert.equal(analiticaPermitida(true, { a: true, p: false }), true)
  assert.equal(publicidadPermitida(true, { a: true, p: false }), false)
  assert.equal(publicidadPermitida(true, { a: false, p: true }), true)
})
