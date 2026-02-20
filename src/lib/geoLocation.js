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
  'DO': '+1',
  'PR': '+1',
  'JM': '+1',
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

// Guardar ubicación randomizada en localStorage
export function saveLocationCache(phoneNumber, countryCode, lat, lng) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  localStorage.setItem(key, JSON.stringify({ lat, lng }));
}

// Recuperar ubicación randomizada del localStorage
export function getLocationCache(phoneNumber, countryCode) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  const cached = localStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
}

// Limpiar cache de ubicación
export function clearLocationCache(phoneNumber, countryCode) {
  const key = `geo_cache_${countryCode}_${phoneNumber}`;
  localStorage.removeItem(key);
}

// Detectar país y ubicación por IP (para detección inicial sin pedir GPS)
// Esta función se usa en onMount solo para establecer país/idioma/ubicación inicial
export async function detectCountry() {
  try {
    // Usar IP geolocation (rápido, sin permisos, sin warnings)
    return await detectByIP();
  } catch (error) {
    console.log('IP geolocation falló, usando valores por defecto (México)');
    // Randomizar CDMX por defecto
    const randomized = randomizeLocation(19.4326, -99.1332);
    return {
      countryCode: '+52',
      isoCode: 'MX',
      lat: randomized.lat,
      lng: randomized.lng,
    };
  }
}

/**
 * Detectar ubicación con prioridad GPS para búsquedas
 * Se usa cuando el usuario interactúa (click OK/búsqueda) - sin warnings
 * SIEMPRE intenta GPS primero, cae a IP solo si falla
 */
export async function detectLocationForSearch() {
  try {
    // SIEMPRE intentar GPS primero (prioridad para búsquedas)
    console.log('📍 Solicitando ubicación GPS...');
    return await detectByGPS();
  } catch (error) {
    console.log('📍 GPS no disponible o rechazado, usando IP como fallback...');
    try {
      // Fallback a IP si GPS falla o usuario rechaza
      return await detectByIP();
    } catch (err) {
      console.log('IP geolocation falló, usando valores por defecto (México)');
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

// Detectar por IP
async function detectByIP() {
  console.log('🌐 Intentando detectar por IP...');
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
  const data = await response.json();
  console.log('📡 Respuesta de geojs.io:', data);
  
  const isoCode = data.country_code?.toUpperCase();
  console.log('🇨🇴 Código ISO detectado:', isoCode);
  
  if (isoCode && countryCodeMap[isoCode]) {
    const lat = parseFloat(data.latitude) || 19.4326;
    const lng = parseFloat(data.longitude) || -99.1332;
    
    // Randomizar ubicación
    const randomized = randomizeLocation(lat, lng);
    
    console.log('✅ País mapeado:', isoCode, '->', countryCodeMap[isoCode]);
    
    return {
      countryCode: countryCodeMap[isoCode],
      isoCode: isoCode,
      lat: randomized.lat,
      lng: randomized.lng,
    };
  }
  
  console.error('❌ País no encontrado en mapeo:', isoCode);
  throw new Error('País no detectado por IP');
}

/**
 * Búsqueda por navegador (GPS)
 * Para ser llamada directamente desde Safe Mode en respuesta a click del usuario
 * SIEMPRE pide GPS (no verifica permisos previamente)
 */
export async function searchByBrowser() {
  console.log('🔍 Iniciando búsqueda por navegador...');
  
  try {
    const result = await detectByGPS();
    console.log('✅ Búsqueda por navegador exitosa:', result);
    return result;
  } catch (error) {
    console.error('❌ Error en búsqueda por navegador:', error);
    throw error;
  }
}

/**
 * Búsqueda por IP
 * Para ser llamada directamente desde Safe Mode
 */
export async function searchByIP() {
  console.log('🔍 Iniciando búsqueda por IP...');
  try {
    const result = await detectByIP();
    console.log('✅ Búsqueda por IP exitosa:', result);
    return result;
  } catch (error) {
    console.error('❌ Error en búsqueda por IP:', error);
    throw error;
  }
}
