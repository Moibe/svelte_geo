import Database from 'better-sqlite3'
import { randomBytes, scryptSync } from 'node:crypto'

/**
 * Siembra la base: los flags y, si no hay ninguna, una cuenta de admin.
 *
 * Es IDEMPOTENTE. Los flags se insertan con INSERT OR IGNORE, así que correr
 * esto de nuevo NO pisa un valor que hayas cambiado desde el panel: solo
 * agrega los que falten. Es lo que permite dejarlo en el deploy sin miedo.
 *
 * Los valores por defecto de cada flag son los que estaban VIVOS en Firestore
 * al momento de migrar (leídos el 2026-09-20), no los defaults del código —
 * que en varios casos decían otra cosa: wait-safe estaba en 9 y no en 30,
 * price-level en 100 y no en 200, y prod en true y no en false.
 */

const url = process.env.DATABASE_URL ?? './local.db'
const sqlite = new Database(url)
sqlite.pragma('foreign_keys = ON')

// ── Flags ────────────────────────────────────────────────────────────────────
// clave, valor, tipo, etiqueta, descripción, grupo, orden
const FLAGS = [
  ['safe-mode', true, 'boolean', 'Safe Mode',
   'Busca por navegador/IP en vez de pedir un número telefónico.', 'Modo', 10],

  ['sell', true, 'boolean', 'Vender',
   'Si se apaga, el modal de compra no aparece nunca y la app queda gratuita.', 'Venta', 20],
  ['stripe-prod', true, 'boolean', 'Stripe en producción',
   'Encendido cobra de verdad. Apagado usa el sandbox de Stripe.', 'Venta', 21],
  ['price-level', 100, 'number', 'Nivel de precio',
   'Qué catálogo se usa: 100 (producto barato) o 200 (producto original).', 'Venta', 22],
  ['price-testing', true, 'boolean', 'Precio de prueba activo',
   'Reemplaza el precio del país por el price_id de abajo. Para probar cobros.', 'Venta', 23],
  ['price-test', 'price_1T4rQRIYi36CbmfWMkzqBQ2e', 'texto', 'price_id de prueba',
   'Solo se usa si "Precio de prueba activo" está encendido.', 'Venta', 24],
  ['pmc', 'pmc_1KaoJKIYi36CbmfWCbDAL0wy', 'texto', 'PMC de producción',
   'Configuración de métodos de pago de Stripe, modo producción.', 'Venta', 25],
  ['pmc-test', 'pmc_1RXpciROVpWRmEfBIWAuWceY', 'texto', 'PMC de sandbox',
   'Configuración de métodos de pago de Stripe, modo prueba.', 'Venta', 26],

  ['wait-safe', 9, 'number', 'Espera en Safe Mode (s)',
   'Segundos antes de mostrar el modal de compra, en Safe Mode.', 'Tiempos', 30],
  ['wait-prod', 9, 'number', 'Espera en modo normal (s)',
   'Segundos antes de mostrar el modal de compra, en modo normal.', 'Tiempos', 31],
  ['map-wait-time', 9, 'number', 'Permanencia en mapa (s)',
   'Segundos en el mapa antes de disparar la conversión map_wait.', 'Tiempos', 32],

  ['map-interaction', false, 'boolean', 'Conversión al interactuar con el mapa',
   'Dispara una conversión de compra cuando el usuario toca el mapa.', 'Conversiones', 40],
  ['map-wait', false, 'boolean', 'Conversión por permanencia en mapa',
   'Dispara una conversión cuando el usuario se queda el tiempo de arriba.', 'Conversiones', 41],
  ['sell-pop', false, 'boolean', 'Conversión al abrir el modal',
   'Dispara una conversión cuando aparece el modal de venta.', 'Conversiones', 42],
  ['phone-search', false, 'boolean', 'Conversión al buscar teléfono',
   'Dispara una conversión cuando el usuario busca un número.', 'Conversiones', 43],

  ['verbose', true, 'boolean', 'Logs en consola',
   'Muestra los logs técnicos en la consola del navegador. Los errores se ven siempre.', 'Depuración', 50],
]

const insertarFlag = sqlite.prepare(`
  INSERT OR IGNORE INTO flags (clave, valor, tipo, etiqueta, descripcion, grupo, orden, actualizado_en)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
`)

let nuevos = 0
for (const [clave, valor, tipo, etiqueta, descripcion, grupo, orden] of FLAGS) {
  const r = insertarFlag.run(clave, JSON.stringify(valor), tipo, etiqueta, descripcion, grupo, orden)
  nuevos += r.changes
}
console.log(`[OK] flags: ${nuevos} nuevos, ${FLAGS.length - nuevos} ya existían (no se tocaron)`)

// ── Cuenta de admin ──────────────────────────────────────────────────────────
// Solo si no hay ninguna. Nunca pisa una cuenta existente ni su contraseña.
const { total } = sqlite.prepare('SELECT COUNT(*) AS total FROM usuarios').get()

if (total === 0) {
  const usuario = process.env.ADMIN_USER ?? 'admin'
  // Si no se pasa contraseña se genera una al azar y se imprime UNA vez: es
  // mejor que un 'admin/admin' que nadie cambia y queda expuesto en internet.
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString('base64url')

  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  sqlite
    .prepare('INSERT INTO usuarios (usuario, password_hash) VALUES (?, ?)')
    .run(usuario, `${salt.toString('hex')}:${hash.toString('hex')}`)

  console.log('')
  console.log('[OK] cuenta de administración creada')
  console.log(`     usuario:    ${usuario}`)
  console.log(`     contraseña: ${password}`)
  console.log('     (esto se imprime UNA sola vez, guardalo)')
} else {
  console.log(`[OK] ya hay ${total} cuenta(s), no se creó ninguna`)
}

sqlite.close()
