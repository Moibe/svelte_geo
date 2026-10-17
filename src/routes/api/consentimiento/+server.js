import { json } from '@sveltejs/kit'
// Rutas relativas (y no `$lib`) a propósito: así la prueba de este archivo corre con `node --test`.
import { COOKIE_CONSENTIMIENTO, VIGENCIA_DIAS, serializarDecision } from '../../../lib/consentimiento.js'

/**
 * Guarda la elección del aviso de cookies como cookie puesta POR EL SERVIDOR.
 *
 * Por qué hace falta si el navegador ya la guarda: Safari (ITP) limita a 7 días la vida de las
 * cookies que escribe JavaScript (`document.cookie`), no las que llegan en una cabecera
 * `Set-Cookie`. Sin esto, quien usa Safari —casi la mitad de los móviles del Reino Unido—
 * volvería a ver el aviso cada semana en vez de cada 180 días. El script de arranque
 * (consentimiento-arranque.js) la escribe primero, para que el cambio sea inmediato, y después
 * le avisa a esta ruta, que la renueva con la vida completa. Es un refuerzo: si esta petición
 * falla, la elección sigue guardada por la vía de siempre.
 *
 * Solo guarda lo que le llega (dos booleanos); no lee ni devuelve nada de nadie, y no se puede
 * pedir desde otro sitio: se exige que el origen sea el propio.
 */
export async function POST({ request, cookies, url }) {
  const origen = request.headers.get('origin')

  // Los navegadores mandan Origin en todo POST. Si viene y no es este sitio, es otra página
  // intentando poner una elección en nombre de quien la visita.
  if (origen !== null && origen !== url.origin) {
    return json({ error: 'origen_no_permitido' }, { status: 403 })
  }

  let cuerpo = null

  try {
    cuerpo = await request.json()
  } catch {
    return json({ error: 'cuerpo_ilegible' }, { status: 400 })
  }

  if (typeof cuerpo?.a !== 'boolean' || typeof cuerpo?.p !== 'boolean') {
    return json({ error: 'se_esperaban_a_y_p_booleanos' }, { status: 400 })
  }

  cookies.set(COOKIE_CONSENTIMIENTO, serializarDecision({ analitica: cuerpo.a, publicidad: cuerpo.p }), {
    path: '/',
    maxAge: VIGENCIA_DIAS * 86400,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    // El script de arranque la LEE desde JavaScript en cada página: no puede ser HttpOnly.
    httpOnly: false,
    // El valor ya viene codificado (serializarDecision): sin esto se codificaría dos veces.
    encode: (valor) => valor,
  })

  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
