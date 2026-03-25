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
    '+351': { code: 'EUR', symbol: '€' },
    '+355': { code: 'ALL', symbol: 'L' },
    '+43': { code: 'EUR', symbol: '€' },
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
    '+82': { code: 'KRW', symbol: '₩' },
    '+36': { code: 'HUF', symbol: 'Ft' },
    '+234': { code: 'NGN', symbol: '₦' },
    '+60': { code: 'MYR', symbol: 'RM' },
    '+45': { code: 'DKK', symbol: 'kr' },
    '+852': { code: 'HKD', symbol: 'HK$' },
    '+976': { code: 'MNT', symbol: '₮' },
    '+224': { code: 'GNF', symbol: 'FG' },
    '+264': { code: 'NAD', symbol: 'N$' },
    '+256': { code: 'UGX', symbol: 'USh' },
    '+267': { code: 'BWP', symbol: 'P' },
    '+374': { code: 'AMD', symbol: '֏' },
    '+7': { code: 'RUB', symbol: '₽' },
    '+66': { code: 'THB', symbol: '฿' },
    '+258': { code: 'MZN', symbol: 'MT' },
    '+65': { code: 'SGD', symbol: 'S$' },
    '+373': { code: 'MDL', symbol: 'L' },
    '+995': { code: 'GEL', symbol: '₾' },
    '+1246': { code: 'BBD', symbol: 'Bds$' },
    '+505': { code: 'NIO', symbol: 'C$' },
    '+501': { code: 'BZD', symbol: 'BZ$' },
    '+212': { code: 'MAD', symbol: 'MAD' },
    '+380': { code: 'UAH', symbol: '₴' },
    '+244': { code: 'AOA', symbol: 'Kz' },
    '+1868': { code: 'TTD', symbol: 'TT$' },
    '+679': { code: 'FJD', symbol: 'FJ$' },
    '+20': { code: 'EGP', symbol: 'E£' },
    '+253': { code: 'DJF', symbol: 'Fdj' },
    '+95': { code: 'MMK', symbol: 'K' },
    '+260': { code: 'ZMW', symbol: 'ZK' },
    '+47': { code: 'NOK', symbol: 'kr' },
    '+853': { code: 'MOP', symbol: 'MOP$' },
    '+1876': { code: 'JMD', symbol: 'J$' },
    '+91': { code: 'INR', symbol: '₹' },
    '+974': { code: 'QAR', symbol: 'QR' },
    '+257': { code: 'BIF', symbol: 'FBu' },
    '+266': { code: 'LSL', symbol: 'L' },
    '+254': { code: 'KES', symbol: 'KSh' },
    '+269': { code: 'KMF', symbol: 'CF' },
    '+689': { code: 'XPF', symbol: '₣' },
    '+86': { code: 'CNY', symbol: '¥' },
    '+856': { code: 'LAK', symbol: '₭' },
    '+268': { code: 'SZL', symbol: 'E' },
    '+504': { code: 'HNL', symbol: 'L' },
    '+354': { code: 'ISK', symbol: 'kr' },
    '+966': { code: 'SAR', symbol: 'SR' },
    '+972': { code: 'ILS', symbol: '₪' },
    '+967': { code: 'YER', symbol: 'YR' },
    '+261': { code: 'MGA', symbol: 'Ar' },
    '+250': { code: 'RWF', symbol: 'RF' },
    '+48': { code: 'PLN', symbol: 'zł' },
    '+500': { code: 'FKP', symbol: '£' },
    '+1767': { code: 'XCD', symbol: 'EC$' },
    '+502': { code: 'GTQ', symbol: 'Q' },
    '+46': { code: 'SEK', symbol: 'kr' },
    '+41': { code: 'CHF', symbol: 'CHF' },
    '+977': { code: 'NPR', symbol: 'Rs' },
    '+231': { code: 'LRD', symbol: 'L$' },
    '+265': { code: 'MWK', symbol: 'MK' },
    '+232': { code: 'SLE', symbol: 'Le' },
    '+297': { code: 'AWG', symbol: 'Afl' },
    '+63': { code: 'PHP', symbol: '₱' },
    '+238': { code: 'CVE', symbol: 'Esc' },
    '+592': { code: 'GYD', symbol: 'G$' },
    '+213': { code: 'DZD', symbol: 'DA' },
    '+387': { code: 'BAM', symbol: 'KM' },
    '+420': { code: 'CZK', symbol: 'Kč' },
    '+230': { code: 'MUR', symbol: 'Rs' },
    '+597': { code: 'SRD', symbol: 'SR$' },
    '+252': { code: 'SOS', symbol: 'Sh' },
    '+389': { code: 'MKD', symbol: 'ден' },
    '+1242': { code: 'BSD', symbol: 'B$' },
    '+64': { code: 'NZD', symbol: 'NZ$' },
    '+220': { code: 'GMD', symbol: 'D' },
    '+84': { code: 'VND', symbol: '₫' },
    '+678': { code: 'VUV', symbol: 'VT' },
    '+685': { code: 'WST', symbol: 'WS$' },
    '+255': { code: 'TZS', symbol: 'TSh' },
    '+350': { code: 'GIP', symbol: '£' },
    '+375': { code: 'BYN', symbol: 'Br' },
    '+676': { code: 'TOP', symbol: 'T$' },
    '+62': { code: 'IDR', symbol: 'Rp' },
    '+381': { code: 'RSD', symbol: 'din' },
    '+506': { code: 'CRC', symbol: '₡' },
    '+1441': { code: 'BMD', symbol: 'BD$' },
    '+599': { code: 'ANG', symbol: 'NAf' },
    '+290': { code: 'SHP', symbol: '£' },
    '+248': { code: 'SCR', symbol: 'SR' },
    '+960': { code: 'MVR', symbol: 'Rf' },
    '+94': { code: 'LKR', symbol: 'Rs' },
    '+855': { code: 'KHR', symbol: '៛' },
    '+40': { code: 'RON', symbol: 'lei' },
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
      paymentMethodConfig = await getPMCConfig(isProductionMode);
      unsubscribePMC = onPMCChange((pmc) => {
        paymentMethodConfig = pmc;
      }, isProductionMode);
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
    bottom: 1rem;
    left: 0;
    right: 0;
    margin: 0;
    font-size: 0.75rem;
    color: #888;
    text-align: center;
    width: 100%;
  }
</style>