import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import { db } from './db/index.js'
import { sesiones, usuarios } from './db/schema.js'

/**
 * Autenticación del panel: scrypt para contraseñas, tokens de sesión de 32
 * bytes aleatorios, y de esos tokens la base guarda SOLO el SHA-256.
 *
 * Sin JWT, sin librería de auth y sin ninguna clave compartida en el entorno:
 * la seguridad viene de la aleatoriedad del token y de que el servidor nunca
 * almacena el token crudo. Quien se lleve la base no puede suplantar a nadie
 * con lo que hay ahí.
 *
 * Mismo patrón que shape_up, traducido a JavaScript.
 */

// SvelteKit pone `secure: true` en las cookies salvo que el host sea
// literalmente "localhost". En un despliegue alcanzado por IP sobre HTTP plano
// el navegador descartaría el Set-Cookie sin avisar y el login rebotaría sin
// error visible. Se deriva de ORIGIN, que es el esquema que el deploy declara.
const COOKIES_SEGURAS = (env.ORIGIN ?? '').startsWith('https://')

const DIA = 1000 * 60 * 60 * 24
const VIDA_SESION = 30 * DIA
const UMBRAL_RENOVACION = 15 * DIA // se extiende cuando queda menos que esto

export const COOKIE_SESION = 'session'

// ── Contraseñas (scrypt, guardado como "saltHex:hashHex") ───────────────────

export function hashearPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verificarPassword(password, guardado) {
  if (!guardado) return false

  const [saltHex, hashHex] = guardado.split(':')
  if (!saltHex || !hashHex) return false

  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
  const esperado = Buffer.from(hashHex, 'hex')

  // timingSafeEqual y no ===: comparar strings corta en el primer byte
  // distinto, y ese tiempo filtra información sobre el hash.
  return hash.length === esperado.length && timingSafeEqual(hash, esperado)
}

// ── Sesiones ────────────────────────────────────────────────────────────────

export function generarTokenDeSesion() {
  return randomBytes(32).toString('base64url')
}

/** La cookie lleva el token crudo; la base guarda solo su SHA-256. */
const idDeSesion = (token) => createHash('sha256').update(token).digest('hex')

export function crearSesion(token, usuarioId) {
  const id = idDeSesion(token)
  const expiraEn = Date.now() + VIDA_SESION

  db.insert(sesiones).values({ id, usuarioId, expiraEn }).run()

  return { id, usuarioId, expiraEn }
}

/**
 * Valida el token de la cookie y devuelve el usuario, o nulls.
 * De paso renueva la sesión si le queda poco, para que alguien que entra
 * seguido no tenga que volver a loguearse cada 30 días.
 */
export function validarTokenDeSesion(token) {
  const id = idDeSesion(token)
  const [fila] = db.select().from(sesiones).where(eq(sesiones.id, id)).all()

  if (!fila) return { sesion: null, usuario: null }

  if (Date.now() >= fila.expiraEn) {
    db.delete(sesiones).where(eq(sesiones.id, id)).run()
    return { sesion: null, usuario: null }
  }

  let expiraEn = fila.expiraEn
  if (Date.now() >= fila.expiraEn - UMBRAL_RENOVACION) {
    expiraEn = Date.now() + VIDA_SESION
    db.update(sesiones).set({ expiraEn }).where(eq(sesiones.id, id)).run()
  }

  const [u] = db
    .select({ id: usuarios.id, usuario: usuarios.usuario })
    .from(usuarios)
    .where(eq(usuarios.id, fila.usuarioId))
    .all()

  // La cuenta se borró pero la sesión seguía viva: se limpia.
  if (!u) {
    db.delete(sesiones).where(eq(sesiones.id, id)).run()
    return { sesion: null, usuario: null }
  }

  return { sesion: { id, usuarioId: fila.usuarioId, expiraEn }, usuario: u }
}

export function invalidarSesion(id) {
  db.delete(sesiones).where(eq(sesiones.id, id)).run()
}

export function ponerCookieDeSesion(cookies, token, expiraEn) {
  cookies.set(COOKIE_SESION, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIES_SEGURAS,
    expires: new Date(expiraEn),
  })
}

export function borrarCookieDeSesion(cookies) {
  cookies.delete(COOKIE_SESION, { path: '/' })
}

// ── Consultas de usuario ────────────────────────────────────────────────────

export function buscarUsuarioPorNombre(nombre) {
  const [u] = db.select().from(usuarios).where(eq(usuarios.usuario, nombre)).all()
  return u ?? null
}
