import { countryCodeMap } from '$lib/geoLocation.js'

/**
 * Detección de país por IP en el SERVIDOR, en MODO SOMBRA.
 *
 * ---
 *
 * QUÉ SIGNIFICA "MODO SOMBRA" Y POR QUÉ
 *
 * Esto calcula el país pero NO lo usa para nada: solo lo escribe al log con
 * prefijo GEO_SHADOW, para poder compararlo unos días contra la distribución
 * que ya se conoce (pesada en MX) antes de darle la fuente de verdad.
 *
 * El motivo no es prudencia genérica. Esta clase de falla devuelve HTTP 200 y
 * no escribe nada en ningún lado:
 *
 *   https://get.geojs.io/v1/ip/geo.json  SIN parámetro de IP geolocaliza a
 *   QUIEN LLAMA. Movido tal cual al servidor, eso es el datacenter: todos los
 *   visitantes saldrían de Nueva York, con la lada equivocada, el mapa
 *   centrado ahí y el price_id de otro mercado. Y contaminaría la misma tabla
 *   de conversiones con la que uno lo detectaría.
 *
 * Por eso acá se usa SIEMPRE la forma explícita con la IP del visitante.
 *
 * REQUISITO NO NEGOCIABLE: event.getClientAddress() solo devuelve la IP real
 * si adapter-node sabe de dónde leerla. Detrás de nginx hace falta
 * ADDRESS_HEADER=x-forwarded-for y XFF_DEPTH=1 en el entorno del proceso. Sin
 * eso devuelve la IP del proxy (127.0.0.1) y geojs respondería cualquier cosa.
 * El log lo delata: si la IP que aparece es local, la configuración falta.
 */

/** IPs que nunca van a geolocalizar a nada útil. */
function esLocal(ip) {
  return (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.')
  )
}

/**
 * Consulta geojs por la IP del visitante y deja el resultado en el log.
 * No lanza nunca: es observación, no puede afectar la respuesta.
 *
 * @param {string} ip - la IP del visitante (event.getClientAddress())
 */
export async function observarPaisPorIP(ip) {
  if (esLocal(ip)) {
    console.log(
      `GEO_SHADOW ip=${ip || 'nula'} resultado=omitido ` +
        `motivo=ip_local_o_ausente (revisar ADDRESS_HEADER/XFF_DEPTH si esto sale en produccion)`
    )
    return
  }

  try {
    // Forma EXPLÍCITA: la IP va en la URL. La variante sin IP geolocalizaría
    // al droplet, no al visitante.
    const respuesta = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`, {
      signal: AbortSignal.timeout(3000),
    })

    if (!respuesta.ok) {
      console.log(`GEO_SHADOW ip=${ip} resultado=error http=${respuesta.status}`)
      return
    }

    const datos = await respuesta.json()
    const iso = datos.country_code?.toUpperCase()
    const lada = iso ? countryCodeMap[iso] : null

    console.log(
      `GEO_SHADOW ip=${ip} iso=${iso || 'nulo'} lada=${lada || 'sin_mapeo'} ` +
        `lat=${datos.latitude} lng=${datos.longitude}`
    )
  } catch (err) {
    // Un timeout o un fallo de red acá no puede romper la página: solo se anota.
    console.log(`GEO_SHADOW ip=${ip} resultado=excepcion detalle=${String(err?.message || err)}`)
  }
}
