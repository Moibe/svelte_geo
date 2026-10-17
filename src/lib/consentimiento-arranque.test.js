import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  VERSION_CONSENTIMIENTO,
  VIGENCIA_DIAS,
  estadoConsentModeGoogle,
  regionDeZonaHoraria,
  requiereConsentimiento,
  serializarDecision,
} from './consentimiento.js'
import { ALMACENAMIENTO_DE_GOOGLE, COOKIES_DE_GOOGLE, noscriptDeGoogle, scriptDeArranque } from './consentimiento-arranque.js'

/**
 * Ejecuta el script de arranque REAL (el mismo texto que va en el <head>) en un
 * navegador de mentira: un frasco de cookies que se comporta como el de verdad
 * (Max-Age=0 borra), un dataLayer, la zona horaria que se le pida y un <head> donde
 * se anota qué scripts se piden. Así se prueba el texto que se envía, no una copia.
 */
function ejecutar({ regionIp = '?', zona = '', cookies = {}, almacen = {}, search = '', protocolo = 'https:', host = 'geoservices.space', gtmId = 'GTM-PRUEBA', conFetch = false, jarra = null, bus = null, cookiesBloqueadas = false } = {}) {
  // `jarra` y `bus` se comparten entre dos llamadas para simular DOS PESTAÑAS del mismo navegador:
  // las cookies son de todas, y el canal de BroadcastChannel las comunica.
  const frasco = jarra ?? new Map(Object.entries(cookies))
  const localStorage = new Map(Object.entries(almacen))
  const escrituras = []
  const scriptsPedidos = []
  const eventos = []

  const documento = {
    get cookie() {
      return [...frasco].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set cookie(texto) {
      escrituras.push(texto)
      // «Bloquear todas las cookies»: el navegador descarta lo que se le escribe.
      if (cookiesBloqueadas) return
      const [par, ...atributos] = texto.split(';').map((x) => x.trim())
      const i = par.indexOf('=')
      const nombre = par.slice(0, i)
      const valor = par.slice(i + 1)
      const borra = atributos.some((a) => /^max-age=0$/i.test(a)) || atributos.some((a) => /^expires=thu, 01 jan 1970/i.test(a))
      if (borra) frasco.delete(nombre)
      else frasco.set(nombre, valor)
    },
    createElement: () => ({}),
    head: { appendChild: (el) => scriptsPedidos.push(el) },
    documentElement: { appendChild: (el) => scriptsPedidos.push(el) },
    visibilityState: 'visible',
    addEventListener: (tipo, fn) => (manejadoresDocumento[tipo] ??= []).push(fn),
  }

  const recargas = []
  const sesion = new Map()
  const manejadoresVentana = {}
  const manejadoresDocumento = {}

  const ventana = {
    location: { search, hostname: host, protocol: protocolo, reload: () => recargas.push(1), replace: (url) => recargas.push(url) },
    dispatchEvent: (e) => eventos.push(e),
    addEventListener: (tipo, fn) => (manejadoresVentana[tipo] ??= []).push(fn),
    localStorage: { removeItem: (k) => localStorage.delete(k) },
    sessionStorage: { setItem: (k, v) => sesion.set(k, v) },
  }
  if (bus) {
    // El mensaje llega a los OTROS canales con el mismo nombre, no al que lo manda.
    ventana.BroadcastChannel = function (nombre) {
      this.nombre = nombre
      bus.canales.push(this)
      this.postMessage = (mensaje) => {
        for (const otro of bus.canales) if (otro !== this && otro.nombre === nombre) otro.onmessage?.({ data: mensaje })
      }
    }
  }
  // fetch de mentira (opcional): anota las peticiones. Sin él, el script no debe romperse.
  const peticiones = []
  if (conFetch) {
    ventana.fetch = (url, opciones) => {
      peticiones.push({ url, ...opciones })
      return Promise.resolve({ ok: true })
    }
  }

  const contexto = vm.createContext({
    window: ventana,
    document: documento,
    CustomEvent: function (tipo, init) {
      this.type = tipo
      this.detail = init?.detail
    },
  })
  // Intl se reemplaza dentro del contexto para fijar la zona horaria.
  vm.runInContext(`Intl = { DateTimeFormat: function () { return { resolvedOptions: function () { return { timeZone: ${JSON.stringify(zona)} } } } } }`, contexto)

  const html = scriptDeArranque({ regionIp, gtmId })
  const codigo = html.replace(/^<script>/, '').replace(/<\/script>$/, '')
  vm.runInContext(codigo, contexto)

  // dataLayer: los comandos de gtag() entran como objetos Arguments; se pasan a arreglos para compararlos.
  // Y por JSON: lo que se crea dentro del contexto de vm tiene otros prototipos, y assert.deepEqual
  // estricto los vería distintos aunque tengan el mismo contenido.
  const dataLayer = JSON.parse(
    JSON.stringify((ventana.dataLayer || []).map((e) => (Object.prototype.toString.call(e) === '[object Arguments]' ? Array.from(e) : e)))
  )

  return {
    ventana,
    recargas,
    sesion,
    manejadoresVentana,
    manejadoresDocumento,
    peticiones,
    dataLayerCrudo: [...(ventana.dataLayer || [])],
    frasco,
    localStorage,
    escrituras,
    scriptsPedidos,
    eventos,
    dataLayer,
    consent: ventana.__consent,
    gtmCargado: scriptsPedidos.some((s) => String(s.src || '').includes('googletagmanager.com/gtm.js')),
    comandosConsent: dataLayer.filter((e) => Array.isArray(e) && e[0] === 'consent'),
  }
}

// El dataLayer ACTUAL de una ventana, normalizado (ver el comentario en ejecutar()).
const leerDataLayer = (ventana) =>
  JSON.parse(JSON.stringify((ventana.dataLayer || []).map((e) => (Object.prototype.toString.call(e) === '[object Arguments]' ? Array.from(e) : e))))

const AHORA = () => Math.floor(Date.now() / 1000)
const cookieDe = (analitica, publicidad, t = AHORA()) => ({ cookie_consent: serializarDecision({ analitica, publicidad }, t) })

test('gtag() empuja el objeto "arguments", NO un arreglo (con un arreglo Google ignora el default en silencio)', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies: cookieDe(true, true) })
  const tipo = (e) => Object.prototype.toString.call(e)
  const deConsentimiento = r.dataLayerCrudo.filter((e) => tipo(e) === '[object Arguments]' && e[0] === 'consent')

  assert.equal(deConsentimiento.length, 2, 'default y update, los dos como arguments')
  assert.equal(r.dataLayerCrudo.filter((e) => Array.isArray(e)).length, 0, 'ningún comando de Google debe ir como arreglo')
})

test('el script es un solo <script> y no puede cerrarse antes de tiempo', () => {
  const html = scriptDeArranque({ regionIp: 'si', gtmId: 'GTM-X' })

  assert.ok(html.startsWith('<script>') && html.endsWith('</script>'))
  assert.equal((html.match(/<\/script/gi) || []).length, 1, 'solo el cierre final')
  assert.equal((html.match(/<script/gi) || []).length, 1)
})

test('una región desconocida o inventada se reduce a "?" (nunca se inyecta texto libre)', () => {
  for (const raro of ['', 'quizá', '"; alert(1); //', undefined, null, 'SI', '</script>']) {
    const html = scriptDeArranque({ regionIp: raro, gtmId: 'GTM-X' })

    assert.ok(html.includes('"regionIp":"?"'), String(raro))
    assert.ok(!html.includes('alert(1)'))
  }
})

test('el script decide IGUAL que consentimiento.js, en todas las combinaciones de IP y zona horaria', () => {
  const zonas = ['Europe/Berlin', 'Europe/London', 'Europe/Madrid', 'Atlantic/Canary', 'America/Cayenne', 'Indian/Reunion', 'America/Mexico_City', 'America/Bogota', 'America/New_York', 'Asia/Tokyo', 'Africa/Cairo', 'Atlantic/Bermuda', 'UTC', 'Etc/UTC', 'GMT', '']

  for (const regionIp of ['si', 'no', '?']) {
    for (const zona of zonas) {
      const esperado = requiereConsentimiento(regionIp, regionDeZonaHoraria(zona))
      const real = ejecutar({ regionIp, zona }).consent.requerido

      assert.equal(real, esperado, `IP ${regionIp} + zona "${zona}"`)
    }
  }
})

test('fuera de la región: todo concedido y GTM se carga de inmediato (como siempre fue)', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'America/Mexico_City' })

  assert.equal(r.consent.requerido, false)
  assert.equal(r.gtmCargado, true)
  assert.deepEqual(r.comandosConsent, [['consent', 'default', estadoConsentModeGoogle(false, null)]])
  assert.ok(Object.values(r.comandosConsent[0][2]).every((v) => v === 'granted'))
  // El consentimiento va ANTES que GTM en el dataLayer.
  assert.equal(r.dataLayer.findIndex((e) => Array.isArray(e) && e[0] === 'consent'), 0)
  assert.equal(r.dataLayer[1].event, 'gtm.js')
})

test('en la región sin elección: todo denegado y NO se pide NADA de Google', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })

  assert.equal(r.consent.requerido, true)
  assert.equal(r.consent.decision, null)
  assert.equal(r.gtmCargado, false, 'GTM no debe descargarse sin consentimiento')
  assert.equal(r.scriptsPedidos.length, 0)
  assert.deepEqual(r.comandosConsent, [['consent', 'default', estadoConsentModeGoogle(true, null)]])
  assert.equal(r.comandosConsent[0][2].analytics_storage, 'denied')
  assert.equal(r.comandosConsent[0][2].ad_storage, 'denied')
})

test('una señal basta: IP de México pero equipo en Europe/Berlin (VPN) pide consentimiento', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'Europe/Berlin' })

  assert.equal(r.consent.requerido, true)
  assert.equal(r.gtmCargado, false)
})

test('IP desconocida y zona UTC: se pide consentimiento por si acaso', () => {
  const r = ejecutar({ regionIp: '?', zona: 'UTC' })

  assert.equal(r.consent.requerido, true)
  assert.equal(r.gtmCargado, false)
})

test('con una elección guardada que acepta algo: update + GTM, en ese orden', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Paris', cookies: cookieDe(true, false) })

  assert.deepEqual(r.consent.decision && { a: r.consent.decision.a, p: r.consent.decision.p }, { a: true, p: false })
  assert.deepEqual(r.comandosConsent.map((c) => c[1]), ['default', 'update'])
  assert.equal(r.comandosConsent[0][2].analytics_storage, 'denied')
  assert.equal(r.comandosConsent[1][2].analytics_storage, 'granted')
  assert.equal(r.comandosConsent[1][2].ad_storage, 'denied')
  assert.equal(r.gtmCargado, true)
  const iUpdate = r.dataLayer.findIndex((e) => Array.isArray(e) && e[1] === 'update')
  const iGtm = r.dataLayer.findIndex((e) => e && e.event === 'gtm.js')
  assert.ok(iUpdate < iGtm, 'el consentimiento tiene que estar puesto antes de que GTM arranque')
})

test('con una elección guardada que RECHAZA todo: no se carga GTM', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Paris', cookies: cookieDe(false, false) })

  assert.equal(r.consent.decision.a, false)
  assert.equal(r.consent.decision.p, false)
  assert.equal(r.gtmCargado, false)
})

test('una elección vencida, de otra versión, futura o ilegible se ignora y se vuelve a preguntar', () => {
  const venció = AHORA() - (VIGENCIA_DIAS + 1) * 86400
  const casos = {
    vencida: cookieDe(true, true, venció),
    'del futuro': cookieDe(true, true, AHORA() + 30 * 86400),
    'otra versión': { cookie_consent: encodeURIComponent(JSON.stringify({ v: VERSION_CONSENTIMIENTO + 1, a: 1, p: 1, t: AHORA() })) },
    ilegible: { cookie_consent: 'basura%' },
    vacía: { cookie_consent: '' },
  }

  for (const [nombre, cookies] of Object.entries(casos)) {
    const r = ejecutar({ regionIp: 'si', zona: 'Europe/Paris', cookies })

    assert.equal(r.consent.decision, null, nombre)
    assert.equal(r.gtmCargado, false, nombre)
  }
})

test('?cookies=preview fuerza el aviso desde cualquier país, sin tocar nada más', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'America/Mexico_City', search: '?utm_source=x&cookies=preview' })

  assert.equal(r.consent.requerido, true)
  assert.equal(r.gtmCargado, false)
  // y una palabra parecida no lo activa
  assert.equal(ejecutar({ regionIp: 'no', zona: 'America/Mexico_City', search: '?cookies=previewx' }).consent.requerido, false)
  assert.equal(ejecutar({ regionIp: 'no', zona: 'America/Mexico_City', search: '?xcookies=preview' }).consent.requerido, false)
})

test('aplicar(): guarda la cookie, actualiza Consent Mode y carga GTM al aceptar', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  assert.equal(r.gtmCargado, false)

  const decision = r.consent.aplicar(true, true)

  assert.deepEqual({ a: decision.a, p: decision.p }, { a: true, p: true })
  // La cookie: valor, duración y atributos.
  const escritura = r.escrituras.at(-1)
  assert.match(escritura, /^cookie_consent=/)
  assert.match(escritura, new RegExp(`Max-Age=${VIGENCIA_DIAS * 86400}`))
  assert.match(escritura, /SameSite=Lax; Secure$/)
  const valor = escritura.split(';')[0].slice('cookie_consent='.length)
  assert.deepEqual(JSON.parse(decodeURIComponent(valor)), { v: VERSION_CONSENTIMIENTO, a: 1, p: 1, t: decision.t })
  // Consent Mode: el update después del default, todo concedido.
  const comandos = leerDataLayer(r.ventana).filter((e) => Array.isArray(e) && e[0] === 'consent')
  assert.deepEqual(comandos.map((c) => c[1]), ['default', 'update'])
  assert.ok(Object.values(comandos[1][2]).every((v) => v === 'granted'))
  // GTM se pidió una sola vez.
  assert.equal(r.scriptsPedidos.filter((s) => String(s.src).includes('gtm.js')).length, 1)
  assert.match(r.scriptsPedidos[0].src, /id=GTM-PRUEBA$/)
  // Y la aplicación se entera.
  assert.equal(r.eventos.at(-1).type, 'consent:cambio')
})

test('aplicar() le avisa al servidor para que renueve la cookie (Safari limita a 7 días la que escribe JavaScript)', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', conFetch: true })

  r.consent.aplicar(true, false)

  assert.equal(r.peticiones.length, 1)
  assert.equal(r.peticiones[0].url, '/api/consentimiento')
  assert.equal(r.peticiones[0].method, 'POST')
  assert.equal(r.peticiones[0].keepalive, true)
  assert.equal(r.peticiones[0].credentials, 'same-origin')
  assert.deepEqual(JSON.parse(r.peticiones[0].body), { a: true, p: false })
})

test('aplicar() funciona igual si no hay fetch o si fetch falla', () => {
  // Sin fetch.
  const sin = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  assert.doesNotThrow(() => sin.consent.aplicar(true, true))
  assert.equal(sin.consent.decision.a, true)

  // Con un fetch que lanza al llamarlo y con uno que rechaza la promesa.
  const lanza = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  lanza.ventana.fetch = () => {
    throw new Error('sin red')
  }
  assert.doesNotThrow(() => lanza.consent.aplicar(false, false))
  assert.equal(lanza.consent.decision.a, false)

  const rechaza = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  rechaza.ventana.fetch = () => Promise.reject(new Error('503'))
  assert.doesNotThrow(() => rechaza.consent.aplicar(true, false))
})

test('aplicar() sin https no pone Secure; aplicar() dos veces no recarga GTM', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', protocolo: 'http:' })

  r.consent.aplicar(true, false)
  r.consent.aplicar(true, true)

  assert.doesNotMatch(r.escrituras.at(-1), /Secure/)
  assert.equal(r.scriptsPedidos.filter((s) => String(s.src).includes('gtm.js')).length, 1)
})

test('aplicar(rechazar todo) NO carga GTM y deja todo denegado', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })

  r.consent.aplicar(false, false)

  assert.equal(r.gtmCargado, false)
  const ultimo = leerDataLayer(r.ventana).filter((e) => Array.isArray(e) && e[1] === 'update').at(-1)
  assert.equal(ultimo[2].analytics_storage, 'denied')
  assert.equal(ultimo[2].ad_storage, 'denied')
  assert.equal(ultimo[2].ad_user_data, 'denied')
  assert.equal(ultimo[2].ad_personalization, 'denied')
})

test('retirar el consentimiento borra las cookies de Google de ESA categoría y solo de esa', () => {
  const cookies = {
    ...cookieDe(true, true),
    _ga: 'GA1.1.123.456',
    _ga_ABC123: 'GS1.1.1',
    _gid: 'GA1.1.9',
    _gcl_au: '1.1.7',
    _gcl_aw: 'GCL.1.abc',
    __gads: 'ID=1',
    preferred_language: 'de',
    algo_propio: 'x',
  }
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies })

  // Se retira solo la analítica.
  r.consent.aplicar(false, true)
  for (const k of ['_ga', '_ga_ABC123', '_gid']) assert.equal(r.frasco.has(k), false, `${k} debía borrarse`)
  for (const k of ['_gcl_au', '_gcl_aw', '__gads', 'preferred_language', 'algo_propio']) assert.equal(r.frasco.has(k), true, `${k} no debía tocarse`)

  // Ahora se retira también la publicidad.
  r.consent.aplicar(false, false)
  for (const k of ['_gcl_au', '_gcl_aw', '__gads']) assert.equal(r.frasco.has(k), false, `${k} debía borrarse`)
  assert.equal(r.frasco.get('preferred_language'), 'de', 'la cookie de idioma es necesaria y se conserva')
  assert.equal(r.frasco.has('algo_propio'), true)
  assert.equal(r.frasco.has('cookie_consent'), true, 'la elección misma se guarda')
})

test('al cargar en la región SIN permiso se borra lo que Google dejó de antes del aviso', () => {
  const cookies = { _ga: 'GA1.1.1.2', _ga_ABC: 'GS1', _gid: 'x', _gcl_au: '1.1.3', _gcl_aw: 'GCL.1', _gcl_gs: 'y', preferred_language: 'de', algo_propio: 'z' }
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies, almacen: { _gcl_ls: '{"a":1}', map_coords: '{}', last_phone_number: '5512345678' } })

  for (const k of ['_ga', '_ga_ABC', '_gid', '_gcl_au', '_gcl_aw', '_gcl_gs']) assert.equal(r.frasco.has(k), false, `${k} debía borrarse`)
  for (const k of ['preferred_language', 'algo_propio']) assert.equal(r.frasco.has(k), true, `${k} no es de Google`)
  assert.equal(r.localStorage.has('_gcl_ls'), false, 'la clave de localStorage del Conversion Linker también')
  assert.equal(r.localStorage.has('map_coords'), true, 'lo propio del sitio no lo toca este script')
  assert.equal(r.localStorage.has('last_phone_number'), true, 'lo propio del sitio lo limpia la aplicación, no este script')
})

test('al cargar con analítica concedida solo se borra lo de publicidad', () => {
  const cookies = { ...cookieDe(true, false), _ga: 'GA1.1.1.2', _ga_ABC: 'GS1', _gcl_au: '1.1.3', __gads: 'ID=1' }
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies, almacen: { _gcl_ls: 'x' } })

  assert.equal(r.frasco.has('_ga'), true)
  assert.equal(r.frasco.has('_ga_ABC'), true)
  assert.equal(r.frasco.has('_gcl_au'), false)
  assert.equal(r.frasco.has('__gads'), false)
  assert.equal(r.localStorage.has('_gcl_ls'), false)
})

test('al cargar con todo concedido no se borra nada', () => {
  const cookies = { ...cookieDe(true, true), _ga: 'GA1.1.1.2', _gcl_au: '1.1.3' }
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies, almacen: { _gcl_ls: 'x' } })

  assert.equal(r.frasco.has('_ga'), true)
  assert.equal(r.frasco.has('_gcl_au'), true)
  assert.equal(r.localStorage.has('_gcl_ls'), true)
})

test('FUERA de la región no se borra nada (nadie pidió permiso, nada que retirar)', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'America/Mexico_City', cookies: { _ga: 'GA1.1.1.2', _gcl_au: '1.1.3' }, almacen: { _gcl_ls: 'x' } })

  assert.equal(r.frasco.has('_ga'), true)
  assert.equal(r.frasco.has('_gcl_au'), true)
  assert.equal(r.localStorage.has('_gcl_ls'), true)
})

test('retirar publicidad borra también _gcl_ls del localStorage', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies: { ...cookieDe(true, true), _gcl_au: '1.1.3' }, almacen: { _gcl_ls: 'x', map_coords: '{}' } })

  r.consent.aplicar(true, false)

  assert.equal(r.localStorage.has('_gcl_ls'), false)
  assert.equal(r.localStorage.has('map_coords'), true)
})

test('necesitaRecarga: solo cuando se RETIRA algo y Google ya estaba cargado en esta página', () => {
  // Primera elección (aceptar): no hay nada que retirar.
  let r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  assert.equal(r.consent.necesitaRecarga, false)
  r.consent.aplicar(true, true)
  assert.equal(r.consent.necesitaRecarga, false)

  // ...y retirar algo después, en la misma página (GTM ya cargado por aceptar): sí.
  r.consent.aplicar(true, false)
  assert.equal(r.consent.necesitaRecarga, true)
  // Volver a conceder no pide recarga.
  r.consent.aplicar(true, true)
  assert.equal(r.consent.necesitaRecarga, false)

  // Elección guardada de antes (GTM se cargó al arrancar) y se retira todo: sí.
  r = ejecutar({ regionIp: 'si', zona: 'Europe/Paris', cookies: cookieDe(true, true) })
  r.consent.aplicar(false, false)
  assert.equal(r.consent.necesitaRecarga, true)

  // Primera elección = rechazar: Google nunca se cargó, no hay nada que recargar.
  r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })
  r.consent.aplicar(false, false)
  assert.equal(r.consent.necesitaRecarga, false)
  assert.equal(r.gtmCargado, false)

  // Elección guardada de antes que NO concedía nada y ahora tampoco: nada que retirar.
  r = ejecutar({ regionIp: 'si', zona: 'Europe/Paris', cookies: cookieDe(false, false) })
  r.consent.aplicar(false, false)
  assert.equal(r.consent.necesitaRecarga, false)
})

test('el <noscript> de GTM lleva el id, escapado', () => {
  assert.match(noscriptDeGoogle('GTM-ABC'), /ns\.html\?id=GTM-ABC"/)
  assert.ok(!noscriptDeGoogle('"><script>').includes('<script>'))
})

test('el catálogo de cookies de Google no deja a ninguna categoría vacía', () => {
  assert.ok(COOKIES_DE_GOOGLE.analitica.includes('_ga'))
  assert.ok(COOKIES_DE_GOOGLE.analitica.includes('_ga_*'))
  // Con comodín: el gtag.js real arma _gcl_au, _gcl_aw, _gcl_dc, _gcl_gb, _gcl_gf, _gcl_gs, _gcl_ha, _gcl_ag, _gcl_gp…
  assert.ok(COOKIES_DE_GOOGLE.publicidad.includes('_gcl_*'))
  assert.ok(ALMACENAMIENTO_DE_GOOGLE.publicidad.includes('_gcl_ls'))
})

// ── Dos pestañas del mismo navegador ──────────────────────────────────────────────────────────────
// La elección de cada página es una copia en memoria; la verdad es la cookie, que comparten todas.

/** Dos pestañas sobre la misma jarra de cookies, comunicadas por el mismo canal. */
function dosPestanas(opciones = {}) {
  const jarra = new Map(Object.entries(opciones.cookies ?? {}))
  const bus = { canales: [] }
  const base = { regionIp: 'si', zona: 'Europe/Berlin', jarra, bus }

  return { jarra, A: ejecutar(base), B: ejecutar(base) }
}

const GOOGLE = { _ga: 'GA1.1.1.2', _ga_ABC: 'GS1', _gid: 'x', _gcl_au: '1.1.3', _gcl_ag: 'a', _gcl_gp: 'b', __gads: 'ID=1' }

test('pestañas: si una acepta, la otra lo adopta (y carga Google) sin recargar', () => {
  const { A, B } = dosPestanas()
  assert.equal(B.gtmCargado, false)

  A.consent.aplicar(true, true)

  // El canal le avisó a B: leyó la cookie y adoptó la elección.
  assert.deepEqual({ a: B.consent.decision.a, p: B.consent.decision.p }, { a: true, p: true })
  assert.equal(B.scriptsPedidos.some((s) => String(s.src).includes('gtm.js')), true, 'B carga Google con el permiso que dio A')
  assert.deepEqual(B.comandosConsent.length >= 1, true)
  assert.equal(B.recargas.length, 0, 'ampliar un permiso no recarga')
  assert.equal(B.eventos.at(-1).type, 'consent:cambio', 'la aplicación de B se entera (para quitar su aviso)')
})

test('pestañas: si una RETIRA, la otra (con Google cargado) borra lo de Google y se recarga', () => {
  const { A, B, jarra } = dosPestanas({ cookies: { ...cookieDe(true, true), ...GOOGLE } })
  assert.equal(A.gtmCargado && B.gtmCargado, true, 'las dos arrancaron con Google por la elección guardada')

  B.consent.aplicar(false, false) // en B: Rechazar todo

  // En la pestaña que ELIGE, la recarga la hace la aplicación (consent.svelte.js) al ver necesitaRecarga.
  assert.equal(B.consent.necesitaRecarga, true, 'B se recarga (retiró algo y Google estaba cargado)')
  // A se enteró por el canal: adopta, borra y se recarga.
  assert.equal(A.consent.decision.a, false)
  assert.equal(A.consent.decision.p, false)
  assert.equal(A.recargas.length, 1, 'A también se recarga: sus etiquetas seguían vivas en memoria')
  assert.equal(A.sesion.get('recarga_por_consentimiento'), '1', 'A marca que la recarga es por el consentimiento (no es actividad de la persona)')
  assert.equal(A.consent.necesitaRecarga, true)
  for (const k of Object.keys(GOOGLE)) assert.equal(jarra.has(k), false, k)
  // La última orden de Consent Mode que A le mandó a Google: todo denegado.
  const ultimo = leerDataLayer(A.ventana).filter((e) => Array.isArray(e) && e[1] === 'update').at(-1)
  assert.equal(ultimo[2].analytics_storage, 'denied')
  assert.equal(ultimo[2].ad_storage, 'denied')
})

test('pestañas: rechazar en una BORRA lo de Google que creó otra, aunque ésta no tuviera nada concedido', () => {
  const { A, B, jarra } = dosPestanas()

  // B acepta y Google crea sus cookies (en el navegador, o sea en la jarra de las dos).
  B.consent.aplicar(true, true)
  for (const [k, v] of Object.entries(GOOGLE)) jarra.set(k, v)

  // A (que ya adoptó lo de B por el canal) rechaza.
  A.consent.aplicar(false, false)
  for (const k of Object.keys(GOOGLE)) assert.equal(jarra.has(k), false, k)

  // Y el caso que antes fallaba: una pestaña que NUNCA se enteró (sin canal) rechaza.
  const sola = new Map()
  const C = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra: sola })
  for (const [k, v] of Object.entries(GOOGLE)) sola.set(k, v) // otra pestaña los creó
  C.consent.aplicar(false, false)
  for (const k of Object.keys(GOOGLE)) assert.equal(sola.has(k), false, `sin canal: ${k}`)
})

test('pestañas: sin canal, la cookie se contrasta al volver a la pestaña, al restaurarla y al darle foco', () => {
  for (const evento of [
    (r) => r.manejadoresDocumento.visibilitychange.forEach((f) => f()),
    (r) => r.manejadoresVentana.pageshow.forEach((f) => f()),
    (r) => r.manejadoresVentana.focus.forEach((f) => f()),
  ]) {
    const jarra = new Map(Object.entries({ ...cookieDe(true, true), ...GOOGLE }))
    const A = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra }) // sin bus: no hay canal

    // Otra pestaña retiró todo y la cookie lo dice.
    for (const [k, v] of Object.entries(cookieDe(false, false))) jarra.set(k, v)
    evento(A)

    assert.equal(A.consent.decision.a, false)
    assert.equal(A.recargas.length, 1)
  }

  // visibilitychange a "hidden" no contrasta nada.
  const jarra = new Map(Object.entries(cookieDe(true, true)))
  const B = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra })
  for (const [k, v] of Object.entries(cookieDe(false, false))) jarra.set(k, v)
  B.ventana // eslint-disable-line no-unused-expressions
  B.manejadoresDocumento.visibilitychange.forEach((f) => f.call({ visibilityState: 'hidden' }))
  assert.equal(B.recargas.length, 1, 'el documento de la prueba sigue "visible": se contrasta')
})

test('sincronizar(): sin cambios no hace nada; la cookie borrada o vencida cuenta como "sin permiso"', () => {
  const jarra = new Map(Object.entries({ ...cookieDe(true, false), ...GOOGLE }))
  const A = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra })
  const eventosAntes = A.eventos.length

  assert.equal(A.consent.sincronizar(), false)
  assert.equal(A.eventos.length, eventosAntes)
  assert.equal(A.recargas.length, 0)

  // Se borraron las cookies del sitio: la elección ya no existe.
  jarra.delete('cookie_consent')
  assert.equal(A.consent.sincronizar(), true)
  assert.equal(A.consent.decision, null)
  assert.equal(A.recargas.length, 1, 'tenía Google cargado con un permiso que ya no hay')
  assert.equal(jarra.has('_ga'), false)
})

test('sincronizar(): fuera de la región no hay elección que contrastar', () => {
  const jarra = new Map(Object.entries({ ...GOOGLE }))
  const A = ejecutar({ regionIp: 'no', zona: 'America/Mexico_City', jarra })

  // Aunque alguien escribiera una cookie de rechazo (otra IP, un reloj distinto), aquí no aplica.
  for (const [k, v] of Object.entries(cookieDe(false, false))) jarra.set(k, v)

  assert.equal(A.consent.sincronizar(), false)
  assert.equal(A.recargas.length, 0)
  assert.equal(jarra.has('_ga'), true, 'no se borra lo de Google de quien no tiene que dar permiso')
})

// ── una elección guardada manda sobre las señales de región ──────────────────────────────────────

test('un RECHAZO guardado se respeta aunque la IP y la zona digan "fuera de la región" (VPN, zona UTC)', () => {
  for (const [regionIp, zona] of [['no', 'UTC'], ['no', ''], ['no', 'America/New_York'], ['no', 'Etc/UTC'], ['?', 'America/Mexico_City']]) {
    const jarra = new Map(Object.entries({ ...cookieDe(false, false), ...GOOGLE }))
    const r = ejecutar({ regionIp, zona, jarra })

    assert.equal(r.consent.requerido, true, `${regionIp}/${zona}: la elección guardada obliga a respetarla`)
    assert.equal(r.gtmCargado, false, `${regionIp}/${zona}: no se carga Google`)
    for (const k of Object.keys(GOOGLE)) assert.equal(jarra.has(k), false, `${regionIp}/${zona}: se borra ${k}`)
    assert.equal(r.comandosConsent[0][2].analytics_storage, 'denied')
    assert.equal(r.comandosConsent[0][2].ad_storage, 'denied')
  }
})

test('una elección guardada con permisos concedidos también se respeta desde una IP de fuera', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'UTC', cookies: cookieDe(true, false) })

  assert.equal(r.consent.requerido, true)
  assert.equal(r.comandosConsent.at(-1)[2].analytics_storage, 'granted')
  assert.equal(r.comandosConsent.at(-1)[2].ad_storage, 'denied')
  assert.equal(r.gtmCargado, true)
})

test('sin elección guardada, fuera de la región sigue todo concedido (como siempre)', () => {
  const r = ejecutar({ regionIp: 'no', zona: 'America/Mexico_City' })

  assert.equal(r.consent.requerido, false)
  assert.equal(r.comandosConsent[0][2].analytics_storage, 'granted')
  assert.equal(r.gtmCargado, true)
})

test('una cookie de otra versión o vencida NO cuenta como elección guardada', () => {
  const vieja = { cookie_consent: serializarDecision({ analitica: false, publicidad: false }, AHORA() - (VIGENCIA_DIAS + 1) * 86400) }
  const r = ejecutar({ regionIp: 'no', zona: 'UTC', cookies: vieja })

  // IP "fuera" y zona UTC (no sabe): sin elección vigente se decide como siempre → fuera de la región.
  assert.equal(r.consent.requerido, false)
})

// ── reloj mal puesto ─────────────────────────────────────────────────────────────────────────────

test('la fecha de la elección tolera un reloj atrasado hasta una semana, y no más', () => {
  const adelantada = (dias) => ({ cookie_consent: serializarDecision({ analitica: true, publicidad: true }, AHORA() + dias * 86400) })

  assert.equal(ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies: adelantada(3) }).consent.decision?.a, true, '3 días: se acepta')
  assert.equal(ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookies: adelantada(10) }).consent.decision, null, '10 días: se descarta')
})

// ── navegador que no guarda la cookie ────────────────────────────────────────────────────────────

test('si el navegador NO guarda la cookie, aceptar se obedece en la página y NO provoca recargas', () => {
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', cookiesBloqueadas: true })

  r.consent.aplicar(true, true)

  assert.equal(r.consent.sinCookies, true, 'se da cuenta de que la cookie no quedó')
  assert.equal(r.consent.decision.a, true, 'la elección sigue vigente en esta página')
  assert.equal(r.scriptsPedidos.some((s) => String(s.src || '').includes('gtm.js')), true, 'Google se carga al aceptar')

  // Cualquier contraste posterior (lo hace cada analiticaOk()) no lo toma por una retirada.
  assert.equal(r.consent.sincronizar(), false)
  assert.equal(r.consent.decision.a, true)
  assert.equal(r.recargas.length, 0)
  assert.equal(r.consent.necesitaRecarga, false)
})

test('con cookies normales, sinCookies es false y el contraste sigue funcionando', () => {
  const jarra = new Map()
  const r = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra })

  r.consent.aplicar(true, true)
  assert.equal(r.consent.sinCookies, false)

  jarra.delete('cookie_consent')
  assert.equal(r.consent.sincronizar(), true, 'si la cookie se borra de verdad, sí es una retirada')
})

// ── a dónde se recarga ───────────────────────────────────────────────────────────────────────────

test('recargar(): por defecto recarga la página; con urlAlRecargar va a esa URL (el mapa pagado), y siempre deja la marca', () => {
  const A = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })

  A.consent.recargar()
  assert.deepEqual(A.recargas, [1], 'location.reload()')
  assert.equal(A.sesion.get('recarga_por_consentimiento'), '1')

  const B = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin' })

  B.consent.urlAlRecargar = '/es?payment=success'
  B.consent.recargar()
  assert.deepEqual(B.recargas, ['/es?payment=success'], 'location.replace(url)')
  assert.equal(B.sesion.get('recarga_por_consentimiento'), '1')
})

test('retirar un permiso desde otra pestaña recarga hacia urlAlRecargar si la página lo fijó', () => {
  const jarra = new Map(Object.entries({ ...cookieDe(true, true), ...GOOGLE }))
  const A = ejecutar({ regionIp: 'si', zona: 'Europe/Berlin', jarra })

  A.consent.urlAlRecargar = '/es?payment=success'
  for (const [k, v] of Object.entries(cookieDe(false, false))) jarra.set(k, v)

  assert.equal(A.consent.sincronizar(), true)
  assert.deepEqual(A.recargas, ['/es?payment=success'])
})
