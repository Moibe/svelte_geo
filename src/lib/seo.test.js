import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDIOMAS } from './idiomas.js'
import { alternativas, canonica, jsonSeguroParaHtml, normalizarPorcentajes, normalizarRuta, redireccionDeNormalizacion } from './seo.js'

const ORIGEN = 'https://geoservices.space'

test('normalizarRuta quita la barra final salvo en la raíz', () => {
  assert.equal(normalizarRuta('/es/'), '/es')
  assert.equal(normalizarRuta('/es/privacy///'), '/es/privacy')
  assert.equal(normalizarRuta('/'), '/')
  assert.equal(normalizarRuta(''), '/')
})

test('cada página es el canonical de sí misma (no hay un idioma "principal")', () => {
  // Apuntar todos los canonical a un solo idioma le diría a Google que las
  // traducciones son duplicados de esa y las sacaría del índice.
  for (const l of IDIOMAS) {
    assert.equal(canonica(ORIGEN, `/${l}`), `${ORIGEN}/${l}`)
    assert.equal(canonica(ORIGEN, `/${l}/privacy`), `${ORIGEN}/${l}/privacy`)
  }
  assert.equal(canonica(ORIGEN, '/'), `${ORIGEN}/`)
})

test('hreflang: los seis idiomas más x-default, y x-default es la ruta sin prefijo', () => {
  const alt = alternativas(ORIGEN, '/es/privacy')

  assert.deepEqual(
    alt.map((a) => a.hreflang),
    [...IDIOMAS, 'x-default']
  )
  assert.equal(alt.find((a) => a.hreflang === 'pt').href, `${ORIGEN}/pt/privacy`)
  assert.equal(alt.find((a) => a.hreflang === 'x-default').href, `${ORIGEN}/privacy`)
})

test('hreflang es RECÍPROCO: todas las versiones de una página listan lo mismo', () => {
  // Si /es listara a /en pero /en no listara a /es, Google ignora el par.
  for (const base of ['/', '/privacy']) {
    const listas = [base, ...IDIOMAS.map((l) => (base === '/' ? `/${l}` : `/${l}${base}`))].map((ruta) =>
      JSON.stringify(alternativas(ORIGEN, ruta))
    )

    assert.equal(new Set(listas).size, 1, `las versiones de ${base} no coinciden entre sí`)
  }
})

test('la raíz lista cada idioma como /<idioma> y no como /<idioma>/', () => {
  const alt = alternativas(ORIGEN, '/')

  assert.equal(alt.find((a) => a.hreflang === 'es').href, `${ORIGEN}/es`)
  assert.equal(alt.find((a) => a.hreflang === 'x-default').href, `${ORIGEN}/`)
})

test('los datos estructurados no pueden cerrar la etiqueta de script', () => {
  const objeto = { texto: '</script><script>alert(1)</script>', otro: 'a < b' }
  const json = jsonSeguroParaHtml(objeto)

  assert.ok(!json.includes('<'), 'queda un "<" sin escapar')
  // Y sigue siendo el mismo dato para quien lo lea.
  assert.deepEqual(JSON.parse(json), objeto)
})

test('normalizarPorcentajes reduce %XX de caracteres no reservados a una sola forma de la URL', () => {
  // SvelteKit enruta /%65s como /es, pero el idioma, el canonical y los hreflang
  // leían el path crudo: una página, dos URLs, y las alternativas daban 404.
  assert.equal(normalizarPorcentajes('/%65s'), '/es')
  assert.equal(normalizarPorcentajes('/%61pi/flags'), '/api/flags')
  assert.equal(normalizarPorcentajes('/es/%70rivacy'), '/es/privacy')
  assert.equal(normalizarPorcentajes('/%2D%2e%5F%7E'), '/-._~')
})

test('redireccionDeNormalizacion nunca devuelve un destino que el navegador lea como OTRO sitio', () => {
  // Normal: se redirige a la forma normal.
  assert.equal(redireccionDeNormalizacion('/%65s'), '/es')
  assert.equal(redireccionDeNormalizacion('/es/%70rivacy'), '/es/privacy')
  // Ya normal: no hay nada que redirigir.
  assert.equal(redireccionDeNormalizacion('/es'), null)
  assert.equal(redireccionDeNormalizacion('/'), null)
  // «//evil.com/%65s» redirigiría a //evil.com/es = https://evil.com/es (redirección abierta).
  assert.equal(redireccionDeNormalizacion('//evil.com/%65s'), null)
  assert.equal(redireccionDeNormalizacion('///evil.com/%65s'), null)
  assert.equal(redireccionDeNormalizacion('/\\evil.com/%65s'), null)
})

test('normalizarPorcentajes no toca lo que no es un carácter no reservado', () => {
  // %2F es "/" y %25 es "%": decodificarlos cambiaría el significado del path.
  assert.equal(normalizarPorcentajes('/a%2Fb'), '/a%2Fb')
  assert.equal(normalizarPorcentajes('/100%25'), '/100%25')
  assert.equal(normalizarPorcentajes('/mapa%20grande'), '/mapa%20grande')
  // Solo pasa a mayúsculas el hex de lo que se queda codificado.
  assert.equal(normalizarPorcentajes('/%c3%a1'), '/%C3%A1')
  assert.equal(normalizarPorcentajes('/es/privacy'), '/es/privacy')
  assert.equal(normalizarPorcentajes('/'), '/')
})
