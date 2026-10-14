import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatearImporte, isZeroDecimal, toMajorUnits } from './currency.js'

test('las monedas sin subunidad no se dividen entre 100', () => {
  assert.equal(isZeroDecimal('JPY'), true)
  assert.equal(isZeroDecimal('krw'), true)
  assert.equal(isZeroDecimal('USD'), false)

  assert.equal(toMajorUnits(178000, 'jpy'), 178000)
  assert.equal(toMajorUnits(20000, 'mxn'), 200)
})

test('un importe inutilizable da null, nunca NaN', () => {
  assert.equal(toMajorUnits(undefined, 'usd'), null)
  assert.equal(toMajorUnits(NaN, 'usd'), null)
  assert.equal(toMajorUnits('12', 'usd'), null)
})

test('formatearImporte muestra lo que Stripe cobra: importe y moneda del precio', () => {
  assert.equal(formatearImporte(20000, 'mxn'), '$200 MXN')
  assert.equal(formatearImporte(1000, 'eur'), '€10 EUR')
  assert.equal(formatearImporte(1250, 'usd'), '$12.50 USD')
  // Sin separador de miles: una coma se leería como decimal en español, portugués,
  // francés y alemán.
  assert.equal(formatearImporte(4260000, 'cop'), '$42600 COP')
})

test('en monedas sin subunidad muestra la cifra cobrada, no la dividida entre 100', () => {
  // El catálogo trae 178000 JPY y su campo `formatted` decía "1780": 100 veces menos.
  assert.equal(formatearImporte(178000, 'jpy'), '¥178000 JPY')
  assert.equal(formatearImporte(840000, 'krw'), '₩840000 KRW')
})

test('el código de la moneda va siempre, y una moneda desconocida no rompe', () => {
  // Intl separa el código de la cifra con un espacio duro (U+00A0), a propósito:
  // así no se parte entre dos renglones. Se compara con un espacio normal.
  const espacios = (texto) => texto.replaceAll(String.fromCharCode(160), ' ')

  assert.match(formatearImporte(1100, 'all'), /ALL/)
  assert.equal(espacios(formatearImporte(999, 'xyz')), 'XYZ 9.99')
})

test('sin importe o sin moneda no inventa nada', () => {
  assert.equal(formatearImporte(undefined, 'usd'), null)
  assert.equal(formatearImporte(1000, ''), null)
  assert.equal(formatearImporte(1000, undefined), null)
})
