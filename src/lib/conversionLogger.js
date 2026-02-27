/**
 * Módulo de logging de conversiones.
 * Por ahora imprime en consola. En el futuro, guardará en base de datos (Firestore, etc.).
 */
import { log } from './logger.js';

/**
 * Registra una conversión con todos los datos de sesión disponibles.
 * @param {Object} params
 * @param {string} params.type           - Tipo de conversión: 'map_interaction', 'purchase', etc.
 * @param {string} params.gaClientId     - GA Client ID del usuario
 * @param {string} params.phone          - Teléfono ingresado por el usuario (puede ser vacío)
 * @param {string} params.language       - Idioma activo ('es', 'en', 'pt', 'fr', 'de')
 * @param {Object} params.ipDetection    - Resultado de detección por IP
 * @param {Object} params.gpsDetection   - Resultado de detección por GPS (null si no ocurrió)
 * @param {string} params.searchMethod   - Método de búsqueda usado: 'phone', 'browser', 'ip', 'none'
 * @param {Object} params.locationShown  - Coordenadas que se mostraron al usuario {lat, lng}
 * @param {string} params.countryISO     - ISO del país del usuario (MX, US, etc.)
 * @param {string} params.countryCode    - Código telefónico del país (+52, +1, etc.)
 */
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

export function logConversion({
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
}) {
  const now = new Date();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const conversionData = {
    // — Identificación —
    type,
    timestamp_utc:   now.toISOString(),
    timestamp_user:  formatInTimezone(now, userTimezone),
    timestamp_cdmx:  formatInTimezone(now, 'America/Mexico_City'),

    // — Usuario —
    gaClientId: gaClientId || '(no disponible)',
    phone: phone || '(no ingresó teléfono)',
    language,

    // — Ubicación mostrada —
    countryISO,
    countryCode,
    locationShown: locationShown
      ? { lat: locationShown.lat, lng: locationShown.lng }
      : null,

    // — Detección IP (siempre ocurre al cargar) —
    ipDetection: ipDetection
      ? { isoCode: ipDetection.isoCode, countryCode: ipDetection.countryCode, lat: ipDetection.lat, lng: ipDetection.lng }
      : null,

    // — Detección GPS (solo si el usuario usó el botón Browser) —
    gpsDetection: gpsDetection
      ? { isoCode: gpsDetection.isoCode, countryCode: gpsDetection.countryCode, lat: gpsDetection.lat, lng: gpsDetection.lng }
      : null,

    // — Método de búsqueda —
    searchMethod,
  };

  log('═══════════════════════════════════════════════');
  log('📊 CONVERSIÓN REGISTRADA');
  log('═══════════════════════════════════════════════');
  log(JSON.stringify(conversionData, null, 2));
  log('═══════════════════════════════════════════════');

  // TODO: en el futuro, guardar en Firestore:
  // await addDoc(collection(db, 'conversiones'), conversionData);

  return conversionData;
}
