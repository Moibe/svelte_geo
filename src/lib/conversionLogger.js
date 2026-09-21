/**
 * Módulo de logging de conversiones.
 * Guarda en la API de Geospaces y también imprime en consola.
 */
import { log, error } from './logger.js';

// Destino PRINCIPAL: la API de tracking del droplet, servida en el mismo
// origen por el bloque `location /track/` de nginx. Ser mismo-origen quita el
// preflight de CORS, el salto cross-provider y el cold start del Space.
const API_URL = import.meta.env.VITE_TRACK_URL || '/track/api/map-interactions';

// Destino LEGACY: el Space de HuggingFace, que escribe en MariaDB (Opalstack).
// Se mantiene en paralelo un tiempo para poder reconciliar ambos lados antes
// de dar de baja el Space. Poner VITE_LEGACY_TRACK_URL vacio apaga el solape
// sin tocar esta linea.
const LEGACY_API_URL = import.meta.env.VITE_LEGACY_TRACK_URL
  ?? 'https://moibe-fastapi-mariadb-geospaces.hf.space/api/map-interactions';

/**
 * Formatea una fecha en una zona horaria dada como string legible tipo ISO.
 * @param {Date} date
 * @param {string} timeZone - IANA timezone string (e.g. 'America/Mexico_City')
 * @returns {string}
 */
function formatInTimezone(date, timeZone) {
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
  return `${formatted} (${timeZone})`;
}

/**
 * Registra una conversión: guarda en la API y en consola.
 * @param {Object} params
 * @param {string} params.type           - Tipo de conversión: 'map_interaction', 'map_wait', 'purchase', etc.
 * @param {string} params.gaClientId     - GA Client ID del usuario
 * @param {string} params.phone          - Teléfono ingresado por el usuario (puede ser vacío)
 * @param {string} params.language       - Idioma activo ('es', 'en', 'pt', 'fr', 'de')
 * @param {Object} params.ipDetection    - Resultado de detección por IP
 * @param {Object} params.gpsDetection   - Resultado de detección por GPS (null si no ocurrió)
 * @param {string} params.searchMethod   - Método de búsqueda usado: 'phone', 'browser', 'ip', 'none'
 * @param {Object} params.locationShown  - Coordenadas que se mostraron al usuario {lat, lng}
 * @param {string} params.countryISO     - ISO del país del usuario (MX, US, etc.)
 * @param {string} params.countryCode    - Código telefónico del país (+52, +1, etc.)
 * @param {string} params.utmSource      - utm_source
 * @param {string} params.utmMedium      - utm_medium
 * @param {string} params.utmCampaign    - utm_campaign
 * @param {string} params.utmTerm        - utm_term
 * @param {string} params.utmContent     - utm_content
 * @param {string} params.gclid          - Google Ads click ID
 * @param {string} params.fbclid         - Meta Ads click ID
 * @param {number} params.purchaseValue  - Valor de la compra (solo para type='purchase')
 * @param {string} params.purchaseCurrency - Moneda de la compra (solo para type='purchase')
 */
export async function logConversion({
  type,
  gaClientId = null,
  phone = '',
  language = 'en',
  ipDetection = null,
  gpsDetection = null,
  searchMethod = 'none',
  locationShown = null,
  countryISO = null,
  countryCode = null,
  utmSource = null,
  utmMedium = null,
  utmCampaign = null,
  utmTerm = null,
  utmContent = null,
  gclid = null,
  fbclid = null,
  purchaseValue = null,
  purchaseCurrency = null,
}) {
  const now = new Date();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Payload snake_case para la API
  const payload = {
    type,
    timestamp_utc:              now.toISOString(),
    timestamp_user:             formatInTimezone(now, userTimezone),
    timestamp_cdmx:             formatInTimezone(now, 'America/Mexico_City'),
    ga_client_id:               gaClientId || null,
    phone:                      phone || null,
    language,
    country_iso:                countryISO || null,
    country_code:               countryCode || null,
    location_shown_lat:         locationShown?.lat ?? null,
    location_shown_lng:         locationShown?.lng ?? null,
    ip_detection_iso_code:      ipDetection?.isoCode ?? null,
    ip_detection_country_code:  ipDetection?.countryCode ?? null,
    ip_detection_lat:           ipDetection?.lat ?? null,
    ip_detection_lng:           ipDetection?.lng ?? null,
    gps_detection_iso_code:     gpsDetection?.isoCode ?? null,
    gps_detection_country_code: gpsDetection?.countryCode ?? null,
    gps_detection_lat:          gpsDetection?.lat ?? null,
    gps_detection_lng:          gpsDetection?.lng ?? null,
    search_method:              searchMethod,    utm_source:                 utmSource || null,
    utm_medium:                 utmMedium || null,
    utm_campaign:               utmCampaign || null,
    utm_term:                   utmTerm || null,
    utm_content:                utmContent || null,
    gclid:                      gclid || null,
    fbclid:                     fbclid || null,
    purchase_value:             purchaseValue ?? null,
    purchase_currency:          purchaseCurrency || null,
  };

  log('═══════════════════════════════════════════════');
  log('📊 CONVERSIÓN REGISTRADA');
  log('═══════════════════════════════════════════════');
  log(JSON.stringify(payload, null, 2));
  log('═══════════════════════════════════════════════');

  // Se escribe a los DOS destinos en paralelo mientras dura la migración.
  // Van con Promise.allSettled y no con await encadenado a propósito: si el
  // legacy está caído (hoy lo está, la BD de Opalstack rechaza credenciales),
  // no debe retrasar ni tumbar la escritura local.
  const cuerpo = JSON.stringify(payload);
  const destinos = [['local', API_URL]];

  if (LEGACY_API_URL) {
    destinos.push(['legacy', LEGACY_API_URL]);
  }

  await Promise.allSettled(destinos.map(([nombre, url]) => enviar(nombre, url, cuerpo)));

  return payload;
}

/**
 * Manda el payload a un destino. Nunca lanza: un fallo de tracking no puede
 * romper el flujo de la app.
 *
 * `keepalive` es lo que hace que el POST sobreviva al cierre de la pestaña
 * (es el mismo transporte que usa sendBeacon, con tope de 64KB — el payload
 * de ~35 campos está muy por debajo). Sin esto se perderían los page_close.
 */
async function enviar(nombre, url, cuerpo) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
    });

    if (response.ok) {
      log(`✅ Conversión guardada (${nombre}):`, await response.json());
    } else {
      error(`❌ Error al guardar conversión (${nombre}):`, response.status, await response.text());
    }
  } catch (err) {
    error(`❌ No se pudo conectar con la API de conversiones (${nombre}):`, err);
  }
}
