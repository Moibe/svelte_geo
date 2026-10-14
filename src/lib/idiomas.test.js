import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  idiomaDeAcceptLanguage,
  quitarPrefijoIdioma,
  resolverIdiomaDeRequest,
  rutaEnIdioma,
} from './idiomas.js'

// Estas pruebas guardan la regla que hace funcionar el SEO multilingüe: el
// idioma de la URL manda sobre la cookie y sobre Accept-Language. Si una cookie
// pudiera pisar a /es, la misma URL mostraría idiomas distintos según quién la
// abra y los hreflang le prometerían a Google algo falso.

test('la URL manda sobre la cookie y sobre Accept-Language', () => {
  assert.equal(
    resolverIdiomaDeRequest({ pathname: '/es', cookie: 'en', acceptLanguage: 'fr' }),
    'es'
  )
  assert.equal(resolverIdiomaDeRequest({ pathname: '/ar/privacy', cookie: 'es' }), 'ar')
})

test('en la raíz decide la cookie, luego Accept-Language, luego inglés', () => {
  assert.equal(resolverIdiomaDeRequest({ pathname: '/', cookie: 'pt', acceptLanguage: 'de' }), 'pt')
  assert.equal(resolverIdiomaDeRequest({ pathname: '/', cookie: null, acceptLanguage: 'de-DE,de;q=0.9' }), 'de')
  assert.equal(resolverIdiomaDeRequest({ pathname: '/', cookie: null, acceptLanguage: null }), 'en')
  // Un rastreador sin cookie ni Accept-Language: inglés.
  assert.equal(resolverIdiomaDeRequest({ pathname: '/' }), 'en')
})

test('una cookie con un idioma que no existe se ignora', () => {
  assert.equal(resolverIdiomaDeRequest({ pathname: '/', cookie: 'xx', acceptLanguage: 'fr' }), 'fr')
})

test('Accept-Language respeta los factores q', () => {
  assert.equal(idiomaDeAcceptLanguage('fr;q=0.2, es;q=0.9'), 'es')
  assert.equal(idiomaDeAcceptLanguage('xx, ja;q=0.8, pt-BR;q=0.5'), 'pt')
  assert.equal(idiomaDeAcceptLanguage('ja, ko'), null)
})

test('quitarPrefijoIdioma compara el segmento completo', () => {
  assert.equal(quitarPrefijoIdioma('/es'), '/')
  assert.equal(quitarPrefijoIdioma('/es/privacy'), '/privacy')
  assert.equal(quitarPrefijoIdioma('/privacy'), '/privacy')
  assert.equal(quitarPrefijoIdioma('/'), '/')
  // "es" y "en" son prefijo de estas palabras, pero no son idiomas.
  assert.equal(quitarPrefijoIdioma('/estado'), '/estado')
  assert.equal(quitarPrefijoIdioma('/endpoint/x'), '/endpoint/x')
})

test('rutaEnIdioma conserva la página y escribe la raíz sin barra final', () => {
  assert.equal(rutaEnIdioma('/', 'en'), '/en')
  assert.equal(rutaEnIdioma('/es', 'pt'), '/pt')
  assert.equal(rutaEnIdioma('/es/privacy', 'de'), '/de/privacy')
  assert.equal(rutaEnIdioma('/privacy', 'ar'), '/ar/privacy')
})
