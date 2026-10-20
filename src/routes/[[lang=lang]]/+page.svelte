<script>
  import { onMount, onDestroy } from 'svelte';
  import { _ , locale } from 'svelte-i18n';
  import CountrySelect from '$lib/CountrySelect.svelte';
  import PhoneInput from '$lib/PhoneInput.svelte';
  import Map from '$lib/Map.svelte';
  import LoadingSpinner from '$lib/LoadingSpinner.svelte';
  import Modal from '$lib/Modal.svelte';
  import LanguageSelector from '$lib/LanguageSelector.svelte';
  import Seo from '$lib/Seo.svelte';
  import InfoSection from '$lib/InfoSection.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { rutaEnIdioma } from '$lib/idiomas.js';
  import { getLocationCache, saveLocationCache, searchByBrowser, searchByIP, ubicacionDeArranque } from '$lib/geoLocation.js';
  import { getGAClientId } from '$lib/stripe.js';
  import { logConversion } from '$lib/conversionLogger.js';
  import { borrarCoordenadasDelPago, guardar, leer, leerCoordenadasDelPago, purgarCoordenadasVencidas, quitar } from '$lib/almacenamiento.js';
  import { consumirRecargaPorConsentimiento, cuandoHayAnalitica, hayRecargaPorConsentimiento } from '$lib/consentimiento-navegador.js';
  import { setLanguageFromCountry, getLanguageFromCountry } from '$lib/i18n.js';
  import { getSafeModeConfig, onSafeModeChange, getStripeModeConfig, onStripeModeChange, getModalWaitConfig, onModalWaitChange, getSellConfig, onSellChange, getVerboseConfig, onVerboseChange, getMapWaitConfig, onMapWaitChange, getPriceLevelConfig, onPriceLevelChange } from '$lib/flags.js';
  import { verboseStore, log, warn, error } from '$lib/logger.js';

  let phoneNumber = '';
  let selectedCountry = '+1'; // País del teléfono que busca
  let userCountryCode = '+52'; // País del visitante por su IP (precio de Stripe y registros)
  let userCountryISO = 'MX'; // Código ISO del país del visitante (MX, US, BR, etc.)
  let showMap = false;
  let showSpinner = false;
  // El pago se completó pero no sobrevivieron las coordenadas del redirect:
  // hay que avisarle al cliente y pedirle que repita la búsqueda.
  let purchaseCoordsLost = false;
  // Clave de traducción del aviso de una búsqueda que falló (permiso de ubicación
  // negado, GeoJS sin respuesta…), o '' si no hay. Se muestra en la propia página
  // y no con un alert() del navegador; la clave y no el texto, para que siga el
  // idioma si el visitante lo cambia con el aviso a la vista.
  let errorBusqueda = '';
  // true una vez que la página se destruyó (navegación del lado del cliente), y el
  // temporizador que abre el modal de cobro. Ver terminarBusqueda.
  let destruida = false;
  let temporizadorModal = null;
  let showModal = false;
  // Punto de partida del mapa (CDMX) hasta que haya una ubicación del visitante. `ubicacionConocida` dice si
  // `mapCoords` ya es una ubicación REAL (la de una búsqueda, la del mapa pagado): mientras no lo sea, no se
  // registra como «ubicación mostrada» en los eventos (todos los visitantes aparecerían en la CDMX).
  let mapCoords = { lat: 19.4326, lng: -99.1332 };
  let ubicacionConocida = false;
  const ubicacionMostrada = () => (ubicacionConocida ? mapCoords : null);
  function fijarUbicacion(coords) {
    mapCoords = coords;
    ubicacionConocida = true;
  }
  let lastUsedPhoneNumber = '';
  // Datos que resolvió el servidor: los flags de Firestore ya leídos.
  //
  // Inicializar el estado desde acá NO es opcional con SSR encendido: si el
  // servidor renderiza la pantalla de safe mode y el cliente hidratara con
  // safeMode = null, el HTML servido y el primer render del cliente no
  // coincidirían. Los listeners de Firestore del onMount siguen puestos, así
  // que cambiar un flag desde la consola sigue llegando al instante.
  export let data;

  // El país del visitante lo resolvió el SERVIDOR por la IP de la petición (base local de DB-IP): decide
  // el precio, el idioma inicial y los registros. Ya no se consulta a GeoJS al cargar la página. Se fija
  // aquí (y no en onMount) para que el HTML del servidor y la hidratación coincidan.
  const arranque = ubicacionDeArranque(data.pais);
  userCountryCode = arranque.countryCode;
  userCountryISO = arranque.isoCode;
  selectedCountry = arranque.countryCode; // El desplegable de lada inicia con el país del visitante

  let safeMode = data.flags.safeMode; // Estado de Safe Mode (resuelto en el servidor)
  let unsubscribe = null; // Función para detener listener de Firestore
  let unsubscribeStripeMode = null; // Función para detener listener de Stripe Mode
  let unsubscribeModalWait = null; // Función para detener listener de Modal Wait
  let unsubscribeSell = null; // Función para detener listener de Sell Config
  let unsubscribeVerbose = null; // Función para detener listener de Verbose Config
  let isProductionMode = data.flags.isProductionMode; // Stripe Mode (false = sandbox)
  let waitSafe = data.flags.waitSafe; // Tiempo de espera en Safe Mode (segundos)
  let waitProd = data.flags.waitProd; // Tiempo de espera en modo producción (segundos)
  let sellEnabled = data.flags.sellEnabled; // Estado de venta (true = mostrar modal)
  let mapWaitTime = 30;              // Segundos en el mapa antes de registrar map_wait
  let unsubscribeMapWait = null;
  let priceLevel = data.flags.priceLevel;   // Nivel de precio (100 = barato, 200 = original)
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

  // El modo con número de teléfono (safeMode apagado) es un SIMULADOR de
  // entretenimiento: no consulta ninguna red ni operador, solo muestra un punto
  // al azar cerca de la ubicación aproximada del propio visitante. Todo lo que
  // lo dice (título, descripción, avisos, mapa y cobro) cuelga de esta bandera,
  // y es la del modo y no la de searchMethod a propósito: al volver de Stripe
  // searchMethod vuelve a 'none' pero el mapa restaurado sigue siendo el del
  // simulador.
  $: modoTelefono = safeMode === false;



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
    // ¿Esta carga es la recarga que hizo el aviso de cookies al retirarse un permiso? Si sí, no es una
    // recarga de la persona y no se anota como page_refresh (lo mismo con el page_close de antes).
    const vinoDeConsentimiento = consumirRecargaPorConsentimiento();

    // Las coordenadas del mapa que se pagó caducan a las 24 h (ver $lib/almacenamiento.js): las que ya
    // vencieron, o las de antes de que llevaran fecha, se borran en cualquier carga.
    purgarCoordenadasVencidas();

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
      mapWaitTime = (await getMapWaitConfig()).waitTime;
      log(`⏱️ Map Wait: ${mapWaitTime}s`);
      unsubscribeMapWait = onMapWaitChange((newValue) => {
        mapWaitTime = newValue.waitTime;
        log(`⏱️ Map Wait actualizado: ${newValue.waitTime}s`);
      });
    } catch (err) {
      error('❌ Error al cargar map-wait-time:', err);
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

    // El país ya lo resolvió el servidor (ver `arranque` arriba): no se le pregunta a nadie más. Sin
    // coordenadas: la base local es de países, y la ubicación en el mapa solo se pide cuando la
    // persona hace una búsqueda.
    ipDetectionResult = arranque.conocido
      ? { countryCode: arranque.countryCode, isoCode: arranque.isoCode, lat: null, lng: null }
      : null; // Guardar para logging de conversiones

    // Establecer idioma automáticamente según el país (sin país conocido, el del navegador)
    setLanguageFromCountry(arranque.conocido ? arranque.countryCode : null);

    log('🌍 País del visitante (por la IP, resuelto en el servidor):', arranque.conocido ? arranque.isoCode : 'desconocido (se usa México)');
    log('   📞 Código telefónico:', userCountryCode);
    log('   🌐 Idioma establecido:', getLanguageFromCountry(arranque.countryCode) === 'es' ? 'Español' : 'English');
    
    // Recuperar el último teléfono usado (solo existe si hubo permiso de analítica al
    // guardarlo: ver $lib/almacenamiento.js)
    const lastPhone = leer('last_phone_number');
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

    // Lo que se sabe AL LLEGAR. La visita de llegada (ad_visit u organic_visit) puede quedar en espera
    // del permiso (ver más abajo) y, cuando llegue, la persona puede haber cambiado de idioma o hecho
    // una búsqueda: la fila tiene que describir la llegada, no el momento de aceptar.
    const llegada = {
      idioma: $locale,
      ubicacion: ubicacionMostrada(),
      ipDetection: ipDetectionResult,
      countryISO: userCountryISO,
      countryCode: userCountryCode,
    };

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

      // Registrar visita desde anuncio en MariaDB. Con el aviso de cookies en pantalla
      // (UE, Reino Unido, Suiza) esto ocurriría antes de poder contestar: cuandoHayAnalitica
      // lo deja en espera y lo registra si la persona acepta durante esta visita. NO se cancela al
      // salir de la portada: el propio aviso enlaza a la política de privacidad, y quien la lee
      // antes de aceptar no debería perder la visita (ni la campaña que lo trajo). La clave evita
      // que cada regreso a la portada deje otra espera y salgan todas juntas al aceptar.
      const campana = { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid };
      cuandoHayAnalitica(() => {
        logConversion({
          type: 'ad_visit',
          gaClientId: getGAClientId(),
          phone: '',
          language: llegada.idioma,
          ipDetection: llegada.ipDetection,
          gpsDetection: null,
          searchMethod: 'none',
          locationShown: llegada.ubicacion,
          countryISO: llegada.countryISO,
          countryCode: llegada.countryCode,
          ...campana,
        });
        log('📣 ad_visit registrado en MariaDB');
      }, 'llegada');
    } else if (urlParams.get('payment') === 'cancelled') {
      log('🚫 Retorno de Stripe sin comprar (flake_out vía cancel_url)');
      // Cancelar el pago: las coordenadas del mapa ya no hacen falta y no se quedan en el dispositivo.
      borrarCoordenadasDelPago();
      // flake_out se registra abajo con pending_checkout
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('payment') === 'success') {
      // purchase se registra más abajo — no registrar organic_visit
    } else if (leer('pending_checkout')) {
      // flake_out se registra abajo — no registrar organic_visit
    } else {
      // Solo registrar organic_visit si es una visita genuina nueva (no refresh, no retorno de Stripe)
      const isReload = performance?.getEntriesByType?.('navigation')?.[0]?.type === 'reload'
        || performance?.navigation?.type === 1;
      if (!isReload) {
        log('📡 Sin parámetros de campaña (tráfico directo u orgánico)');
        // En espera hasta que haya permiso de analítica (ver ad_visit, arriba).
        cuandoHayAnalitica(() => {
          logConversion({
            type: 'organic_visit',
            gaClientId: getGAClientId(),
            phone: '',
            language: llegada.idioma,
            ipDetection: llegada.ipDetection,
            gpsDetection: null,
            searchMethod: 'none',
            locationShown: llegada.ubicacion,
            countryISO: llegada.countryISO,
            countryCode: llegada.countryCode,
            utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, gclid: null, fbclid: null,
          });
          log('🌿 organic_visit registrado en MariaDB');
        }, 'llegada');
      }
    }

    // Detectar retorno de Stripe sin comprar (flake_out)
    const pendingCheckout = leer('pending_checkout');
    if (pendingCheckout && urlParams.get('payment') !== 'success') {
      quitar('pending_checkout');
      quitar('purchase_data');
      log('🚫 Retorno de Stripe sin comprar (flake_out)');
      logConversion({
        type: 'flake_out',
        gaClientId: getGAClientId(),
        phone: leer('last_phone_number') || '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: null,
        searchMethod: 'none',
        locationShown: ubicacionMostrada(),
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, gclid: null, fbclid: null,
      });
      log('🚫 flake_out registrado en MariaDB');
    }

    // Detectar retorno exitoso de Stripe
    if (urlParams.get('payment') === 'success') {
      // Cada parte de este bloque va por separado A PROPÓSITO. Antes todo colgaba
      // de un único `if (savedCoords)`: si localStorage no sobrevivía el redirect
      // a Stripe (ITP de Safari, modo privado, navegadores in-app de Instagram o
      // TikTok), el cliente PAGABA y se quedaba viendo una página en blanco — y
      // como el registro de la compra vivía en el mismo bloque, tampoco quedaba
      // fila en la base para encontrarlo y reembolsarlo.
      // El arreglo de raíz es llevar las coordenadas en la metadata de la sesión
      // de Stripe; esto es la red de seguridad mientras tanto.

      // 1. Coordenadas: recuperarlas si sobrevivieron.
      // Solo si siguen vigentes (24 h desde que se pulsó «Comprar»). NO se borran al restaurarlas:
      // volver a abrir este enlace (atrás, una recarga) tiene que seguir mostrando el mapa pagado;
      // caducan solas, o las borra cancelar el pago.
      const restoredCoords = leerCoordenadasDelPago();

      if (restoredCoords) {
        fijarUbicacion(restoredCoords);
        showMap = true;
        log('✅ Pago exitoso - Mapa restaurado');

        // Si la persona retira un permiso con este mapa en pantalla, el aviso recarga la página (la única
        // forma de quitar a Google de memoria). Esa recarga tiene que volver a ESTE mapa, que se pagó:
        // el estado del mapa vive solo en la página, y la URL ya no llevará ?payment=success.
        if (window.__consent) window.__consent.urlAlRecargar = `${window.location.pathname}?payment=success`;
      } else {
        // No mostramos el mapa en la ubicación por defecto: enseñarle CDMX a
        // quien pagó por localizar otro número es peor que pedirle que repita
        // la búsqueda. Se le avisa que el pago sí se procesó.
        purchaseCoordsLost = true;
        warn('⚠️ Pago exitoso pero se perdió map_coords; se pedirá repetir la búsqueda');
      }

      // 2. Registrar la compra SIEMPRE, haya o no coordenadas.
      {
        // Enviar evento de conversión a Google Analytics/Ads. purchase_data solo existe si hubo
        // permiso (de analítica o de publicidad) al guardarlo: ver $lib/almacenamiento.js.
        const purchaseData = leer('purchase_data');
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
              const conversionCtxRaw = leer('conversion_context');
              const ctx = conversionCtxRaw ? JSON.parse(conversionCtxRaw) : {};
              logConversion({
                type: 'purchase',
                gaClientId: getGAClientId(),
                phone: ctx.phone || leer('last_phone_number') || '',
                language: ctx.language || 'es',
                ipDetection: ctx.ipDetection || null,
                gpsDetection: ctx.gpsDetection || null,
                searchMethod: ctx.searchMethod || 'none',
                locationShown: ctx.locationShown || ubicacionMostrada(),
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
              quitar('purchase_data');
              quitar('pending_checkout');
              quitar('conversion_context');
            } catch (e) {
              error('Error al procesar datos de compra:', e);
            }
        } else {
          // Hubo pago pero se perdió purchase_data: igual conviene dejar rastro.
          warn('⚠️ payment=success sin purchase_data: la compra no se puede reportar con valor');
        }
      }

      // 3. Limpiar el parámetro de la URL, haya funcionado o no lo anterior.
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Detectar si fue un refresh de la página
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'reload' && !vinoDeConsentimiento) {
        log('🔄 Page reload detectado (page_refresh)');
        logConversion({
          type: 'page_refresh',
          gaClientId: getGAClientId(),
          phone: lastUsedPhoneNumber || '',
          language: $locale,
          ipDetection: ipDetectionResult,
          gpsDetection: null,
          searchMethod: 'none',
          locationShown: ubicacionMostrada(),
          countryISO: userCountryISO,
          countryCode: userCountryCode,
          utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
        });
      }
    }
    // Detectar cierre real de pestaña/ventana (no cambio de pestaña)
    let pageCloseLogged = false;
    handleVisibilityChange = (event) => {
      // Ignorar si es navegación a Stripe (el usuario va a pagar, no es un cierre real)
      if (leer('pending_checkout')) return;

      // Ignorar la recarga que hace el aviso de cookies al retirarse un permiso: no es un cierre.
      if (hayRecargaPorConsentimiento()) return;

      // beforeunload y pagehide pueden dispararse los dos en el mismo cierre.
      if (pageCloseLogged) return;
      pageCloseLogged = true;

      // Nota: no intentamos distinguir refresh de cierre real porque beforeunload
      // no puede diferenciarlos. En caso de refresh, se registra page_close aquí
      // Y page_refresh en onMount — se puede deduplicar en la DB por gaClientId + timestamps.
      log('🚪 Pestaña o ventana cerrada (page_close)');
      logConversion({
        type: 'page_close',
        gaClientId: getGAClientId(),
        phone: lastUsedPhoneNumber || '',
        language: $locale,
        ipDetection: ipDetectionResult,
        gpsDetection: gpsDetectionResult,
        searchMethod,
        locationShown: ubicacionMostrada(),
        countryISO: userCountryISO,
        countryCode: userCountryCode,
        utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
      });
    };
    // beforeunload no dispara de forma confiable en iOS Safari, que en su lugar
    // manda pagehide. Se escuchan los dos y el flag evita la fila duplicada
    // cuando el navegador dispara ambos.
    // Nota: NO se usa visibilitychange a propósito — dispara en cada cambio de
    // pestaña y cada vez que la app pasa a segundo plano en móvil, que es justo
    // lo que este evento quiere NO contar como cierre.
    window.addEventListener('beforeunload', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);
  });

  onDestroy(() => {
    // La recarga hacia el mapa pagado (ver urlAlRecargar) solo vale mientras este mapa siga en pantalla.
    if (typeof window !== 'undefined' && window.__consent) window.__consent.urlAlRecargar = null;

    // Detener lo que una búsqueda en curso dejó programado (ver terminarBusqueda).
    destruida = true;
    if (temporizadorModal) {
      clearTimeout(temporizadorModal);
      temporizadorModal = null;
    }

    // Limpiar event listeners de cierre de página
    if (typeof window !== 'undefined' && handleVisibilityChange) {
      window.removeEventListener('beforeunload', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
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
    if (unsubscribeMapWait) {
      unsubscribeMapWait();
    }
    if (unsubscribePriceLevel) {
      unsubscribePriceLevel();
    }
  });

  function handleSellPop() {
    // Guardar contexto para logConversion si el usuario termina comprando (con permiso de
    // analítica va al dispositivo; sin él, solo a la memoria de la página: $lib/almacenamiento.js)
    guardar('conversion_context', JSON.stringify({
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      // Los identificadores de clic de anuncios (gclid, fbclid) son de publicidad: $lib/almacenamiento.js
      // no los deja en el dispositivo sin ese permiso (en memoria sí, por si llega después).
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    }));

    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    logConversion({
      type: 'sell_pop',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

  }

  function handlePhoneSearch() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra toda búsqueda)

    logConversion({
      type: 'phone_search',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });
  }

  function handleMapWaited() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    logConversion({
      type: 'map_wait',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

  }

  function handleMapInteracted() {
    // logConversion SIEMPRE se ejecuta (MariaDB registra todo)
    logConversion({
      type: 'map_interaction',
      gaClientId: getGAClientId(),
      phone: phoneNumber,
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });

  }

  // Punto de partida del simulador: la ubicación aproximada del visitante por su IP, que SÍ trae
  // coordenadas (GeoJS; la base local del servidor es solo de países). Se pide en la primera búsqueda
  // con teléfono —una acción suya— y no al cargar la página. Si falla, el punto de partida del mapa.
  let ubicacionBase = null;
  async function obtenerUbicacionBase() {
    if (ubicacionBase) return ubicacionBase;

    try {
      const porIp = await searchByIP();
      ipDetectionResult = porIp;
      ubicacionBase = { lat: porIp.lat, lng: porIp.lng };
    } catch (err) {
      warn('No se pudo ubicar por IP el punto de partida del simulador; se usa el predeterminado:', err);
      ubicacionBase = { lat: mapCoords.lat, lng: mapCoords.lng };
    }

    return ubicacionBase;
  }

  async function handleOkClick() {
    searchMethod = 'phone';
    handlePhoneSearch();

    // Mostrar spinner (antes de la espera de la ubicación, para que el botón responda al instante)
    showSpinner = true;

    // Verificar si existe ubicación en cache para este número
    let cached = getLocationCache(phoneNumber, selectedCountry);
    const numero = phoneNumber;
    const ladaDelNumero = selectedCountry;

    // La ubicación se resuelve MIENTRAS corre la animación del spinner (de 16,5 s) y no antes: el mapa
    // solo hace falta al final, y esperar a GeoJS por delante dejaba la pantalla en blanco entre una cosa y otra.
    const ubicacionLista = (async () => {
      if (cached) {
        // Si existe en cache, usar esa ubicación (mismo número)
        fijarUbicacion(cached);
      } else {
        // Si no existe en cache, es un número nuevo: generar nueva posición random
        // basada en la ubicación del visitante por su IP
        const base = await obtenerUbicacionBase();
        const newLocation = randomizeLocation(base.lat, base.lng);
        fijarUbicacion(newLocation);
        saveLocationCache(numero, ladaDelNumero, newLocation.lat, newLocation.lng);
      }
    })();

    // Guardar el número actual como último usado (solo en el dispositivo con permiso de analítica)
    guardar('last_phone_number', phoneNumber);
    lastUsedPhoneNumber = phoneNumber;

    await terminarBusqueda(ubicacionLista);
  }

  // El final COMÚN de las tres búsquedas (teléfono, navegador, IP): esperar a que
  // la animación muestre todos sus mensajes, enseñar el mapa y, pasado el tiempo
  // configurado, abrir el modal de cobro.
  //
  // Se comprueba `destruida` después de cada espera y el temporizador del modal se
  // guarda para cancelarlo en onDestroy. Antes daba igual, porque la página no
  // tenía ningún enlace que la abandonara sin recargar; ahora los hay (la política
  // de privacidad), y un temporizador vivo seguía corriendo sobre un componente ya
  // destruido: al vencer registraba un sell_pop (y, con ese flag encendido, un
  // `purchase` a Google) sin que hubiera ningún modal en pantalla.
  async function terminarBusqueda(ubicacionLista = Promise.resolve()) {
    // Esperar a que el spinner termine de mostrar todos los mensajes (último mensaje dura doble)
    await new Promise(resolve => setTimeout(resolve, 16500));
    // ...y a que la ubicación del mapa esté lista (solo la búsqueda con teléfono la espera; GeoJS tiene tope de 4 s)
    await ubicacionLista;
    if (destruida) return;

    // Mostrar mapa primero
    showMap = true;

    // Ocultar spinner después (para que no haya tiempo en blanco)
    await new Promise(resolve => setTimeout(resolve, 100));
    if (destruida) return;
    showSpinner = false;

    // Iniciar timer para modal (tiempo dinámico según modo)
    log('⏱️ Modal se mostrará en', currentWaitTime, 'ms');
    temporizadorModal = setTimeout(() => {
      if (destruida) return;

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

  function handleMapZoom(event) {
    const { direction, from, to } = event.detail;
    const type = direction === 'in' ? 'zoom_in' : 'zoom_out';
    log(`🔍 Map ${type}: ${from} → ${to}`);
    logConversion({
      type,
      gaClientId: getGAClientId(),
      phone: lastUsedPhoneNumber || '',
      language: $locale,
      ipDetection: ipDetectionResult,
      gpsDetection: gpsDetectionResult,
      searchMethod,
      locationShown: ubicacionMostrada(),
      countryISO: userCountryISO,
      countryCode: userCountryCode,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, fbclid,
    });
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
      locationShown: ubicacionMostrada(),
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
      locationShown: ubicacionMostrada(),
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
    errorBusqueda = '';
    showSpinner = true;
    try {
      const result = await searchByBrowser();
      gpsDetectionResult = result; // Guardar para logging
      searchMethod = 'browser';
      fijarUbicacion({ lat: result.lat, lng: result.lng });
      // El país del visitante (precio y registros) sigue siendo el de su IP, no el que salga de la búsqueda:
      // el GPS de un equipo con VPN dice dónde está el equipo, y el precio no puede depender de eso. El
      // resultado de la búsqueda queda en gpsDetectionResult, que también va a los registros.
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner

      await terminarBusqueda();
    } catch (err) {
      error('Error en búsqueda por navegador:', err);
      errorBusqueda = 'search.errorBrowser';
      showSpinner = false;
    }
  }

  async function handleIPSearch() {
    errorBusqueda = '';
    showSpinner = true;
    try {
      const result = await searchByIP();
      searchMethod = 'ip';
      ipDetectionResult = result; // Ahora sí con coordenadas: es lo que la persona pidió ver
      ubicacionBase = { lat: result.lat, lng: result.lng };
      fijarUbicacion({ lat: result.lat, lng: result.lng });
      // El país del visitante (precio y registros) ya es el de su IP desde que se cargó la página: lo
      // resolvió el servidor con la misma IP. Aquí solo se actualiza el desplegable de lada.
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner

      await terminarBusqueda();
    } catch (err) {
      error('Error en búsqueda por IP:', err);
      errorBusqueda = 'search.errorIP';
      showSpinner = false;
    }
  }
  

</script>

<!-- La descripción que acaba en «Pago único…» solo vale si hay cobro: con el flag
     `sell` apagado la app es gratuita y se usa la variante sin esa frase. -->
<Seo
  titulo={modoTelefono ? $_('seo.home.titleSim') : $_('seo.home.title')}
  descripcion={$_(
    modoTelefono
      ? sellEnabled ? 'seo.home.descriptionSim' : 'seo.home.descriptionSimFree'
      : sellEnabled ? 'seo.home.description' : 'seo.home.descriptionFree'
  )}
  categoriaApp={modoTelefono ? 'EntertainmentApplication' : 'UtilitiesApplication'}
/>

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
    simulation={modoTelefono}
  />
  <div class="language-selector-wrapper">
    <LanguageSelector on:change={handleLanguageChange} />
  </div>
  <div class="container">
    {#if purchaseCoordsLost}
      <div class="purchase-notice" role="status">{$_('purchase.coordsLost')}</div>
    {/if}
    {#if errorBusqueda}
      <div class="search-error" role="alert">{$_(errorBusqueda)}</div>
    {/if}
    {#if !showMap && !showSpinner}
      {#if safeMode === null}
        <!-- Cargando configuración desde Firebase -->
        <div class="loading-config">
          <div class="spinner-small"></div>
          <p>{$_('modal.loading')}</p>
        </div>
      {:else if safeMode === false}
        <!-- Modo Normal: Dropdown + Phone + Buscar. Es el simulador de
             entretenimiento: el título y el aviso lo dicen a la vista, no solo
             en el HTML que lee un buscador. -->
        <h1 class="sim-title">{$_('seo.home.h1Sim')}</h1>
        <div class="input-wrapper" dir="ltr">
          <CountrySelect bind:value={selectedCountry} on:change={handleLadaChange} />
          <PhoneInput
            bind:value={phoneNumber}
            onSubmit={() => phoneNumber.length >= 7 && handleOkClick()}
            describedby={sellEnabled ? 'aviso-simulacion aviso-cobro' : 'aviso-simulacion'}
          />
          <button
            class="ok-button"
            on:click={handleOkClick}
            disabled={phoneNumber.length < 7}
            aria-describedby={sellEnabled ? 'aviso-simulacion aviso-cobro' : 'aviso-simulacion'}
          >
            {$_('search.okButton')}
          </button>
        </div>
        <!-- Los dos avisos van después del campo en el DOM: se asocian a él y al
             botón con aria-describedby para que un lector de pantalla los lea ANTES
             de que se escriba un número (que además se guarda). -->
        <p class="sim-notice" id="aviso-simulacion">{$_('sim.formNotice')}</p>
        {#if sellEnabled}
          <p class="pay-notice" id="aviso-cobro">{$_('search.payNotice')}</p>
        {/if}
      {:else}
        <!-- Safe Mode: Botones de búsqueda -->
        <div class="safe-mode-container">
          <h1 class="safe-mode-title">{$_('search.safeModeTitle')}</h1>
          <p class="safe-mode-subtitle">{$_('search.safeModeSubtitle')}</p>
          
          <div class="safe-mode-buttons">
            <button
              class="safe-button browser-button"
              on:click={handleBrowserSearch}
              aria-describedby={sellEnabled ? 'aviso-cobro' : undefined}
            >
              🌐 {$_('search.searchByBrowser')}
            </button>
            <button
              class="safe-button ip-button"
              on:click={handleIPSearch}
              aria-describedby={sellEnabled ? 'aviso-cobro' : undefined}
            >
              📡 {$_('search.searchByIP')}
            </button>
          </div>
          {#if sellEnabled}
            <!-- Va después de los botones en el DOM, así que se asocia a ellos con
                 aria-describedby: quien navega con lector de pantalla lo oye al
                 llegar al botón, ANTES de activarlo. -->
            <p class="pay-notice" id="aviso-cobro">{$_('search.payNotice')}</p>
          {/if}
        </div>
      {/if}
    {/if}
    {#if showMap || showSpinner}
      <!-- Al buscar se va el <h1> de la pantalla inicial y la página seguiría sin
           encabezado de primer nivel (el InfoSection de abajo empieza en <h2>). Solo
           para lectores de pantalla: a la vista ya hay un mapa o una animación. -->
      <h1 class="solo-lectores">{modoTelefono ? $_('seo.home.h1Sim') : $_('search.safeModeTitle')}</h1>
    {/if}
    {#if showMap}
      <div class="map-wrapper">
        <Map lat={mapCoords.lat} lng={mapCoords.lng} simulation={modoTelefono} on:mapInteracted={handleMapInteracted} mapWaitTime={mapWaitTime} on:mapWaited={handleMapWaited} on:mapZoom={handleMapZoom} />
      </div>
    {/if}
  </div>
</main>

<InfoSection
  simulacion={modoTelefono}
  conCobro={sellEnabled}
  conPrivacidad={data.conPrivacidad}
  rutaPrivacidad={rutaEnIdioma('/privacy', $locale)}
/>
<SiteFooter conPrivacidad={data.conPrivacidad} />

<style>
  /* Roboto ya no se pide a Google Fonts: se sirve desde el sitio y se importa
     en +layout.svelte (@fontsource/roboto). Ver el comentario ahí. */

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
    /* Por ENCIMA del aviso de cookies (1900) y por debajo de la ventana de pago (2000): quien llega en un idioma que no es el suyo tiene que poder cambiarlo sin contestar el aviso. */
    z-index: 1950;
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

  /* Texto solo para lectores de pantalla (el <h1> que se va al buscar). */
  .solo-lectores {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .sim-title {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 1.7rem;
    font-weight: 700;
    line-height: 1.25;
    color: white;
    text-align: center;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .sim-notice {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 0.95rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    margin: 1.25rem auto 0;
    max-width: 32rem;
  }

  /* El aviso del cobro: a la vista ANTES de la primera acción, no solo en el
     modal que aparece al final. Más discreto que el de la simulación. */
  .pay-notice {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 0.85rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.78);
    text-align: center;
    margin: 0.9rem auto 0;
    max-width: 32rem;
  }

  .safe-mode-buttons + .pay-notice {
    margin-top: 1.75rem;
  }

  /* Una búsqueda que falló. Sustituye al alert() nativo: mismo recuadro que el
     aviso de compra, en rojo. */
  .search-error {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    color: #ffffff;
    background: rgba(178, 42, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 12px;
    padding: 0.9rem 1.1rem;
    margin: 0 auto 1.5rem;
    max-width: 32rem;
    text-align: center;
  }

  .purchase-notice {
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    color: #ffffff;
    background: rgba(16, 122, 62, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 12px;
    padding: 0.9rem 1.1rem;
    margin: 0 0 1.5rem 0;
    max-width: 32rem;
    text-align: center;
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
