import { json } from '@sveltejs/kit'
import { estadoDelCache, obtenerFlags } from '$lib/server/flags.js'

/**
 * Salud del proceso, con foco en lo que puede fallar EN SILENCIO.
 *
 * Expone la antiguedad del cache de flags a proposito: un cache que se dejo de
 * refrescar no se nota mirando la pagina — todo carga bien, solo que con
 * valores viejos. Si `antiguedadSegundos` crece por encima del intervalo, el
 * sondeo a Firestore esta fallando aunque la app se vea perfecta.
 *
 * Devuelve 503 en ese caso para que un monitoreo externo lo detecte sin tener
 * que interpretar el cuerpo (mismo criterio que la API de tracking).
 */
export async function GET() {
  // Arranca el cache si todavía nadie lo hizo. Sin esto, un proceso recién
  // reiniciado reportaría "degraded" hasta que llegara la primera visita —
  // una alerta falsa justo después de cada deploy, que es exactamente cuando
  // uno mira el health check.
  await obtenerFlags()

  const cache = estadoDelCache()

  // Se tolera hasta 3 intervalos antes de declararlo degradado: un fallo
  // aislado de red no deberia disparar una alerta.
  const limite = cache.intervaloSegundos * 3
  const sano =
    cache.antiguedadSegundos !== null && cache.antiguedadSegundos <= limite

  return json(
    {
      status: sano ? 'healthy' : 'degraded',
      flagsCache: cache,
    },
    { status: sano ? 200 : 503 }
  )
}
