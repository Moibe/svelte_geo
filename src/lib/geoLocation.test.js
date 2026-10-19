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
    assert.match(r.countryCode, /^\+\d{1,4}$/, iso)
  }
})

test('todo código del catálogo de precios es alcanzable desde un país de la tabla (salvo los ya conocidos)', async () => {
  const { readFileSync } = await import('node:fs')
  const catalogos = ['static/product-details.json', 'static/product-details-100.json'].map((f) => JSON.parse(readFileSync(f, 'utf8')))
  const alcanzables = new Set(Object.values(countryCodeMap))
  // Las entradas de dos letras ('KZ', 'CA') son por ISO (paises que comparten codigo telefonico): el pais tiene que existir.
  const sinPais = new Set(catalogos.flatMap((c) => Object.keys(c)).filter((k) => (/^[A-Z]{2}$/.test(k) ? !Object.prototype.hasOwnProperty.call(countryCodeMap, k) : !alcanzables.has(k))))

  // Códigos con precio propio en el catálogo pero SIN un país en countryCodeMap que lleve a ellos: esos
  // visitantes caen al precio de México. Se agregan países a la tabla para vaciar esta lista; si aparece
  // un código nuevo aquí, es un precio que nadie puede obtener.
  const CONOCIDOS = []

  assert.deepEqual([...sinPais].sort(), [...CONOCIDOS].sort())
})

test('los dos niveles del catálogo de precios tienen los mismos países y la misma moneda en cada uno', async () => {
  const { readFileSync } = await import('node:fs')
  const [n200, n100] = ['static/product-details.json', 'static/product-details-100.json'].map((f) => JSON.parse(readFileSync(f, 'utf8')))

  assert.deepEqual(Object.keys(n100).sort(), Object.keys(n200).sort())

  for (const codigo of Object.keys(n100)) {
    assert.equal(n100[codigo].price.currency, n200[codigo].price.currency, `moneda de ${codigo}`)
    // El nivel 200 es el doble del 100 (con holgura por el redondeo a cifras «bonitas» de cada moneda).
    const razon = n200[codigo].price.unit_amount / n100[codigo].price.unit_amount
    assert.ok(razon > 1.7 && razon < 2.5, `${codigo} ${n100[codigo].price.currency}: razón 200/100 = ${razon.toFixed(2)}`)
    // Lo que el catálogo dice cobrar es un precio de Stripe real (los ids empiezan por price_).
    assert.match(n100[codigo].priceId, /^price_/)
    assert.match(n200[codigo].priceId, /^price_/)
  }
})
