import { log, warn, error } from './logger.js';

// Configuración de Stripe - Backend en Hugging Face Spaces
const STRIPE_BACKEND_DEV = 'https://moibe-stripe-kraken-dev.hf.space/creaLinkSesion/';
const STRIPE_BACKEND_PROD = 'https://moibe-stripe-kraken-prod.hf.space/creaLinkSesion/';

/**
 * Obtiene el Google Analytics Client ID
 * GA4 almacena el client_id en la cookie _ga con formato GA1.X.XXXXXXX.XXXXXXX
 * El client_id real son los últimos dos segmentos: XXXXXXX.XXXXXXX
 * @returns {string|null} GA Client ID si está disponible
 */
export function getGAClientId() {
  // 1. Desde la cookie _ga (más confiable — funciona con GTM y gtag directo)
  try {
    const gaCookie = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('_ga='));
    if (gaCookie) {
      const value = gaCookie.split('=')[1]; // e.g. "GA1.1.1234567890.1709058600"
      const parts = value.split('.');
      if (parts.length >= 4) {
        return parts.slice(2).join('.'); // "1234567890.1709058600"
      }
    }
  } catch (e) {
    warn('Error leyendo cookie _ga:', e);
  }

  // 2. Desde localStorage (si fue guardado manualmente en otro flujo)
  const storedGAClientId = localStorage.getItem('ga_client_id');
  if (storedGAClientId) {
    return storedGAClientId;
  }

  return null;
}

/**
 * Crea una sesión de pago con Stripe (usando Stripe Kraken Backend)
 * @param {string} priceId - ID del precio de Stripe (ej: price_xxx)
 * @param {number} unidades - Cantidad de unidades (default: 1)
 * @param {string} mode - Tipo de pago: "payment" (pago único) o "subscription" (suscripción)
 * @param {Object} options - Opciones adicionales
 * @param {string} options.customerEmail - Email del cliente
 * @param {string} options.firebaseUser - ID del usuario de Firebase
 * @param {string} options.customerId - ID existente del cliente en Stripe
 * @param {string} options.gaCliente - Google Analytics Client ID
 * @param {string} options.app - Subdominio (default: "app")
 * @param {string} options.sitio - Nombre del sitio de origen
 * @param {string} options.successUrl - URL de retorno tras pago exitoso
 * @param {string} options.cancelUrl - URL de retorno tras cancelación
 * @param {boolean} options.isProductionMode - true = producción, false = sandbox (default: false)
 * @returns {Promise<Object>} Respuesta del backend
 */
export async function crearSesionPago(
  priceId, 
  unidades = 1, 
  mode = 'payment', 
  options = {}
) {
  try {
    // Determinar modo de Stripe (producción vs sandbox)
    const isProductionMode = options.isProductionMode || false;
    
    // Seleccionar backend según el modo
    const STRIPE_BACKEND = isProductionMode ? STRIPE_BACKEND_PROD : STRIPE_BACKEND_DEV;
    
    log('💳 Stripe Mode:', isProductionMode ? '🏭 PRODUCTION' : '🧪 SANDBOX');
    log('🌐 Backend URL:', STRIPE_BACKEND);
    
    // Validar parámetros requeridos
    if (!priceId) {
      throw new Error('El price_id es requerido');
    }
    if (!mode || !['payment', 'subscription'].includes(mode)) {
      throw new Error('mode debe ser "payment" o "subscription"');
    }
    if (typeof unidades !== 'number' || unidades < 1) {
      throw new Error('unidades debe ser un número mayor a 0');
    }

    const params = new URLSearchParams({
      price_id: priceId,
      unidades: unidades.toString(),
      mode: mode,
    });

    // Agregar parámetros opcionales
    if (options.customerEmail) {
      params.append('customer_email', options.customerEmail);
    }
    if (options.firebaseUser) {
      params.append('firebase_user', options.firebaseUser);
    }
    if (options.customerId) {
      params.append('customer_id', options.customerId);
    }
    
    // Google Analytics - usar el proporcionado o intentar detectarlo
    const gaClientId = options.gaCliente || getGAClientId();
    if (gaClientId) {
      params.append('gaCliente', gaClientId);
      log('📊 GA Client ID:', gaClientId);
    } else {
      warn('⚠️ No se pudo detectar GA Client ID');
    }
    
    if (options.app) {
      params.append('app', options.app);
    }
    if (options.sitio) {
      params.append('sitio', options.sitio);
    }
    if (options.paymentMethodConfiguration) {
      params.append('payment_method_configuration', options.paymentMethodConfiguration);
    }
    if (options.successUrl) {
      params.append('success_url', options.successUrl);
    }
    if (options.cancelUrl) {
      params.append('cancel_url', options.cancelUrl);
    }

    log('═══════════════════════════════════════');
    log('📤 STRIPE KRAKEN - PAYLOAD ENVIADO');
    log('═══════════════════════════════════════');
    log('🌐 URL:', STRIPE_BACKEND);
    log('📦 Parámetros:');
    log(JSON.stringify(Object.fromEntries(params), null, 2));
    log('🔗 Query string:', params.toString());
    log('═══════════════════════════════════════');

    const response = await fetch(STRIPE_BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del backend (${response.status}): ${errorText}`);
    }

    // El backend puede devolver la URL como texto plano o como JSON
    const responseText = await response.text();
    log('✅ Respuesta del backend:', responseText);
    log('📏 Tipo de respuesta:', typeof responseText);
    log('📏 Longitud de respuesta:', responseText.length);

    let checkoutUrl = null;

    // Intentar parsear como JSON primero
    try {
      const data = JSON.parse(responseText);
      log('✅ Parseado como JSON:', data);
      log('🔍 Tipo de data:', typeof data);
      log('🔍 Claves disponibles:', Object.keys(data));
      
      // Si el JSON parseado es un string (URL directamente)
      if (typeof data === 'string' && data.startsWith('http')) {
        checkoutUrl = data;
        log('✓ URL encontrada en string directo');
      } else if (data && data.checkout_url) {
        checkoutUrl = data.checkout_url;
        log('✓ URL encontrada en data.checkout_url');
      } else if (data && data.url) {
        checkoutUrl = data.url;
        log('✓ URL encontrada en data.url');
      } else if (data && data.session && data.session.url) {
        checkoutUrl = data.session.url;
        log('✓ URL encontrada en data.session.url');
      } else {
        error('❌ JSON parseado pero sin URL reconocible. Data completa:', data);
      }
    } catch (e) {
      log('⚠️ No es JSON válido, intentando como texto plano. Error:', e.message);
      // No es JSON, verificar si es una URL directamente
      if (responseText.startsWith('http')) {
        checkoutUrl = responseText.trim();
        log('✓ URL encontrada como texto plano');
      }
    }

    // Redirigir si tenemos URL válida
    if (checkoutUrl) {
      log('🔗 Redirigiendo a Stripe Checkout:', checkoutUrl);
      window.location.href = checkoutUrl;
      return { url: checkoutUrl };
    } else {
      error('⚠️ Respuesta no reconocida:', responseText);
      error('❌ NO SE ENCONTRÓ CHECKOUT URL. Primeros 500 caracteres:', responseText.substring(0, 500));
      throw new Error('No se recibió URL de checkout válida en la respuesta del backend');
    }
  } catch (err) {
    error('❌ Error al crear sesión de pago:', err);
    throw err;
  }
}

/**
 * Obtiene los detalles de un producto por país (desde archivo local)
 * @param {string} countryCode - Código de país (ej: +34)
 * @param {boolean} isProductionMode - true = producción, false = sandbox
 * @returns {Promise<Object>} Detalles del precio y producto
 */
export async function getProductDetailsByCountry(countryCode, isProductionMode = true, priceLevel = 200) {
  try {
    log(`\ud83d\udd0d Buscando detalles para pa\u00eds: ${countryCode} (Modo: ${isProductionMode ? 'PRODUCTION' : 'SANDBOX'}, Nivel: $${priceLevel})`);
    
    const testPriceId = import.meta.env.VITE_STRIPE_TEST_PRICE_ID || 'price_test_default';
    
    const fileName = priceLevel === 100 ? '/product-details-100.json' : '/product-details.json';
    const response = await fetch(fileName);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const productData = await response.json();
    log('📄 Archivo de detalles cargado, claves disponibles:', Object.keys(productData));
    
    // Intentar encontrar el país específico, si no existe, usar México (+52) como default
    const details = productData[countryCode] || productData['+52'];
    
    if (!details) {
      error(`❌ No se encontraron detalles para ${countryCode} ni para México (+52)`);
      throw new Error(`No hay detalles disponibles para el país ${countryCode}`);
    }
    
    if (productData[countryCode]) {
      log(`✅ Detalles específicos encontrados para ${countryCode}:`, details);
    } else {
      log(`⚠️ No hay precio específico para ${countryCode}, usando México (+52) como default:`, details);
    }
    
    if (!details.priceId) {
      error('❌ Price ID missing en detalles:', details);
      throw new Error('Price ID no disponible en los detalles del producto');
    }
    
    return details;
  } catch (err) {
    error('❌ Error al obtener detalles del producto:', err);
    
    // Fallback final con México (según nivel de precio)
    const fallback = priceLevel === 100 ? {
      priceId: 'price_1T6msaIYi36CbmfWYxbCIfix', // México $100
      product: { id: 'prod_U4wmT5U2hLGQoM', name: 'GPS SMS Location', description: 'Acceso a Mapa Completo' },
      price: { id: 'price_1T6msaIYi36CbmfWYxbCIfix', unit_amount: 10000, currency: 'mxn', formatted: '$100', nickname: 'Default $100' }
    } : {
      priceId: 'price_1T1c40IYi36CbmfWavUj4xxu', // México $200
      product: { id: 'prod_TzbGHlbKHkeGiq', name: 'GPS SMS Location', description: 'Acceso a Mapa Completo' },
      price: { id: 'price_1T1c40IYi36CbmfWavUj4xxu', unit_amount: 20000, currency: 'mxn', formatted: '$200', nickname: 'Default $200' }
    };
    
    log('🚨 Usando fallback de México:', fallback);
    return fallback;
  }
}
