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
  const conversionData = {
    // — Identificación —
    type,
    timestamp: new Date().toISOString(),

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
