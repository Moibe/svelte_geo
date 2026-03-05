<script>
  import { onMount, onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { crearSesionPago, getProductDetailsByCountry, getGAClientId } from './stripe.js';
  import { getPMCConfig, onPMCChange, getStripeModeConfig, onStripeModeChange, getPriceTestConfig, onPriceTestChange } from './firebase.js';
  import { logConversion } from './conversionLogger.js';
  import { log, warn, error } from './logger.js';
  
  export let isVisible = false;
  export let onClose = () => {};
  export let countryCode = '';
  export let countryISO = 'MX'; // Código ISO del país (de geolocalización real)

  let paymentMethodConfig = null; // PMC desde Firestore (geo-stripe.PMC)
  let unsubscribePMC;
  let priceTestOverride = null;   // Override de precio para pruebas en producción (geo-stripe.price-test)
  let unsubscribePriceTest;
  export let mapLat = 19.4326;
  export let mapLng = -99.1332;
  export let priceLevel = 200;
  
  let isLoading = false;
  let errorMessage = '';
  let productDetails = null;
  let loadingDetails = false;
  let isProductionMode = false; // true = producción, false = sandbox
  let unsubscribeStripeMode = null;

  // Mapeo de códigos de país a monedas
  const currencyMap = {
    '+1': { code: 'USD', symbol: '$' },
    '+52': { code: 'MXN', symbol: '$' }, 
    '+54': { code: 'ARS', symbol: '$' },
    '+55': { code: 'BRL', symbol: 'R$' },
    '+56': { code: 'CLP', symbol: '$' },
    '+57': { code: 'COP', symbol: '$' },
    '+51': { code: 'PEN', symbol: 'S/' },
    '+58': { code: 'VES', symbol: 'Bs.' },
    '+593': { code: 'USD', symbol: '$' },
    '+591': { code: 'BOB', symbol: 'Bs.' },
    '+595': { code: 'PYG', symbol: '₲' },
    '+598': { code: 'UYU', symbol: '$U' },
    '+34': { code: 'EUR', symbol: '€' },
    '+33': { code: 'EUR', symbol: '€' },
    '+49': { code: 'EUR', symbol: '€' },
    '+351': { code: 'EUR', symbol: '€' },    '+355': { code: 'ALL', symbol: 'L' },    '+43': { code: 'EUR', symbol: '€' },
    '+32': { code: 'EUR', symbol: '€' },
    '+352': { code: 'EUR', symbol: '€' },
    '+353': { code: 'EUR', symbol: '€' },
    '+39': { code: 'EUR', symbol: '€' },
    '+31': { code: 'EUR', symbol: '€' },
    '+30': { code: 'EUR', symbol: '€' },
    '+358': { code: 'EUR', symbol: '€' },
    '+44': { code: 'GBP', symbol: '£' },
    '+359': { code: 'EUR', symbol: '€' },
    '+61': { code: 'AUD', symbol: '$' },
    '+82': { code: 'KRW', symbol: '₩' }
  };

  onMount(async () => {
    // Cargar modo de Stripe desde Firestore
    try {
      isProductionMode = await getStripeModeConfig();
      
      // Escuchar cambios en tiempo real
      unsubscribeStripeMode = onStripeModeChange((isProd) => {
        isProductionMode = isProd;
        log('💳 Stripe Mode actualizado:', isProd ? 'PRODUCTION' : 'SANDBOX');
        // Recargar detalles del producto si el modal está visible
        if (isVisible && countryCode) {
          productDetails = null;
          loadProductDetails();
        }
      });
    } catch (err) {
      error('❌ Error al cargar Stripe Mode:', err);
      isProductionMode = false; // Default a sandbox por seguridad
    }

    try {
      paymentMethodConfig = await getPMCConfig();
      unsubscribePMC = onPMCChange((pmc) => {
        paymentMethodConfig = pmc;
      });
    } catch (err) {
      error('❌ Error al cargar PMC:', err);
      paymentMethodConfig = null;
    }

    try {
      priceTestOverride = await getPriceTestConfig();
      if (priceTestOverride) log('🧪 PROD TEST PRICE override activo:', priceTestOverride);
      unsubscribePriceTest = onPriceTestChange((price) => {
        priceTestOverride = price;
        log('🧪 PROD TEST PRICE actualizado:', price || 'desactivado');
        if (isVisible && countryCode) {
          productDetails = null;
          loadProductDetails();
        }
      });
    } catch (err) {
      error('❌ Error al cargar price-test:', err);
      priceTestOverride = null;
    }
  });

  onDestroy(() => {
    if (unsubscribeStripeMode) unsubscribeStripeMode();
    if (unsubscribePMC) unsubscribePMC();
    if (unsubscribePriceTest) unsubscribePriceTest();
  });

  function getCurrency(code) {
    return currencyMap[code] || { code: 'USD', symbol: '$' };
  }

  // Cargar detalles del producto cuando se muestra el modal, cambia el pa\u00eds o cambia el nivel de precio
  $: if (isVisible && countryCode) {
    productDetails = null;
    loadProductDetails();
  }

  async function loadProductDetails() {
    loadingDetails = true;
    
    try {
      // En modo SANDBOX, usar un precio fijo para todos los países
      if (!isProductionMode) {
        // Usar configuración de sandbox desde variables de entorno
        const testPriceId = import.meta.env.VITE_STRIPE_TEST_PRICE_ID || 'price_test_default';
        productDetails = {
          priceId: testPriceId,
          price: {
            amount: 100, // $1.00 en sandbox
            formatted: '1.00'
          }
        };
        log('🧪 SANDBOX MODE - Usando precio de prueba:', testPriceId);
      } else {
        // En modo PRODUCCIÓN, usar precios por país
        productDetails = await getProductDetailsByCountry(countryCode, isProductionMode, priceLevel);
        // Aplicar override de price-test si está activo
        if (priceTestOverride) {
          log('🧪 PROD TEST PRICE aplicado:', priceTestOverride, '(reemplaza:', productDetails.priceId + ')');
          productDetails = { ...productDetails, priceId: priceTestOverride };
        } else {
          log('🏭 PRODUCTION MODE - Precio por país cargado');
        }
      }
    } catch (err) {
      error('Error loading product details:', err);
    } finally {
      loadingDetails = false;
    }
  }

  async function handlePayment() {
    isLoading = true;
    errorMessage = '';
    
    try {
      if (!productDetails?.priceId) {
        throw new Error('No se pudieron cargar los detalles del producto.');
      }

      // Guardar coordenadas del mapa en localStorage antes de ir a Stripe
      localStorage.setItem('map_coords', JSON.stringify({ lat: mapLat, lng: mapLng }));

      // Guardar datos de la compra para el evento de conversión
      const purchaseData = {
        transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        value: productDetails.price.amount / 100, // Convertir centavos a unidad
        currency: getCurrency(countryCode).code,
        price_id: productDetails.priceId,
        country_code: countryCode,
        country_iso: countryISO, // Usar ISO real de geolocalización
        timestamp: Date.now()
      };
      localStorage.setItem('purchase_data', JSON.stringify(purchaseData));
      log('💾 Datos de compra guardados para conversión:', purchaseData);

      // Registrar clic en botón de compra en MariaDB
      const ctxRaw = localStorage.getItem('conversion_context');
      const ctx = ctxRaw ? JSON.parse(ctxRaw) : {};
      logConversion({
        type: 'buy_click',
        gaClientId: getGAClientId(),
        phone: ctx.phone || '',
        language: ctx.language || 'es',
        ipDetection: ctx.ipDetection || null,
        gpsDetection: ctx.gpsDetection || null,
        searchMethod: ctx.searchMethod || 'none',
        locationShown: { lat: mapLat, lng: mapLng },
        countryISO: countryISO,
        countryCode: countryCode,
        utmSource: ctx.utmSource || null,
        utmMedium: ctx.utmMedium || null,
        utmCampaign: ctx.utmCampaign || null,
        utmTerm: ctx.utmTerm || null,
        utmContent: ctx.utmContent || null,
        gclid: ctx.gclid || null,
        fbclid: ctx.fbclid || null,
      });
      log('🛒 buy_click registrado en MariaDB');

      const gaClientId = getGAClientId();
      const baseUrl = window.location.origin;

      await crearSesionPago(
        productDetails.priceId,
        1,
        'payment',
        {
          gaCliente: gaClientId,
          sitio: 'svelte-geo',
          app: 'geo',
          ...(paymentMethodConfig ? { paymentMethodConfiguration: paymentMethodConfig } : {}),
          successUrl: `${baseUrl}?payment=success`,
          cancelUrl: baseUrl,
          isProductionMode: isProductionMode // Pasar modo de Stripe
        }
      );
    } catch (error) {
      errorMessage = error.message || 'Error al procesar el pago. Intenta de nuevo.';
      isLoading = false;
    }
  }
</script>

{#if isVisible}
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="payment-section">
        {#if loadingDetails}
          <div class="radio-button">
            <div class="radio-dot"></div>
          </div>
          <div class="content">
            <h2>{$_('modal.loading')}</h2>
          </div>
        {:else if productDetails}
          <div class="radio-button">
            <div class="radio-dot"></div>
          </div>
          <div class="content">
            <h2>{$_('modal.title')}</h2>
          </div>
          <div class="price">{productDetails.price.formatted}{productDetails.price.formatted.endsWith(getCurrency(countryCode).code) ? '' : ' ' + getCurrency(countryCode).code}</div>
          <button 
            class="payment-button"
            on:click={handlePayment}
            disabled={isLoading || loadingDetails || !productDetails}
          >
            {isLoading ? $_('modal.processing') : $_('modal.buyButton')}
          </button>
        {:else}
          <div class="radio-button">
            <div class="radio-dot"></div>
          </div>
          <div class="content">
            <h2>{$_('modal.premium')}</h2>
          </div>
        {/if}
        
        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}
        
        <p class="stripe-text">{$_('modal.securePayment')}</p>
        <div class="card-icons">
          <!-- Visa -->
          <svg viewBox="0 0 48 32" class="card-icon">
            <rect fill="#1A1F71" width="48" height="32" rx="4"/>
            <path fill="#FFFFFF" d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm-5.3 0h-2.8l-2.5-8.1-.3 1.6-.9 5.3s-.1.6-.4.9c-.3.3-.7.3-.7.3h-4.1l-.1-.3s1.5-.3 2.9-1.5c1.4-1.2 2.1-3 2.1-3l3.4-8.2h2.8l4.3 10.5h-2.8l-.9-2.5zm16.5-7.8c0-.6.5-1.2 1.6-1.2.8 0 1.5.2 1.9.4l.3-2s-.7-.3-1.9-.3c-2.9 0-4.6 1.5-4.6 3.6 0 1.6 1.4 2.5 2.5 3 1.1.5 1.5.9 1.5 1.4 0 .7-.9 1.1-1.7 1.1-1.2 0-2-.3-2.5-.5l-.4 2.1s.9.4 2.4.4c3 0 4.8-1.5 4.8-3.7 0-2.8-3.9-3-3.9-4.3zm11.8-2.7h-2.2c-.7 0-1.2.2-1.5.8L34 21h2.8l.6-1.6h3.4l.3 1.6h2.5l-2.1-10.5zm-3.2 6.8l1.4-3.8.8 3.8h-2.2z"/>
          </svg>
          <!-- Mastercard -->
          <svg viewBox="0 0 48 32" class="card-icon">
            <rect fill="#000000" width="48" height="32" rx="4"/>
            <circle fill="#EB001B" cx="18" cy="16" r="9"/>
            <circle fill="#F79E1B" cx="30" cy="16" r="9"/>
            <path fill="#FF5F00" d="M24 9.2c2.2 1.7 3.6 4.4 3.6 7.3s-1.4 5.6-3.6 7.3c-2.2-1.7-3.6-4.4-3.6-7.3s1.4-5.6 3.6-7.3z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(30, 60, 114, 0.7) 0%, rgba(42, 82, 152, 0.7) 100%);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    padding: 1rem 2rem;
    max-width: 600px;
    width: 90%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 20px 60px rgba(0, 0, 0, 0.3),
      0 0 80px rgba(255, 255, 255, 0.6),
      0 0 120px rgba(255, 255, 255, 0.4),
      0 0 160px rgba(255, 255, 255, 0.2);
  }

  .payment-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
    width: 100%;
  }

  .radio-button {
    background: #4A90E2;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
  }

  .radio-dot {
    background: white;
    border-radius: 50%;
    width: 6px;
    height: 6px;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .content h2 {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
    font-weight: 600;
    white-space: nowrap;
  }

  .price {
    font-size: 1.25rem;
    font-weight: 700;
    color: #2c5f8d;
    margin: 0;
    flex-shrink: 0;
  }

  .payment-button {
    background: #2c5f8d;
    color: white;
    border: none;
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .payment-button:hover:not(:disabled) {
    background: #234a6e;
    transform: translateY(-1px);
  }

  .payment-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    background: #fee;
    color: #c33;
    padding: 0.75rem;
    border-radius: 8px;
    margin: 0.5rem 0;
    font-size: 0.9rem;
    border-left: 4px solid #c33;
    width: 100%;
  }

  .stripe-text {
    position: absolute;
    bottom: 2.5rem;
    left: 0;
    right: 0;
    margin: 0;
    font-size: 0.75rem;
    color: #888;
    text-align: center;
    width: 100%;
  }

  .card-icons {
    position: absolute;
    bottom: 0.8rem;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .card-icon {
    width: 36px;
    height: 24px;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .card-icon:hover {
    opacity: 1;
  }
</style>