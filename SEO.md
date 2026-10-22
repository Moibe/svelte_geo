# SEO de geoservices.space

Cómo está armado el SEO, qué reglas no se pueden romper y qué falta. Escrito el
2026-10-13, cuando se hizo.

## Qué hay y dónde vive

| Pieza | Dónde |
| --- | --- |
| Una URL por idioma (`/es`, `/en`, `/pt`, `/fr`, `/de`, `/ar`) y la raíz `/` | `src/routes/[[lang=lang]]/` y el matcher `src/params/lang.js` |
| Qué idioma tiene una request | `resolverIdiomaDeRequest` en `src/lib/idiomas.js`, usado por `src/hooks.server.js` |
| `<title>`, descripción, canonical, hreflang, Open Graph, Twitter y datos estructurados | `src/lib/Seo.svelte` (una vez por página) y las funciones puras de `src/lib/seo.js` |
| Sitemap con las alternativas por idioma | `src/routes/sitemap.xml/+server.js` |
| `robots.txt` | `static/robots.txt` |
| Íconos e imagen para compartir (1200×630) | `static/` (`favicon.svg`, `apple-touch-icon.png`, `og-image.png`) y `src/routes/favicon.ico/+server.js` |
| Texto visible para buscadores y personas: «Cómo funciona», preguntas frecuentes y pie con enlaces de idioma | `src/lib/InfoSection.svelte`, `src/lib/SiteFooter.svelte` |
| Política de privacidad | `src/routes/[[lang=lang]]/privacy/` |
| Los textos | `src/lib/locales/*.json`, grupos `seo`, `info`, `sim`, `footer`, `privacy` y las claves `search.payNotice`, `search.error*`, `purchase.coordsLost` |
| Pruebas de las reglas de abajo | `npm test` (`src/lib/*.test.js`) |

## Reglas que no se deben romper

1. **El idioma de la URL manda sobre la cookie, el país y `Accept-Language`.**
   Los buscadores no mandan cookie y Googlebot ejecuta JavaScript con IP de
   EE. UU.: si algo pudiera pisar a `/es`, el rastreador vería la página en
   inglés. Solo en la raíz `/`, que no declara idioma, deciden la cookie, el
   navegador y el país.
2. **Cada página es su propio canonical** (`/es` es el canonical de `/es`). Si
   todos apuntaran a un idioma, Google trataría las traducciones como
   duplicados y las sacaría del índice. El canonical ignora la query
   (`?payment=…`, UTM).
3. **hreflang recíproco**: cada versión lista a todas, incluida ella misma, más
   `x-default`, que apunta a la ruta sin prefijo. Si falta un lado, Google
   ignora el par.
4. **El sitemap y los hreflang del `<head>` salen de las mismas funciones**
   (`alternativas` en `src/lib/seo.js`). Que digan cosas distintas hace que Google
   desconfíe de ambos.
5. **`/admin` y `/api` no se indexan**: se manda `X-Robots-Tag: noindex` por
   cabecera (la API devuelve JSON, no tiene `<head>`). `robots.txt` NO nombra
   `/admin` a propósito: listarlo ahí le diría a cualquiera dónde está.
6. **No se publica `FAQPage`**: Google dejó de mostrar ese resultado enriquecido
   para casi todos los sitios.
7. **`Vary: Accept-Language, Cookie` solo en los documentos HTML.**
8. **El modo con número de teléfono es un simulador y todo lo dice.** Nunca se
   escribe copy que prometa localizar a otras personas. La divulgación está en:
   el título y la descripción del buscador (`titleSim`, `descriptionSim`), el
   encabezado y el aviso bajo el formulario, el aviso del spinner, la leyenda del
   mapa, la nota del modal de cobro y la explicación propia de
   `InfoSection` en ese modo. Y el cobro se anuncia ANTES de la primera acción
   (`search.payNotice`).

## Política de privacidad y variables de entorno

La política dice que los derechos se ejercen escribiendo a un contacto. Sin
contacto sería una promesa sin a quién dirigirla, así que **la página solo existe
si hay un correo configurado**:

- `PRIVACY_CONTACT_EMAIL` — obligatoria para que exista `/privacy`. Sin ella la
  ruta da 404 y ni el pie, ni la respuesta de «¿Qué datos se guardan?», ni el
  sitemap la mencionan.
- `PRIVACY_OPERATOR_NAME` — opcional: persona o empresa responsable; si está, la
  política la muestra junto al contacto.

Son variables de **runtime** y de servidor (a propósito sin el prefijo `PUBLIC_`:
así no salen en `/_app/env.js` ni en el HTML de cada página, solo en la política):
se agregan al `.env` del droplet (`/root/code/svelte_geo_kit/.env`) y se reinicia;
no hace falta recompilar. El deploy ya hace `set -a && . ./.env` antes del
`pm2 restart --update-env`. Dos trampas:

1. **Ese `.env` lo lee el shell**, así que un valor con espacios o símbolos va entre
   comillas dobles (`PRIVACY_OPERATOR_NAME="Mi Empresa S.A. de C.V."`). Sin ellas el
   deploy falla antes del `pm2 restart` y deja el build nuevo debajo del proceso
   viejo.
2. **`pm2 restart --update-env` conserva las variables que el proceso ya tenía**: para
   apagar la política no basta borrar la línea del `.env`, hay que dejarla **vacía**.

## Cuando cambie el código, revisa el texto

Los textos afirman hechos. Estos son los que más fácil se vuelven falsos:

- **A quién se manda qué**: GeoJS recibe la IP **solo desde el navegador y solo cuando la
  persona elige «Búsqueda por IP» o usa el simulador** (ya no al abrir la página: el
  servidor estima el país con la base local de DB-IP y no se la manda a nadie, ver
  `COOKIES.md`); OpenStreetMap/Nominatim recibe las coordenadas
  exactas si se usa el GPS; Google (GTM, GA4, Ads) recibe el importe y la moneda
  de las compras, desde el navegador y desde el servicio de avisos de Stripe, y en
  el EEE, el Reino Unido y Suiza **solo se carga con el permiso de quien visita**;
  Hugging Face crea las sesiones de pago y recibe esos avisos; OpenAI recibe
  resultados de consultas del asistente interno de `geospace_nucleo` (Opalstack
  ya no interviene: se dio de baja el 2026-10-22, tras migrar su histórico de
  `map_interactions` a la base del droplet). El envío paralelo de eventos al Space
  legacy está **apagado** (`VITE_LEGACY_TRACK_URL`, ver
  `src/lib/conversionLogger.js`): si se vuelve a encender, la política tiene que
  nombrarlo.
- **Qué se guarda**: los campos de `src/lib/conversionLogger.js` y el esquema de
  `fastapi-mariadb-geospaces/schema_sqlite.sql`. El número del simulador se guarda
  en el servidor y en el navegador (`last_phone_number`, `geo_cache_*`,
  `conversion_context`); en el EEE, el Reino Unido y Suiza solo con permiso de
  analítica (`src/lib/almacenamiento.js`). Cada dato nuevo que se guarde en el
  dispositivo o se mande a un tercero tiene que pasar por ahí o por
  `analiticaOk()` / `publicidadOk()`, y la política cambiar con él.
- **La variación aleatoria** de unos 5 km por eje (`randomizeLocation` en
  `src/lib/geoLocation.js`) y que los marcadores de antenas son ilustrativos.
- **Qué compra el pago**: no existe un estado «pagado»; tras Stripe solo se
  restaura el mapa de esa búsqueda desde `localStorage` (y la URL se limpia), así
  que recargar o cerrar la página lo pierde y otra búsqueda puede volver a pedir
  pago. Los textos lo dicen (`info.how`, `sim.modalNote*`, `purchase.coordsLost`):
  si algún día el pago guarda el acceso, hay que reescribirlos.
- **El flag `sell`**: apagado, el modal de compra no aparece y la app es gratuita.
  La página entonces no anuncia ningún pago (no se muestra `search.payNotice` y
  `InfoSection` quita el último paso de `info.how` / `info.howSim`, que es siempre
  el del pago: si se reordenan esas listas hay que cambiar ese `slice`), y la
  descripción para buscadores pasa a las variantes `seo.home.descriptionFree` /
  `descriptionSimFree`, que son la misma sin la última frase (la del pago).
- **El precio**: el modal muestra el importe y la moneda del precio de Stripe
  (`formatearImporte` en `src/lib/currency.js`). Con el flag `price-testing`
  encendido se cobra un `price_id` de prueba: entonces el modal NO muestra ninguna
  cifra (no es la que se cobrará; Stripe enseña la real) y la conversión se
  reporta a Google sin valor. Revisar en `/admin` que esté apagado.

Los textos se verificaron afirmación por afirmación contra el código con agentes
independientes (hechos, protección al consumidor), dos veces, y las traducciones
las revisó otro agente nativo por idioma más una auditoría de promesas en los seis
idiomas. Si se cambia un texto, vale la pena repetir ese ciclo.

## Cómo agregar…

- **Una página pública**: crearla bajo `src/routes/[[lang=lang]]/`, usar
  `<Seo titulo=… descripcion=… />`, agregar su ruta (sin idioma) a `paginas` en
  `src/routes/sitemap.xml/+server.js` y sus textos a los seis `locales/*.json`.
- **Un idioma**: `IDIOMAS` en `src/lib/idiomas.js`, el conjunto de
  `src/params/lang.js`, `LOCALE_OG` en `src/lib/seo.js`, el nombre en
  `SiteFooter.svelte` y en `LanguageSelector.svelte`, y el diccionario en
  `src/lib/locales/`. El sitemap y los hreflang lo toman solos.

## Search Console (lo tiene que hacer el dueño del dominio)

1. En <https://search.google.com/search-console> agregar la propiedad
   `https://geoservices.space` (de dominio con un registro DNS TXT, o de prefijo
   de URL con una etiqueta `<meta>`; con la etiqueta, pásala y se agrega en
   `src/app.html`).
2. «Sitemaps» → enviar `https://geoservices.space/sitemap.xml`.
3. «Inspección de URLs» con `/es` y `/en`: debe decir que la página se puede
   indexar y mostrar el canonical propio.
4. Opcional: lo mismo en Bing Webmaster Tools (importa la propiedad desde Google).

## Lo que NO está resuelto

- **Consentimiento de cookies**: **resuelto para el EEE, el Reino Unido y Suiza** con
  el aviso de cookies y Consent Mode v2 (`COOKIES.md`). Queda lo que ese archivo
  lista en «Lo que este trabajo NO resuelve» (GeoJS al pulsar «Búsqueda por IP», los ajustes
  de la interfaz de Tag Manager, el webhook de Stripe, revisión legal).
- **Base legal y responsable**: la política no dice con qué base legal se tratan
  los datos y solo identifica a alguien si se define `PRIVACY_OPERATOR_NAME`.
- **Posible doble conteo de compras en GA4** (sin comprobar en Analytics): el
  navegador empuja `purchase` al dataLayer con `transaction_id` `txn_…`, y el
  servicio de avisos de Stripe en Hugging Face (`stripe-fastapi-docker`,
  `send_ga4_purchase_event`) manda otro `purchase` a GA4 por Measurement Protocol
  con el id de la sesión de Stripe (`cs_…`). Si los dos llegan, GA4 ve dos compras
  con ids distintos. Vale la pena mirar un `purchase` real en GA4 DebugView.
- **Nombre del producto en Stripe**: en Checkout y en el recibo aparece «GPS SMS
  Location» / «Acceso a Mapa Completo», que sugiere localización real por SMS y
  contradice el aviso de simulación. Se cambia en el dashboard de Stripe (y se
  ponen al día los JSON de `static/` con `npm run fetch-product-details -- --aplicar`).
- **Precios de Stripe cargados 100 veces de más** en monedas sin subunidad
  (`PRECIOS_STRIPE.md`): el modal ya muestra lo que Stripe cobra de verdad, pero
  el precio sigue siendo el equivocado hasta que se corrija en Stripe.
- **`price-testing` está encendido en producción** (se migró así desde Firestore):
  con ese flag Stripe cobra el `price_id` de prueba a todos los visitantes (el modal
  ya no muestra una cifra falsa, pero el cobro no es el del país). Revisarlo en
  `/admin` y apagarlo si ya no se está probando.
- **Rendimiento en móvil**: lo que más pesa son los scripts de Google (GTM, GA,
  Ads), que ocupan el hilo principal alrededor de un segundo. Diferir su carga
  mejoraría el LCP a costa de no contar a quien rebota en los primeros segundos.
