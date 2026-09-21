import { json } from '@sveltejs/kit'
import { obtenerFlags, versionDeFlags } from '$lib/server/flags.js'

/**
 * Salud del proceso.
 *
 * Antes esto exponia la antiguedad del cache de Firestore, porque un cache
 * congelado NO se nota mirando la pagina: todo carga bien, solo que con
 * valores viejos. Con los flags en la base local ya no hay cache ni sondeo que
 * se pueda quedar viejo, asi que lo que se verifica ahora es lo unico que
 * puede fallar: que la base responda y tenga los flags.
 */
export function GET() {
  try {
    const flags = obtenerFlags()

    return json({
      status: 'healthy',
      flags: { total: Object.keys(flags).length, version: versionDeFlags() },
    })
  } catch (err) {
    return json(
      { status: 'degraded', error: String(err?.message || err) },
      { status: 503 }
    )
  }
}
