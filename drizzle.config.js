/** @type {import('drizzle-kit').Config} */
export default {
  dialect: 'sqlite',
  schema: './src/lib/server/db/schema.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './local.db',
  },
}
