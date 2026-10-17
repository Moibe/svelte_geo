import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OPCIONES_DE_FLAG, opcionPermitida, siguienteOpcion } from './opcionesDeFlag.js'

const NIVEL = OPCIONES_DE_FLAG['price-level']

test('el nivel de precio es una elección entre 100 y 200, en ese orden', () => {
  assert.equal(NIVEL.length, 2)
  assert.deepEqual(
    NIVEL.map((o) => o.valor),
    [100, 200]
  )
  for (const opcion of NIVEL) assert.ok(opcion.etiqueta)
})

test('el interruptor alterna entre las dos opciones', () => {
  assert.equal(siguienteOpcion(NIVEL, 100), 200)
  assert.equal(siguienteOpcion(NIVEL, 200), 100)
})

test('apretarlo dos veces vuelve al valor de partida', () => {
  for (const inicio of [100, 200]) {
    assert.equal(siguienteOpcion(NIVEL, siguienteOpcion(NIVEL, inicio)), inicio)
  }
})

test('desde un valor que no es ninguna de las dos pasa a la segunda opción', () => {
  for (const raro of [150, 0, null, undefined, '100', '200', NaN]) {
    assert.equal(siguienteOpcion(NIVEL, raro), 200, String(raro))
  }
})

test('solo las dos opciones son válidas, y con su tipo (un "200" de texto no vale)', () => {
  assert.equal(opcionPermitida(NIVEL, 100), true)
  assert.equal(opcionPermitida(NIVEL, 200), true)

  for (const malo of [150, 0, -100, '100', '200', null, undefined, NaN, 100.5]) {
    assert.equal(opcionPermitida(NIVEL, malo), false, String(malo))
  }
})
