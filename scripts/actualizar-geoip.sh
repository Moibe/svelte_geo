#!/usr/bin/env bash
#
# actualizar-geoip.sh -- actualizacion mensual de la base DB-IP "IP to Country Lite"
# (formato MMDB) en un servidor Linux. Pensado para cron. NO tiene efectos fuera de
# $GEOIP_DIR y no reinicia nada: la app detecta el archivo nuevo sola (ver
# src/lib/server/geoip.js) en cuanto cambia su firma (inodo, tamano, mtime).
#
# Fuente:   https://download.db-ip.com/free/dbip-country-lite-AAAA-MM.mmdb.gz
# Licencia: Creative Commons Attribution 4.0 (CC BY 4.0). DB-IP exige enlazar a
#           https://db-ip.com en las paginas que muestren o usen resultados de la base.
#
# QUE HACE, EN ORDEN
#   1. Toma un candado (flock, o mkdir si no hay flock): nunca corren dos a la vez.
#   2. Calcula las ediciones candidatas en UTC: la del mes actual y la del mes anterior.
#      DB-IP publica el dia 1 de cada mes (~06:30 UTC) y solo conserva el mes actual y
#      el anterior en el servidor; antes de eso el mes actual da 404 y se cae al anterior.
#   3. Si la edicion instalada (archivo .edicion) ya es igual o mas nueva que la
#      candidata, termina SIN tocar la red. Nunca baja de version (ni con --forzar, que solo
#      permite volver a descargar la MISMA edicion).
#   4. Descarga a un temporal DENTRO de $GEOIP_DIR (mismo filesystem => mv atomico).
#   5. Valida: gzip -t, tamano minimo del .gz y del .mmdb, tamano relativo al actual,
#      marcador de metadata MaxMind y tipo de base en los ultimos 4 KiB y, si hay
#      node + maxmind (o mmdblookup), apertura real + IPs de control.
#   6. Guarda copia de la actual (.prev), la reemplaza con mv -f (rename atomico) y registra
#      la edicion (.edicion) y el sha256 (.sha256) junto a ella. --estado compara ese hash
#      despues: detecta un archivo danado en el disco aunque todavia abra bien.
#
# SALIDA: 0 = instalada una edicion nueva o ya estaba al dia; 1 = error (no se instalo
# nada y debia); con --estado: 0 ok, 1 ausente/corrupta, 2 desactualizada.
#
# CRON (root en el droplet). El script es idempotente y no usa la red cuando ya esta
# al dia, por eso puede correr a diario; si un dia falla, el siguiente reintenta:
#   23 7 * * *  GEOIP_NTFY_TOPIC=<tema> bash /root/code/svelte_geo_kit/scripts/actualizar-geoip.sh >> /root/scripts/actualizar-geoip.log 2>&1
# (se invoca con "bash" para no depender del bit de ejecucion que git guarde para el .sh; la app
# se busca sola en la carpeta de arriba del script, o sea /root/code/svelte_geo_kit)
#
# VARIABLES (todas opcionales)
#   GEOIP_DB_PATH        la MISMA variable que lee la app (ver src/lib/server/pais.js): ruta completa del
#                        .mmdb. Si esta en el entorno, o en el .env de la app (GEOIP_APP_DIR/.env), de ella
#                        salen GEOIP_DIR y GEOIP_NOMBRE; asi la app y este script no pueden apuntar a
#                        archivos distintos. Sin ella, la ruta por defecto de la app:
#                        /root/data/geoip/dbip-country-lite.mmdb
#   GEOIP_DIR            destino; si se define, manda sobre GEOIP_DB_PATH [/root/data/geoip]
#   GEOIP_NOMBRE         nombre del archivo que abre la app         [dbip-country-lite.mmdb]
#   GEOIP_BASE_URL       origen                                     [https://download.db-ip.com/free]
#   GEOIP_PREFIJO        prefijo del archivo remoto                 [dbip-country-lite]
#   GEOIP_MIN_GZ         bytes minimos del .gz (hoy 4,1 MB)         [2000000]
#   GEOIP_MIN_DB         bytes minimos del .mmdb (hoy 8,3 MB)       [5000000]
#   GEOIP_MIN_RATIO      % minimo del tamano de la base actual      [80]
#   GEOIP_MIN_NODOS      node_count minimo (hoy 1.383.101)          [1000000]
#   GEOIP_TIPO           database_type esperado                     [DBIP-Country-Lite]
#   GEOIP_DIAS_GRACIA    dias del mes en que un 404 es normal       [3]
#   GEOIP_MAX_EDAD_DIAS  para --estado: pasado esto = desactualizada [45]
#   GEOIP_APP_DIR        carpeta con node_modules/maxmind           [la carpeta de arriba del script,
#                        o sea <app>/ si vive en <app>/scripts/; vacia = sin consulta con node]
#   GEOIP_NODE           binario de node (si no, PATH y luego nvm)  []
#   GEOIP_EXIGIR_CONSULTA=1  error si no hay forma de hacer la consulta de prueba [0]
#   GEOIP_CURL           binario de curl                            [curl]
#   GEOIP_REINTENTOS / GEOIP_ESPERA_REINTENTO   reintentos de curl ante timeout/5xx y segundos entre ellos [3 / 5]
#   GEOIP_ROMPE_CACHE=0  no agregar ?r=<epoch> a la URL (por defecto SI: el CDN cachea los 404 8 h) [1]
#   GEOIP_NTFY_TOPIC     tema de ntfy.sh al que avisar SOLO cuando el script falla (como hace
#                        geospace-health.sh con el suyo); vacio = no avisa             []
#   GEOIP_AHORA_YM / GEOIP_AHORA_DIA   solo para pruebas: fingen el mes (AAAA-MM) y el dia
# OPCIONES: -n|--dry-run (descarga y valida, no instala)  -f|--forzar  --estado  -h|--help

set -Eeuo pipefail
umask 022
export LC_ALL=C

# Sin "-": un GEOIP_APP_DIR definido pero VACIO desactiva la consulta de prueba con node.
# Si no esta definido, se asume que el script vive en <app>/scripts/ y la app es la carpeta de arriba.
GEOIP_APP_DIR="${GEOIP_APP_DIR-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd || true)}"

# La app abre GEOIP_DB_PATH (o su ruta por defecto). Si esa variable esta en el entorno o en el .env de la
# app, el destino sale de ELLA: el cron no carga el .env, y sin esto renovaria un archivo que la app no lee.
# El .env se LEE con grep (no se ejecuta ni se "source"-a: es un archivo de configuracion, no un script).
GEOIP_DB_PATH="${GEOIP_DB_PATH:-}"
if [ -z "$GEOIP_DB_PATH" ] && [ -n "$GEOIP_APP_DIR" ] && [ -f "$GEOIP_APP_DIR/.env" ]; then
  # (El deploy lo carga con ". ./.env": acepta "export ", sangria y un comentario al final de la linea.)
  GEOIP_DB_PATH="$(sed -n -E 's/^[[:space:]]*(export[[:space:]]+)?GEOIP_DB_PATH=//p' "$GEOIP_APP_DIR/.env" | tail -1 | sed -E 's/[[:space:]]+#.*$//' | tr -d "\"'\r" || true)"
fi
if [ -n "$GEOIP_DB_PATH" ]; then
  GEOIP_DIR="${GEOIP_DIR:-$(dirname "$GEOIP_DB_PATH")}"
  GEOIP_NOMBRE="${GEOIP_NOMBRE:-$(basename "$GEOIP_DB_PATH")}"
fi

GEOIP_DIR="${GEOIP_DIR:-/root/data/geoip}"
GEOIP_NOMBRE="${GEOIP_NOMBRE:-dbip-country-lite.mmdb}"
GEOIP_BASE_URL="${GEOIP_BASE_URL:-https://download.db-ip.com/free}"
GEOIP_PREFIJO="${GEOIP_PREFIJO:-dbip-country-lite}"
GEOIP_MIN_GZ="${GEOIP_MIN_GZ:-2000000}"
GEOIP_MIN_DB="${GEOIP_MIN_DB:-5000000}"
GEOIP_MIN_RATIO="${GEOIP_MIN_RATIO:-80}"
GEOIP_MIN_NODOS="${GEOIP_MIN_NODOS:-1000000}"
GEOIP_TIPO="${GEOIP_TIPO:-DBIP-Country-Lite}"
GEOIP_DIAS_GRACIA="${GEOIP_DIAS_GRACIA:-3}"
GEOIP_MAX_EDAD_DIAS="${GEOIP_MAX_EDAD_DIAS:-45}"
GEOIP_NODE="${GEOIP_NODE:-}"
GEOIP_EXIGIR_CONSULTA="${GEOIP_EXIGIR_CONSULTA:-0}"
GEOIP_CURL="${GEOIP_CURL:-curl}"
GEOIP_ROMPE_CACHE="${GEOIP_ROMPE_CACHE:-1}"
GEOIP_NTFY_TOPIC="${GEOIP_NTFY_TOPIC:-}"
GEOIP_REINTENTOS="${GEOIP_REINTENTOS:-3}"
GEOIP_ESPERA_REINTENTO="${GEOIP_ESPERA_REINTENTO:-5}"
GEOIP_AHORA_YM="${GEOIP_AHORA_YM:-}"
GEOIP_AHORA_DIA="${GEOIP_AHORA_DIA:-}"

DRY_RUN=0
FORZAR=0
MODO=actualizar
TMP=""
LOCK_DIR=""
DEST=""

# ----------------------------------------------------------------------------- log
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { printf '%s GEOIP %s\n' "$(ts)" "$*"; }
warn() { printf '%s GEOIP AVISO %s\n' "$(ts)" "$*" >&2; }
die() {
  printf '%s GEOIP ERROR %s\n' "$(ts)" "$*" >&2
  exit 1
}

ayuda() {
  sed -n '2,/^set -Eeuo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

# ------------------------------------------------------------------------ avisos
# Aviso por ntfy SOLO cuando hay algo que atender (no en --estado ni en --dry-run, ni sin tema).
# Nunca puede cambiar el codigo de salida ni romper nada: si ntfy no responde, se ignora.
avisar_ntfy() {
  local titulo="$1" mensaje="$2"
  [ -n "$GEOIP_NTFY_TOPIC" ] && [ "$MODO" = actualizar ] && [ "$DRY_RUN" != 1 ] || return 0

  "$GEOIP_CURL" -fsS -m 15 -H "Title: $titulo" -d "$(hostname): $mensaje" \
    "https://ntfy.sh/$GEOIP_NTFY_TOPIC" >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------ limpieza
limpiar() {
  local rc=$?
  if [ -n "$TMP" ] && [ -d "$TMP" ]; then rm -rf "$TMP"; fi
  if [ -n "$LOCK_DIR" ] && [ -d "$LOCK_DIR" ]; then rmdir "$LOCK_DIR" 2>/dev/null || true; fi

  if [ "$rc" -ne 0 ]; then
    avisar_ntfy "geoip: fallo la actualizacion" "actualizar-geoip.sh termino con codigo $rc. La base vigente no se toco; ver el .log."
  fi
}

tomar_candado() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$GEOIP_DIR/.actualizar.lock"
    flock -n 9 || {
      log "otra instancia esta corriendo; salgo sin hacer nada"
      exit 0
    }
  else
    # Sin flock (macOS, Git Bash): mkdir es atomico. Un candado de mas de 2 h es de una
    # corrida que murio sin limpiar (kill -9, corte de luz) y se retira.
    LOCK_DIR="$GEOIP_DIR/.actualizar.lock.d"
    if [ -d "$LOCK_DIR" ] && [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
      warn "candado huerfano (mas de 2 h), lo retiro: $LOCK_DIR"
      rmdir "$LOCK_DIR" 2>/dev/null || true
    fi
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
      LOCK_DIR="" # no es nuestro: que limpiar() no lo borre
      log "otra instancia esta corriendo; salgo sin hacer nada"
      exit 0
    fi
  fi
}

# ------------------------------------------------------------------------- meses
# Indice entero de un mes "AAAA-MM" para poder comparar sin depender del locale.
ym_a_indice() { echo $((10#${1%-*} * 12 + 10#${1#*-})); }

# Mes anterior sin GNU date (date -d "-1 month" falla el dia 31): aritmetica pura.
mes_anterior() {
  local y="${1%-*}" m="${1#*-}"
  m=$((10#$m - 1))
  if [ "$m" -eq 0 ]; then
    m=12
    y=$((10#$y - 1))
  fi
  printf '%04d-%02d' "$((10#$y))" "$m"
}

ym_actual() {
  if [ -n "$GEOIP_AHORA_YM" ]; then printf '%s' "$GEOIP_AHORA_YM"; else date -u +%Y-%m; fi
}

dia_actual() {
  if [ -n "$GEOIP_AHORA_DIA" ]; then echo $((10#$GEOIP_AHORA_DIA)); else echo $((10#$(date -u +%d))); fi
}

es_ym() { [[ "$1" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]]; }

# ---------------------------------------------------------------------- utilidades
bytes_de() { wc -c <"$1" | tr -d ' '; }

mtime_de() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

buscar_node() {
  if [ -n "$GEOIP_NODE" ] && [ -x "$GEOIP_NODE" ]; then
    echo "$GEOIP_NODE"
    return 0
  fi
  # nvm primero: es el node con el que corre la app (el deploy del proyecto lo carga igual). Una shell
  # no interactiva (cron, ssh) no lo tiene en el PATH, y bajo cron el PATH reducido puede traer otro
  # node mas viejo (/usr/bin/node de apt) que ni siquiera entiende la sintaxis de la consulta de prueba.
  local base="${NVM_DIR:-$HOME/.nvm}/versions/node" cand
  if [ -d "$base" ]; then
    cand="$(ls -1d "$base"/v*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
    if [ -n "$cand" ]; then
      echo "$cand"
      return 0
    fi
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  return 1
}

# Consulta de prueba con node + maxmind (el mismo lector que usa la app).
# Imprime una linea de resumen. Devuelve 0 = pasa; 3 = la base NO pasa; 4 = no se pudo
# cargar maxmind (p. ej. node_modules a medio reinstalar durante un deploy): eso no es
# culpa de la base y no debe hacer que se rechace una descarga buena.
verificar_con_node() {
  local nodebin="$1" db="$2"
  (
    cd "$GEOIP_APP_DIR"
    "$nodebin" -e '
      let mm;
      try { mm = require("maxmind"); } catch (e) { console.error("no se pudo cargar maxmind: " + e.message); process.exit(4); }
      const { open, validate } = mm;
      const [ruta, tipo, minNodos] = process.argv.slice(1);
      (async () => {
        const r = await open(ruta);
        const m = r.metadata;
        const fallos = [];
        if (!new RegExp(tipo).test(String(m.databaseType))) fallos.push("database_type=" + m.databaseType);
        if (m.ipVersion !== 6) fallos.push("ip_version=" + m.ipVersion);
        if (!(m.nodeCount >= Number(minNodos))) fallos.push("node_count=" + m.nodeCount);
        const canarios = [["8.8.8.8", "US"], ["85.214.132.117", "DE"], ["81.2.69.142", "GB"], ["213.4.0.1", "ES"]];
        let ok = 0;
        for (const [ip, esperado] of canarios) {
          if (validate(ip) && r.get(ip)?.country?.iso_code === esperado) ok++;
        }
        if (ok < 3) fallos.push("IPs de control " + ok + "/4");
        if (fallos.length) { console.error(fallos.join("; ")); process.exit(3); }
        console.log("tipo=" + m.databaseType + " nodos=" + m.nodeCount + " build=" + m.buildEpoch.toISOString() + " control=" + ok + "/4");
      })().catch((e) => { console.error("no se pudo abrir: " + e.message); process.exit(3); });
    ' "$db" "$GEOIP_TIPO" "$GEOIP_MIN_NODOS"
  )
}

verificar_con_mmdblookup() {
  local db="$1" ok=0 par ip esperado salida
  for par in "8.8.8.8 US" "85.214.132.117 DE" "81.2.69.142 GB" "213.4.0.1 ES"; do
    ip="${par% *}"
    esperado="${par#* }"
    salida="$(mmdblookup --file "$db" --ip "$ip" country iso_code 2>/dev/null | tr -d '\n' || true)"
    case "$salida" in *"\"$esperado\""*) ok=$((ok + 1)) ;; esac
  done
  [ "$ok" -ge 3 ]
}

# Comprobaciones que no necesitan node: marcador de metadata y tipo de base. Ambos
# cadenas quedan a unos cientos de bytes del final del archivo (281 y 177 bytes en la
# edicion 2026-10), asi que bastan los ultimos 4 KiB.
verificar_estructura() {
  local db="$1"
  tail -c 4096 "$db" | grep -a -q 'MaxMind\.com' || {
    echo "no tiene el marcador de metadata MaxMind (no parece un MMDB)"
    return 1
  }
  tail -c 4096 "$db" | grep -a -q -F "$GEOIP_TIPO" || {
    echo "la metadata no menciona el tipo esperado '$GEOIP_TIPO'"
    return 1
  }
  return 0
}

# Abre la base con un lector real y consulta IPs de control. Imprime UNA linea por stdout
# (el resumen si pasa, el motivo si falla). Devuelve 0 = paso; 1 = fallo; 5 = no hay forma
# de hacer la consulta (ni node+maxmind ni mmdblookup).
consulta_de_prueba() {
  local db="$1" nodebin salida rc

  if [ -n "$GEOIP_APP_DIR" ] && [ -d "$GEOIP_APP_DIR/node_modules/maxmind" ] && nodebin="$(buscar_node)"; then
    rc=0
    salida="$(verificar_con_node "$nodebin" "$db" 2>&1)" || rc=$?
    case "$rc" in
      0)
        echo "node+maxmind: $salida"
        return 0
        ;;
      3)
        # La UNICA señal de que la BASE esta mala: node la abrio y no paso las comprobaciones.
        echo "la consulta de prueba fallo: $salida"
        return 1
        ;;
      *)
        # Cualquier otro codigo (4 = sin maxmind, 1 = excepcion o sintaxis que ese node no entiende,
        # 127 = no se pudo ejecutar, 137 = sin memoria...) es del ENTORNO de node, no de la descarga:
        # no se rechaza una edicion buena por eso. Se intenta con otro metodo.
        warn "la consulta con node no se pudo hacer (codigo $rc): $salida (se intenta con otro metodo)"
        ;;
    esac
  fi

  if command -v mmdblookup >/dev/null 2>&1; then
    if verificar_con_mmdblookup "$db"; then
      echo "mmdblookup: al menos 3 de 4 IPs de control coinciden"
      return 0
    fi
    echo "la consulta de prueba con mmdblookup fallo"
    return 1
  fi
  return 5
}

# Verificacion completa de un .mmdb ya descomprimido. Imprime el motivo si falla.
verificar_base() {
  local db="$1" rc=0 salida

  verificar_estructura "$db" || return 1

  salida="$(consulta_de_prueba "$db")" || rc=$?
  case "$rc" in
    0)
      log "consulta de prueba OK ($salida)" >&2
      return 0
      ;;
    5)
      if [ "$GEOIP_EXIGIR_CONSULTA" = 1 ]; then
        echo "no hay forma de hacer la consulta de prueba (GEOIP_APP_DIR con node_modules/maxmind, o mmdblookup) y GEOIP_EXIGIR_CONSULTA=1"
        return 1
      fi
      warn "sin consulta de prueba (no hay GEOIP_APP_DIR con node_modules/maxmind ni mmdblookup): solo se comprobo la estructura"
      return 0
      ;;
    *)
      echo "$salida"
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------- descarga
# Descarga y valida UNA edicion. Deja el resultado en $TMP/db.mmdb.
# Devuelve: 0 = lista para instalar; 44 = 404 (aun no publicada); 1 = fallo (ya registrado).
bajar_y_validar() {
  local ym="$1"
  local archivo="$GEOIP_PREFIJO-$ym.mmdb.gz"
  local url="$GEOIP_BASE_URL/$archivo"
  local gz="$TMP/$archivo" code motivo tam_gz tam_db tam_actual
  # El CDN de DB-IP (Cloudflare) cachea tambien los 404 durante 8 h (Cache-Control:
  # max-age=28800, comprobado el 2026-10-13): si algo pidio el mes nuevo antes de que
  # DB-IP lo publicara (~06:30 UTC del dia 1), el 404 puede seguir saliendo hasta 8 h
  # DESPUES de publicada la edicion. Un parametro distinto da otra clave de cache y la
  # peticion llega al origen; el archivo estatico ignora el parametro.
  if [ "$GEOIP_ROMPE_CACHE" = 1 ]; then url="$url?r=$(date -u +%s)"; fi

  rm -f "$gz" "$TMP/db.mmdb"
  # --fail NO se usa a proposito: se necesita el codigo HTTP para distinguir 404 (aun no
  # publicada, se cae al mes anterior) de un error de verdad. --retry cubre timeouts y 5xx.
  code="$("$GEOIP_CURL" -sS -L --connect-timeout 20 --max-time 600 --retry "$GEOIP_REINTENTOS" --retry-delay "$GEOIP_ESPERA_REINTENTO" \
    -o "$gz" -w '%{http_code}' "$url" 2>"$TMP/curl.err")" || code="000"

  case "$code" in
    200) ;;
    404)
      log "la edicion $ym todavia no esta publicada (HTTP 404): $url"
      return 44
      ;;
    *)
      warn "edicion $ym: HTTP $code al descargar $url ($(tr -d '\n' <"$TMP/curl.err" 2>/dev/null | cut -c1-200))"
      return 1
      ;;
  esac

  tam_gz="$(bytes_de "$gz")"
  if [ "$tam_gz" -lt "$GEOIP_MIN_GZ" ]; then
    warn "edicion $ym rechazada: el .gz pesa $tam_gz bytes (minimo $GEOIP_MIN_GZ)"
    return 1
  fi

  # Por stdin (<): asi el mensaje de gzip dice "stdin: unexpected end of file" y no una ruta larga.
  if ! gzip -t <"$gz" 2>"$TMP/gzip.err"; then
    warn "edicion $ym rechazada: gzip -t fallo ($(tr -d '\n' <"$TMP/gzip.err" | cut -c1-200)); descarga corrupta o pagina de error"
    return 1
  fi

  if ! gzip -dc <"$gz" >"$TMP/db.mmdb" 2>"$TMP/gzip.err"; then
    warn "edicion $ym rechazada: no se pudo descomprimir ($(tr -d '\n' <"$TMP/gzip.err" | cut -c1-200))"
    return 1
  fi

  tam_db="$(bytes_de "$TMP/db.mmdb")"
  if [ "$tam_db" -lt "$GEOIP_MIN_DB" ]; then
    warn "edicion $ym rechazada: el .mmdb pesa $tam_db bytes (minimo $GEOIP_MIN_DB)"
    return 1
  fi

  # Una base nueva mucho mas chica que la vigente es sospechosa (build roto, rango recortado).
  if [ -f "$DEST" ] && base_instalada_sirve; then
    tam_actual="$(bytes_de "$DEST")"
    if [ $((tam_db * 100)) -lt $((tam_actual * GEOIP_MIN_RATIO)) ]; then
      warn "edicion $ym rechazada: pesa $tam_db bytes y la instalada $tam_actual (menos del $GEOIP_MIN_RATIO %)"
      return 1
    fi
  fi

  if ! motivo="$(verificar_base "$TMP/db.mmdb")"; then
    warn "edicion $ym rechazada: $motivo"
    return 1
  fi

  log "edicion $ym descargada y verificada: gz=$tam_gz bytes, mmdb=$tam_db bytes"
  return 0
}

# La base instalada existe, pesa lo que debe y tiene la estructura de un MMDB del tipo esperado. Es
# lo que decide si se da por buena (y por "al dia"), no solo que haya un archivo con el nombre.
base_instalada_sirve() {
  [ -f "$DEST" ] || return 1
  [ "$(bytes_de "$DEST")" -ge "$GEOIP_MIN_DB" ] || return 1
  verificar_estructura "$DEST" >/dev/null 2>&1 || return 1

  # El hash que se registro al instalar: un archivo danado en el disco que conserva su tamano y su
  # estructura (bytes cambiados en medio del arbol) pasa lo anterior y daria paises erroneos hasta el
  # mes siguiente. Comparar cuesta ~20 ms. Sin .sha256 (instalada antes de que existiera) no se exige.
  if [ -f "$DEST.sha256" ] && command -v sha256sum >/dev/null 2>&1; then
    (cd "$GEOIP_DIR" && sha256sum -c "$GEOIP_NOMBRE.sha256" >/dev/null 2>&1) || return 1
  fi

  return 0
}

instalar() {
  local ym="$1" tam sha
  chmod 0644 "$TMP/db.mmdb"
  tam="$(bytes_de "$TMP/db.mmdb")"
  sha="$( (sha256sum "$TMP/db.mmdb" 2>/dev/null || shasum -a 256 "$TMP/db.mmdb" 2>/dev/null || echo "sin_sha256") | cut -d' ' -f1)"

  if [ "$DRY_RUN" = 1 ]; then
    log "DRY-RUN: edicion $ym lista (sha256=$sha), NO se instala"
    return 0
  fi

  if base_instalada_sirve; then
    # Ultima copia buena conocida, para volver atras a mano si hiciera falta. Una base que no pasa las
    # comprobaciones NO se guarda como "buena": pisaria la ultima copia que si lo era.
    cp -p "$DEST" "$DEST.prev" 2>/dev/null || warn "no pude guardar la copia $DEST.prev"
  fi
  # rename(2) dentro del mismo filesystem: el lector ve la base vieja o la nueva, nunca a medias.
  mv -f "$TMP/db.mmdb" "$DEST"
  printf '%s\n' "$ym" >"$DEST.edicion.tmp"
  mv -f "$DEST.edicion.tmp" "$DEST.edicion"
  # Hash registrado al instalar (formato de sha256sum -c): --estado lo compara despues y
  # detecta un archivo alterado o danado en el disco aunque siga abriendo bien.
  printf '%s  %s\n' "$sha" "$GEOIP_NOMBRE" >"$DEST.sha256.tmp"
  mv -f "$DEST.sha256.tmp" "$DEST.sha256"
  log "INSTALADA edicion=$ym anterior=${INSTALADA:-ninguna} bytes=$tam sha256=$sha destino=$DEST"
}

# ------------------------------------------------------------------------ --estado
estado() {
  local ed="" tam mt ahora edad resumen rc=0 rc_consulta=0 base fuente inicio
  if [ ! -f "$DEST" ]; then
    echo "ESTADO ausente: no existe $DEST"
    return 1
  fi
  [ -f "$DEST.edicion" ] && ed="$(tr -d ' \t\r\n' <"$DEST.edicion")"
  tam="$(bytes_de "$DEST")"
  mt="$(mtime_de "$DEST")"
  ahora="$(date -u +%s)"
  # La edad se cuenta desde el dia 1 de la EDICION instalada (la fecha real de los datos);
  # el mtime solo se usa si falta .edicion, porque restaurar un respaldo lo reinicia.
  base="$mt"
  fuente="mtime"
  if es_ym "$ed" && inicio="$(date -u -d "$ed-01" +%s 2>/dev/null)"; then
    base="$inicio"
    fuente="edicion"
  fi
  edad=$(((ahora - base) / 86400))
  [ "$edad" -lt 0 ] && edad=0
  echo "ESTADO archivo=$DEST bytes=$tam edicion=${ed:-desconocida} edad_dias=$edad (segun $fuente)"

  if ! resumen="$(verificar_estructura "$DEST")"; then
    echo "ESTADO CORRUPTA: $resumen"
    return 1
  fi
  if [ -f "$DEST.sha256" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      if (cd "$GEOIP_DIR" && sha256sum -c "$GEOIP_NOMBRE.sha256" >/dev/null 2>&1); then
        echo "ESTADO sha256 coincide con el registrado al instalar"
      else
        echo "ESTADO CORRUPTA: el sha256 del archivo NO coincide con el registrado al instalar (disco danado o archivo alterado)"
        return 1
      fi
    else
      echo "ESTADO sha256 no verificado (no hay sha256sum)"
    fi
  fi
  resumen="$(consulta_de_prueba "$DEST")" || rc_consulta=$?
  case "$rc_consulta" in
    0) echo "ESTADO consulta OK: $resumen" ;;
    5) echo "ESTADO consulta no disponible (sin GEOIP_APP_DIR con maxmind ni mmdblookup): solo se comprobo la estructura" ;;
    *)
      echo "ESTADO CORRUPTA: $resumen"
      return 1
      ;;
  esac
  if [ "$edad" -gt "$GEOIP_MAX_EDAD_DIAS" ]; then
    echo "ESTADO DESACTUALIZADA: $edad dias (limite $GEOIP_MAX_EDAD_DIAS)"
    rc=2
  fi
  return "$rc"
}

# ------------------------------------------------------------------------- principal
main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      -n | --dry-run) DRY_RUN=1 ;;
      -f | --forzar) FORZAR=1 ;;
      --estado) MODO=estado ;;
      -h | --help)
        ayuda
        exit 0
        ;;
      *) die "argumento desconocido: $1 (usa --help)" ;;
    esac
    shift
  done

  DEST="$GEOIP_DIR/$GEOIP_NOMBRE"

  # --estado solo lee: no crea la carpeta ni toma el candado.
  if [ "$MODO" = estado ]; then
    estado
    exit $?
  fi

  # La limpieza (y el aviso de fallo) se arma ANTES de lo que puede fallar.
  trap limpiar EXIT

  mkdir -p "$GEOIP_DIR" || die "no pude crear $GEOIP_DIR"
  [ -w "$GEOIP_DIR" ] || die "no puedo escribir en $GEOIP_DIR"

  tomar_candado
  # Restos de corridas que murieron sin limpiar (mas de 2 h): se barren con el candado ya tomado.
  find "$GEOIP_DIR" -maxdepth 1 -name '.tmp.*' -mmin +120 -exec rm -rf {} + 2>/dev/null || true

  TMP="$(mktemp -d "$GEOIP_DIR/.tmp.XXXXXX")" || die "no pude crear un temporal en $GEOIP_DIR"

  # Espacio: .gz (~4 MB) + .mmdb (~8 MB) + la copia .prev (~8 MB). Se pide holgura (40 MB).
  local libre_kb
  libre_kb="$(df -Pk "$GEOIP_DIR" 2>/dev/null | tail -1 | tr -s ' ' | cut -d' ' -f4 || true)"
  if [[ "$libre_kb" =~ ^[0-9]+$ ]] && [ "$libre_kb" -lt 40000 ]; then
    die "poco espacio en $GEOIP_DIR: ${libre_kb} KB libres (se piden 40000)"
  fi

  INSTALADA=""
  if [ -f "$DEST.edicion" ]; then
    INSTALADA="$(tr -d ' \t\r\n' <"$DEST.edicion")"
    es_ym "$INSTALADA" || {
      warn "el archivo $DEST.edicion tiene un valor raro ('$INSTALADA'); se ignora"
      INSTALADA=""
    }
  fi
  # Sin base —o con una que no pasa las comprobaciones (truncada, danada)— no hay edicion instalada,
  # diga lo que diga el archivo .edicion: se reinstala aunque el mes sea el mismo. Antes un archivo
  # danado se daba por "al dia" y no se reparaba hasta el mes siguiente.
  if ! base_instalada_sirve; then
    [ -f "$DEST" ] && warn "la base instalada no pasa las comprobaciones de tamano y estructura: se vuelve a descargar"
    INSTALADA=""
  fi

  local actual anterior candidatas ym rc
  actual="$(ym_actual)"
  es_ym "$actual" || die "mes actual invalido: '$actual'"
  anterior="$(mes_anterior "$actual")"
  candidatas="$actual $anterior"

  local hubo_error=0 instalada_ahora=0 al_dia=0 actual_404=0
  for ym in $candidatas; do
    # Una edicion MAS VIEJA que la instalada nunca se instala (tampoco con --forzar); una IGUAL solo con
    # --forzar (volver a bajar la misma, para repararla o por prueba).
    if [ -n "$INSTALADA" ]; then
      local cand inst
      cand="$(ym_a_indice "$ym")"
      inst="$(ym_a_indice "$INSTALADA")"
      if [ "$cand" -lt "$inst" ] || { [ "$cand" -eq "$inst" ] && [ "$FORZAR" != 1 ]; }; then
        log "al dia: instalada=$INSTALADA, la edicion $ym no es mas nueva"
        al_dia=1
        break
      fi
    fi

    rc=0
    bajar_y_validar "$ym" || rc=$?
    if [ "$rc" -eq 0 ]; then
      instalar "$ym"
      instalada_ahora=1
      break
    elif [ "$rc" -eq 44 ]; then
      [ "$ym" = "$actual" ] && actual_404=1
    else
      hubo_error=1
    fi
  done

  if [ "$actual_404" -eq 1 ]; then
    if [ "$(dia_actual)" -le "$GEOIP_DIAS_GRACIA" ]; then
      log "la edicion $actual aun no esta publicada (dia $(dia_actual) del mes; DB-IP publica el 1 hacia las 06:30 UTC): normal"
    else
      warn "la edicion $actual sigue sin publicarse el dia $(dia_actual) del mes (pasaron mas de $GEOIP_DIAS_GRACIA): revisar https://db-ip.com/db/download/ip-to-country-lite"
      # Sale con 0 (la base vigente sigue sirviendo), asi que sin esto nadie se enteraria. Sin estado
      # que recordar: solo los dias 4, 11, 18 y 25, o sea como mucho una vez por semana.
      case "$(dia_actual)" in
        4 | 11 | 18 | 25) avisar_ntfy "geoip: la edicion $actual no se publica" "DB-IP no publico la edicion $actual (hoy es el dia $(dia_actual)); la base instalada es ${INSTALADA:-ninguna}. Revisar https://db-ip.com/db/download/ip-to-country-lite" ;;
      esac
    fi
  fi

  if [ "$hubo_error" -eq 1 ]; then
    if [ "$instalada_ahora" -eq 1 ]; then
      warn "se instalo una edicion, pero otra candidata fallo (ver arriba)"
      exit 0
    fi
    die "no se pudo obtener una edicion valida (instalada: ${INSTALADA:-ninguna}); la base actual NO se toco"
  fi

  if [ "$instalada_ahora" -eq 0 ] && [ "$al_dia" -eq 0 ]; then
    # Nada que instalar y nada instalado: primera vez y ninguna edicion disponible.
    [ -f "$DEST" ] || die "no hay base instalada y ninguna edicion candidata esta disponible ($candidatas)"
  fi
  exit 0
}

main "$@"
