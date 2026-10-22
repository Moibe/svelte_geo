#!/usr/bin/env node

/**
 * Pone al día el catálogo de precios de la app con lo que hay hoy en Stripe.
 *
 *   npm run fetch-product-details              SIMULACRO: muestra qué cambiaría, no escribe nada
 *   npm run fetch-product-details -- --aplicar escribe los dos JSON (si no hay problemas)
 *
 * Archivos que mantiene (los lee la app y se publican en /product-details*.json):
 *   static/product-details-100.json   nivel 100
 *   static/product-details.json       nivel 200
 *
 * Para cada entrada del catálogo (código telefónico, o ISO como KZ/CA) busca su precio en
 * Stripe y refresca importe, moneda, texto y apodo. Si el precio fue archivado (en Stripe los
 * precios son inmutables: cambiar uno es crear otro), lo reemplaza por el único precio activo
 * de esa moneda. NUNCA agrega ni quita países: eso se decide a mano en el JSON. Detalle y
 * motivos en scripts/catalogo-stripe.js.
 *
 * Solo LEE de Stripe (únicamente peticiones GET) y no imprime la clave.
 *
 * Variables de entorno (.env):
 *   STRIPE_API_KEY_GEOSPACE   llave de la cuenta Stripe de Geospace; basta con lectura de
 *                             Productos y Precios. Es solo para esta herramienta local.
 *   STRIPE_PRODUCT_ID_100 / STRIPE_PRODUCT_ID_200   opcionales: por defecto el producto sale
 *                             del propio catálogo (product.id de sus entradas).
 *   VITE_STRIPE_TEST_PRICE_ID opcional: el precio de prueba, para no usarlo nunca de reemplazo.
 *
 * Después de aplicar: revisar con git diff, probar, commit y push (el deploy publica el catálogo).
 */

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { estiloDe, planificar, serializar } from './catalogo-stripe.js'

dotenv.config()

const APLICAR = process.argv.includes('--aplicar')
const CLAVE = (process.env.STRIPE_API_KEY_GEOSPACE || '').trim()
const IDS_DE_PRUEBA = new Set([(process.env.VITE_STRIPE_TEST_PRICE_ID || '').trim()].filter(Boolean))

const NIVELES = [
  { nivel: 100, archivo: 'static/product-details-100.json', variable: 'STRIPE_PRODUCT_ID_100' },
  { nivel: 200, archivo: 'static/product-details.json', variable: 'STRIPE_PRODUCT_ID_200' },
]

/** GET a la API de Stripe. Es lo único que este script le manda: no hay forma de escribir. */
async function get(ruta) {
  const respuesta = await fetch(`https://api.stripe.com${ruta}`, {
    headers: { Authorization: `Bearer ${CLAVE}` },
    signal: AbortSignal.timeout(20000),
  })
  const cuerpo = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    throw new Error(`Stripe respondió ${respuesta.status}${cuerpo.error?.message ? `: ${cuerpo.error.message}` : ''}`)
  }
  return cuerpo
}

/** Todas las páginas de una lista de Stripe. */
async function todos(ruta) {
  const filas = []
  let despues = ''
  for (;;) {
    const pagina = await get(`${ruta}${ruta.includes('?') ? '&' : '?'}limit=100${despues}`)
    filas.push(...pagina.data)
    if (!pagina.has_more) break
    despues = `&starting_after=${pagina.data.at(-1).id}`
  }
  return filas
}

/** El producto que le toca a un catálogo: el de la variable de entorno o el que ya usa el catálogo. */
function productoDe(catalogo, variable) {
  const forzado = (process.env[variable] || '').trim()
  if (forzado) return forzado

  const ids = new Set(Object.values(catalogo).map((entrada) => entrada?.product?.id).filter(Boolean))
  if (ids.size === 0) throw new Error(`el catálogo no trae ningún product.id (define ${variable})`)
  if (ids.size > 1) throw new Error(`el catálogo mezcla ${ids.size} productos (${[...ids].join(', ')}); define ${variable}`)
  return [...ids][0]
}

const mostrar = (valor) => (valor === null || valor === undefined ? '(vacío)' : String(valor))

function importeLegible(precio) {
  return `${precio.currency.toUpperCase()} ${precio.unit_amount}`
}

function imprimir({ nivel, producto, entradas, activos, resultado }) {
  const { cambios, errores, sinUsar } = resultado
  const sinCambios = entradas - cambios.length - errores.length

  console.log(`\n== Nivel ${nivel} · «${producto.name}» (${producto.id})`)
  console.log(`   ${entradas} entradas en el catálogo · ${activos} precios activos en Stripe`)
  console.log(`   sin cambios: ${sinCambios} · con cambios: ${cambios.length} · con problemas: ${errores.length}`)

  // Las entradas que cambian igual (p. ej. los 21 códigos del euro) se agrupan en una línea.
  const grupos = new Map()
  for (const cambio of cambios) {
    const clave = JSON.stringify(cambio.campos)
    if (!grupos.has(clave)) grupos.set(clave, { codigos: [], moneda: cambio.moneda, campos: cambio.campos })
    grupos.get(clave).codigos.push(cambio.codigo)
  }
  for (const { codigos, moneda, campos } of grupos.values()) {
    const que = campos.map((c) => `${c.campo}: ${mostrar(c.de)} -> ${mostrar(c.a)}`).join(' | ')
    console.log(`   CAMBIA ${codigos.join(' ')} (${moneda.toUpperCase()})  ${que}`)
  }

  for (const error of errores) {
    console.log(`   PROBLEMA ${error.codigo}: ${error.problema} · ${error.detalle}`)
  }

  if (sinUsar.length > 0) {
    console.log(`   Precios activos que ningún país usa (no es un error): ${sinUsar.map(importeLegible).join(', ')}`)
    console.log('   Para cubrir una moneda nueva, agrega a mano una entrada al JSON y vuelve a correr.')
  }
}

async function main() {
  if (!CLAVE) {
    throw new Error('falta STRIPE_API_KEY_GEOSPACE en el .env (la llave de la cuenta Stripe de Geospace)')
  }

  console.log(APLICAR ? 'MODO: aplicar cambios' : 'MODO: simulacro (no se escribe nada)')

  const preparados = []

  for (const { nivel, archivo, variable } of NIVELES) {
    const ruta = path.join(process.cwd(), archivo)
    const texto = fs.readFileSync(ruta, 'utf8')
    const catalogo = JSON.parse(texto)

    const productoId = productoDe(catalogo, variable)
    let producto
    try {
      producto = await get(`/v1/products/${productoId}`)
    } catch (error) {
      throw new Error(`no se pudo leer el producto ${productoId} del nivel ${nivel}: ${error.message}. ¿La llave es de la cuenta de Geospace?`)
    }
    const precios = await todos(`/v1/prices?product=${productoId}&active=true`)

    const resultado = planificar({ catalogo, producto, precios, idsDePrueba: IDS_DE_PRUEBA })
    imprimir({ nivel, producto, entradas: Object.keys(catalogo).length, activos: precios.length, resultado })

    preparados.push({ nivel, archivo, ruta, texto, catalogo, resultado })
  }

  // Los dos niveles tienen que cubrir los mismos países.
  const [a, b] = preparados.map((p) => new Set(Object.keys(p.catalogo)))
  const soloEn100 = [...a].filter((k) => !b.has(k))
  const soloEn200 = [...b].filter((k) => !a.has(k))
  if (soloEn100.length || soloEn200.length) {
    console.log(`\nAviso: los niveles no cubren los mismos países. Solo en 100: ${soloEn100.join(' ') || '-'} · solo en 200: ${soloEn200.join(' ') || '-'}`)
  }

  const problemas = preparados.reduce((suma, p) => suma + p.resultado.errores.length, 0)
  const cambios = preparados.reduce((suma, p) => suma + p.resultado.cambios.length, 0)

  if (problemas > 0) {
    console.log(`\nHay ${problemas} problema(s): no se escribe nada, ni siquiera lo que sí se podía actualizar. Arréglalos en Stripe y vuelve a correr.`)
    process.exitCode = 1
    return
  }

  if (cambios === 0) {
    console.log('\nTodo al día: el catálogo coincide con Stripe.')
    return
  }

  if (!APLICAR) {
    console.log(`\nSIMULACRO: ${cambios} entrada(s) cambiarían y no se escribió nada.`)
    console.log('Para aplicar: npm run fetch-product-details -- --aplicar')
    return
  }

  for (const { archivo, ruta, texto, resultado } of preparados) {
    if (resultado.cambios.length === 0) continue
    fs.writeFileSync(ruta, serializar(resultado.catalogo, estiloDe(texto)))
    console.log(`Escrito: ${archivo} (${resultado.cambios.length} entradas)`)
  }
  console.log('\nListo. Revisa con git diff, prueba y haz commit y push: el deploy publica el catálogo.')
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`)
  process.exitCode = 1
})
