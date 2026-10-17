import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Pruebas de lo que consulta el permiso en el navegador (consentimiento-navegador.js) y
 * del localStorage con permiso (almacenamiento.js). Node no tiene `window` ni
 * `localStorage`: se arman unos de mentira, y el `window` es un EventTarget de verdad para
 * poder probar `consent:cambio`.
 */

const ANTES = { window: globalThis.window, localStorage: globalThis.localStorage }

function almacenFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial))

  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => void datos.set(k, String(v)),
    removeItem: (k) => void datos.delete(k),
    // Object.keys(localStorage) en el navegador lista las claves guardadas.
    __datos: datos,
  }
}

/** Un navegador de mentira con el estado de consentimiento que se pida. */
function navegador({ requerido = true, decision = null, almacen = {}, sinConsent = false } = {}) {
  const ventana = new EventTarget()
  if (!sinConsent) ventana.__consent = { requerido, decision }

  const ls = almacenFalso(almacen)
  // Object.keys() sobre el objeto de mentira debe ver las claves guardadas.
  const proxy = new Proxy(ls, {
    ownKeys: () => [...ls.__datos.keys()],
    getOwnPropertyDescriptor: (obj, k) => (ls.__datos.has(k) ? { enumerable: true, configurable: true, value: ls.__datos.get(k) } : Reflect.getOwnPropertyDescriptor(obj, k)),
  })

  globalThis.window = ventana
  globalThis.localStorage = proxy

  return { ventana, ls }
}

// Los módulos se importan DESPUÉS de definir un navegador por defecto: guardan su estado (la
// memoria de almacenamiento.js) entre pruebas, así que cada prueba trabaja con claves propias.
navegador()
const { analiticaOk, publicidadOk, algunaOk, cuandoHayAnalitica, estadoDelNavegador } = await import('./consentimiento-navegador.js')
const {
  guardar,
  leer,
  quitar,
  permitido,
  borrarLoQueYaNoSePermite,
  promoverMemoria,
  guardarCoordenadasDelPago,
  leerCoordenadasDelPago,
  borrarCoordenadasDelPago,
  purgarCoordenadasVencidas,
} = await import('./almacenamiento.js')

beforeEach(() => navegador())
after(() => {
  globalThis.window = ANTES.window
  globalThis.localStorage = ANTES.localStorage
})

const SI = { a: true, p: true }
const SOLO_ANALITICA = { a: true, p: false }
const SOLO_PUBLICIDAD = { a: false, p: true }
const NADA = { a: false, p: false }

test('sin el script de arranque se asume lo MÁS ESTRICTO: región regulada y sin elección', () => {
  navegador({ sinConsent: true })

  assert.deepEqual(estadoDelNavegador(), { requerido: true, decision: null })
  assert.equal(analiticaOk(), false)
  assert.equal(publicidadOk(), false)
  assert.equal(algunaOk(), false)

  // Y sin `window` (renderizado en el servidor) lo mismo.
  const ventana = globalThis.window
  delete globalThis.window
  try {
    assert.equal(analiticaOk(), false)
  } finally {
    globalThis.window = ventana
  }
})

test('fuera de la región todo está permitido', () => {
  navegador({ requerido: false })

  assert.equal(analiticaOk(), true)
  assert.equal(publicidadOk(), true)
  assert.equal(algunaOk(), true)
})

test('en la región, cada permiso es el suyo', () => {
  const casos = [
    [null, false, false, false],
    [NADA, false, false, false],
    [SOLO_ANALITICA, true, false, true],
    [SOLO_PUBLICIDAD, false, true, true],
    [SI, true, true, true],
  ]

  for (const [decision, analitica, publicidad, alguna] of casos) {
    navegador({ requerido: true, decision })
    assert.equal(analiticaOk(), analitica, JSON.stringify(decision))
    assert.equal(publicidadOk(), publicidad, JSON.stringify(decision))
    assert.equal(algunaOk(), alguna, JSON.stringify(decision))
  }
})

test('cuandoHayAnalitica: con permiso se ejecuta de inmediato', () => {
  navegador({ requerido: true, decision: SOLO_ANALITICA })
  let corridas = 0

  cuandoHayAnalitica(() => corridas++)

  assert.equal(corridas, 1)
})

test('cuandoHayAnalitica: sin permiso espera, y corre UNA vez cuando llega', () => {
  const { ventana } = navegador({ requerido: true, decision: null })
  let corridas = 0

  cuandoHayAnalitica(() => corridas++)
  assert.equal(corridas, 0)

  // Llega una elección que NO da analítica: sigue esperando.
  ventana.__consent.decision = SOLO_PUBLICIDAD
  ventana.dispatchEvent(new Event('consent:cambio'))
  assert.equal(corridas, 0)

  // Llega la analítica: corre, una sola vez.
  ventana.__consent.decision = SI
  ventana.dispatchEvent(new Event('consent:cambio'))
  ventana.dispatchEvent(new Event('consent:cambio'))
  assert.equal(corridas, 1)
})

test('cuandoHayAnalitica: cancelar la espera evita que corra', () => {
  const { ventana } = navegador({ requerido: true, decision: null })
  let corridas = 0

  const cancelar = cuandoHayAnalitica(() => corridas++)
  cancelar()

  ventana.__consent.decision = SI
  ventana.dispatchEvent(new Event('consent:cambio'))
  assert.equal(corridas, 0)
})

test('permitido: cada clave pide el permiso que le toca', () => {
  navegador({ requerido: true, decision: SOLO_PUBLICIDAD })

  assert.equal(permitido('last_phone_number'), false)
  assert.equal(permitido('conversion_context'), false)
  assert.equal(permitido('pending_checkout'), false)
  assert.equal(permitido('geo_cache_+52_5512345678'), false)
  // Los datos de la compra sirven también para la publicidad.
  assert.equal(permitido('purchase_data'), true)

  navegador({ requerido: true, decision: SOLO_ANALITICA })
  assert.equal(permitido('last_phone_number'), true)
  assert.equal(permitido('purchase_data'), true)

  navegador({ requerido: true, decision: NADA })
  assert.equal(permitido('purchase_data'), false)
  // Una clave que nadie conoce pide lo más estricto: analítica.
  navegador({ requerido: true, decision: SOLO_PUBLICIDAD })
  assert.equal(permitido('clave_desconocida'), false)
})

test('guardar con permiso va al dispositivo y se lee de vuelta', () => {
  const { ls } = navegador({ requerido: true, decision: SI })

  assert.equal(guardar('last_phone_number_a', '555'), true)
  assert.equal(guardar('last_phone_number', '5512345678'), true)
  assert.equal(ls.__datos.get('last_phone_number'), '5512345678')
  assert.equal(leer('last_phone_number'), '5512345678')
})

test('guardar SIN permiso no toca el dispositivo, pero se recuerda mientras la página siga abierta', () => {
  const { ls } = navegador({ requerido: true, decision: null })

  assert.equal(guardar('conversion_context', '{"a":1}'), false)
  assert.equal(ls.__datos.has('conversion_context'), false, 'nada en el dispositivo')
  assert.equal(leer('conversion_context'), '{"a":1}', 'en memoria sí')

  quitar('conversion_context')
  assert.equal(leer('conversion_context'), null)
})

test('leer SIN permiso no mira el dispositivo aunque haya algo (de una elección anterior)', () => {
  navegador({ requerido: true, decision: NADA, almacen: { pending_checkout: 'true', purchase_data: '{}' } })

  assert.equal(leer('pending_checkout'), null)
  assert.equal(leer('purchase_data'), null)
})

test('fuera de la región funciona como un localStorage normal', () => {
  const { ls } = navegador({ requerido: false })

  guardar('geo_cache_+1_5551234567', '{"lat":1,"lng":2}')
  assert.equal(ls.__datos.get('geo_cache_+1_5551234567'), '{"lat":1,"lng":2}')
  assert.equal(leer('geo_cache_+1_5551234567'), '{"lat":1,"lng":2}')
})

test('un almacenamiento que lanza (modo privado, lleno) cae a la memoria sin romper nada', () => {
  navegador({ requerido: false })
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('bloqueado')
    },
    setItem: () => {
      throw new Error('lleno')
    },
    removeItem: () => {
      throw new Error('bloqueado')
    },
  }

  assert.equal(guardar('last_phone_number', '123'), false)
  assert.equal(leer('last_phone_number'), '123')
  assert.doesNotThrow(() => quitar('last_phone_number'))
  assert.doesNotThrow(() => borrarLoQueYaNoSePermite())
})

test('borrarLoQueYaNoSePermite borra solo lo propio que ya no tiene permiso', () => {
  const { ls } = navegador({
    requerido: true,
    decision: SOLO_ANALITICA,
    almacen: {
      last_phone_number: '555', // analítica: permitido, se queda
      conversion_context: '{}', // analítica: permitido
      'geo_cache_+52_555': '{}', // analítica: permitido
      purchase_data: '{}', // analítica o publicidad: permitido
      map_coords: '{}', // necesario: nunca se toca
      preferred_language: 'es', // necesario
      cosa_de_otro: 'x', // no es de este módulo
    },
  })

  borrarLoQueYaNoSePermite()
  assert.deepEqual([...ls.__datos.keys()].sort(), ['cosa_de_otro', 'conversion_context', 'geo_cache_+52_555', 'last_phone_number', 'map_coords', 'preferred_language', 'purchase_data'].sort())

  // La persona retira todo.
  globalThis.window.__consent.decision = NADA
  borrarLoQueYaNoSePermite()
  assert.deepEqual([...ls.__datos.keys()].sort(), ['cosa_de_otro', 'map_coords', 'preferred_language'])
})

test('retirar solo la publicidad le quita el gclid y el fbclid al contexto de la compra que ya estaba guardado', () => {
  const contexto = { phone: '555', language: 'es', utmSource: 'goog', gclid: 'G123', fbclid: 'F456' }
  const { ls } = navegador({
    requerido: true,
    decision: SI,
    almacen: { conversion_context: JSON.stringify(contexto), last_phone_number: '555' },
  })

  // Con todo concedido no se toca nada.
  borrarLoQueYaNoSePermite()
  assert.equal(JSON.parse(ls.__datos.get('conversion_context')).gclid, 'G123')

  // La persona retira SOLO la publicidad: el contexto sigue (es de analítica) pero sin los identificadores de anuncios.
  globalThis.window.__consent.decision = SOLO_ANALITICA
  borrarLoQueYaNoSePermite()

  const despues = JSON.parse(ls.__datos.get('conversion_context'))
  assert.equal(despues.gclid, null)
  assert.equal(despues.fbclid, null)
  assert.equal(despues.phone, '555')
  assert.equal(despues.utmSource, 'goog')
  assert.equal(ls.__datos.get('last_phone_number'), '555')

  // Idempotente: otra pasada no cambia nada.
  const antes = ls.__datos.get('conversion_context')
  borrarLoQueYaNoSePermite()
  assert.equal(ls.__datos.get('conversion_context'), antes)
})

test('retirar solo la analítica deja los datos de la compra mientras la publicidad siga permitida', () => {
  const { ls } = navegador({
    requerido: true,
    decision: SOLO_PUBLICIDAD,
    almacen: { last_phone_number: '555', purchase_data: '{}', pending_checkout: 'true', 'geo_cache_+1_5': '{}' },
  })

  borrarLoQueYaNoSePermite()

  assert.deepEqual([...ls.__datos.keys()], ['purchase_data'])
})

// ── la cookie es la fuente de verdad ──────────────────────────────────────────────────────────────

test('estadoDelNavegador contrasta con la cookie ANTES de contestar (otra pestaña pudo cambiarla)', () => {
  const { ventana } = navegador({ requerido: true, decision: SI })
  let llamadas = 0

  // El "sincronizar" real vive en el script de arranque: aquí uno de mentira que simula que otra pestaña retiró todo.
  ventana.__consent.sincronizar = () => {
    llamadas++
    ventana.__consent.decision = NADA

    return true
  }

  assert.equal(analiticaOk(), false, 'el permiso retirado en otra pestaña ya no vale')
  assert.equal(publicidadOk(), false)
  assert.ok(llamadas >= 2)
})

test('estadoDelNavegador sigue funcionando si sincronizar lanza', () => {
  const { ventana } = navegador({ requerido: true, decision: SOLO_ANALITICA })
  ventana.__consent.sincronizar = () => {
    throw new Error('cookie ilegible')
  }

  assert.equal(analiticaOk(), true)
  assert.equal(publicidadOk(), false)
})

test('leer y guardar usan el permiso vigente aunque la copia de esta página esté vieja', () => {
  const { ventana, ls } = navegador({ requerido: true, decision: SI })
  ventana.__consent.sincronizar = () => {
    ventana.__consent.decision = NADA
  }

  assert.equal(guardar('last_phone_number_b', '5551234'), false, 'ya no se guarda en el dispositivo')
  assert.equal(ls.__datos.has('last_phone_number_b'), false)
})

// ── esperas con clave ─────────────────────────────────────────────────────────────────────────────

test('cuandoHayAnalitica con clave: una sola espera por clave (la primera manda)', () => {
  const { ventana } = navegador({ requerido: true, decision: null })
  const registros = []

  cuandoHayAnalitica(() => registros.push('primera'), 'llegada')
  cuandoHayAnalitica(() => registros.push('segunda'), 'llegada') // otra vez la portada, sin haber contestado
  cuandoHayAnalitica(() => registros.push('otra-clave'), 'otra')

  ventana.__consent.decision = SI
  ventana.dispatchEvent(new Event('consent:cambio'))

  assert.deepEqual(registros.sort(), ['otra-clave', 'primera'], 'la segunda de la misma clave no se registra')
})

test('cuandoHayAnalitica con clave: tras cumplirse o cancelarse, la clave queda libre', () => {
  const { ventana } = navegador({ requerido: true, decision: null })
  const registros = []

  const cancelar = cuandoHayAnalitica(() => registros.push('uno'), 'llegada')
  cancelar()
  cuandoHayAnalitica(() => registros.push('dos'), 'llegada')

  ventana.__consent.decision = SI
  ventana.dispatchEvent(new Event('consent:cambio'))
  assert.deepEqual(registros, ['dos'])

  // Ya se cumplió: una nueva con la misma clave, con permiso, corre de inmediato.
  cuandoHayAnalitica(() => registros.push('tres'), 'llegada')
  assert.deepEqual(registros, ['dos', 'tres'])
})

// ── marca de "recarga por consentimiento" ─────────────────────────────────────────────────────────

test('la marca de recarga por consentimiento se pone, se lee sin borrarse y se consume una vez', async () => {
  const { marcarRecargaPorConsentimiento, hayRecargaPorConsentimiento, consumirRecargaPorConsentimiento } = await import('./consentimiento-navegador.js')
  const datos = new Map()

  globalThis.sessionStorage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => void datos.set(k, String(v)),
    removeItem: (k) => void datos.delete(k),
  }

  try {
    assert.equal(hayRecargaPorConsentimiento(), false)
    assert.equal(consumirRecargaPorConsentimiento(), false)

    marcarRecargaPorConsentimiento()
    assert.equal(hayRecargaPorConsentimiento(), true)
    assert.equal(hayRecargaPorConsentimiento(), true, 'leerla no la borra (la lee el cierre de la página)')
    assert.equal(consumirRecargaPorConsentimiento(), true)
    assert.equal(hayRecargaPorConsentimiento(), false, 'consumirla sí')
  } finally {
    delete globalThis.sessionStorage
  }
})

test('la marca no rompe nada si sessionStorage no existe o lanza', async () => {
  const { marcarRecargaPorConsentimiento, hayRecargaPorConsentimiento, consumirRecargaPorConsentimiento } = await import('./consentimiento-navegador.js')

  delete globalThis.sessionStorage
  assert.doesNotThrow(() => marcarRecargaPorConsentimiento())
  assert.equal(hayRecargaPorConsentimiento(), false)
  assert.equal(consumirRecargaPorConsentimiento(), false)
})

// ── aceptar DESPUÉS: lo que esperaba en memoria pasa al dispositivo ───────────────────────────────

test('promoverMemoria: lo que esperaba permiso pasa al dispositivo cuando llega', () => {
  const { ventana, ls } = navegador({ requerido: true, decision: null })

  guardar('conversion_context', '{"phone":"5512345678","language":"en"}')
  guardar('last_phone_number', '5512345678')
  assert.equal(ls.__datos.size, 0, 'sin permiso, nada en el dispositivo')

  // La persona acepta con la ventana de pago ya abierta.
  ventana.__consent.decision = SOLO_ANALITICA
  promoverMemoria()

  assert.equal(ls.__datos.get('last_phone_number'), '5512345678')
  assert.ok(ls.__datos.has('conversion_context'))
  // Y la memoria queda vacía: ya no hay nada que promover.
  ls.__datos.clear()
  promoverMemoria()
  assert.equal(ls.__datos.size, 0)
})

test('promoverMemoria: solo lo que tiene permiso (publicidad sola no promueve lo de analítica)', () => {
  const { ventana, ls } = navegador({ requerido: true, decision: null })

  guardar('pending_checkout', 'true') // analítica
  guardar('purchase_data', '{"value":1}') // analítica o publicidad

  ventana.__consent.decision = SOLO_PUBLICIDAD
  promoverMemoria()

  assert.equal(ls.__datos.has('purchase_data'), true)
  assert.equal(ls.__datos.has('pending_checkout'), false, 'pending_checkout sigue esperando analítica')
  assert.equal(leer('pending_checkout'), 'true', 'y sigue en memoria')

  ventana.__consent.decision = SI
  promoverMemoria()
  assert.equal(ls.__datos.get('pending_checkout'), 'true')
})

test('el contexto de la compra guarda sus identificadores de clic en memoria pero NO en el dispositivo sin permiso de publicidad', () => {
  const { ventana, ls } = navegador({ requerido: true, decision: SOLO_ANALITICA })
  const contexto = JSON.stringify({ phone: '5512', utmSource: 'goog', gclid: 'G123', fbclid: 'F456' })

  guardar('conversion_context', contexto)

  const guardado = JSON.parse(ls.__datos.get('conversion_context'))
  assert.equal(guardado.gclid, null)
  assert.equal(guardado.fbclid, null)
  assert.equal(guardado.utmSource, 'goog', 'las UTM son de analítica: se conservan')
  assert.equal(guardado.phone, '5512')

  // Con permiso de publicidad se guarda completo.
  ventana.__consent.decision = SI
  guardar('conversion_context', contexto)
  assert.equal(JSON.parse(ls.__datos.get('conversion_context')).gclid, 'G123')
})

test('si el permiso llega después, el contexto promovido conserva el gclid solo con permiso de publicidad', () => {
  const { ventana, ls } = navegador({ requerido: true, decision: null })
  const contexto = JSON.stringify({ gclid: 'G123', utmSource: 'goog' })

  guardar('conversion_context', contexto)
  assert.equal(leer('conversion_context'), contexto, 'en memoria queda completo')

  ventana.__consent.decision = SOLO_ANALITICA
  promoverMemoria()
  assert.equal(JSON.parse(ls.__datos.get('conversion_context')).gclid, null)
  assert.equal(JSON.parse(ls.__datos.get('conversion_context')).utmSource, 'goog')
})

// ── las coordenadas del mapa que se paga caducan ─────────────────────────────────────────────────

const HORA = 3600 * 1000

test('las coordenadas del pago se guardan con fecha y se leen de vuelta', () => {
  const { ls } = navegador({ requerido: true, decision: null }) // sin permiso: son NECESARIAS y se guardan igual
  const t0 = 1_800_000_000_000

  guardarCoordenadasDelPago(52.52, 13.4, t0)

  assert.deepEqual(JSON.parse(ls.__datos.get('map_coords')), { lat: 52.52, lng: 13.4, t: t0 })
  assert.deepEqual(leerCoordenadasDelPago(t0 + 5 * 60 * 1000), { lat: 52.52, lng: 13.4 })
  assert.deepEqual(leerCoordenadasDelPago(t0 + 23 * HORA), { lat: 52.52, lng: 13.4 })
})

test('las coordenadas del pago caducan a las 24 horas y las ilegibles o sin fecha no valen', () => {
  const { ls } = navegador({ requerido: true, decision: null })
  const t0 = 1_800_000_000_000

  guardarCoordenadasDelPago(1, 2, t0)
  assert.equal(leerCoordenadasDelPago(t0 + 25 * HORA), null, 'vencidas')
  assert.equal(leerCoordenadasDelPago(t0 - 2 * HORA), null, 'del futuro (reloj mal puesto)')

  for (const malo of ['basura', '{"lat":1,"lng":2}', '{"lat":"1","lng":2,"t":1}', '{"lat":1,"lng":2,"t":"ayer"}', 'null', '[]', '{}']) {
    ls.__datos.set('map_coords', malo)
    assert.equal(leerCoordenadasDelPago(t0), null, malo)
  }

  ls.__datos.delete('map_coords')
  assert.equal(leerCoordenadasDelPago(t0), null)
})

test('purgarCoordenadasVencidas borra lo vencido o inservible y deja lo vigente', () => {
  const { ls } = navegador({ requerido: true, decision: null })
  const t0 = 1_800_000_000_000

  guardarCoordenadasDelPago(1, 2, t0)
  purgarCoordenadasVencidas(t0 + 2 * HORA)
  assert.equal(ls.__datos.has('map_coords'), true, 'vigente: se queda')

  purgarCoordenadasVencidas(t0 + 30 * HORA)
  assert.equal(ls.__datos.has('map_coords'), false, 'vencida: se borra')

  // Las de antes de este cambio (sin fecha) se borran en la primera carga.
  ls.__datos.set('map_coords', '{"lat":1,"lng":2}')
  purgarCoordenadasVencidas(t0)
  assert.equal(ls.__datos.has('map_coords'), false)

  // Sin nada, no pasa nada.
  assert.doesNotThrow(() => purgarCoordenadasVencidas(t0))
})

test('borrarCoordenadasDelPago borra siempre, y nada de esto lanza si el almacenamiento falla', () => {
  const { ls } = navegador({ requerido: false })

  guardarCoordenadasDelPago(1, 2)
  borrarCoordenadasDelPago()
  assert.equal(ls.__datos.has('map_coords'), false)

  globalThis.localStorage = {
    getItem: () => {
      throw new Error('bloqueado')
    },
    setItem: () => {
      throw new Error('lleno')
    },
    removeItem: () => {
      throw new Error('bloqueado')
    },
  }

  assert.doesNotThrow(() => guardarCoordenadasDelPago(1, 2))
  assert.equal(leerCoordenadasDelPago(), null)
  assert.doesNotThrow(() => borrarCoordenadasDelPago())
  assert.doesNotThrow(() => purgarCoordenadasVencidas())
})
