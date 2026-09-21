import { json } from '@sveltejs/kit'
import { obtenerFlags, versionDeFlags } from '$lib/server/flags.js'

/**
 * Los flags vigentes, para que una pestaña abierta se entere de un cambio.
 *
 * Reemplaza lo que hacían los onSnapshot de Firestore. Se sondea desde el
 * cliente en vez de mantener una conexión abierta, y el intercambio vale la
 * pena: la respuesta del caso normal —que no cambió nada— son unas decenas de
 * bytes, y a cambio se fueron ~400 KB de SDK del bundle de cada visitante.
 *
 * El cliente manda la versión que ya tiene; si coincide se responde sin el
 * cuerpo de los flags, para que el caso normal sea lo más barato posible.
 */
export function GET({ url }) {
  const version = versionDeFlags()

  if (url.searchParams.get('version') === version) {
    return json({ sinCambios: true, version })
  }

  return json({ sinCambios: false, version, flags: obtenerFlags() })
}
