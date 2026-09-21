import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { env } from '$env/dynamic/private'
import * as schema from './schema.js'

/**
 * Base local de la app: usuarios, sesiones y flags.
 *
 * Es un archivo aparte del de tracking (/root/data/geospace/geospace.db, que
 * escribe la API de Python): son dos cosas distintas con dueños distintos y
 * juntarlas solo crearia contencion de escritura entre dos procesos.
 */
const sqlite = new Database(env.DATABASE_URL ?? './local.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
