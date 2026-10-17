import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VERSION_CONSENTIMIENTO, VIGENCIA_DIAS, leerDecision } from '../../../lib/consentimiento.js'
import { POST } from './+server.js'

/** Un `cookies` de SvelteKit de mentira: anota lo que se le pone. */
function jarra() {
  const puestas = []

  return { puestas, set: (nombre, valor, opciones) => puestas.push({ nombre, valor, opciones }) }
}

function peticion(cuerpo, { origen = 'https://geoservices.space', crudo = false } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (origen !== null) headers.origin = origen

  return new Request('https://geoservices.space/api/consentimiento', {
    method: 'POST',
    headers,
    body: crudo ? cuerpo : JSON.stringify(cuerpo),
  })
}

const llamar = (req, url = 'https://geoservices.space/api/consentimiento') => {
  const cookies = jarra()

  return POST({ request: req, cookies, url: new URL(url) }).then((respuesta) => ({ respuesta, cookies }))
}

test('guarda la elección como cookie del servidor, con la vida completa y sin doble codificación', async () => {
  const { respuesta, cookies } = await llamar(peticion({ a: true, p: false }))

  assert.equal(respuesta.status, 204)
  assert.equal(respuesta.headers.get('cache-control'), 'no-store')
  assert.equal(cookies.puestas.length, 1)

  const { nombre, valor, opciones } = cookies.puestas[0]
  assert.equal(nombre, 'cookie_consent')
  assert.equal(opciones.maxAge, VIGENCIA_DIAS * 86400)
  assert.equal(opciones.path, '/')
  assert.equal(opciones.sameSite, 'lax')
  assert.equal(opciones.secure, true)
  assert.equal(opciones.httpOnly, false, 'el script de arranque la lee con document.cookie')
  // Sin codificación extra: la función `encode` devuelve el valor tal cual.
  assert.equal(opciones.encode(valor), valor)
  // Y lo guardado es lo que el resto del sitio sabe leer.
  assert.deepEqual(leerDecision(valor), { v: VERSION_CONSENTIMIENTO, a: true, p: false, t: leerDecision(valor).t })
})

test('no pone Secure en http (pruebas locales)', async () => {
  const { cookies } = await llamar(peticion({ a: false, p: false }, { origen: 'http://localhost:3931' }), 'http://localhost:3931/api/consentimiento')

  assert.equal(cookies.puestas[0].opciones.secure, false)
})

test('rechaza un POST que viene de otro sitio', async () => {
  for (const origen of ['https://malo.example', 'https://geoservices.space.malo.example', 'http://geoservices.space', 'null']) {
    const { respuesta, cookies } = await llamar(peticion({ a: true, p: true }, { origen }))

    assert.equal(respuesta.status, 403, origen)
    assert.equal(cookies.puestas.length, 0, origen)
  }
})

test('sin cabecera Origin (herramientas de línea de comandos) se acepta: no es una petición de otra página', async () => {
  const { respuesta } = await llamar(peticion({ a: true, p: true }, { origen: null }))

  assert.equal(respuesta.status, 204)
})

test('rechaza lo que no sea exactamente dos booleanos', async () => {
  const malos = [{}, { a: true }, { p: true }, { a: 1, p: 0 }, { a: 'true', p: 'false' }, { a: null, p: null }, [], 'texto', 42, null]

  for (const cuerpo of malos) {
    const { respuesta, cookies } = await llamar(peticion(cuerpo))

    assert.equal(respuesta.status, 400, JSON.stringify(cuerpo))
    assert.equal(cookies.puestas.length, 0, JSON.stringify(cuerpo))
  }
})

test('rechaza un cuerpo que no es JSON', async () => {
  const { respuesta, cookies } = await llamar(peticion('{no es json', { crudo: true }))

  assert.equal(respuesta.status, 400)
  assert.equal(cookies.puestas.length, 0)
})

test('campos de más se ignoran: solo importan a y p', async () => {
  const { respuesta, cookies } = await llamar(peticion({ a: true, p: true, t: 1, v: 99, extra: '<script>' }))

  assert.equal(respuesta.status, 204)
  const decision = leerDecision(cookies.puestas[0].valor)
  assert.equal(decision.v, VERSION_CONSENTIMIENTO, 'la versión y la fecha las pone el servidor, no el cliente')
  assert.ok(Math.abs(decision.t - Math.floor(Date.now() / 1000)) < 5)
})
