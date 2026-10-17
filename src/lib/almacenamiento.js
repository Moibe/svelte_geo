import { algunaOk, analiticaOk, publicidadOk } from './consentimiento-navegador.js'

/**
 * El almacenamiento local del sitio (`localStorage`) con permiso.
 *
 * Guardar datos en el dispositivo de alguien que no se necesitan para el servicio que
 * pidió también exige consentimiento en la UE, el Reino Unido y Suiza (no solo las
 * cookies: el `localStorage` cuenta igual). Todo lo que el sitio guarda "por si sirve" o
 * "para medir" pasa por aquí; fuera de la región regulada el permiso siempre está dado y
 * esto se comporta como un `localStorage` normal.
 *
 * Qué NO pasa por las claves de abajo, porque es necesario para lo que la persona pidió:
 *   - `map_coords`: las coordenadas del mapa que va a pagar, para devolvérselo al volver de Stripe.
 *     Tiene sus propias funciones al final de este archivo y CADUCA (24 horas).
 *   - el idioma elegido (cookie y `preferred_language`): es su propia elección.
 *   - `cookie_consent`: la elección sobre las cookies, que NO se puede recordar si hace falta
 *     permiso para recordarla.
 *
 * Qué permiso pide cada dato:
 *   - analítica: el contexto de la búsqueda y el último número del simulador (solo sirven
 *     para el registro de actividad), el pago en curso (sirve para registrar que se
 *     abandonó) y la ubicación asignada a un número (para que el mismo número dé siempre el
 *     mismo punto en el mapa).
 *   - analítica O publicidad: los datos de la compra, que sirven para informar la conversión
 *     tanto a Google Analytics como a Google Ads.
 *
 * Sin permiso el dato no se pierde: queda en MEMORIA mientras la página siga abierta (el
 * mismo número sigue dando el mismo punto, por ejemplo) y desaparece al cerrarla o
 * recargarla. Nada toca el dispositivo. Si la persona da el permiso DESPUÉS (acepta el aviso con
 * la ventana de pago ya abierta, por ejemplo), lo que estaba en memoria pasa entonces al
 * dispositivo (`promoverMemoria`): de lo contrario la compra llegaría sin el contexto de la búsqueda.
 */

/** @type {Map<string, string>} */
const memoria = new Map()

/**
 * Lo que se le quita a un dato AL PONERLO en el dispositivo (no en memoria, donde queda completo
 * por si después llega el permiso). Los identificadores de clic de anuncios (gclid, fbclid) son
 * de publicidad: sin ESE permiso no se guardan en el dispositivo aunque el de analítica sí esté.
 */
const DEPURAR_PARA_EL_DISPOSITIVO = {
  conversion_context(texto) {
    if (publicidadOk()) return texto

    try {
      const contexto = JSON.parse(texto)

      if (contexto && typeof contexto === 'object') {
        contexto.gclid = null
        contexto.fbclid = null

        return JSON.stringify(contexto)
      }
    } catch {
      // Un valor que no es JSON se guarda como vino: no es de este módulo arreglarlo.
    }

    return texto
  },
}

function paraElDispositivo(clave, texto) {
  const depurar = DEPURAR_PARA_EL_DISPOSITIVO[clave]

  return depurar ? depurar(texto) : texto
}

/** Las claves que piden "analítica O publicidad". Todas las demás piden analítica. */
const CLAVES_CON_CUALQUIER_PERMISO = new Set(['purchase_data'])

/** Lo que este módulo administra (para poder retirarlo cuando se retira el permiso). */
const CLAVES = ['conversion_context', 'last_phone_number', 'pending_checkout', 'purchase_data']
const PREFIJOS = ['geo_cache_']

function administra(clave) {
  return CLAVES.includes(clave) || PREFIJOS.some((p) => clave.startsWith(p))
}

/** ¿Hay permiso para dejar ESTA clave en el dispositivo? */
export function permitido(clave) {
  return CLAVES_CON_CUALQUIER_PERMISO.has(clave) ? algunaOk() : analiticaOk()
}

/**
 * Guarda un valor. Con permiso va al `localStorage`; sin él, a la memoria de la página.
 * @param {string} clave
 * @param {string} valor
 * @returns {boolean} true si quedó en el dispositivo
 */
export function guardar(clave, valor) {
  const texto = String(valor)

  if (permitido(clave)) {
    try {
      localStorage.setItem(clave, paraElDispositivo(clave, texto))
      memoria.delete(clave)
      return true
    } catch {
      // Almacenamiento lleno o bloqueado (modo privado de algunos navegadores): cae a la memoria.
    }
  }

  memoria.set(clave, texto)
  return false
}

/**
 * Pasa al dispositivo lo que estaba esperando en memoria y que AHORA tiene permiso. Se llama cuando
 * la persona elige en el aviso (y cuando otra pestaña lo hace).
 */
export function promoverMemoria() {
  for (const [clave, texto] of [...memoria]) {
    if (!permitido(clave)) continue

    try {
      localStorage.setItem(clave, paraElDispositivo(clave, texto))
      memoria.delete(clave)
    } catch {
      // Sigue en memoria: es lo mismo que antes.
    }
  }
}

/**
 * Lee un valor guardado con `guardar`. Solo mira el dispositivo si hay permiso.
 * @param {string} clave
 * @returns {string|null}
 */
export function leer(clave) {
  if (permitido(clave)) {
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado !== null) return guardado
    } catch {
      // Sin almacenamiento: se mira la memoria.
    }
  }

  return memoria.get(clave) ?? null
}

/** Borra un valor de los dos lados. */
export function quitar(clave) {
  memoria.delete(clave)

  try {
    localStorage.removeItem(clave)
  } catch {
    // Nada que borrar si no hay almacenamiento.
  }
}

/**
 * Borra del dispositivo lo que ahora NO tiene permiso: lo que quedó de una elección
 * anterior (la persona retiró el permiso, o la cookie con su elección venció y se le
 * volvió a preguntar). Lo que sí tiene permiso no se toca.
 */
export function borrarLoQueYaNoSePermite() {
  let claves = []

  try {
    claves = Object.keys(localStorage)
  } catch {
    return
  }

  for (const clave of claves) {
    if (!administra(clave)) continue

    if (!permitido(clave)) {
      try {
        localStorage.removeItem(clave)
      } catch {
        // Sin acceso: nada que hacer.
      }

      continue
    }

    // Con permiso para la clave, pero lo de ADENTRO puede haber dejado de tenerlo: al retirar solo la
    // publicidad, el contexto de la compra sigue (es de analítica) pero sin el gclid ni el fbclid.
    if (DEPURAR_PARA_EL_DISPOSITIVO[clave]) {
      try {
        const actual = localStorage.getItem(clave)

        if (actual !== null) {
          const depurado = paraElDispositivo(clave, actual)
          if (depurado !== actual) localStorage.setItem(clave, depurado)
        }
      } catch {
        // Sin acceso: nada que hacer.
      }
    }
  }
}

// ── Las coordenadas del mapa que se va a pagar ───────────────────────────────────────────────────
//
// `map_coords` es NECESARIA (sin ella, quien paga no recupera el mapa al volver de Stripe) y por eso
// se guarda sin pedir permiso. Pero es un dato de ubicación, así que:
//   - solo se guarda al pulsar «Comprar», y lleva su fecha;
//   - CADUCA a las 24 horas (lo que dura una sesión de pago de Stripe): se descarta al leerla y se
//     borra en cualquier carga posterior. Antes quedaba en el dispositivo para siempre si la persona
//     cancelaba o cerraba Stripe, que es lo más común;
//   - al volver de Stripe con éxito NO se borra enseguida: volver a abrir ese enlace (el botón
//     «atrás», una recarga) tiene que seguir mostrando el mapa pagado, como siempre.

const COORDENADAS_DEL_PAGO = 'map_coords'
const VIGENCIA_COORDENADAS_MS = 24 * 60 * 60 * 1000

/** Guarda las coordenadas del mapa que se va a pagar, con su fecha. */
export function guardarCoordenadasDelPago(lat, lng, ahora = Date.now()) {
  try {
    localStorage.setItem(COORDENADAS_DEL_PAGO, JSON.stringify({ lat, lng, t: ahora }))
  } catch {
    // Sin almacenamiento el pago funciona igual; solo no se podrá restaurar el mapa al volver.
  }
}

/**
 * Las coordenadas guardadas, o null si no hay, son ilegibles, no tienen fecha (las de antes de
 * este cambio) o ya caducaron.
 *
 * @returns {{lat: number, lng: number}|null}
 */
export function leerCoordenadasDelPago(ahora = Date.now()) {
  try {
    const crudo = localStorage.getItem(COORDENADAS_DEL_PAGO)
    if (!crudo) return null

    const dato = JSON.parse(crudo)

    if (!dato || typeof dato !== 'object') return null
    if (!Number.isFinite(dato.lat) || !Number.isFinite(dato.lng) || !Number.isFinite(dato.t)) return null
    // Una fecha del futuro (reloj mal puesto, dato manipulado) tampoco vale.
    if (dato.t > ahora + 60_000 || ahora - dato.t > VIGENCIA_COORDENADAS_MS) return null

    return { lat: dato.lat, lng: dato.lng }
  } catch {
    return null
  }
}

/** Borra las coordenadas (el pago se canceló, o ya no hacen falta). */
export function borrarCoordenadasDelPago() {
  try {
    localStorage.removeItem(COORDENADAS_DEL_PAGO)
  } catch {
    // Nada que borrar si no hay almacenamiento.
  }
}

/** Borra las coordenadas que caducaron o que no se pueden usar. Se llama al cargar la página. */
export function purgarCoordenadasVencidas(ahora = Date.now()) {
  try {
    if (localStorage.getItem(COORDENADAS_DEL_PAGO) !== null && leerCoordenadasDelPago(ahora) === null) {
      localStorage.removeItem(COORDENADAS_DEL_PAGO)
    }
  } catch {
    // Sin acceso al almacenamiento: nada que purgar.
  }
}
