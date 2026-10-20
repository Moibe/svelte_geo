# Aviso de cookies y consentimiento

Qué hace el sitio para respetar el consentimiento de cookies en el **Espacio
Económico Europeo (UE + Islandia, Liechtenstein y Noruega), el Reino Unido y
Suiza**, cómo está hecho y qué hay que mantener. Se escribió junto con el código
(`src/lib/consentimiento*.js`, `CookieBanner.svelte`, `hooks.server.js`); si algo
de aquí deja de ser cierto, el código manda y este archivo está mal.

> Esto no es asesoría legal. Las decisiones salen de la normativa y las guías
> leídas al construirlo (ePrivacy/RGPD, ICO y la ley británica DUAA 2025, CNIL,
> EDPB, la política de consentimiento de Google); conviene que lo revise un abogado
> antes de apoyarse en ello.

## Resumen en cinco líneas

1. Un visitante de la región regulada ve un aviso con **Aceptar todo / Rechazar
   todo / Configurar** (los dos primeros idénticos). Nada viene marcado.
2. **Hasta que elija, no se carga ni un byte de Google** (Tag Manager, Analytics,
   Ads), no se registra su actividad en el servidor propio y no se guarda en su
   dispositivo nada que sea de medición.
3. Su elección se recuerda **180 días** en una cookie propia (`cookie_consent`) y se
   cambia desde **«Preferencias de cookies»**, en el pie de cada página.
4. Quien está **fuera** de la región ve el sitio **como siempre**: Google se carga al
   abrir la página, sin aviso.
5. La región se decide con la **IP** (base local, nada sale a ningún tercero) **o** la
   **zona horaria** del navegador: basta una señal de región regulada. Si no se puede
   saber, se pide consentimiento.

## Cómo se decide quién ve el aviso

`requiereConsentimiento(porIp, porZona, hayDecisionGuardada)` en `src/lib/consentimiento.js`
combina dos señales, cada una `'si' | 'no' | '?'`, y la elección ya guardada:

| IP | Zona horaria | ¿Se pide consentimiento? | Ejemplo |
| --- | --- | --- | --- |
| **cualquiera** | **cualquiera, con una elección guardada y vigente** | **sí: se respeta** | alemán que rechazó y vuelve por una VPN de EE. UU. con el navegador en UTC |
| sí | cualquiera | **sí** | alemán con el reloj mal puesto |
| cualquiera | sí | **sí** | VPN de EE. UU. con el equipo en `Europe/Berlin` |
| no | no / ? | no | México |
| ? | no | no | IP desconocida pero zona de América |
| ? | ? | **sí** (por si acaso) | IP desconocida y navegador en UTC |

- **La IP** la resuelve el servidor (`hooks.server.js` → `src/lib/server/pais.js`) con la
  base **DB-IP «IP to Country Lite»**, leída del disco: ~1 µs por consulta y la IP no sale
  de la máquina. La IP real llega por `X-Forwarded-For` (`ADDRESS_HEADER` +
  `XFF_DEPTH=1`, ya configurados en el droplet).
- **La zona horaria** la lee el propio script de arranque en el navegador
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`): `Europe/*` y los territorios de
  la UE (Canarias, Madeira, Azores, Ceuta, Reunión, Guayana…) cuentan como región
  regulada; `America/*`, `Asia/*`, etc. dicen «fuera»; UTC o vacío (navegadores que
  protegen la huella digital) no dicen nada. **Chipre** es la excepción que ya mordió: es de
  la UE pero su zona es `Asia/Nicosia` (los navegadores canonizan `Europe/Nicosia` a eso), así
  que está en `ZONAS_REGULADAS` aparte. `consentimiento.test.js` recorre las zonas IANA de
  TODOS los países de `PAISES_REGULADOS` (y cómo las canoniza el navegador) para que no
  falte ningún otro.
- **Los países** (`PAISES_REGULADOS`): UE-27, Islandia, Liechtenstein, Noruega, Reino Unido,
  Suiza, y dependencias y regiones ultraperiféricas que aplican las mismas reglas
  (Gibraltar, Jersey, Guernsey, Isla de Man, Åland, Svalbard, Guayana Francesa,
  Guadalupe, Martinica, Reunión, Mayotte, San Martín). Se pasó de más a propósito: un
  aviso de sobra es barato; uno de menos no. **No se usa** `is_in_european_union` de la
  base ni el continente: el primero es exactamente la UE-27 (sin Reino Unido ni Suiza)
  y el segundo mete a Rusia o Ucrania y deja fuera a las regiones francesas de ultramar.
- **El Reino Unido** se trata igual que la UE: la excepción estadística de la DUAA 2025
  no cubre una analítica enlazada a Google Ads ni el registro por visitante.
- **Una elección guardada y vigente manda sobre las dos señales.** Quien ya contestó (p. ej.
  «Rechazar todo» desde Alemania) y vuelve con una IP o una zona que dicen «fuera» (VPN, red
  móvil mal ubicada, navegador que esconde la zona) conserva su elección: Google no se carga, se
  borra lo que dejó y el pie sigue ofreciendo «Preferencias de cookies». Una señal más débil no
  puede anular una respuesta explícita (el script de arranque lee la cookie ANTES de decidir la
  región; el `<noscript>` de GTM tampoco se manda a quien tiene una elección guardada).
- **Reloj mal puesto**: la fecha de la elección se acepta hasta `TOLERANCIA_RELOJ_SEGUNDOS`
  (una semana) por delante del reloj de quien la lee; sin margen, un equipo con el reloj atrasado
  descartaba la cookie que renueva el servidor y volvía a preguntar en cada visita.
- **Navegador que no guarda cookies** («bloquear todas las cookies»): `aplicar()` comprueba que la
  cookie quedó (`sinCookies`). Si no, la elección se obedece en esa página pero no hay cookie contra
  la que contrastarla: no se toma por una retirada ni se recarga la página (antes cada «Aceptar»
  recargaba y el aviso reaparecía). En la visita siguiente se vuelve a preguntar: no hay dónde recordarla.
- **Ver el aviso desde cualquier país**: abrir la página con `?cookies=preview`
  (`https://geoservices.space/es?cookies=preview`). Solo cambia lo que ve quien lo escribe.

El servidor pinta el aviso **ya en el HTML** cuando la IP es de la región (no aparece
unos instantes después). Cuando solo la zona horaria lo delata, aparece al montar la
página. `Cache-Control: private` en el HTML: la página depende de la IP de quien la pide.
**Límite conocido**: esa cabecera protege a las cachés compartidas, no a la del propio
navegador. Quien abre la página desde una IP de fuera de la región y vuelve a ella con
«Atrás» desde una IP de la región (cambió de red) recibe la copia vieja, con la decisión
por IP de entonces; solo la zona horaria puede corregirla. Es inherente a decidir en el
servidor; el remedio (`no-store`) costaría el historial rápido del navegador.

## Qué pasa en cada caso (región regulada)

| Situación | Consent Mode (`gtag('consent', …)`) | Google Tag Manager | Registro propio (`/track`) |
| --- | --- | --- | --- |
| Sin elección | `default`: todo `denied` salvo `functionality_storage` y `security_storage` | **no se carga** | no se registra nada |
| Rechazar todo | `update`: todo `denied` | no se carga | no |
| Solo analítica | `update`: `analytics_storage` `granted` | se carga | sí, **sin** `gclid`/`fbclid` |
| Solo publicidad | `update`: `ad_storage`, `ad_user_data`, `ad_personalization` `granted` | se carga | no |
| Aceptar todo | `update`: todo `granted` | se carga | sí |
| Elección guardada al recargar | `default` (denegado) → `update` (lo elegido) → recién entonces el snippet de GTM | según la elección | según la elección |
| Retirar un permiso | `update` + **se borran las cookies de Google de esa categoría** (y, si se retira solo la publicidad, el `gclid`/`fbclid` que ya estaba en `conversion_context`) + se recarga la página si Google ya estaba cargado. Con el **mapa pagado** en pantalla la recarga vuelve a `?payment=success` (`urlAlRecargar`) para no perderlo | — | — |

Fuera de la región: `default` con todo `granted` y GTM se carga de inmediato, como antes.

**El orden es lo importante** (probado con el contenedor real, ver «Pruebas»): primero
`default`, luego `update` (si ya había elección) y **después** `gtm.js`. Así todos los
hits de Google salen con el estado definitivo. La función `gtag` del script de arranque
empuja el objeto `arguments`, no un arreglo: con un arreglo Google ignora el `default` **en
silencio** (hay una prueba que lo cuida). `gtag` NO es global a propósito.

**Modo básico, no avanzado**: GTM no se carga hasta que haya algún permiso. El modo
avanzado (cargarlo con todo denegado) manda a Google la URL, el título y los datos de las
compras antes de consentir. Se pierde el modelado de Google (no se alcanzan sus umbrales
con este tráfico) a cambio de cero tráfico a Google sin permiso.

**Varias pestañas**: la elección de cada página es una copia en memoria; la **cookie** es la
verdad. `window.__consent.sincronizar()` la vuelve a leer y, si cambió, aplica la diferencia
(Consent Mode, borrado, carga de Google, recarga si se retiró algo y Google estaba cargado). Se
llama cuando otra pestaña avisa (`BroadcastChannel`), al volver a la pestaña
(`visibilitychange`, `focus`), al restaurarla del historial (`pageshow`) y **antes de cada
cosa que pide permiso** (`estadoDelNavegador()`): una pestaña vieja no puede registrar
actividad ni guardar nada con un permiso que se retiró en otra. Y `aplicar()` borra lo de
Google de **toda** categoría que no quede concedida, no solo de la que esa página tenía.

**Retirar un permiso no basta con `update denied`**: Google no borra sus cookies y, con
sus etiquetas ya cargadas, sigue mandando señales sin cookies. Por eso `aplicar()` borra
`_ga`, `_ga_*`, `_gid`, `_gat*` (analítica) o `_gcl_*` (con comodín: el `gtag.js` real arma
`_gcl_au`, `_gcl_aw`, `_gcl_ag`, `_gcl_gp`…), `_gac_*`, `__gads`, `__gpi`, `FPLC`, `FPGSID` y la
clave de localStorage `_gcl_ls` (publicidad) en el host y en el dominio padre, y la página se
**recarga** (`necesitaRecarga`; esa recarga no se anota como actividad: `recarga_por_consentimiento`
en `sessionStorage`). Lo mismo se hace **al cargar** cada
página para lo que no tenga permiso: así desaparece lo que Google dejó de antes de que
existiera el aviso.

## Qué se condiciona (y qué no)

| Qué | Categoría | Sin permiso |
| --- | --- | --- |
| Google Tag Manager, Analytics, Ads (`gtm.js`, `gtag/js` y los pings) | analítica **o** publicidad | no se descargan |
| `<noscript>` de GTM | — | solo se emite si la IP es **seguramente** de fuera de la región (sin JS no hay cómo pedir permiso) |
| Registro propio `logConversion` → `/track/api/map-interactions` (15 tipos de evento) | analítica | no se manda **nada** (ni a la consola) |
| `gclid` / `fbclid` dentro de ese registro y de `conversion_context` | publicidad | se omiten (en el dispositivo y en el registro) |
| `getGAClientId()` (lee `_ga`) | analítica | devuelve `null` (no se lee la cookie) |
| localStorage `last_phone_number`, `conversion_context`, `pending_checkout`, `geo_cache_<país>_<teléfono>` | analítica | **no se guardan en el dispositivo**; quedan en memoria mientras la página siga abierta, y **pasan al dispositivo si la persona acepta después** (`promoverMemoria`: aceptar con la ventana de pago ya abierta no deja la compra sin su contexto) |
| localStorage `purchase_data` | analítica **o** publicidad | ídem |
| Visitas `ad_visit` / `organic_visit` (al llegar) | analítica | **una sola en espera por documento** (clave `llegada`: la primera manda), con lo que se sabía AL LLEGAR; si acepta después —incluso tras leer la política—, se registra entonces. No se cancela al salir de la portada |
| localStorage `map_coords` (posición del mapa que se paga, para devolverlo al volver de Stripe) | **necesaria** | se guarda siempre, al pulsar «Comprar», **con su fecha y caduca a las 24 horas** (lo que dura una sesión de Stripe): se borra al cancelar el pago y en cualquier carga posterior una vez vencida (las de antes de este cambio, sin fecha, también). NO se borra al restaurar el mapa: volver a abrir el enlace de éxito (atrás, recarga) sigue mostrándolo |
| Cookie `preferred_language` y su espejo en localStorage | **necesaria** (preferencia elegida por la persona) | se guarda solo cuando elige idioma; 1 año; `SameSite=Lax; Secure` |
| Cookie `cookie_consent` | **necesaria** (guarda la propia elección) | 180 días; sin identificador: `{"v":1,"a":0|1,"p":0|1,"t":<época>}`. La escribe el navegador y la **renueva el servidor** (`/api/consentimiento`): Safari limita a 7 días las cookies que escribe JavaScript, no las de `Set-Cookie` |
| Cookie de sesión del panel `/admin` | **necesaria** | solo existe tras iniciar sesión; `/admin` no lleva GTM ni aviso |

El código no escribe en `localStorage` directamente (salvo `map_coords` y el idioma):
pasa por `src/lib/almacenamiento.js`, que consulta el permiso. **Al agregar un dato nuevo
que se guarde en el dispositivo, hay que decidir su categoría ahí.**

Lo que **no** se condiciona: crear la sesión de pago, el mapa (teselas de OpenStreetMap),
`/api/flags`, `/api/precio` y las acciones explícitas de la persona («Búsqueda por IP» le
pide la IP a GeoJS —igual que la primera búsqueda con teléfono del simulador, que necesita
un punto de partida—, «Búsqueda por navegador» las coordenadas a Nominatim). **Cargar la
página ya no le pregunta nada a GeoJS** (ver la sección siguiente).

## El país del visitante lo resuelve el servidor

El país que decide el **precio** (`/api/precio?pais=…`), el **idioma inicial** (cuando la URL no
trae idioma) y el `country_iso` de los registros sale de la **IP de la petición**, con la base
local de DB-IP, **en el servidor** (`hooks.server.js` → `locals.pais` → `+layout.server.js`,
que lo manda a la página como `data.pais`: un código de dos letras, nunca la IP).
`ubicacionDeArranque()` (`src/lib/geoLocation.js`) lo pasa al código telefónico que usa el
catálogo de precios. Antes lo hacía el **navegador**, que al cargar cada página le mandaba la IP
a GeoJS; eso (a) mandaba la IP a un tercero antes de que se pudiera contestar el aviso, y
(b) fallaba en silencio con bloqueadores de rastreo o VPN del navegador, y entonces **cobraba
como mexicano** (el respaldo era México).

- **Sin país conocido** (IP privada, sin base, un país que la tabla `countryCodeMap` no cubre):
  el precio cae al de México (+52), el respaldo de siempre del catálogo, y el idioma al del
  navegador. `ubicacionDeArranque(...).conocido` dice cuál fue el caso.
- **El país no cambia con una búsqueda.** «Búsqueda por navegador» (GPS) y «Búsqueda por IP»
  ya no pisan el país del visitante (antes sí): el precio no puede depender de dónde diga estar
  el GPS de un equipo con VPN. Los resultados de cada búsqueda quedan en sus propios campos
  de los registros (`gps_detection_*`, `ip_detection_*`).
- **Sin coordenadas hasta que haya una búsqueda.** La base local es de países. Antes cada visita
  registraba `ip_detection_lat/lng` y `location_shown_*` con la ubicación aproximada de la IP; ahora
  esos campos van **vacíos** (`null`) hasta que la persona busca (el mapa por defecto, la CDMX, no
  se registra como «ubicación mostrada»). `ip_detection_iso_code`/`country_code` sí llevan el país.
- **Costo/alternativa**: obtener coordenadas en el servidor pediría la base *City* de DB-IP
  (~130 MB), que no cabe en el límite de memoria de pm2 del sitio (250 MB con ~125 MB ya en uso).
- El modo sombra (`GEO_SHADOW`, una línea de log por visita) **terminó**: el módulo
  `src/lib/server/geoSombra.js` ya no lo importa nadie y se puede borrar.

## Piezas y dónde viven

| Archivo | Qué hace |
| --- | --- |
| `src/lib/consentimiento.js` | Reglas **puras**: países, zonas horarias, cookie de elección, estados de Consent Mode. Lo usan servidor, script de arranque, componentes y pruebas. |
| `src/lib/consentimiento-arranque.js` | El **script inline** del `<head>` (texto, no función): decide región, manda `default`/`update`, carga GTM, limpia lo de Google y deja `window.__consent`. Va en `%consent.script%` de `app.html`. |
| `src/lib/server/geoip.js`, `pais.js` | Lector de la base de países (recarga solo, valida antes de reemplazar) y la consulta por IP. |
| `src/hooks.server.js` | Resuelve país y elección por request (`event.locals`), inyecta el script y el `<noscript>`, pone `Cache-Control: private`, precarga la base (`init`). |
| `src/routes/+layout.server.js` / `+layout.svelte` | Pasan al navegador el estado ya resuelto y montan el aviso **primero en el DOM**. |
| `src/routes/api/consentimiento/+server.js` | Renueva `cookie_consent` desde el servidor (Safari/ITP) a petición del script de arranque; solo acepta dos booleanos y solo del propio origen. |
| `src/lib/consent.svelte.js` | Estado reactivo del aviso (una instancia por documento, por contexto; **nunca** un store de módulo: en el servidor se compartiría entre visitantes). |
| `src/lib/CookieBanner.svelte` | El aviso: `role="dialog"` no modal, no roba el foco al cargar (al pulsar «Configurar» pasa a la primera casilla), sí lo recibe al reabrirse; «Cerrar» y Escape solo existen si ya había elección; lógica CSS para árabe (RTL). **No ocupa más de ~70 % de la pantalla** (el texto se desplaza por dentro, los botones quedan a la vista), reserva su alto al final de la página (`--alto-aviso`, que suma el pie y usa `scroll-padding-bottom`) y queda **por debajo de la ventana de pago** (z-index 1900 frente a 2000: pagar no depende de contestar). Sin JavaScript se oculta (`<noscript>` en `app.html`). |
| `src/lib/consentimiento-navegador.js`, `almacenamiento.js` | `analiticaOk()` / `publicidadOk()` y el `localStorage` con permiso. Sin el script de arranque se asume lo **más estricto**. |
| `src/lib/SiteFooter.svelte` | «Preferencias de cookies» y la atribución a DB-IP. También en las páginas de error (`+error.svelte`). |
| `scripts/actualizar-geoip.sh` | Descarga y renueva la base de países (ver abajo). |

El aviso **no** aparece en `/admin` ni en `/api`.

## La base de países (DB-IP)

- **Fuente**: <https://download.db-ip.com/free/dbip-country-lite-AAAA-MM.mmdb.gz>, sin
  cuenta. Licencia **CC BY 4.0**: se puede usar comercialmente y tener copia en el
  servidor, y exige **un enlace a DB-IP** en las páginas que usan el resultado. Está en el
  pie (`SiteFooter.svelte`: «IP Geolocation by DB-IP») y la política lo nombra.
- **Dónde vive**: `/root/data/geoip/dbip-country-lite.mmdb` en el droplet (es la ruta por
  defecto del código; `GEOIP_DB_PATH` la cambia). **Fuera del repo y del build**: sobrevive a
  `git pull`, `npm ci` y `vite build`. Pesa ~8 MB.
- **Quién la renueva**: `scripts/actualizar-geoip.sh`, desde el cron **diario** del root.
  DB-IP publica el día 1 de cada mes hacia las 06:30 UTC y solo conserva el mes actual y el
  anterior; el script es idempotente (si ya está al día no toca la red), cae al mes anterior
  mientras el nuevo no sale, valida antes de instalar (gzip, tamaños, tipo de base, IPs de
  control) y reemplaza con `mv` atómico: la app ve la base vieja o la nueva, nunca a medias.
  Si algo falla **no toca la base vigente**. Detalles que importan:
  - Cada corrida compara el **sha256** registrado al instalar: un archivo dañado en el disco
    que conserva tamaño y estructura se reinstala en vez de darse por «al día».
  - **Nunca baja de versión**, tampoco con `--forzar` (que solo permite volver a bajar la
    misma edición).
  - Usa la **misma variable que la app** (`GEOIP_DB_PATH`): en el entorno o, si no, en el `.env`
    de la app (que el cron no carga). Sin ella, `/root/data/geoip/dbip-country-lite.mmdb`.
  - Busca primero el node de **nvm** (el de la app) y solo después el del `PATH`; un fallo del
    entorno de node (código distinto de «la base no pasa») no rechaza una descarga buena.
- **Instalación en el droplet** (ya hecha el 2026-10-17; se repite solo si se reconstruye
  el servidor):

  ```sh
  # primera descarga, a mano
  bash /root/code/svelte_geo_kit/scripts/actualizar-geoip.sh
  # cron (crontab -e como root; antes: cp el crontab a /root/scripts/crontab.backup.<fecha>)
  23 7 * * * GEOIP_NTFY_TOPIC=<tema> bash /root/code/svelte_geo_kit/scripts/actualizar-geoip.sh >> /root/scripts/actualizar-geoip.log 2>&1
  ```

  `GEOIP_NTFY_TOPIC` (el mismo tema que usa `geospace-health.sh`) hace que un **fallo**
  avise por ntfy; sin él solo queda en el log.
- **Cómo saber si está bien**: `curl https://geoservices.space/api/health` incluye
  `geoip: { cargada, edicion, edadDias, vieja }` (`vieja` pasa a `true` a los 45 días), y
  `bash scripts/actualizar-geoip.sh --estado` da 0 (bien), 1 (ausente o corrupta) o 2
  (desactualizada) y comprueba el sha256 que registró al instalar. El log del proceso trae
  líneas `GEOIP cargada|recargada|recarga_rechazada|sin_archivo|base_vieja`.
- **Si falta la base** todo sigue funcionando: el país sale «desconocido», el aviso se
  decide con la zona horaria del navegador (con UTC se pide consentimiento) y **el precio cae al
  de México (+52) para todos**: sin la base, un visitante de Alemania vería pesos mexicanos. Por eso
  hay que instalarla ANTES de desplegar una versión que la use, y vigilar `geoip.cargada` en
  `/api/health`.
- **Precisión**: la versión gratuita acierta menos que la comercial; VPN, datos móviles y
  CGNAT fallan. Por eso «no sé» significa pedir consentimiento y la zona horaria es una
  segunda señal.

## Pruebas

```sh
npm test                                              # unitarias: reglas, script de arranque (en una vm), lector de país
GEOIP_DB_PATH=/ruta/dbip-country-lite.mmdb npm test   # además prueba la base real
```

`consentimiento-arranque.test.js` ejecuta **el texto real del script** en un navegador de
mentira (frasco de cookies que borra con `Max-Age=0`, `dataLayer`, zona horaria) y comprueba
que decide igual que `consentimiento.js` en todas las combinaciones. Las pruebas de
extremo a extremo con navegador (IP simulada por `X-Forwarded-For`, Google reemplazado por un
stub para no ensuciar Analytics) viven fuera del repo; el recorrido que cubren: SSR y
cabeceras por país, Consent Mode en cada elección, que no se pida nada a Google antes de
elegir, el pie, retirar un permiso, teclado y foco, y las señales de IP y zona horaria.

Para repetir la comprobación de Consent Mode contra Google de verdad, nada mejor que
Tag Assistant (<https://tagassistant.google.com>) con `?cookies=preview`.

## Cuándo hay que tocar esto

- **Cambian las finalidades, lo que activa cada opción o los terceros** → subir
  `VERSION_CONSENTIMIENTO` en `consentimiento.js`: las elecciones guardadas con otra versión
  se ignoran y se vuelve a preguntar. Guardar (git) el texto de esa versión: Google pide
  poder demostrar qué se le mostró a cada persona.
- **Se agrega un dato en el dispositivo o una petición a un tercero** → ponerlo en
  `almacenamiento.js` o detrás de `analiticaOk()`/`publicidadOk()`, y actualizar la tabla de
  arriba y la política (`privacy.*` en los seis `locales/*.json`).
- **Se agrega un país a la región** → `PAISES_REGULADOS` (y su zona horaria si hace falta).
- **Se cambia un texto del aviso** → los seis idiomas (`consent.*`) y repetir la revisión de
  traducciones (ver `SEO.md`).

## Lo que este trabajo NO resuelve

1. **GeoJS sigue recibiendo la IP —desde el navegador, también en la UE— cuando la persona
   elige «Búsqueda por IP» o hace su primera búsqueda con teléfono en el simulador**
   (`geoLocation.js` → `detectByIP`). Ya NO ocurre al cargar la página ni sin una acción suya:
   el país sale del servidor (sección «El país del visitante lo resuelve el servidor»). Es una
   petición que la persona pidió y la política la declara, pero sí va a un tercero antes
   de (o sin) contestar el aviso. Quitarla del todo pediría una base de coordenadas local (la
   *City* de DB-IP no cabe en la memoria de pm2) o un centro por país.
2. **Ajustes en la interfaz de Tag Manager / Analytics / Ads** que solo puede hacer el dueño
   del contenedor `GTM-WJ8WCDZN`: URL passthrough y enlazado entre dominios del Conversion
   Linker, recolección automática de datos aportados por la persona (teléfono, correo) del
   Google tag, y —opcional— comprobaciones de consentimiento adicionales por etiqueta.
   Con consentimiento **parcial** y GTM cargado, Google sigue mandando señales **sin
   cookies** del propósito denegado (medido en pruebas): ningún ajuste de este repo lo evita.
3. **El servicio de avisos de Stripe** (`stripe-fastapi-docker`, en Hugging Face) falla con
   `KeyError` (HTTP 500 y reintentos de Stripe) en `checkout.session.async_payment_succeeded`
   cuando el pago no trae `gaCliente`, y el aviso va a hacer que haya más pagos sin él. No es
   de este repo.
4. **`/privacy` no existe en producción** hasta definir `PRIVACY_CONTACT_EMAIL` (ver `SEO.md`).
   Mientras tanto el aviso no enlaza a ninguna política (sí a «cómo usa Google tus datos»).
5. **Registros del servidor**: los de pm2 no rotan y los de nginx guardan la IP 14 días.
6. Los cuatro `purchase` de «engagement» que empujaban un evento falso de valor 1 a Google (`sell_pop`,
   `phone_search`, `map_wait`, `map_interaction`) se **borraron el 2026-10-19**, junto con sus cuatro
   interruptores del panel. Esos cuatro eventos siguen registrándose en la base propia (`logConversion`),
   solo que ya no llegan a Google Analytics ni a Google Ads como compras.
7. **Revisión legal**: nada de esto la sustituye.
