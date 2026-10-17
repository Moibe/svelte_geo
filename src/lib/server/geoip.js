import fs from 'node:fs/promises'
import { open as abrirMmdb, validate } from 'maxmind'

/**
 * Lector de la base de países por IP (DB-IP "IP to Country Lite", formato MMDB)
 * con recarga automática cuando el archivo cambia.
 *
 * Por qué una base LOCAL y no una API: saber si un visitante está en la región que
 * exige pedir consentimiento (ver $lib/consentimiento.js) se decide en CADA carga de
 * página, y hacerlo contra un servicio externo sumaría su latencia a todas, mandaría
 * la IP de cada visitante a un tercero solo para decidir si mostrarle un aviso de
 * privacidad, y dejaría el aviso a merced de que ese servicio responda. Con la base
 * en disco la consulta cuesta ~1 µs y no sale nada de la máquina.
 *
 * Decisiones (todas probadas en geoip.test.js):
 *
 *  1. Sin fs.watchFile ni temporizadores: el archivo se revisa "por demanda", como
 *     mucho una vez cada `intervaloRevisionMs`, cuando llega una consulta. Nada
 *     mantiene vivo el proceso y no hay nada que cerrar.
 *
 *  2. Una base nueva SOLO reemplaza a la vigente si pasa la validación (tipo, IPv6,
 *     número de nodos, fecha de construcción, IPs de control). El `watchForUpdates`
 *     de maxmind recarga sin validar y, con un archivo corrupto, deja una promesa
 *     rechazada sin manejar que tumba el proceso.
 *
 *  3. La "firma" del archivo es (inodo, tamaño, mtime): un `mv` atómico cambia el
 *     inodo y un archivo reescrito cambia el mtime. Se compara con !==, nunca con >
 *     (un gunzip que conserva la fecha de la cabecera puede traer un mtime ANTERIOR
 *     al del archivo que reemplaza).
 *
 *  4. Si algo falla (archivo ausente, corrupto, un .gz puesto por error) se conserva
 *     el lector anterior y se avisa por onEvento; la versión rechazada no se
 *     reintenta en cada consulta, solo cuando el archivo vuelva a cambiar.
 *
 * Nunca lanza al consultar: sin base, o ante una IP que no es IP, responde "no sé"
 * y quien llama decide (para el consentimiento, "no sé" significa pedirlo).
 */

const DIA_MS = 86_400_000

/** IPs de control de la base real: si casi todas fallan, la base está mal. */
export const CANARIOS_DBIP = [
  ['8.8.8.8', 'US'],
  ['85.214.132.117', 'DE'],
  ['81.2.69.142', 'GB'],
  ['213.4.0.1', 'ES'],
]

/**
 * Deja la IP lista para consultar, o devuelve null. El `get()` de maxmind NO valida
 * nada: "8.8.8", "85.214.132.117abc" o "1.2.3.4.5" devuelven un país igualmente
 * (se leen con parseInt), así que SIEMPRE se valida antes con net.isIP.
 *
 * @param {unknown} valor
 * @returns {string|null}
 */
export function normalizarIp(valor) {
  if (typeof valor !== 'string') return null

  let ip = valor.trim()
  if (!ip) return null

  const conCorchetes = /^\[([^\]]+)\](?::\d+)?$/.exec(ip) // [2001:db8::1] o [2001:db8::1]:443
  if (conCorchetes) {
    ip = conCorchetes[1]
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':')) // 1.2.3.4:443
  }

  const zona = ip.indexOf('%') // fe80::1%eth0
  if (zona !== -1) ip = ip.slice(0, zona)

  return validate(ip) ? ip : null
}

function problemaDeLaBase(lector, { tipoEsperado, minNodos, canarios, minAciertos }) {
  const m = lector.metadata

  if (!tipoEsperado.test(String(m.databaseType))) return `database_type inesperado: ${m.databaseType}`
  if (m.ipVersion !== 6) return `ip_version=${m.ipVersion} (se esperaba 6)`
  if (!(m.nodeCount >= minNodos)) return `node_count=${m.nodeCount} es menor que ${minNodos}`
  if (!(m.buildEpoch instanceof Date) || Number.isNaN(m.buildEpoch.getTime())) return 'build_epoch ilegible'

  let aciertos = 0

  for (const [ip, esperado] of canarios) {
    let iso

    try {
      iso = lector.get(ip)?.country?.iso_code
    } catch {
      iso = undefined
    }

    if (iso === esperado) aciertos++
  }

  if (aciertos < minAciertos) {
    return `solo ${aciertos} de ${canarios.length} IPs de control coinciden (se piden ${minAciertos})`
  }

  return null
}

/**
 * @param {object} o
 * @param {string} o.ruta  ruta del .mmdb (la que actualiza el cron con un mv atómico)
 * @param {number} [o.intervaloRevisionMs=60000]  cada cuánto mirar si el archivo cambió
 * @param {number} [o.maxEdadDias=45]  pasado esto la base se considera vieja (se sigue usando)
 * @param {(e: object) => void} [o.onEvento]  cargada | recargada | recarga_rechazada | sin_archivo | base_vieja
 * @param {() => number} [o.ahora]  reloj inyectable para pruebas
 * @param {(ruta: string) => Promise<object>} [o.abrir]  inyectable: devuelve algo con get() y metadata
 */
export function crearLectorGeoip({
  ruta,
  intervaloRevisionMs = 60_000,
  maxEdadDias = 45,
  onEvento = () => {},
  ahora = Date.now,
  abrir = abrirMmdb,
  tipoEsperado = /Country/i,
  minNodos = 1_000_000,
  canarios = CANARIOS_DBIP,
  minAciertosCanarios = 3,
} = {}) {
  const reglas = { tipoEsperado, minNodos, canarios, minAciertos: minAciertosCanarios }

  let actual = null // { lector, firma, build }
  let ultimaRevision = -Infinity
  let enVuelo = null
  let firmaRechazada = null
  let ultimoAvisoVieja = -Infinity
  let ultimoAvisoSinArchivo = -Infinity
  let recargas = 0
  let rechazos = 0
  let ultimoError = null

  function emitir(evento) {
    try {
      onEvento({ ...evento, ruta })
    } catch {
      // Un onEvento defectuoso no puede romper la consulta de países.
    }
  }

  async function revisarUnaVez() {
    let firma

    try {
      const st = await fs.stat(ruta, { bigint: true })
      firma = `${st.ino}:${st.size}:${st.mtimeNs}`
    } catch (e) {
      // Se avisa cuando CAMBIA el motivo y, mientras siga igual, una vez al día. Sin esto, un servidor
      // sin la base repetía la misma línea cada minuto para siempre (los registros de pm2 no rotan).
      if (ultimoError?.codigo !== e.code || ahora() - ultimoAvisoSinArchivo > DIA_MS) {
        ultimoAvisoSinArchivo = ahora()
        emitir({ tipo: 'sin_archivo', codigo: e.code, conservando: Boolean(actual) })
      }
      ultimoError = { codigo: e.code, mensaje: e.message }
      return
    }

    if (actual && actual.firma === firma) return // sin cambios
    if (firma === firmaRechazada) return // esta versión del archivo ya se rechazó

    let candidato

    try {
      candidato = await abrir(ruta)

      const problema = problemaDeLaBase(candidato, reglas)
      if (problema) throw new Error(problema)
    } catch (e) {
      firmaRechazada = firma
      rechazos++
      ultimoError = { codigo: 'BASE_INVALIDA', mensaje: String(e?.message ?? e) }
      emitir({ tipo: 'recarga_rechazada', motivo: ultimoError.mensaje, conservando: Boolean(actual) })
      return
    }

    const habia = Boolean(actual)

    actual = { lector: candidato, firma, build: candidato.metadata.buildEpoch }
    firmaRechazada = null
    ultimoError = null
    if (habia) recargas++

    emitir({
      tipo: habia ? 'recargada' : 'cargada',
      tipoBase: candidato.metadata.databaseType,
      build: actual.build.toISOString(),
      nodos: candidato.metadata.nodeCount,
    })
  }

  /** Fuerza una revisión ahora (arranque, pruebas). */
  function recargarAhora() {
    enVuelo ??= revisarUnaVez()
      .catch((e) => emitir({ tipo: 'error_inesperado', mensaje: String(e?.message ?? e) }))
      .finally(() => {
        ultimaRevision = ahora()
        enVuelo = null
      })

    return enVuelo
  }

  function programarRevision() {
    if (enVuelo || ahora() - ultimaRevision < intervaloRevisionMs) return

    void recargarAhora()
  }

  function avisarSiEsVieja() {
    if (!actual) return

    const edad = (ahora() - actual.build.getTime()) / DIA_MS

    if (edad > maxEdadDias && ahora() - ultimoAvisoVieja > DIA_MS) {
      ultimoAvisoVieja = ahora()
      emitir({ tipo: 'base_vieja', edadDias: Math.floor(edad), build: actual.build.toISOString() })
    }
  }

  /**
   * Consulta SÍNCRONA (no espera al disco). Nunca lanza.
   * estado: 'ok' | 'sin_dato' | 'ip_invalida' | 'sin_base'
   *
   * @param {unknown} ipCruda
   * @returns {{ estado: 'ok'|'sin_dato'|'ip_invalida'|'sin_base', iso: string|null }}
   */
  function pais(ipCruda) {
    programarRevision()

    if (!actual) return { estado: 'sin_base', iso: null }

    avisarSiEsVieja()

    const ip = normalizarIp(ipCruda)
    if (!ip) return { estado: 'ip_invalida', iso: null }

    let registro = null

    try {
      registro = actual.lector.get(ip)
    } catch {
      return { estado: 'sin_dato', iso: null }
    }

    const iso = registro?.country?.iso_code

    // "ZZ" es "sin país" (DB-IP lo usa en rangos reservados): se trata como desconocido.
    if (typeof iso !== 'string' || !/^[A-Z]{2}$/.test(iso) || iso === 'ZZ') return { estado: 'sin_dato', iso: null }

    return { estado: 'ok', iso }
  }

  function salud() {
    const edad = actual ? (ahora() - actual.build.getTime()) / DIA_MS : null

    return {
      cargada: Boolean(actual),
      ruta,
      tipoBase: actual?.lector.metadata.databaseType ?? null,
      build: actual?.build.toISOString() ?? null,
      edadDias: edad === null ? null : Math.floor(edad),
      vieja: edad !== null && edad > maxEdadDias,
      recargas,
      rechazos,
      ultimoError,
    }
  }

  return { pais, salud, recargarAhora }
}
