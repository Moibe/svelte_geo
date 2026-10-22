import test from 'node:test'
import assert from 'node:assert/strict'
import { cifraDeImporte, esPrecioDePrueba, estiloDe, etiquetaDeImporte, planificar, serializar } from './catalogo-stripe.js'

const PRODUCTO = { id: 'prod_NUEVO', name: 'Map Location', description: null }

function entrada(priceId, moneda, importe, formatted, apodo = 'X') {
  return {
    priceId,
    product: { id: 'prod_NUEVO', name: 'Map Location', description: 'Acceso a Mapa Completo' },
    price: { id: priceId, unit_amount: importe, currency: moneda, formatted, nickname: apodo },
  }
}

function precio(id, currency, unit_amount, nickname = 'X') {
  return { id, currency, unit_amount, nickname }
}

/** Un catálogo chico y coherente con Stripe: dos códigos que comparten el euro, uno en pesos, uno en yenes. */
function catalogoBase() {
  return {
    '+52': entrada('price_mxn', 'mxn', 10000, '$100'),
    '+33': entrada('price_eur', 'eur', 500, '€5'),
    '+49': entrada('price_eur', 'eur', 500, '€5'),
    '+81': entrada('price_jpy', 'jpy', 899, '¥899'),
  }
}

function preciosBase() {
  return [precio('price_mxn', 'mxn', 10000), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
}

test('un catálogo al día no cambia nada', () => {
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios: preciosBase() })
  assert.deepEqual(r.cambios, [])
  assert.deepEqual(r.errores, [])
  assert.deepEqual(r.catalogo, catalogoBase())
  assert.deepEqual(r.sinUsar, [])
})

test('no modifica el catálogo que recibe', () => {
  const original = catalogoBase()
  const precios = [precio('price_mxn2', 'mxn', 12000), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  planificar({ catalogo: original, producto: PRODUCTO, precios })
  assert.deepEqual(original, catalogoBase())
})

test('un precio archivado se reemplaza por el único activo de su moneda', () => {
  const precios = [precio('price_mxn2', 'mxn', 12000, 'México'), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })

  assert.deepEqual(r.errores, [])
  assert.equal(r.cambios.length, 1)
  assert.equal(r.cambios[0].codigo, '+52')
  assert.equal(r.catalogo['+52'].priceId, 'price_mxn2')
  assert.equal(r.catalogo['+52'].price.id, 'price_mxn2')
  assert.equal(r.catalogo['+52'].price.unit_amount, 12000)
  assert.equal(r.catalogo['+52'].price.formatted, '$120')
  assert.equal(r.catalogo['+52'].price.nickname, 'México')
})

test('todas las entradas que compartían el precio se reemplazan juntas', () => {
  const precios = [precio('price_mxn', 'mxn', 10000), precio('price_eur2', 'eur', 700), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })

  assert.deepEqual(r.cambios.map((c) => c.codigo).sort(), ['+33', '+49'])
  assert.equal(r.catalogo['+33'].priceId, 'price_eur2')
  assert.equal(r.catalogo['+49'].priceId, 'price_eur2')
  assert.equal(r.catalogo['+33'].price.formatted, '€7')
})

test('conserva el orden de las claves de cada entrada', () => {
  const catalogo = catalogoBase()
  catalogo['+52'] = { price: catalogo['+52'].price, priceId: 'price_mxn', product: catalogo['+52'].product }
  const precios = [precio('price_mxn2', 'mxn', 12000), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo, producto: PRODUCTO, precios })

  assert.deepEqual(Object.keys(r.catalogo['+52']), ['price', 'priceId', 'product'])
  assert.deepEqual(Object.keys(r.catalogo), Object.keys(catalogo))
})

test('sin precio activo en esa moneda es un error y la entrada queda como estaba', () => {
  const precios = [precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })

  assert.equal(r.errores.length, 1)
  assert.equal(r.errores[0].codigo, '+52')
  assert.equal(r.errores[0].problema, 'sin-precio-activo')
  assert.deepEqual(r.catalogo['+52'], catalogoBase()['+52'])
})

test('dos candidatos en la moneda es ambiguo: no se adivina', () => {
  const precios = [precio('price_mxn_a', 'mxn', 10000), precio('price_mxn_b', 'mxn', 12000), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const catalogo = catalogoBase()
  catalogo['+52'].priceId = 'price_mxn_viejo'
  catalogo['+52'].price.id = 'price_mxn_viejo'
  const r = planificar({ catalogo, producto: PRODUCTO, precios })

  assert.equal(r.errores.length, 1)
  assert.equal(r.errores[0].problema, 'ambiguo')
  assert.match(r.errores[0].detalle, /price_mxn_a/)
  assert.match(r.errores[0].detalle, /price_mxn_b/)
})

test('el precio de prueba no cuenta como candidato, ni por apodo ni por id', () => {
  const catalogo = catalogoBase()
  catalogo['+52'].priceId = 'price_mxn_viejo'
  catalogo['+52'].price.id = 'price_mxn_viejo'

  const porApodo = [precio('price_mxn2', 'mxn', 12000), precio('price_prueba', 'mxn', 1000, 'Test Mini Price'), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  assert.equal(planificar({ catalogo, producto: PRODUCTO, precios: porApodo }).catalogo['+52'].priceId, 'price_mxn2')

  const porId = [precio('price_mxn2', 'mxn', 12000), precio('price_x', 'mxn', 1000, null), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo, producto: PRODUCTO, precios: porId, idsDePrueba: new Set(['price_x']) })
  assert.equal(r.catalogo['+52'].priceId, 'price_mxn2')
  assert.deepEqual(r.errores, [])
})

test('un catálogo que apunta al precio de prueba es un error', () => {
  const catalogo = catalogoBase()
  catalogo['+52'].priceId = 'price_prueba'
  catalogo['+52'].price.id = 'price_prueba'
  const precios = [...preciosBase(), precio('price_prueba', 'mxn', 1000, 'Test Mini Price')]
  const r = planificar({ catalogo, producto: PRODUCTO, precios })

  assert.equal(r.errores.length, 1)
  assert.equal(r.errores[0].problema, 'precio-de-prueba')
})

test('monedas sin subunidad: ¥899 son 899 yenes, no 8.99', () => {
  assert.equal(cifraDeImporte(899, 'jpy'), '899')
  assert.equal(cifraDeImporte(1780, 'JPY'), '1780')
  assert.equal(cifraDeImporte(899, 'usd'), '8.99')
  assert.equal(cifraDeImporte(10000, 'mxn'), '100')
  assert.equal(cifraDeImporte(141900, 'isk'), '1419')
})

test('un reemplazo en yenes escribe el texto con la cifra correcta', () => {
  const precios = [precio('price_mxn', 'mxn', 10000), precio('price_eur', 'eur', 500), precio('price_jpy2', 'jpy', 1780)]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })
  assert.equal(r.catalogo['+81'].price.formatted, '¥1780')
})

test('el texto que ya tiene la cifra correcta se conserva; el que no, se regenera', () => {
  assert.equal(etiquetaDeImporte('TWD365', 36500, 'twd'), 'TWD365')
  assert.equal(etiquetaDeImporte('kr1419', 141900, 'isk'), 'kr1419')
  assert.equal(etiquetaDeImporte('¥17.8', 1780, 'jpy'), '¥1780')
  assert.equal(etiquetaDeImporte(undefined, 10000, 'mxn'), '$100')
})

test('al corregir una cifra se respeta el símbolo que ya tenía el texto', () => {
  assert.equal(etiquetaDeImporte('L11', 110000, 'all'), 'L1100')
  assert.equal(etiquetaDeImporte('$50', 5000, 'clp'), '$5000')
  assert.equal(etiquetaDeImporte('L£51500000', 51500000, 'lbp'), 'L£515000')
  assert.equal(etiquetaDeImporte('SOS664000', 664000, 'sos'), 'SOS6640')
})

test('un símbolo con punto no se confunde con decimales', () => {
  assert.equal(etiquetaDeImporte('Bs.40', 4000, 'bob'), 'Bs.40')
  assert.equal(etiquetaDeImporte('$1,234', 123400, 'usd'), '$1,234')
})

test('una moneda de tres decimales es un error en vez de un importe adivinado', () => {
  assert.throws(() => cifraDeImporte(6000, 'kwd'), /tres decimales/)

  const catalogo = { '+965': entrada('price_kwd', 'kwd', 6000, 'KWD6') }
  const r = planificar({ catalogo, producto: PRODUCTO, precios: [precio('price_kwd', 'kwd', 6000)] })
  assert.equal(r.errores[0].problema, 'importe')
})

test('un precio sin importe (personalizado) es un error', () => {
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios: [precio('price_mxn', 'mxn', null), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)] })
  assert.equal(r.errores[0].codigo, '+52')
  assert.equal(r.errores[0].problema, 'importe')
})

test('la moneda de la entrada y la del precio tienen que coincidir', () => {
  const catalogo = catalogoBase()
  catalogo['+52'].price.currency = 'usd'
  const r = planificar({ catalogo, producto: PRODUCTO, precios: preciosBase() })
  assert.equal(r.errores[0].problema, 'moneda-distinta')
})

test('Stripe sin apodo deja el apodo en null; el producto se refresca', () => {
  const precios = [precio('price_mxn', 'mxn', 10000, null), precio('price_eur', 'eur', 500), precio('price_jpy', 'jpy', 899)]
  const r = planificar({ catalogo: catalogoBase(), producto: { id: 'prod_NUEVO', name: 'Otro nombre', description: 'Otra descripción' }, precios })

  assert.equal(r.catalogo['+52'].price.nickname, null)
  assert.equal(r.catalogo['+52'].product.name, 'Otro nombre')
  assert.equal(r.catalogo['+52'].product.description, 'Otra descripción')
  assert.ok(r.cambios.find((c) => c.codigo === '+52').campos.some((c) => c.campo === 'apodo'))
})

test('un producto sin descripción conserva la que ya tenía la entrada', () => {
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios: preciosBase() })
  assert.equal(r.catalogo['+52'].product.description, 'Acceso a Mapa Completo')
  assert.deepEqual(r.cambios, [])
})

test('los precios activos que ningún país usa se listan aparte, sin los de prueba', () => {
  const precios = [...preciosBase(), precio('price_clp', 'clp', 9900), precio('price_prueba', 'mxn', 1000, 'Test Mini Price')]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })
  assert.deepEqual(r.sinUsar.map((p) => p.id), ['price_clp'])
})

test('nunca agrega ni quita entradas', () => {
  const precios = [...preciosBase(), precio('price_clp', 'clp', 9900)]
  const r = planificar({ catalogo: catalogoBase(), producto: PRODUCTO, precios })
  assert.deepEqual(Object.keys(r.catalogo), Object.keys(catalogoBase()))
})

test('esPrecioDePrueba reconoce el apodo y el id', () => {
  assert.equal(esPrecioDePrueba({ id: 'a', nickname: 'Test Mini Price' }, new Set()), true)
  assert.equal(esPrecioDePrueba({ id: 'a', nickname: 'México' }, new Set()), false)
  assert.equal(esPrecioDePrueba({ id: 'a', nickname: null }, new Set(['a'])), true)
})

test('serializar reproduce el archivo idéntico: CRLF y sin salto final', () => {
  const crlf = JSON.stringify(catalogoBase(), null, 2).replace(/\n/g, '\r\n')
  assert.deepEqual(estiloDe(crlf), { crlf: true, saltoFinal: false })
  assert.equal(serializar(JSON.parse(crlf), estiloDe(crlf)), crlf)

  const lf = JSON.stringify(catalogoBase(), null, 2) + '\n'
  assert.deepEqual(estiloDe(lf), { crlf: false, saltoFinal: true })
  assert.equal(serializar(JSON.parse(lf), estiloDe(lf)), lf)
})
