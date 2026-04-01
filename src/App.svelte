<script>
  import { onMount, onDestroy } from 'svelte';
  import { _ , locale } from 'svelte-i18n';
  import CountrySelect from './lib/CountrySelect.svelte';
  import PhoneInput from './lib/PhoneInput.svelte';
  import Map from './lib/Map.svelte';
  import LoadingSpinner from './lib/LoadingSpinner.svelte';
  import Modal from './lib/Modal.svelte';
  import LanguageSelector from './lib/LanguageSelector.svelte';
  import { detectCountry, getLocationCache, saveLocationCache, searchByBrowser, searchByIP } from './lib/geoLocation.js';
  import { getGAClientId } from './lib/stripe.js';
  import { logConversion } from './lib/conversionLogger.js';
  import { setLanguageFromCountry, getLanguageFromCountry } from './lib/i18n.js';
  import { getSafeModeConfig, onSafeModeChange, getStripeModeConfig, onStripeModeChange, getModalWaitConfig, onModalWaitChange, getSellConfig, onSellChange, getVerboseConfig, onVerboseChange, getMapInteractionConfig, onMapInteractionChange, getMapWaitConfig, onMapWaitChange, getSellPopConfig, onSellPopChange, getPhoneSearchConfig, onPhoneSearchChange, getPriceLevelConfig, onPriceLevelChange } from './lib/firebase.js';
  import { verboseStore, log, warn, error } from './lib/logger.js';

  let phoneNumber = '';
  let selectedCountry = '+1'; // País del teléfono que busca
  let userCountryCode = '+52'; // País real del usuario (para precio Stripe)
  let userCountryISO = 'MX'; // Código ISO del país del usuario (MX, US, BR, etc.)
  let showMap = false;
  let showSpinner = false;
  let showModal = false;
  let mapCoords = { lat: 19.4326, lng: -99.1332 }; // Default CDMX
  let lastUsedPhoneNumber = '';
  let safeMode = null; // Estado de Safe Mode (cargado desde Firestore, null = cargando)
  let unsubscribe = null; // Función para detener listener de Firestore
  let unsubscribeStripeMode = null; // Función para detener listener de Stripe Mode
  let unsubscribeModalWait = null; // Función para detener listener de Modal Wait
  let unsubscribeSell = null; // Función para detener listener de Sell Config
  let unsubscribeVerbose = null; // Función para detener listener de Verbose Config
  let isProductionMode = false; // Estado de Stripe Mode (false = sandbox, true = production)
  let waitSafe = 30; // Tiempo de espera en Safe Mode (segundos)
  let waitProd = 30; // Tiempo de espera en modo producción (segundos)
  let sellEnabled = true; // Estado de venta (true = mostrar modal, false = nunca mostrar)
  let mapInteractionEnabled = false; // Si true, dispara purchase al interactuar con mapa
  let unsubscribeMapInteraction = null;
  let mapWaitEnabled = false;        // Si true, dispara purchase al quedarse X segundos en mapa
  let mapWaitTime = 30;              // Segundos a esperar (desde Firestore)
  let unsubscribeMapWait = null;
  let sellPopEnabled = false;        // Si true, dispara purchase cuando se abre el modal de ventas
  let unsubscribeSellPop = null;
  let phoneSearchEnabled = false;    // Si true, dispara purchase cuando el usuario busca un teléfono
  let unsubscribePhoneSearch = null;
  let priceLevel = 200;              // Nivel de precio (100 = producto barato, 200 = producto original)
  let unsubscribePriceLevel = null;  // Función para detener listener de Price Level

  // Datos de sesión para logging de conversiones
  let ipDetectionResult = null;  // Resultado de detección inicial por IP
  let gpsDetectionResult = null; // Resultado de detección por GPS (si ocurrió)
  let searchMethod = 'none';     // 'phone', 'browser', 'ip', 'none'

  // Parámetros de campaña (UTM + Click IDs)
  let utmSource   = null;
  let utmMedium   = null;
  let utmCampaign = null;
  let utmTerm     = null;
  let utmContent  = null;
  let gclid       = null;
  let fbclid      = null;
  let handleVisibilityChange = null;
  
  // Tiempo de espera actual basado en el modo (Safe Mode usa waitSafe, Normal Mode usa waitProd)
  $: currentWaitTime = (safeMode ? waitSafe : waitProd) * 1000;
  


  // Función para generar posición random
  function randomizeLocation(lat, lng) {
    const kmToDegrees = 5 / 111;
    const latOffset = (Math.random() - 0.5) * 2 * kmToDegrees;
    const lngOffset = (Math.random() - 0.5) * 2 * kmToDegrees;
    
    return {
      lat: lat + latOffset,
      lng: lng + lngOffset,
    };
  }

  onMount(async () => {
    // Cargar configuración de Verbose PRIMERO (antes que otros logs)
    try {
      const verboseEnabled = await getVerboseConfig();
      verboseStore.set(verboseEnabled);
      log('🔊 Verbose logging:', verboseEnabled ? 'ACTIVADO' : 'DESACTIVADO');
      
      // Escuchar cambios en tiempo real
      unsubscribeVerbose = onVerboseChange((newValue) => {
        verboseStore.set(newValue);
        log('🔄 Verbose logging actualizado:', newValue ? 'ACTIVADO' : 'DESACTIVADO');
      });
    } catch (err) {
      error('❌ Error al cargar configuración verbose:', err);
      verboseStore.set(true); // Default a true si falla
    }
    
    // Cargar configuración de Safe Mode desde Firestore
    try {
      safeMode = await getSafeModeConfig();
      log('🔧 Safe Mode inicial:', safeMode);
      
      // Escuchar cambios en tiempo real
      unsubscribe = onSafeModeChange((newValue) => {
        safeMode = newValue;
        log('🔄 Safe Mode actualizado a:', safeMode);
      });
    } catch (err) {
      error('❌ Error al cargar Safe Mode:', err);
      safeMode = false; // Default a modo normal si falla
    }
    
    // Cargar configuración de Stripe Mode desde Firestore
    try {
      isProductionMode = await getStripeModeConfig();
      log('💳 Stripe Mode inicial:', isProductionMode ? 'PRODUCTION' : 'SANDBOX');
      
      // Escuchar cambios en tiempo real
      unsubscribeStripeMode = onStripeModeChange((newValue) => {
        isProductionMode = newValue;
        log('💳 Stripe Mode actualizado a:', newValue ? 'PRODUCTION' : 'SANDBOX');
      });
    } catch (err) {
      error('❌ Error al cargar Stripe Mode:', err);
      isProductionMode = false; // Default a sandbox si falla
    }
    
    // Cargar configuración de tiempos de espera desde Firestore
    try {
      const waitConfig = await getModalWaitConfig();
      waitSafe = waitConfig.waitSafe;
      waitProd = waitConfig.waitProd;
      log('⏱️ Tiempos de espera iniciales - Safe Mode:', waitSafe, 's (' + (waitSafe * 1000) + 'ms), Normal Mode:', waitProd, 's (' + (waitProd * 1000) + 'ms)');
      
      // Escuchar cambios en tiempo real
      unsubscribeModalWait = onModalWaitChange((newConfig) => {
        waitSafe = newConfig.waitSafe;
        waitProd = newConfig.waitProd;
        log('⏱️ Tiempos actualizados - Safe Mode:', waitSafe, 's (' + (waitSafe * 1000) + 'ms), Normal Mode:', waitProd, 's (' + (waitProd * 1000) + 'ms)');
        log('⏱️ Tiempo actual en uso:', currentWaitTime, 'ms');
      });
    } catch (err) {
      error('❌ Error al cargar tiempos de espera:', err);
      waitSafe = 30;
      waitProd = 30;
    }
    
    // Cargar configuración de venta desde Firestore
    try {
      sellEnabled = await getSellConfig();
      log('💰 Configuración de venta inicial:', sellEnabled ? 'ACTIVADA' : 'DESACTIVADA');
      
      // Escuchar cambios en tiempo real
      unsubscribeSell = onSellChange((newValue) => {
        sellEnabled = newValue;
        log('🔄 Configuración de venta actualizada:', sellEnabled ? 'ACTIVADA' : 'DESACTIVADA');
      });
    } catch (err) {
      error('❌ Error al cargar configuración de venta:', err);
      sellEnabled = true; // Default a mostrar modal
    }

    try {
      mapInteractionEnabled = await getMapInteractionConfig();
      log('🗺️ Map Interaction purchase:', mapInteractionEnabled ? 'ACTIVADO' : 'DESACTIVADO');
      unsubscribeMapInteraction = onMapInteractionChange((newValue) => {
        mapInteractionEnabled = newValue;
        log('🗺️ Map Interaction purchase actualizado:', newValue ? 'ACTIVADO' : 'DESACTIVADO');
      });
    } catch (err) {
      error('❌ Error al cargar map-interaction:', err);
      mapInteractionEnabled = false;
    }

    try {
      const mapWaitCfg = await getMapWaitConfig();
      mapWaitEnabled = mapWaitCfg.enabled;
      mapWaitTime = mapWaitCfg.waitTime;
      log(`⏱️ Map Wait purchase: ${mapWaitEnabled ? 'ACTIVADO' : 'DESACTIVADO'} (${mapWaitTime}s)`);
      unsubscribeMapWait = onMapWaitChange((newValue) => {
        mapWaitEnabled = newValue.enabled;
        mapWaitTime = newValue.waitTime;
        log(`⏱️ Map Wait purchase actualizado: ${newValue.enabled ? 'ACTIVADO' : 'DESACTIVADO'} (${newValue.waitTime}s)`);
      });
    } catch (err) {
      error('❌ Error al cargar map-wait:', err);
      mapWaitEnabled = false;
    }

    try {
      sellPopEnabled = await getSellPopConfig();
      log(`🛒 Sell Pop purchase: ${sellPopEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
      unsubscribeSellPop = onSellPopChange((newValue) => {
        sellPopEnabled = newValue;
        log(`🛒 Sell Pop purchase actualizado: ${newValue ? 'ACTIVADO' : 'DESACTIVADO'}`);
      });
    } catch (err) {
      error('❌ Error al cargar sell-pop:', err);
      sellPopEnabled = false;
    }

    try {
      phoneSearchEnabled = await getPhoneSearchConfig();
      log(`📱 Phone Search purchase: ${phoneSearchEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
      unsubscribePhoneSearch = onPhoneSearchChange((newValue) => {
        phoneSearchEnabled = newValue;
        log(`📱 Phone Search purchase actualizado: ${newValue ? 'ACTIVADO' : 'DESACTIVADO'}`);
      });
    } catch (err) {
      error('❌ Error al cargar phone-search:', err);
      phoneSearchEnabled = false;
    }

    try {
      priceLevel = await getPriceLevelConfig();
      log(`💲 Price Level: ${priceLevel}`);
      unsubscribePriceLevel = onPriceLevelChange((newValue) => {
        priceLevel = newValue;
        log(`💲 Price Level actualizado: ${newValue}`);
      });
    } catch (err) {
      error('❌ Error al cargar price-level:', err);
      priceLevel = 200;
    }

    // Detectar país y ubicación REAL del usuario
    const locationData = await detectCountry();
    ipDetectionResult = locationData; // Guardar para logging de conversiones
    userCountryCode = locationData.countryCode; // Para precio Stripe
    userCountryISO = locationData.isoCode || 'MX'; // Código ISO del país
    selectedCountry = locationData.countryCode; // Para dropdown (inicia con país del usuario)
    mapCoords = { lat: locationData.lat, lng: locationData.lng };
    
    // Establecer idioma automáticamente según el país
    setLanguageFromCountry(locationData.countryCode);
    
    log('🌍 Ubicación del usuario detectada:');
    log('   📞 Código telefónico:', userCountryCode);
    if (locationData.isoCode) {
      log('   🏴 Código ISO país:', locationData.isoCode);
    }
    log('   🌐 Idioma establecido:', getLanguageFromCountry(locationData.countryCode) === 'es' ? 'Español' : 'English');
    
    // Recuperar el último teléfono usado
    const lastPhone = localStorage.getItem('last_phone_number');
    lastUsedPhoneNumber = lastPhone || '';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📡 PARÁMETROS DE CAMPAÑA (UTM + Click IDs)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const urlParams = new URLSearchParams(window.location.search);
    utmSource   = urlParams.get('utm_source');
    utmMedium   = urlParams.get('utm_medium');
    utmCampaign = urlParams.get('utm_campaign');
    utmTerm     = urlParams.get('utm_term');
    utmContent  = urlParams.get('utm_content');
    gclid       = urlParams.get('gclid');
    fbclid      = urlParams.get('fbclid');

    const hasUtm = utmSource || utmMedium || utmCampaign || utmTerm || utmContent || gclid || fbclid;
    if (hasUtm) {
      log('┌─────────────────────────────────────────');
      log('│ 🎯 CAMPAÑA DE ADS DETECTADA');
      if (utmSource)   log('│   🔎 utm_source   :', utmSource);
      if (utmMedium)   log('│   📡 utm_medium   :', utmMedium);
      if (utmCampaign) log('│   📣 utm_campaign :', utmCampaign);
      if (utmTerm)     log('│   🔤 utm_term     :', utmTerm);
      if (utmContent)  log('│   🖼️  utm_content  :', utmContent);
      if (gclid)       log('│   🟦 gclid        :', gclid);
      if (fbclid)      log('│   🟦 fbclid       :', fbclid);
      log('└─────────────────────────────────────────');

      // Registrar visita desde anuncio en MariaDB
      logConversion({
        type: 'ad_visit',
        gaClientId: getGAClientId(),
        phone: '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: null,
        searchMethod: 'none',
        locationShown: mapCoords,
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
      });
      log('📣 ad_visit registrado en MariaDB');
    } else if (urlParams.get('payment') === 'cancelled') {
      log('🚫 Retorno de Stripe sin comprar (flake_out)');
      logConversion({
        type: 'flake_out',
        gaClientId: getGAClientId(),
        phone: localStorage.getItem('last_phone_number') || '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: null,
        searchMethod: 'none',
        locationShown: mapCoords,
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, gclid: null, fbclid: null,
      });
      log('🚫 flake_out registrado en MariaDB');
      // Limpiar parámetro de la URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      log('📡 Sin parámetros de campaña (tráfico directo u orgánico)');
      // Registrar visita orgánica en MariaDB
      logConversion({
        type: 'organic_visit',
        gaClientId: getGAClientId(),
        phone: '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: null,
        searchMethod: 'none',
        locationShown: mapCoords,
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, gclid: null, fbclid: null,
      });
      log('🌿 organic_visit registrado en MariaDB');
    }

    // Detectar retorno de Stripe sin comprar (flake_out)
    const pendingCheckout = localStorage.getItem('pending_checkout');
    if (pendingCheckout && urlParams.get('payment') !== 'success') {
      localStorage.removeItem('pending_checkout');
      localStorage.removeItem('purchase_data');
      log('🚫 Retorno de Stripe sin comprar (flake_out)');
      logConversion({
        type: 'flake_out',
        gaClientId: getGAClientId(),
        phone: localStorage.getItem('last_phone_number') || '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: null,
        searchMethod: 'none',
        locationShown: mapCoords,
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, gclid: null, fbclid: null,
      });
      log('🚫 flake_out registrado en MariaDB');
    }

    // Detectar retorno exitoso de Stripe
    if (urlParams.get('payment') === 'success') {
      // Restaurar coordenadas del mapa desde localStorage
      const savedCoords = localStorage.getItem('map_coords');
      if (savedCoords) {
        try {
          const coords = JSON.parse(savedCoords);
          mapCoords = coords;
          showMap = true;
          
          // Enviar evento de conversión a Google Analytics/Ads
          const purchaseData = localStorage.getItem('purchase_data');
          if (purchaseData) {
            try {
              const data = JSON.parse(purchaseData);
              
              // Enviar eventos de compra a GA4 vía GTM (dataLayer)
              if (typeof window.dataLayer !== 'undefined') {
                window.dataLayer.push({
                  event: 'purchase',
                  transaction_id: data.transaction_id,
                  value: data.value,
                  currency: data.currency,
                  items: [{
                    item_id: data.price_id,
                    item_name: 'Mapa Completo GPS',
                    item_category: 'Geolocalización',
                    price: data.value,
                    quantity: 1
                  }]
                });
                // Evento de conversión principal para Google Ads
                window.dataLayer.push({
                  event: 'compra_geo',
                  transaction_id: data.transaction_id,
                  value: data.value,
                  currency: data.currency
                });
                log('✅ Eventos purchase y compra_geo enviados vía GTM:', data);
              }
              
              // Registrar compra real en MariaDB
              const conversionCtxRaw = localStorage.getItem('conversion_context');
              const ctx = conversionCtxRaw ? JSON.parse(conversionCtxRaw) : {};
              logConversion({
                type: 'purchase',
                gaClientId: getGAClientId(),
                phone: ctx.phone || localStorage.getItem('last_phone_number') || '',
                language: ctx.language || 'es',
                ipDetection: ctx.ipDetection || null,
                gpsDetection: ctx.gpsDetection || null,
                searchMethod: ctx.searchMethod || 'none',
                locationShown: ctx.locationShown || mapCoords,
                countryISO: data.country_iso || ctx.countryISO || 'MX',
                countryCode: data.country_code || ctx.countryCode || '+52',
                utmSource: ctx.utmSource || null,
                utmMedium: ctx.utmMedium || null,
                utmCampaign: ctx.utmCampaign || null,
                utmTerm: ctx.utmTerm || null,
                utmContent: ctx.utmContent || null,
                gclid: ctx.gclid || null,
                fbclid: ctx.fbclid || null,
                purchaseValue: data.value,
                purchaseCurrency: data.currency,
              });
              log('✅ Compra real registrada en MariaDB');

              // Limpiar datos de compra (ya enviados)
              localStorage.removeItem('purchase_data');
              localStorage.removeItem('pending_checkout');
              localStorage.removeItem('conversion_context');
            } catch (e) {
              error('Error al procesar datos de compra:', e);
            }
          }
          
          // Limpiar el parámetro de la URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          log('✅ Pago exitoso - Mapa restaurado');
        } catch (e) {
          error('Error al restaurar coordenadas:', e);
        }
      }
    }

    // Detectar si fue un refresh de la página
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'reload') {
        log('🔄 Page reload detectado (page_refresh)');
        logConversion({
          type: 'page_refresh',
          gaClientId: getGAClientId(),
          phone: lastUsedPhoneNumber || '',
          language: $locale,
          ipDetection: ipDetectionResult,
          gpsDetection: null,
          searchMethod: 'none',
          locationShown: mapCoords,
          countryISO: userCountryISO,
          countryCode: userCountryCode,
          utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
        });
      }
    }
    // Detectar cierre de pestaña / abandono de la página
    handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Ignorar si es un reload — el navegador dispara 'hidden' durante recarga también
        const isReload = performance?.getEntriesByType?.('navigation')?.[0]?.type === 'reload'
          || performance?.navigation?.type === 1;
        if (isReload) {
          log('🔄 visibilitychange hidden ignorado (es un reload)');
          return;
        }
        log('🚪 Pestaña o ventana ocultada/cerrada (page_close)');
        logConversion({
          type: 'page_close',
          gaClientId: getGAClientId(),
          phone: lastUsedPhoneNumber || '',
          language: $locale,
          ipDetection: ipDetectionResult,
          gpsDetection: gpsDetectionResult,
          searchMethod,
          locationShown: mapCoords,
          countryISO: userCountryISO,
          countryCode: userCountryCode,
          utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onDestroy(() => {
    // Limpiar event listener de visibilitychange
    if (typeof document !== 'undefined' && handleVisibilityChange) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    // Detener listeners de Firestore cuando se destruya el componente
    if (unsubscribe) {
      unsubscribe();
    }
    if (unsubscribeStripeMode) {
      unsubscribeStripeMode();
    }
    if (unsubscribeModalWait) {
      unsubscribeModalWait();
    }
    if (unsubscribeSell) {
      unsubscribeSell();
    }
    if (unsubscribeVerbose) {
      unsubscribeVerbose();
    }
    if (unsubscribeMapInteraction) {
      unsubscribeMapInteraction();
    }
    if (unsubscribeMapWait) {
      unsubscribeMapWait();
    }
    if (unsubscribeSellPop) {
      unsubscribeSellPop();
    }
    if (unsubscribePhoneSearch) {
      unsubscribePhoneSearch();
    }
    if (unsubscribePriceLevel) {
      unsubscribePriceLevel();
    }
  });

  function handleSellPop() {
    // Siempre guardar contexto para logConversion si el usuario termina comprando
    localStorage.setItem('conversion_context', JSON.stringify({
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    }));

    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    // sellPopEnabled solo controla si se marca como conversión en GA4
    logConversion({
      type: 'sell_pop',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

    if (sellPopEnabled) {
      const currency = currencyByCountry[userCountryCode] || 'USD';
      const transactionId = `sell_pop_${Date.now()}`;
      const purchaseData = {
        transaction_id: transactionId,
        value: 1,
        currency,
        price_id: 'sell_pop',
        country_iso: userCountryISO,
      };
      if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'sell_pop', item_name: 'Modal de Ventas Abierto', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('🛒 Sell Pop purchase enviado a GA4:', purchaseData);
      } else if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push({
          event: 'purchase',
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'sell_pop', item_name: 'Modal de Ventas Abierto', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('🛒 Sell Pop purchase enviado vía dataLayer:', purchaseData);
      }
    } else {
      log('🛒 Sell Pop: solo logging a DB (conversión GA4 desactivada)');
    }
  }

  function handlePhoneSearch() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra toda búsqueda)
    // phoneSearchEnabled solo controla si se marca como conversión en GA4
    const currency = currencyByCountry[userCountryCode] || 'USD';

    if (phoneSearchEnabled) {
      const transactionId = `phone_search_${Date.now()}`;
      const purchaseData = {
        transaction_id: transactionId,
        value: 1,
        currency,
        price_id: 'phone_search',
        country_iso: userCountryISO,
      };
      if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'phone_search', item_name: 'Búsqueda por Teléfono', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('📱 Phone Search purchase enviado a GA4:', purchaseData);
      } else if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push({
          event: 'purchase',
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'phone_search', item_name: 'Búsqueda por Teléfono', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('📱 Phone Search purchase enviado vía dataLayer:', purchaseData);
      }
    } else {
      log('📱 Phone Search: solo logging a DB (conversión GA4 desactivada)');
    }

    logConversion({
      type: 'phone_search',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });
  }

  // Currencias por código de país (para los purchases de engagement)
  const currencyByCountry = {
    '+52': 'MXN', '+1': 'USD', '+55': 'BRL', '+34': 'EUR', '+33': 'EUR',
    '+49': 'EUR', '+44': 'GBP', '+54': 'ARS', '+56': 'CLP', '+57': 'COP',
    '+51': 'PEN', '+593': 'USD', '+591': 'BOB', '+595': 'PYG', '+598': 'UYU',
    '+351': 'EUR', '+43': 'EUR', '+32': 'EUR', '+352': 'EUR', '+353': 'EUR',
    '+39': 'EUR', '+31': 'EUR', '+30': 'EUR', '+358': 'EUR',
    '+359': 'EUR', '+355': 'ALL', '+36': 'HUF', '+82': 'KRW',
    '+234': 'NGN', '+60': 'MYR', '+45': 'DKK', '+852': 'HKD', '+976': 'MNT',
    '+224': 'GNF', '+264': 'NAD', '+256': 'UGX', '+267': 'BWP', '+374': 'AMD',
    '+7': 'RUB', '+66': 'THB', '+258': 'MZN', '+65': 'SGD', '+373': 'MDL',
    '+995': 'GEL', '+1246': 'BBD', '+505': 'NIO', '+501': 'BZD', '+212': 'MAD',
    '+380': 'UAH', '+244': 'AOA', '+1868': 'TTD', '+679': 'FJD', '+20': 'EGP',
    '+253': 'DJF', '+95': 'MMK', '+260': 'ZMW', '+47': 'NOK', '+853': 'MOP',
    '+1876': 'JMD', '+91': 'INR', '+974': 'QAR', '+257': 'BIF', '+266': 'LSL',
    '+254': 'KES', '+269': 'KMF', '+689': 'XPF', '+86': 'CNY', '+856': 'LAK',
    '+268': 'SZL', '+504': 'HNL', '+354': 'ISK', '+966': 'SAR', '+972': 'ILS',
    '+967': 'YER', '+261': 'MGA', '+250': 'RWF', '+48': 'PLN', '+500': 'FKP',
    '+1767': 'XCD', '+502': 'GTQ', '+46': 'SEK', '+41': 'CHF', '+977': 'NPR',
    '+231': 'LRD', '+265': 'MWK', '+232': 'SLE', '+297': 'AWG', '+63': 'PHP',
    '+238': 'CVE', '+592': 'GYD', '+213': 'DZD', '+387': 'BAM', '+420': 'CZK',
    '+230': 'MUR', '+597': 'SRD', '+252': 'SOS', '+389': 'MKD', '+1242': 'BSD',
    '+64': 'NZD', '+220': 'GMD', '+84': 'VND', '+678': 'VUV', '+685': 'WST',
    '+255': 'TZS', '+350': 'GIP', '+375': 'BYN', '+676': 'TOP', '+62': 'IDR',
    '+61': 'AUD', '+381': 'RSD', '+506': 'CRC', '+1441': 'BMD', '+599': 'ANG',
    '+290': 'SHP', '+248': 'SCR', '+960': 'MVR', '+94': 'LKR', '+855': 'KHR',
    '+40': 'RON',
  };

  function handleMapWaited() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    // mapWaitEnabled solo controla si se marca como conversión en GA4
    logConversion({
      type: 'map_wait',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

    if (mapWaitEnabled) {
      const currency = currencyByCountry[userCountryCode] || 'USD';
      const transactionId = `map_wait_${Date.now()}`;
      const purchaseData = {
        transaction_id: transactionId,
        value: 1,
        currency,
        price_id: 'map_wait',
        country_iso: userCountryISO,
      };
      if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'map_wait', item_name: `Permanencia en Mapa ${mapWaitTime}s`, item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log(`⏱️ Map Wait purchase enviado a GA4 (${mapWaitTime}s):`, purchaseData);
      } else if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push({
          event: 'purchase',
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'map_wait', item_name: `Permanencia en Mapa ${mapWaitTime}s`, item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log(`⏱️ Map Wait purchase enviado vía dataLayer (${mapWaitTime}s):`, purchaseData);
      }
    } else {
      log('⏱️ Map Wait: solo logging a DB (conversión GA4 desactivada)');
    }
  }

  function handleMapInteracted() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    // mapInteractionEnabled solo controla si se marca como conversión en GA4
    logConversion({
      type: 'map_interaction',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

    if (mapInteractionEnabled) {
      const currency = currencyByCountry[userCountryCode] || 'USD';
      const transactionId = `map_interaction_${Date.now()}`;
      const purchaseData = {
        transaction_id: transactionId,
        value: 1,
        currency,
        price_id: 'map_interaction',
        country_iso: userCountryISO,
      };
      if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'map_interaction', item_name: 'Interacción con Mapa GPS', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('🗺️ Map Interaction purchase enviado a GA4:', purchaseData);
      } else if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push({
          event: 'purchase',
          transaction_id: purchaseData.transaction_id,
          value: purchaseData.value,
          currency: purchaseData.currency,
          country_iso: purchaseData.country_iso,
          items: [{ item_id: 'map_interaction', item_name: 'Interacción con Mapa GPS', item_category: 'Engagement', price: 1, quantity: 1 }]
        });
        log('🗺️ Map Interaction purchase enviado vía dataLayer:', purchaseData);
      }
    } else {
      log('🗺️ Map Interaction: solo logging a DB (conversión GA4 desactivada)');
    }
  }

  async function handleOkClick() {
    searchMethod = 'phone';
    handlePhoneSearch();
    // Verificar si existe ubicación en cache para este número
    let cached = getLocationCache(phoneNumber, selectedCountry);
    
    if (cached) {
      // Si existe en cache, usar esa ubicación (mismo número)
      mapCoords = cached;
    } else {
      // Si no existe en cache, es un número nuevo: generar nueva posición random
      // basada en la ubicación GPS obtenida al inicio
      const newLocation = randomizeLocation(mapCoords.lat, mapCoords.lng);
      mapCoords = newLocation;
      saveLocationCache(phoneNumber, selectedCountry, newLocation.lat, newLocation.lng);
    }
    
    // Guardar el número actual como último usado
    localStorage.setItem('last_phone_number', phoneNumber);
    lastUsedPhoneNumber = phoneNumber;

    // Mostrar spinner
    showSpinner = true;
    
    // Esperar a que el spinner termine de mostrar todos los mensajes (último mensaje dura doble)
    await new Promise(resolve => setTimeout(resolve, 16500));
    
    // Mostrar mapa primero
    showMap = true;
    
    // Ocultar spinner después (para que no haya tiempo en blanco)
    await new Promise(resolve => setTimeout(resolve, 100));
    showSpinner = false;

    // Iniciar timer para modal (tiempo dinámico según modo)
    log('⏱️ Modal se mostrará en', currentWaitTime, 'ms');
    setTimeout(() => {
      if (sellEnabled) {
        showModal = true;
        handleSellPop();
      } else {
        log('🚫 Venta desactivada - Modal no se mostrará');
      }
    }, currentWaitTime);
  }

  function closeModal() {
    showModal = false;
    showMap = false;
    phoneNumber = '';
  }

  function handleLadaChange() {
    logConversion({
      type: 'lada_change',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: selectedCountry,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });
    log('🔄 Cambio de Lada registrado (lada_change):', selectedCountry);
  }

  function handleLanguageChange(event) {
    const newLang = event.detail.language;
    logConversion({
      type: 'language_change',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: newLang,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: mapCoords,
      countryISO: userCountryISO,
      countryCode: selectedCountry,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });
    log('🗣️ Cambio de Idiona registrado (language_change):', newLang);
  }

  function handlePhoneKeydown(event) {
    // Ejecutar handleOkClick si se presiona Enter y hay al menos 7 números
    if (event.key === 'Enter' && phoneNumber.length >= 7) {
      handleOkClick();
    }
  }

  // Funciones para Safe Mode
  async function handleBrowserSearch() {
    showSpinner = true;
    try {
      const result = await searchByBrowser();
      gpsDetectionResult = result; // Guardar para logging
      searchMethod = 'browser';
      mapCoords = { lat: result.lat, lng: result.lng };
      userCountryCode = result.countryCode;
      userCountryISO = result.isoCode || 'MX';
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner
      
      // Esperar spinner
      await new Promise(resolve => setTimeout(resolve, 16500));
      
      // Mostrar mapa primero
      showMap = true;
      
      // Ocultar spinner después (para que no haya tiempo en blanco)
      await new Promise(resolve => setTimeout(resolve, 100));
      showSpinner = false;
      
      // Mostrar modal después del tiempo configurado
      log('⏱️ Modal se mostrará en', currentWaitTime, 'ms');
      setTimeout(() => {
        if (sellEnabled) {
          showModal = true;
          handleSellPop();
        } else {
          log('🚫 Venta desactivada - Modal no se mostrará');
        }
      }, currentWaitTime);
    } catch (err) {
      error('Error en búsqueda por navegador:', err);
      alert('No se pudo acceder a la ubicación del navegador. Por favor, permite el acceso a tu ubicación.');
      showSpinner = false;
    }
  }

  async function handleIPSearch() {
    showSpinner = true;
    try {
      const result = await searchByIP();
      searchMethod = 'ip';
      mapCoords = { lat: result.lat, lng: result.lng };
      userCountryCode = result.countryCode;
      userCountryISO = result.isoCode || 'MX';
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner
      
      // Esperar spinner
      await new Promise(resolve => setTimeout(resolve, 16500));
      
      // Mostrar mapa primero
      showMap = true;
      
      // Ocultar spinner después (para que no haya tiempo en blanco)
      await new Promise(resolve => setTimeout(resolve, 100));
      showSpinner = false;
      
      // Mostrar modal después del tiempo configurado
      log('⏱️ Modal se mostrará en', currentWaitTime, 'ms');
      setTimeout(() => {
        if (sellEnabled) {
          showModal = true;
          handleSellPop();
        } else {
          log('🚫 Venta desactivada - Modal no se mostrará');
        }
      }, currentWaitTime);
    } catch (err) {
      error('Error en búsqueda por IP:', err);
      alert('No se pudo detectar tu ubicación por IP.');
      showSpinner = false;
    }
  }
  

</script>

<main dir={$locale === 'ar' ? 'rtl' : 'ltr'}>
  <LoadingSpinner isVisible={showSpinner} countryCode={selectedCountry} isSafeMode={safeMode === true} />
  <Modal 
    isVisible={showModal} 
    onClose={closeModal}
    countryCode={userCountryCode}
    countryISO={userCountryISO}
    mapLat={mapCoords.lat}
    mapLng={mapCoords.lng}
    priceLevel={priceLevel}
  />
  <div class="language-selector-wrapper">
    <LanguageSelector on:change={handleLanguageChange} />
  </div>
  <div class="container">
    {#if !showMap && !showSpinner}
      {#if safeMode === null}
        <!-- Cargando configuración desde Firebase -->
        <div class="loading-config">
          <div class="spinner-small"></div>
          <p>{$_('modal.loading')}</p>
        </div>
      {:else if safeMode === false}
        <!-- Modo Normal: Dropdown + Phone + Buscar -->
        <div class="input-wrapper" dir="ltr">
          <CountrySelect bind:value={selectedCountry} on:change={handleLadaChange} />
          <PhoneInput 
            bind:value={phoneNumber}
            onSubmit={() => phoneNumber.length >= 7 && handleOkClick()}
          />
          <button 
            class="ok-button" 
            on:click={handleOkClick}
            disabled={phoneNumber.length < 7}
          >
            {$_('search.okButton')}
          </button>
        </div>
      {:else}
        <!-- Safe Mode: Botones de búsqueda -->
        <div class="safe-mode-container">
          <h1 class="safe-mode-title">{$_('search.safeModeTitle')}</h1>
          <p class="safe-mode-subtitle">{$_('search.safeModeSubtitle')}</p>
          
          <div class="safe-mode-buttons">
            <button 
              class="safe-button browser-button" 
              on:click={handleBrowserSearch}
            >
              🌐 {$_('search.searchByBrowser')}
            </button>
            <button 
              class="safe-button ip-button" 
              on:click={handleIPSearch}
            >
              📡 {$_('search.searchByIP')}
            </button>
          </div>
        </div>
      {/if}
    {/if}
    {#if showMap}
      <div class="map-wrapper">
        <Map lat={mapCoords.lat} lng={mapCoords.lng} mapInteractionEnabled={mapInteractionEnabled} on:mapInteracted={handleMapInteracted} mapWaitEnabled={mapWaitEnabled} mapWaitTime={mapWaitTime} on:mapWaited={handleMapWaited} />
      </div>
    {/if}
  </div>
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');

  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }
  
  main {
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .language-selector-wrapper {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1500;
  }
  
  .container {
    width: 100%;
    max-width: 800px;
    padding: 2rem;
  }

  .input-wrapper {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .safe-mode-container {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
  }

  .safe-mode-title {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: white;
    margin: 0 0 1rem 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .safe-mode-subtitle {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 2.5rem 0;
    line-height: 1.5;
  }

  .safe-mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .safe-button {
    padding: 1.5rem 2rem;
    font-size: 1.3rem;
    font-weight: 600;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .browser-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .browser-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }

  .ip-button {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .ip-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
  }

  .ok-button {
    padding: 1rem 2rem;
    font-size: 1.5rem;
    font-weight: bold;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: 2px solid #10b981;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .ok-button:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .ok-button:disabled {
    background: #ccc;
    border-color: #999;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .map-wrapper {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 600px) {
    .input-wrapper {
      flex-direction: column;
      gap: 1rem;
    }

    .safe-mode-container {
      width: 100%;
      padding: 0 1rem;
    }

    .safe-mode-title {
      font-size: 2rem;
    }

    .safe-mode-subtitle {
      font-size: 1rem;
    }

    .safe-mode-buttons {
      width: 100%;
    }

    .safe-button {
      font-size: 1.1rem;
      padding: 1.2rem 1.5rem;
    }
  }

  .loading-config {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: #666;
  }

  .loading-config p {
    margin: 0;
    font-size: 0.9rem;
  }

  .spinner-small {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
