import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CANARIOS_DBIP, crearLectorGeoip, normalizarIp } from './geoip.js'

const DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'geoip-test-'))
after(() => fs.rm(DIR, { recursive: true, force: true }))

let contador = 0

/** Un archivo cualquiera: con un lector falso lo único que se le pide es que exista y cambie. */
async function archivo(contenido = 'x') {
  const ruta = path.join(DIR, `base-${++contador}.mmdb`)
  await fs.writeFile(ruta, contenido)
  return ruta
}

/** Reemplazo ATÓMICO, como hace el mv del script de actualización: escribir al lado y renombrar. */
async function reemplazarAtomico(ruta, contenido) {
  const nuevo = `${ruta}.nuevo`
  await fs.writeFile(nuevo, contenido)
  await fs.rename(nuevo, ruta)
}

const REGISTROS = {
  '8.8.8.8': { country: { iso_code: 'US' } },
  '85.214.132.117': { country: { iso_code: 'DE' } },
  '81.2.69.142': { country: { iso_code: 'GB' } },
  '213.4.0.1': { country: { iso_code: 'ES' } },
  '187.190.144.173': { country: { iso_code: 'MX' } },
  '192.0.0.255': { country: { iso_code: 'ZZ' } },
}

function baseFalsa(cambios = {}) {
  return {
    metadata: {
      databaseType: 'DBIP-Country-Lite',
      ipVersion: 6,
      nodeCount: 1_383_101,
      buildEpoch: new Date('2026-10-01T01:36:12Z'),
      ...cambios,
    },
    get: (ip) => REGISTROS[ip] ?? null,
  }
}

function lector(ruta, extra = {}) {
  const eventos = []
  const reloj = { t: Date.parse('2026-10-13T12:00:00Z') }
  const geo = crearLectorGeoip({
    ruta,
    intervaloRevisionMs: 0,
    abrir: async () => baseFalsa(),
    ahora: () => reloj.t,
    onEvento: (e) => eventos.push(e),
    ...extra,
  })

  return { geo, eventos, reloj, tipos: () => eventos.map((e) => e.tipo) }
}

test('normalizarIp: limpia lo que suele llegar en cabeceras y rechaza lo que no es una IP', () => {
  assert.equal(normalizarIp('85.214.132.117'), '85.214.132.117')
  assert.equal(normalizarIp('  85.214.132.117  '), '85.214.132.117')
  assert.equal(normalizarIp('85.214.132.117:51234'), '85.214.132.117')
  assert.equal(normalizarIp('[2a00:1450:4001:81d::200e]'), '2a00:1450:4001:81d::200e')
  assert.equal(normalizarIp('[2a00:1450:4001:81d::200e]:443'), '2a00:1450:4001:81d::200e')
  assert.equal(normalizarIp('fe80::1%eth0'), 'fe80::1')
  assert.equal(normalizarIp('::ffff:85.214.132.117'), '::ffff:85.214.132.117')

  // Lo que el get() de maxmind aceptaría sin validar, devolviendo un país:
  for (const mala of ['85.214.132.117abc', '8.8.8', '1.2.3.4.5', '999.1.1.1', 'no-es-una-ip', '', '   ', null, undefined, 12345, {}]) {
    assert.equal(normalizarIp(mala), null, `debía rechazar ${JSON.stringify(mala)}`)
  }
})

test('responde con el país, y "sin_dato" para lo reservado, "ip_invalida" para lo que no es una IP', async () => {
  const { geo, tipos } = lector(await archivo())

  assert.deepEqual(geo.pais('85.214.132.117'), { estado: 'sin_base', iso: null }, 'antes de cargar')

  await geo.recargarAhora()
  assert.deepEqual(tipos(), ['cargada'])

  assert.deepEqual(geo.pais('85.214.132.117'), { estado: 'ok', iso: 'DE' })
  assert.deepEqual(geo.pais('187.190.144.173'), { estado: 'ok', iso: 'MX' })
  assert.deepEqual(geo.pais('8.8.8.8:443'), { estado: 'ok', iso: 'US' })
  assert.deepEqual(geo.pais('10.0.0.1'), { estado: 'sin_dato', iso: null })
  // "ZZ" cuenta como "sin país".
  assert.deepEqual(geo.pais('192.0.0.255'), { estado: 'sin_dato', iso: null })

  for (const mala of ['85.214.132.117abc', '8.8.8', 'no-es-una-ip', null, undefined, 42]) {
    assert.deepEqual(geo.pais(mala), { estado: 'ip_invalida', iso: null }, String(mala))
  }
})

test('un lector que lanza al consultar no tumba la consulta', async () => {
  const ruta = await archivo()
  const roto = baseFalsa()
  roto.get = (ip) => {
    if (ip === '1.1.1.1') throw new Error('árbol dañado')
    return REGISTROS[ip] ?? null
  }

  const { geo } = lector(ruta, { abrir: async () => roto })
  await geo.recargarAhora()

  assert.deepEqual(geo.pais('1.1.1.1'), { estado: 'sin_dato', iso: null })
  assert.equal(geo.pais('8.8.8.8').iso, 'US')
})

test('se rechaza una base de otro tipo, solo IPv4, demasiado chica, sin fecha o con IPs de control que no coinciden', async () => {
  const casos = [
    [{ databaseType: 'GeoIP2-City' }, /database_type inesperado: GeoIP2-City/],
    [{ ipVersion: 4 }, /ip_version=4/],
    [{ nodeCount: 1704 }, /node_count=1704 es menor que 1000000/],
    [{ buildEpoch: new Date('nada') }, /build_epoch ilegible/],
    [{ buildEpoch: 'ayer' }, /build_epoch ilegible/],
  ]

  for (const [cambios, esperado] of casos) {
    const { geo, eventos } = lector(await archivo(), { abrir: async () => baseFalsa(cambios) })

    await geo.recargarAhora()
    assert.equal(geo.pais('85.214.132.117').estado, 'sin_base', JSON.stringify(cambios))
    assert.match(eventos[0].motivo, esperado)
    assert.equal(eventos[0].tipo, 'recarga_rechazada')
  }

  // Una base que responde mal en las IPs de control (países cambiados).
  const torcida = baseFalsa()
  torcida.get = (ip) => (REGISTROS[ip] ? { country: { iso_code: 'FR' } } : null)

  const { geo, eventos } = lector(await archivo(), { abrir: async () => torcida })
  await geo.recargarAhora()
  assert.match(eventos[0].motivo, /IPs de control coinciden/)
  assert.equal(geo.pais('85.214.132.117').estado, 'sin_base')
})

test('las IPs de control por defecto son las de la base real', () => {
  assert.ok(CANARIOS_DBIP.length >= 4)
  for (const [ip, iso] of CANARIOS_DBIP) assert.match(iso, /^[A-Z]{2}$/, ip)
})

test('recarga: una base válida nueva reemplaza a la vigente sin reiniciar, y sin cambios no se vuelve a cargar', async () => {
  const ruta = await archivo('a')
  let version = 'A'
  const { geo, tipos } = lector(ruta, {
    abrir: async () => {
      // La versión se captura AL ABRIR: cada lector responde con la suya aunque `version` cambie después.
      const iso = version === 'A' ? 'AU' : 'NZ'
      const base = baseFalsa()
      base.get = (ip) => (ip === '1.1.1.1' ? { country: { iso_code: iso } } : REGISTROS[ip] ?? null)
      return base
    },
  })

  await geo.recargarAhora()
  assert.equal(geo.pais('1.1.1.1').iso, 'AU')

  version = 'B'
  await reemplazarAtomico(ruta, 'archivo-nuevo-mas-largo')
  await geo.recargarAhora()
  assert.equal(geo.pais('1.1.1.1').iso, 'NZ')
  assert.deepEqual(tipos(), ['cargada', 'recargada'])
  assert.equal(geo.salud().recargas, 1)

  await geo.recargarAhora()
  await geo.recargarAhora()
  assert.deepEqual(tipos(), ['cargada', 'recargada'], 'sin cambios en el archivo no se recarga')
})

test('recarga: un archivo corrupto no reemplaza al bueno y no se reintenta en bucle', async () => {
  const ruta = await archivo('bueno')
  let corrupto = false
  const { geo, eventos, tipos } = lector(ruta, {
    abrir: async () => {
      if (corrupto) throw new Error('Invalid MaxMind DB')
      return baseFalsa()
    },
  })

  await geo.recargarAhora()
  assert.equal(geo.pais('85.214.132.117').iso, 'DE')

  corrupto = true
  await reemplazarAtomico(ruta, 'a medias')
  await geo.recargarAhora()
  assert.equal(geo.pais('85.214.132.117').iso, 'DE', 'sigue con la base buena')
  assert.deepEqual(tipos(), ['cargada', 'recarga_rechazada'])
  assert.equal(eventos[1].conservando, true)

  // La misma versión mala: no se reintenta ni se vuelve a avisar.
  await geo.recargarAhora()
  await geo.recargarAhora()
  assert.deepEqual(tipos(), ['cargada', 'recarga_rechazada'])
  assert.equal(geo.salud().rechazos, 1)

  // Otra versión mala cuenta como un rechazo nuevo.
  await reemplazarAtomico(ruta, '<html>404 Not Found</html>')
  await geo.recargarAhora()
  assert.equal(geo.salud().rechazos, 2)

  // Se corrige con una buena: vuelve a cargar y limpia el error.
  corrupto = false
  await reemplazarAtomico(ruta, 'otra-buena-version')
  await geo.recargarAhora()
  assert.equal(tipos().at(-1), 'recargada')
  assert.equal(geo.salud().ultimoError, null)
})

test('archivo ausente: se conserva el lector, el aviso no se repite y al volver se recarga', async () => {
  const ruta = await archivo('a')
  const { geo, eventos, tipos } = lector(ruta)

  await geo.recargarAhora()
  await fs.rm(ruta)
  await geo.recargarAhora()
  await geo.recargarAhora()

  assert.equal(geo.pais('85.214.132.117').iso, 'DE', 'sigue respondiendo con la copia en memoria')
  assert.equal(eventos.filter((e) => e.tipo === 'sin_archivo').length, 1)
  assert.equal(eventos.find((e) => e.tipo === 'sin_archivo').codigo, 'ENOENT')

  await fs.writeFile(ruta, 'volvió')
  await geo.recargarAhora()
  assert.equal(tipos().at(-1), 'recargada')
})

test('arranque SIN archivo: responde sin_base (no lanza) y se carga solo cuando aparece', async () => {
  const ruta = path.join(DIR, 'todavia-no-existe.mmdb')
  const { geo, tipos } = lector(ruta)

  await geo.recargarAhora()
  assert.deepEqual(geo.pais('85.214.132.117'), { estado: 'sin_base', iso: null })
  assert.deepEqual(tipos(), ['sin_archivo'])
  assert.equal(geo.salud().cargada, false)

  await fs.writeFile(ruta, 'ya llegó')
  await geo.recargarAhora()
  assert.equal(geo.pais('85.214.132.117').iso, 'DE')
  assert.equal(tipos().at(-1), 'cargada')
})

test('base vieja: se sigue usando y se avisa una sola vez al día', async () => {
  const { geo, eventos, reloj } = lector(await archivo(), { intervaloRevisionMs: 1e12 })

  await geo.recargarAhora()

  reloj.t = Date.parse('2027-01-01T00:00:00Z') // ~92 días después de la edición
  assert.equal(geo.pais('85.214.132.117').iso, 'DE', 'sigue respondiendo')
  geo.pais('85.214.132.117')
  geo.pais('85.214.132.117')
  assert.equal(eventos.filter((e) => e.tipo === 'base_vieja').length, 1)
  assert.equal(geo.salud().vieja, true)

  reloj.t += 25 * 3600 * 1000
  geo.pais('85.214.132.117')
  assert.equal(eventos.filter((e) => e.tipo === 'base_vieja').length, 2)
})

test('revisión "por demanda": la propia consulta dispara la revisión cuando pasa el intervalo, sin timers', async () => {
  const ruta = await archivo('a')
  let version = 'A'
  const { geo, tipos, reloj } = lector(ruta, {
    intervaloRevisionMs: 60_000,
    abrir: async () => {
      // La versión se captura AL ABRIR: cada lector responde con la suya aunque `version` cambie después.
      const iso = version === 'A' ? 'AU' : 'NZ'
      const base = baseFalsa()
      base.get = (ip) => (ip === '1.1.1.1' ? { country: { iso_code: iso } } : REGISTROS[ip] ?? null)
      return base
    },
  })

  await geo.recargarAhora()
  version = 'B'
  await reemplazarAtomico(ruta, 'archivo-nuevo-mas-largo')

  // Antes de que pase el intervalo ni siquiera se mira el disco.
  reloj.t += 30_000
  assert.equal(geo.pais('1.1.1.1').iso, 'AU')
  await new Promise((r) => setTimeout(r, 30))
  assert.deepEqual(tipos(), ['cargada'])

  // Pasado el intervalo, esta consulta aún responde con la vieja y dispara la revisión.
  reloj.t += 31_000
  assert.equal(geo.pais('1.1.1.1').iso, 'AU')
  await geo.recargarAhora() // se une a la revisión en vuelo
  assert.equal(geo.pais('1.1.1.1').iso, 'NZ')
  assert.deepEqual(tipos(), ['cargada', 'recargada'])
})

test('un onEvento defectuoso no rompe la consulta', async () => {
  const { geo } = lector(await archivo(), {
    onEvento: () => {
      throw new Error('el log falló')
    },
  })

  await geo.recargarAhora()
  assert.equal(geo.pais('85.214.132.117').iso, 'DE')
})

// ── con la base REAL de DB-IP, si hay una a la mano ────────────────────────────
// GEOIP_DB_PATH=/ruta/a/dbip-country-lite.mmdb npm test
const RUTA_REAL = process.env.GEOIP_DB_PATH

test('base real de DB-IP: abre, valida y acierta los países de siempre', { skip: !RUTA_REAL && 'sin GEOIP_DB_PATH' }, async () => {
  const geo = crearLectorGeoip({ ruta: RUTA_REAL, intervaloRevisionMs: 1e12, maxEdadDias: 1e6 })

  await geo.recargarAhora()
  assert.equal(geo.salud().cargada, true, JSON.stringify(geo.salud().ultimoError))

  const esperados = {
    '85.214.132.117': 'DE',
    '81.2.69.142': 'GB',
    '213.4.0.1': 'ES',
    '187.190.144.173': 'MX',
    '8.8.8.8': 'US',
    '195.176.255.1': 'CH',
    '2a00:1450:4001:81d::200e': 'DE',
    '::ffff:85.214.132.117': 'DE',
  }

  for (const [ip, iso] of Object.entries(esperados)) {
    assert.equal(geo.pais(ip).iso, iso, ip)
  }

  for (const ip of ['127.0.0.1', '10.0.0.1', '::1', '169.254.1.1', '100.64.0.1']) {
    assert.equal(geo.pais(ip).estado, 'sin_dato', ip)
  }
})

test('sin la base el aviso "sin_archivo" no se repite cada minuto: una vez, y de nuevo solo cada día', async () => {
  const ruta = path.join(DIR, 'nunca-existe.mmdb')
  const { geo, eventos, reloj } = lector(ruta)

  for (let i = 0; i < 30; i++) {
    await geo.recargarAhora()
    reloj.t += 60_000 // un minuto después
  }
  assert.equal(eventos.filter((e) => e.tipo === 'sin_archivo').length, 1, '30 revisiones, un aviso')

  // Pasado un día, uno más.
  reloj.t += 24 * 3600 * 1000
  await geo.recargarAhora()
  assert.equal(eventos.filter((e) => e.tipo === 'sin_archivo').length, 2)
})
