<script>
  import { onMount, onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import CountrySelect from './lib/CountrySelect.svelte';
  import PhoneInput from './lib/PhoneInput.svelte';
  import Map from './lib/Map.svelte';
  import LoadingSpinner from './lib/LoadingSpinner.svelte';
  import Modal from './lib/Modal.svelte';
  import LanguageSelector from './lib/LanguageSelector.svelte';
  import { detectCountry, getLocationCache, saveLocationCache, searchByBrowser, searchByIP } from './lib/geoLocation.js';
  import { setLanguageFromCountry, getLanguageFromCountry } from './lib/i18n.js';
  import { getSafeModeConfig, onSafeModeChange } from './lib/firebase.js';

  let phoneNumber = '';
  let selectedCountry = '+1'; // País del teléfono que busca
  let userCountryCode = '+52'; // País real del usuario (para precio Stripe)
  let showMap = false;
  let showSpinner = false;
  let showModal = false;
  let mapCoords = { lat: 19.4326, lng: -99.1332 }; // Default CDMX
  let lastUsedPhoneNumber = '';
  let safeMode = false; // Estado de Safe Mode (cargado desde Firestore)
  let unsubscribe = null; // Función para detener listener de Firestore
  


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
    // Cargar configuración de Safe Mode desde Firestore
    try {
      safeMode = await getSafeModeConfig();
      console.log('🔧 Safe Mode inicial:', safeMode);
      
      // Escuchar cambios en tiempo real
      unsubscribe = onSafeModeChange((newValue) => {
        safeMode = newValue;
        console.log('🔄 Safe Mode actualizado a:', safeMode);
      });
    } catch (error) {
      console.error('❌ Error al cargar Safe Mode:', error);
      safeMode = false; // Default a modo normal si falla
    }
    
    // Detectar país y ubicación REAL del usuario
    const locationData = await detectCountry();
    userCountryCode = locationData.countryCode; // Para precio Stripe
    selectedCountry = locationData.countryCode; // Para dropdown (inicia con país del usuario)
    mapCoords = { lat: locationData.lat, lng: locationData.lng };
    
    // Establecer idioma automáticamente según el país
    setLanguageFromCountry(locationData.countryCode);
    
    console.log('🌍 Ubicación del usuario detectada:');
    console.log('   📞 Código telefónico:', userCountryCode);
    if (locationData.isoCode) {
      console.log('   🏴 Código ISO país:', locationData.isoCode);
    }
    console.log('   🌐 Idioma establecido:', getLanguageFromCountry(locationData.countryCode) === 'es' ? 'Español' : 'English');
    
    // Recuperar el último teléfono usado
    const lastPhone = localStorage.getItem('last_phone_number');
    lastUsedPhoneNumber = lastPhone || '';

    // Detectar retorno exitoso de Stripe
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      // Restaurar coordenadas del mapa desde localStorage
      const savedCoords = localStorage.getItem('map_coords');
      if (savedCoords) {
        try {
          const coords = JSON.parse(savedCoords);
          mapCoords = coords;
          showMap = true;
          
          // Limpiar el parámetro de la URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          console.log('✅ Pago exitoso - Mapa restaurado');
        } catch (e) {
          console.error('Error al restaurar coordenadas:', e);
        }
      }
    }
  });

  onDestroy(() => {
    // Detener listener de Firestore cuando se destruya el componente
    if (unsubscribe) {
      unsubscribe();
    }
  });

  async function handleOkClick() {
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
    
    // Mostrar mapa
    showMap = true;
    
    // Ocultar spinner
    showSpinner = false;

    // Iniciar timer para modal (30 segundos)
    setTimeout(() => {
      showModal = true;
    }, 30000);
  }

  function closeModal() {
    showModal = false;
    showMap = false;
    phoneNumber = '';
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
      mapCoords = { lat: result.lat, lng: result.lng };
      userCountryCode = result.countryCode;
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner
      
      // Esperar spinner
      await new Promise(resolve => setTimeout(resolve, 16500));
      
      showMap = true;
      showSpinner = false;
      
      // Mostrar modal después de 30 segundos
      setTimeout(() => {
        showModal = true;
      }, 30000);
    } catch (error) {
      console.error('Error en búsqueda por navegador:', error);
      alert('No se pudo acceder a la ubicación del navegador. Por favor, permite el acceso a tu ubicación.');
      showSpinner = false;
    }
  }

  async function handleIPSearch() {
    showSpinner = true;
    try {
      const result = await searchByIP();
      mapCoords = { lat: result.lat, lng: result.lng };
      userCountryCode = result.countryCode;
      selectedCountry = result.countryCode; // Para mostrar carriers correctos en spinner
      
      // Esperar spinner
      await new Promise(resolve => setTimeout(resolve, 16500));
      
      showMap = true;
      showSpinner = false;
      
      // Mostrar modal después de 30 segundos
      setTimeout(() => {
        showModal = true;
      }, 30000);
    } catch (error) {
      console.error('Error en búsqueda por IP:', error);
      alert('No se pudo detectar tu ubicación por IP.');
      showSpinner = false;
    }
  }
  

</script>

<main>
  <LoadingSpinner isVisible={showSpinner} countryCode={selectedCountry} />
  <Modal 
    isVisible={showModal} 
    onClose={closeModal}
    countryCode={userCountryCode}
    mapLat={mapCoords.lat}
    mapLng={mapCoords.lng}
  />
  <div class="language-selector-wrapper">
    <LanguageSelector />
  </div>
  <div class="container">
    {#if !showMap}
      {#if !safeMode}
        <!-- Modo Normal: Dropdown + Phone + Buscar -->
        <div class="input-wrapper">
          <CountrySelect bind:value={selectedCountry} />
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
      {/if}
    {/if}
    {#if showMap}
      <div class="map-wrapper">
        <Map lat={mapCoords.lat} lng={mapCoords.lng} />
      </div>
    {/if}
  </div>
</main>

<style>
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

  .safe-mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 500px;
    margin: 0 auto;
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

    .safe-mode-buttons {
      width: 100%;
    }

    .safe-button {
      font-size: 1.1rem;
      padding: 1.2rem 1.5rem;
    }
  }
</style>
