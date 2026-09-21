import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Cuentas que pueden entrar al panel de administracion.
 *
 * Mismo patron que shape_up: scrypt guardado como "saltHex:hashHex", sin
 * libreria de auth. La seguridad viene de la aleatoriedad del token de sesion
 * y de que el servidor nunca guarda el token crudo, no de una clave compartida.
 */
export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuario: text('usuario').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  creadoEn: text('creado_en')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Sesiones abiertas.
 *
 * El id es el SHA-256 del token; el token crudo vive SOLO en la cookie. Asi,
 * alguien que se lleve la base no puede suplantar a nadie con lo que hay ahi.
 */
export const sesiones = sqliteTable('sesiones', {
  id: text('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  expiraEn: integer('expira_en').notNull(), // unix ms
})

/**
 * Los flags que antes vivian en Firestore.
 *
 * Es una tabla clave/valor y no una fila con columnas a proposito: asi el
 * formulario del panel se arma SOLO a partir de estas filas (tipo, etiqueta,
 * grupo, orden), y agregar un flag nuevo es insertar una fila en vez de tocar
 * el schema, la UI y el codigo que lo lee.
 *
 * `valor` va como TEXT con JSON adentro para que un booleano, un numero y un
 * string se guarden igual sin inventar tres columnas.
 */
export const flags = sqliteTable('flags', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
  tipo: text('tipo').notNull(), // 'boolean' | 'number' | 'texto'
  etiqueta: text('etiqueta').notNull(),
  descripcion: text('descripcion'),
  grupo: text('grupo').notNull(),
  orden: integer('orden').notNull().default(0),
  actualizadoEn: text('actualizado_en')
    .notNull()
    .default(sql`(datetime('now'))`),
})
