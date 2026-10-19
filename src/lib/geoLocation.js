import { log, warn, error } from './logger.js';
import { guardar, leer, quitar } from './almacenamiento.js';

// Mapeo de código de país ISO (2 letras) a código telefónico
export const countryCodeMap = {
  // Norteamérica
  'US': '+1',
  'MX': '+52',
  'CA': '+1',
  // Centroamérica y Caribe
  'GT': '+502',
  'SV': '+503',
  'HN': '+504',
  'NI': '+505',
  'CR': '+506',
  'PA': '+507',
  'CU': '+53',
  'DO': '+1809',
  'PR': '+1',
  'JM': '+1876',
  'HT': '+509',
  'BZ': '+501',
  // Sudamérica
  'BR': '+55',
  'AR': '+54',
  'CO': '+57',
  'PE': '+51',
  'CL': '+56',
  'VE': '+58',
  'EC': '+593',
  'BO': '+591',
  'PY': '+595',
  'UY': '+598',
  'GY': '+592',
  'SR': '+597',
  // Europa Occidental
  'GB': '+44',
  'ES': '+34',
  'FR': '+33',
  'DE': '+49',
  'IT': '+39',
  'PT': '+351',
  'NL': '+31',
  'BE': '+32',
  'AT': '+43',
  'CH': '+41',
  'IE': '+353',
  'LU': '+352',
  // Europa Nórdica
  'SE': '+46',
  'NO': '+47',
  'DK': '+45',
  'FI': '+358',
  'IS': '+354',
  // Europa del Este
  'PL': '+48',
  'RO': '+40',
  'CZ': '+420',
  'HU': '+36',
  'SK': '+421',
  'BG': '+359',
  'HR': '+385',
  'RS': '+381',
  'SI': '+386',
  'UA': '+380',
  'BY': '+375',
  'MD': '+373',
  'BA': '+387',
  'MK': '+389',
  'AL': '+355',
  'ME': '+382',
  'XK': '+383',
  'LT': '+370',
  'LV': '+371',
  'EE': '+372',
  // Europa del Sur
  'GR': '+30',
  'CY': '+357',
  'MT': '+356',
  // Rusia y Asia Central
  'RU': '+7',
  'KZ': '+7',
  'UZ': '+998',
  'TM': '+993',
  'KG': '+996',
  'TJ': '+992',
  // Asia Oriental
  'JP': '+81',
  'CN': '+86',
  'KR': '+82',
  'TW': '+886',
  'HK': '+852',
  'MO': '+853',
  'MN': '+976',
  // Sudeste Asiático
  'TH': '+66',
  'VN': '+84',
  'PH': '+63',
  'ID': '+62',
  'MY': '+60',
  'SG': '+65',
  'MM': '+95',
  'KH': '+855',
  'LA': '+856',
  'BN': '+673',
  // Asia del Sur
  'IN': '+91',
  'PK': '+92',
  'BD': '+880',
  'LK': '+94',
  'NP': '+977',
  'BT': '+975',
  'MV': '+960',
  // Oriente Medio
  'TR': '+90',
  'SA': '+966',
  'AE': '+971',
  'IL': '+972',
  'IR': '+98',
  'IQ': '+964',
  'JO': '+962',
  'LB': '+961',
  'SY': '+963',
  'KW': '+965',
  'QA': '+974',
  'BH': '+973',
  'OM': '+968',
  'YE': '+967',
  'AF': '+93',
  // África del Norte
  'EG': '+20',
  'MA': '+212',
  'DZ': '+213',
  'TN': '+216',
  'LY': '+218',
  'SD': '+249',
  // África Subsahariana
  'ZA': '+27',
  'NG': '+234',
  'KE': '+254',
  'GH': '+233',
  'UG': '+256',
  'TZ': '+255',
  'ZW': '+263',
  'ET': '+251',
  'CI': '+225',
  'SN': '+221',
  'CM': '+237',
  'AO': '+244',
  'MZ': '+258',
  'ZM': '+260',
  'BW': '+267',
  'NA': '+264',
  'RW': '+250',
  // Países con precio propio en el catálogo (static/product-details*.json) que faltaban aquí: sin su
  // entrada, un visitante de ese país caía al precio de México aunque el catálogo tuviera el suyo.
  'BI': '+257',
  'DJ': '+253',
  'GN': '+224',
  'KM': '+269',
  'MG': '+261',
  'VU': '+678',
  'PF': '+689',
  'ML': '+223',
  'BF': '+226',
  'NE': '+227',
  'TG': '+228',
  'BJ': '+229',
  'GW': '+245',
  'TD': '+235',
  'CF': '+236',
  'CG': '+242',
  'GQ': '+240',
  'GA': '+241',
  // Ídem (precio propio en el catálogo; los dos niveles tienen los mismos códigos).
  'BS': '+1242',
  'BB': '+1246',
  'BM': '+1441',
  'DM': '+1767',
  'TT': '+1868',
  'GM': '+220',
  'MU': '+230',
  'LR': '+231',
  'SL': '+232',
  'CV': '+238',
  'SC': '+248',
  'SO': '+252',
  'MW': '+265',
  'LS': '+266',
  'SZ': '+268',
  'SH': '+290',
  'AW': '+297',
  'GI': '+350',
  'AM': '+374',
  'LI': '+423',
  'FK': '+500',
  'CW': '+599',
  'TO': '+676',
  'WS': '+685',
  'GE': '+995',
  // Monedas que se sumaron al catálogo después (República Dominicana pasa a su código, +1809).
  'CD': '+243',
  'SB': '+677',
  'KY': '+1345',
  'AZ': '+994',
  // Caribe Oriental (XCD), como Dominica:
  'AG': '+1268',
  'KN': '+1869',
  'LC': '+1758',
  'VC': '+1784',
  'GD': '+1473',
  'AI': '+1264',
  'MS': '+1664',
  // Oceanía
  'AU': '+61',
  'NZ': '+64',
  'FJ': '+679',
  'PG': '+675',
};

// Randomizar ubicación (±5 km)
function randomizeLocation(lat, lng) {
  // 1 grado ≈ 111 km, entonces 5 km ≈ 0.045 grados
  const kmToDegrees = 5 / 111;
  
  // Generar desplazamiento aleatorio entre -5 y +5 km
  const latOffset = (Math.random() - 0.5) * 2 * kmToDegrees;
  const lngOffset = (Math.random() - 0.5) * 2 * kmToDegrees;
  
  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}

// La ubicación asignada a cada número del simulador se recuerda para que el mismo número dé
// siempre el mismo punto. Va por $lib/almacenamiento.js: en la UE, el Reino Unido y Suiza solo
// se guarda en el dispositivo con el permiso de analítica; sin él se recuerda mientras la
// página siga abierta, y fuera de esa región funciona como el localStorage de siempre.

// Guardar ubicación randomizada
export function saveLocationCache(phoneNumber, countryCode, lat, lng) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  guardar(key, JSON.stringify({ lat, lng }));
}

// Recuperar ubicación randomizada
export function getLocationCache(phoneNumber, countryCode) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  const cached = leer(key);

  try {
    return cached ? JSON.parse(cached) : null;
  } catch {
    // Un valor dañado se trata como si no hubiera nada guardado.
    return null;
  }
}

// Limpiar cache de ubicación
export function clearLocationCache(phoneNumber, countryCode) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  quitar(key);
}

/**
 * El país «de arranque» del visitante (el que decide el precio, el idioma inicial y los registros),
 * a partir del que el SERVIDOR ya resolvió por la IP de la petición con su base local (ver
 * $lib/server/pais.js y +layout.server.js).
 *
 * Sustituye a la consulta a GeoJS que el navegador hacía al CARGAR cada página: esa llamada mandaba
 * la IP de cada visitante a un tercero antes de que pudiera contestar el aviso de cookies, fallaba en
 * silencio con bloqueadores de rastreo o VPN del navegador (y entonces cobraba como mexicano), y
 * aquí es el mismo dato que ya tiene el servidor, sin red de por medio.
 *
 * Sin país conocido (IP privada, sin base, país que la tabla de códigos no cubre) se cae a México, el
 * mercado principal y el respaldo de siempre del catálogo de precios. `conocido` dice cuál fue el caso.
 *
 * @param {string|null|undefined} iso código ISO de dos letras que resolvió el servidor, o null
 * @returns {{ countryCode: string, isoCode: string, conocido: boolean }}
 */
export function ubicacionDeArranque(iso) {
  const codigo = typeof iso === 'string' ? iso.trim().toUpperCase() : '';

  if (codigo && Object.prototype.hasOwnProperty.call(countryCodeMap, codigo)) {
    return { countryCode: countryCodeMap[codigo], isoCode: codigo, conocido: true };
  }

  return { countryCode: '+52', isoCode: 'MX', conocido: false };
}

/**
 * Detectar ubicación con prioridad GPS para búsquedas
 * Se usa cuando el usuario interactúa (click OK/búsqueda) - sin warnings
 * SIEMPRE intenta GPS primero, cae a IP solo si falla
 */
export async function detectLocationForSearch() {
  try {
    // SIEMPRE intentar GPS primero (prioridad para búsquedas)
    log('📍 Solicitando ubicación GPS...');
    return await detectByGPS();
  } catch (err) {
    log('📍 GPS no disponible o rechazado, usando IP como fallback...');
    try {
      // Fallback a IP si GPS falla o usuario rechaza
      return await detectByIP();
    } catch (err2) {
      log('IP geolocation falló, usando valores por defecto (México)');
      const randomized = randomizeLocation(19.4326, -99.1332);
      return {
        countryCode: '+52',
        isoCode: 'MX',
        lat: randomized.lat,
        lng: randomized.lng,
      };
    }
  }
}

// Detectar por GPS
function detectByGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API no disponible'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Usar API de reverse geocoding
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const isoCode = data.address?.country_code?.toUpperCase();
          
          if (isoCode && countryCodeMap[isoCode]) {
            // Randomizar ubicación
            const randomized = randomizeLocation(latitude, longitude);
            resolve({
              countryCode: countryCodeMap[isoCode],
              isoCode: isoCode,
              lat: randomized.lat,
              lng: randomized.lng,
            });
          } else {
            reject(new Error('País no soportado'));
          }
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(error);
      }
    );
  });
}

// Detectar por IP (con GeoJS, que SÍ da coordenadas: la base local del servidor es solo de países).
// Solo se llama cuando la persona lo pide con una acción suya —el botón «Búsqueda por IP», o la
// búsqueda del simulador, que necesita un punto de partida—; ya NO al cargar la página (para el
// país, ver ubicacionDeArranque).
async function detectByIP() {
  log('🌐 Intentando detectar por IP...');
  // Con tiempo máximo: una conexión que se cuelga dejaba el spinner del simulador para siempre. Si vence,
  // la búsqueda sigue como cuando GeoJS falla (el llamador usa su punto de partida predeterminado).
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
  const data = await response.json();
  log('📡 Respuesta de geojs.io:', data);
  
  const isoCode = data.country_code?.toUpperCase();
  log('🇨🇴 Código ISO detectado:', isoCode);
  
  if (isoCode && countryCodeMap[isoCode]) {
    const lat = parseFloat(data.latitude) || 19.4326;
    const lng = parseFloat(data.longitude) || -99.1332;
    
    // Randomizar ubicación
    const randomized = randomizeLocation(lat, lng);
    
    log('✅ País mapeado:', isoCode, '->', countryCodeMap[isoCode]);
    
    return {
      countryCode: countryCodeMap[isoCode],
      isoCode: isoCode,
      lat: randomized.lat,
      lng: randomized.lng,
    };
  }
  
  error('❌ País no encontrado en mapeo:', isoCode);
  throw new Error('País no detectado por IP');
}

/**
 * Búsqueda por navegador (GPS)
 * Para ser llamada directamente desde Safe Mode en respuesta a click del usuario
 * SIEMPRE pide GPS (no verifica permisos previamente)
 */
export async function searchByBrowser() {
  log('🔍 Iniciando búsqueda por navegador...');
  
  try {
    const result = await detectByGPS();
    log('✅ Búsqueda por navegador exitosa:', result);
    return result;
  } catch (err) {
    error('❌ Error en búsqueda por navegador:', err);
    throw err;
  }
}

/**
 * Búsqueda por IP
 * Para ser llamada directamente desde Safe Mode
 */
export async function searchByIP() {
  log('🔍 Iniciando búsqueda por IP...');
  try {
    const result = await detectByIP();
    log('✅ Búsqueda por IP exitosa:', result);
    return result;
  } catch (err) {
    error('❌ Error en búsqueda por IP:', err);
    throw err;
  }
}
