import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const url = process.env.DATABASE_URL ?? './local.db'
const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

migrate(drizzle(sqlite), { migrationsFolder: './drizzle' })
console.log(`[OK] migraciones aplicadas sobre ${url}`)
sqlite.close()
