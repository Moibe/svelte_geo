// Configuración de Stripe - Backend en Hugging Face Spaces
const STRIPE_BACKEND_DEV = 'https://moibe-stripe-kraken-dev.hf.space/creaLinkSesion/';
const STRIPE_BACKEND_PROD = 'https://moibe-stripe-kraken-prod.hf.space/creaLinkSesion/';

// Usa DEV o PROD según tu preferencia
const STRIPE_BACKEND = STRIPE_BACKEND_PROD;

/**
 * Obtiene el Google Analytics Client ID
 * @returns {string|null} GA Client ID si está disponible
 */
export function getGAClientId() {
  // Intenta obtener el GA Client ID de múltiples fuentes
  
  // 1. Desde gtag.js (Google Analytics 4)
  if (typeof window.gtag !== 'undefined') {
    try {
      window.gtag('get', 'G-XXXXXXXXXX', 'client_id', (clientId) => {
        return clientId;
      });
    } catch (e) {
      console.warn('Error obteniendo GA Client ID de gtag:', e);
    }
  }

  // 2. Desde localStorage (si lo guardamos manualmente)
  const storedGAClientId = localStorage.getItem('ga_client_id');
  if (storedGAClientId) {
    return storedGAClientId;
  }

  // 3. Desde universalGA (GA clásico)
  if (typeof _gaq !== 'undefined') {
    try {
      let clientId = null;
      _gaq.push(function() {
        clientId = _gat._getTrackerByName()._getVisitorId();
      });
      if (clientId) return clientId;
    } catch (e) {
      console.warn('Error obteniendo GA Client ID de _gaq:', e);
    }
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
 * @returns {Promise<Object>} Respuesta del backend
 */
export async function crearSesionPago(
  priceId, 
  unidades = 1, 
  mode = 'payment', 
  options = {}
) {
  try {
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
      console.log('📊 GA Client ID:', gaClientId);
    } else {
      console.warn('⚠️ No se pudo detectar GA Client ID');
    }
    
    if (options.app) {
      params.append('app', options.app);
    }
    if (options.sitio) {
      params.append('sitio', options.sitio);
    }

    console.log('═══════════════════════════════════════');
    console.log('📤 STRIPE KRAKEN - PAYLOAD ENVIADO');
    console.log('═══════════════════════════════════════');
    console.log('🌐 URL:', STRIPE_BACKEND);
    console.log('📦 Parámetros:');
    console.log(JSON.stringify(Object.fromEntries(params), null, 2));
    console.log('🔗 Query string:', params.toString());
    console.log('═══════════════════════════════════════');

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
    console.log('✅ Respuesta del backend:', responseText);

    let checkoutUrl = null;

    // Intentar parsear como JSON primero
    try {
      const data = JSON.parse(responseText);
      
      // Si el JSON parseado es un string (URL directamente)
      if (typeof data === 'string' && data.startsWith('http')) {
        checkoutUrl = data;
      } else if (data && data.checkout_url) {
        checkoutUrl = data.checkout_url;
      } else if (data && data.url) {
        checkoutUrl = data.url;
      } else if (data && data.session && data.session.url) {
        checkoutUrl = data.session.url;
      }
    } catch (e) {
      // No es JSON, verificar si es una URL directamente
      if (responseText.startsWith('http')) {
        checkoutUrl = responseText.trim();
      }
    }

    // Redirigir si tenemos URL válida
    if (checkoutUrl) {
      console.log('🔗 Redirigiendo a Stripe Checkout:', checkoutUrl);
      window.location.href = checkoutUrl;
      return { url: checkoutUrl };
    } else {
      console.error('⚠️ Respuesta no reconocida:', responseText);
      throw new Error('No se recibió URL de checkout válida en la respuesta del backend');
    }
  } catch (error) {
    console.error('❌ Error al crear sesión de pago:', error);
    throw error;
  }
}

/**
 * Obtiene los detalles de un producto por país (desde archivo local)
 * @param {string} countryCode - Código de país (ej: +34)
 * @returns {Promise<Object>} Detalles del precio y producto
 */
export async function getProductDetailsByCountry(countryCode) {
  try {
    console.log(`🔍 Buscando detalles para país: ${countryCode}`);
    
    const response = await fetch('/product-details.json');
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const productData = await response.json();
    console.log('📄 Archivo de detalles cargado, claves disponibles:', Object.keys(productData));
    
    // Intentar encontrar el país específico, si no existe, usar México (+52) como default
    const details = productData[countryCode] || productData['+52'];
    
    if (!details) {
      console.error(`❌ No se encontraron detalles para ${countryCode} ni para México (+52)`);
      throw new Error(`No hay detalles disponibles para el país ${countryCode}`);
    }
    
    if (productData[countryCode]) {
      console.log(`✅ Detalles específicos encontrados para ${countryCode}:`, details);
    } else {
      console.log(`⚠️ No hay precio específico para ${countryCode}, usando México (+52) como default:`, details);
    }
    
    if (!details.priceId) {
      console.error('❌ Price ID missing en detalles:', details);
      throw new Error('Price ID no disponible en los detalles del producto');
    }
    
    return details;
  } catch (error) {
    console.error('❌ Error al obtener detalles del producto:', error);
    
    // Fallback final con México
    const fallback = {
      priceId: 'price_1T1c40IYi36CbmfWavUj4xxu', // México
      product: {
        id: 'prod_TzbGHlbKHkeGiq',
        name: 'GPS SMS Location',
        description: 'Acceso a Mapa Completo'
      },
      price: {
        id: 'price_1T1c40IYi36CbmfWavUj4xxu',
        unit_amount: 20000,
        currency: 'mxn',
        formatted: '$200',
        nickname: 'Default'
      }
    };
    
    console.log('🚨 Usando fallback de México:', fallback);
    return fallback;
  }
}
