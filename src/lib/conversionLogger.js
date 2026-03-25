/**
 * Módulo de logging de conversiones.
 * Guarda en la API de Geospaces y también imprime en consola.
 */
import { log, error } from './logger.js';

const API_URL = 'https://moibe-fastapi-mariadb-geospaces.hf.space/api/map-interactions';

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

  // Guardar en la API (fire and forget — no bloquea el flujo)
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // Importante para que no se aborte al cerrar la pestaña
    });
    if (response.ok) {
      const result = await response.json();
      log('✅ Conversión guardada en API:', result);
    } else {
      error('❌ Error al guardar conversión en API:', response.status, await response.text());
    }
  } catch (err) {
    error('❌ No se pudo conectar con la API de conversiones:', err);
  }

  return payload;
}
