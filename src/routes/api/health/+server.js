import { json } from '@sveltejs/kit'
import { obtenerFlags, versionDeFlags } from '$lib/server/flags.js'
import { saludGeoip } from '$lib/server/pais.js'

/**
 * Salud del proceso.
 *
 * Antes esto exponia la antiguedad del cache de Firestore, porque un cache
 * congelado NO se nota mirando la pagina: todo carga bien, solo que con
 * valores viejos. Con los flags en la base local ya no hay cache ni sondeo que
 * se pueda quedar viejo, asi que lo que se verifica ahora es lo unico que
 * puede fallar: que la base responda y tenga los flags.
 *
 * Además informa de la base de países por IP (la del aviso de cookies). NO degrada el
 * estado: sin ella el sitio funciona (el aviso se decide con la zona horaria del navegador),
 * pero una base que se venció en silencio se nota recién cuando alguien mira, y nadie lee
 * los registros de pm2. "vieja" es true pasados 45 días de la edición; el cron la renueva
 * cada mes (scripts/actualizar-geoip.sh).
 */
export function GET() {
  try {
    const flags = obtenerFlags()
    const geo = saludGeoip()

    return json({
      status: 'healthy',
      flags: { total: Object.keys(flags).length, version: versionDeFlags() },
      geoip: { cargada: geo.cargada, edicion: geo.build, edadDias: geo.edadDias, vieja: geo.vieja },
    })
  } catch (err) {
    return json(
      { status: 'degraded', error: String(err?.message || err) },
      { status: 503 }
    )
  }
}
