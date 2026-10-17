import assert from 'node:assert/strict'
import test from 'node:test'
import { countryCodeMap, ubicacionDeArranque } from './geoLocation.js'

test('ubicacionDeArranque toma el país que resolvió el servidor', () => {
  assert.deepEqual(ubicacionDeArranque('US'), { countryCode: '+1', isoCode: 'US', conocido: true })
  assert.deepEqual(ubicacionDeArranque('ES'), { countryCode: '+34', isoCode: 'ES', conocido: true })
  assert.deepEqual(ubicacionDeArranque('MX'), { countryCode: '+52', isoCode: 'MX', conocido: true })
  assert.deepEqual(ubicacionDeArranque('DE'), { countryCode: '+49', isoCode: 'DE', conocido: true })
})

test('ubicacionDeArranque tolera minúsculas y espacios', () => {
  assert.deepEqual(ubicacionDeArranque(' us '), { countryCode: '+1', isoCode: 'US', conocido: true })
})

test('países que comparten código telefónico (+1) dan el mismo precio de catálogo', () => {
  assert.equal(ubicacionDeArranque('CA').countryCode, '+1')
  assert.equal(ubicacionDeArranque('US').countryCode, '+1')
})

test('sin país conocido cae a México y lo dice (conocido: false)', () => {
  for (const iso of [null, undefined, '', '  ', 'ZZ', 'XX', 'USA', 42, {}, [], 'constructor', '__proto__', 'toString']) {
    assert.deepEqual(ubicacionDeArranque(iso), { countryCode: '+52', isoCode: 'MX', conocido: false }, `entrada: ${String(iso)}`)
  }
})

test('todo país de la tabla produce un código que el catálogo de precios entiende (+ y dígitos)', () => {
  for (const iso of Object.keys(countryCodeMap)) {
    const r = ubicacionDeArranque(iso)

    assert.equal(r.conocido, true, iso)
    assert.match(r.countryCode, /^\+\d{1,3}$/, iso)
  }
})

test('todo código del catálogo de precios es alcanzable desde un país de la tabla (salvo los ya conocidos)', async () => {
  const { readFileSync } = await import('node:fs')
  const catalogos = ['static/product-details.json', 'static/product-details-100.json'].map((f) => JSON.parse(readFileSync(f, 'utf8')))
  const alcanzables = new Set(Object.values(countryCodeMap))
  const sinPais = new Set(catalogos.flatMap((c) => Object.keys(c)).filter((codigo) => !alcanzables.has(codigo)))

  // Códigos con precio propio en el catálogo pero SIN un país en countryCodeMap que lleve a ellos: esos
  // visitantes caen al precio de México. Se agregan países a la tabla para vaciar esta lista; si aparece
  // un código nuevo aquí, es un precio que nadie puede obtener.
  const CONOCIDOS = ['+1242', '+1246', '+1441', '+1767', '+1868', '+1876', '+220', '+230', '+231', '+232', '+238', '+248', '+252', '+265', '+266', '+268', '+290', '+297', '+350', '+374', '+423', '+500', '+599', '+676', '+685', '+995']

  assert.deepEqual([...sinPais].sort(), [...CONOCIDOS].sort())
})
