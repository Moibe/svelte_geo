import { getContext, setContext } from 'svelte'
import { borrarLoQueYaNoSePermite, promoverMemoria } from './almacenamiento.js'
import { marcarRecargaPorConsentimiento } from './consentimiento-navegador.js'

/**
 * El estado del aviso de cookies que ven los componentes: si esta visita pide
 * consentimiento, qué eligió la persona y si el panel está abierto.
 *
 * UNA INSTANCIA POR DOCUMENTO, compartida por contexto (ver crearEstadoDeConsentimiento
 * en el layout raíz y usarConsentimiento en quien lo lea). Nunca una variable de módulo
 * ni un store global: en el servidor un valor de módulo es compartido por todas las
 * requests, y el aviso de un visitante acabaría pintado al siguiente. Ahí, además, este
 * estado se construye solo con lo que el servidor ya resolvió para ESA request
 * (hooks.server.js), y el navegador lo arranca con lo mismo para que lo pintado coincida.
 * Lo que sabe solo el navegador (la zona horaria, la cookie al día) se agrega al montar,
 * con `conciliar`.
 */

const CLAVE = Symbol('consentimiento')

export class EstadoDeConsentimiento {
  /** ¿Esta visita está en una región que exige pedir consentimiento? */
  requerido = $state(false)

  /** La elección guardada, o null si todavía no eligió. */
  decision = $state(null)

  /** ¿La persona pidió volver a verlo (enlace del pie)? Solo importa si ya había elegido. */
  reabierto = $state(false)

  /** Elemento que tenía el foco al reabrir, para devolvérselo al cerrar. */
  #quienAbrio = null

  /**
   * @param {{ regionIp: 'si'|'no'|'?', vistaPrevia: boolean, decision: {analitica: boolean, publicidad: boolean}|null }|null|undefined} delServidor
   */
  constructor(delServidor) {
    // Solo la IP dice "sí" con seguridad desde el servidor: la zona horaria la sabe
    // únicamente el navegador. Si el servidor no está seguro ("no" o "?"), el aviso
    // aparece al montar, cuando ya se puede leer la zona (ver `conciliar`).
    // Una elección guardada y vigente cuenta como «hay que respetarla» aunque la IP diga «fuera» (VPN):
    // así lo hace también el script de arranque (ver requiereConsentimiento en consentimiento.js).
    this.requerido = Boolean(delServidor && (delServidor.vistaPrevia || delServidor.regionIp === 'si' || delServidor.decision))
    this.decision = delServidor?.decision ?? null
  }

  /** ¿Hay que mostrar el aviso ahora? */
  get visible() {
    return this.requerido && (this.decision === null || this.reabierto)
  }

  /**
   * Alinea este estado con lo que ya decidió el script de arranque en el navegador (que
   * sí conoce la zona horaria y la cookie al día). Se llama al montar.
   */
  conciliar() {
    const c = typeof window !== 'undefined' ? window.__consent : undefined

    if (!c) return

    this.requerido = c.requerido !== false
    this.decision = c.decision ? { analitica: Boolean(c.decision.a), publicidad: Boolean(c.decision.p) } : null

    // Lo que esperaba en memoria y ahora tiene permiso pasa al dispositivo; y lo que quedó en el
    // dispositivo de una elección anterior que ya no vale se borra.
    promoverMemoria()
    borrarLoQueYaNoSePermite()
  }

  /**
   * Se queda atento a los cambios de la elección que NO hizo este aviso: otra pestaña que eligió, o
   * la cookie que venció o se borró (ver `sincronizar` en consentimiento-arranque.js). Así el aviso
   * de esta pestaña desaparece solo cuando se contestó en otra, y vuelve si la elección dejó de existir.
   * Devuelve la función que deja de escuchar (para el onMount del layout).
   */
  escucharCambios() {
    if (typeof window === 'undefined') return () => {}

    const alCambiar = () => this.conciliar()

    window.addEventListener('consent:cambio', alCambiar)

    return () => window.removeEventListener('consent:cambio', alCambiar)
  }

  /** Abre el panel a petición de la persona (enlace del pie). */
  abrir() {
    this.#quienAbrio = typeof document !== 'undefined' ? document.activeElement : null
    this.reabierto = true
  }

  /** Cierra el panel reabierto SIN cambiar la elección. */
  cerrar() {
    this.reabierto = false

    const quien = this.#quienAbrio
    this.#quienAbrio = null

    // Después de que el panel salga del DOM, el foco vuelve al botón que lo abrió.
    if (quien && typeof quien.focus === 'function') {
      queueMicrotask(() => quien.isConnected && quien.focus())
    }
  }

  /**
   * Guarda la elección: la anota el script de arranque (cookie, Consent Mode, carga o
   * retiro de Google) y este estado la refleja.
   *
   * @param {boolean} analitica
   * @param {boolean} publicidad
   */
  elegir(analitica, publicidad) {
    const api = typeof window !== 'undefined' ? window.__consent : undefined

    // Sin el script de arranque no hay nada que guardar (ni a quién avisarle): no se
    // finge una elección que no se registró.
    if (!api || typeof api.aplicar !== 'function') return

    api.aplicar(analitica, publicidad)

    this.decision = { analitica: Boolean(analitica), publicidad: Boolean(publicidad) }

    // Lo que esperaba el permiso (el contexto de la búsqueda, el último número) pasa ya al
    // dispositivo si corresponde; y si algo se retiró, también lo propio de este sitio que ya
    // no lo tiene.
    promoverMemoria()
    borrarLoQueYaNoSePermite()

    this.cerrar()

    // Retirar un permiso con Google ya cargado en la página no basta con avisarle: sus etiquetas
    // siguen vivas en memoria y siguen mandando señales sin cookies. Solo recargar las quita (y
    // la página vuelve a cargar ya con la elección nueva, que es la forma más limpia de aplicarla).
    // Se marca para que esa recarga no se anote como actividad de la persona (page_close, page_refresh).
    if (api.necesitaRecarga) {
      if (typeof api.recargar === 'function') {
        api.recargar()
      } else {
        marcarRecargaPorConsentimiento()
        window.location.reload()
      }
    }
  }
}

/** Crea el estado y lo deja en el contexto del componente actual (se llama una vez, en el layout raíz). */
export function crearEstadoDeConsentimiento(delServidor) {
  const estado = new EstadoDeConsentimiento(delServidor)

  setContext(CLAVE, estado)

  return estado
}

/**
 * El estado compartido. Devuelve null en las páginas que no lo tienen (por ejemplo un
 * componente probado suelto): quien lo use tiene que tolerar la ausencia.
 *
 * @returns {EstadoDeConsentimiento|null}
 */
export function usarConsentimiento() {
  return getContext(CLAVE) ?? null
}
