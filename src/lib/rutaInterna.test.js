import assert from 'node:assert/strict'
import test from 'node:test'
import { rutaInterna } from './rutaInterna.js'

test('rutaInterna deja pasar las rutas internas, con su query y su ancla', () => {
  assert.equal(rutaInterna('/admin'), '/admin')
  assert.equal(rutaInterna('/admin/usuarios?x=1#y'), '/admin/usuarios?x=1#y')
  assert.equal(rutaInterna('/'), '/')
})

test('rutaInterna rechaza todo lo que lleve a OTRO sitio', () => {
  for (const malo of [
    'https://evil.example/x',
    'http://evil.example',
    '//evil.example/x',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/admin/€',
    '/admin/\u2028x',
    '/admin/con espacio',
    'javascript:alert(1)',
    'evil.example',
    '',
    null,
    undefined,
  ]) {
    assert.equal(rutaInterna(malo), '/admin', `debía rechazar ${JSON.stringify(malo)}`)
  }
})

test('rutaInterna usa el respaldo que se le pida', () => {
  assert.equal(rutaInterna('//evil.example', '/'), '/')
})
