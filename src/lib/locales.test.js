import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IDIOMAS } from './idiomas.js'

/**
 * Los seis diccionarios tienen que decir lo mismo en la misma forma: las mismas claves, sin
 * textos vacíos y sin el apóstrofo recto que el formato ICU de svelte-i18n se come. Una clave
 * que falta en un idioma no da error: la pantalla muestra la clave cruda ("consent.title").
 */

const leer = (idioma) => JSON.parse(readFileSync(new URL(`./locales/${idioma}.json`, import.meta.url), 'utf8'))

/** { "a.b[0].c": "texto" } — las hojas de un árbol de objetos y arreglos. */
function hojas(nodo, ruta = '', acc = {}) {
  if (Array.isArray(nodo)) nodo.forEach((v, i) => hojas(v, `${ruta}[${i}]`, acc))
  else if (nodo && typeof nodo === 'object') for (const [k, v] of Object.entries(nodo)) hojas(v, ruta ? `${ruta}.${k}` : k, acc)
  else acc[ruta] = nodo

  return acc
}

const ES = hojas(leer('es'))

test('hay seis idiomas y el español es la referencia', () => {
  assert.deepEqual([...IDIOMAS].sort(), ['ar', 'de', 'en', 'es', 'fr', 'pt'])
})

for (const idioma of IDIOMAS) {
  test(`${idioma}: mismas claves que el español, sin textos vacíos ni apóstrofos rectos`, () => {
    const texto = hojas(leer(idioma))

    const faltan = Object.keys(ES).filter((k) => !(k in texto))
    const sobran = Object.keys(texto).filter((k) => !(k in ES))
    assert.deepEqual(faltan, [], `faltan en ${idioma}`)
    assert.deepEqual(sobran, [], `sobran en ${idioma}`)

    for (const [clave, valor] of Object.entries(texto)) {
      assert.equal(typeof valor, 'string', clave)
      assert.ok(valor.trim().length > 0, `${clave} vacío`)
      assert.ok(!valor.includes("'"), `${clave}: apóstrofo recto (') — usar ’`)
    }
  })

  test(`${idioma}: los marcadores {…} son los mismos que en español`, () => {
    const texto = hojas(leer(idioma))

    for (const [clave, original] of Object.entries(ES)) {
      const esperado = (String(original).match(/\{[^}]*\}/g) || []).join(',')
      const real = (String(texto[clave] ?? '').match(/\{[^}]*\}/g) || []).join(',')
      assert.equal(real, esperado, clave)
    }
  })
}

test('el aviso de cookies: los dos botones principales existen y no son iguales entre sí en ningún idioma', () => {
  for (const idioma of IDIOMAS) {
    const { consent } = leer(idioma)

    assert.ok(consent.acceptAll && consent.rejectAll, idioma)
    assert.notEqual(consent.acceptAll, consent.rejectAll, idioma)
  }
})
