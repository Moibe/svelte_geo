<script>
  import { crearSesionPago, getProductDetailsByCountry, getGAClientId } from './stripe.js';
  
  export let isVisible = false;
  export let onClose = () => {};
  export let countryCode = '';
  
  let isLoading = false;
  let errorMessage = '';
  let productDetails = null;
  let loadingDetails = false;

  // Cargar detalles del producto cuando se muestra el modal o cambia el país
  $: if (isVisible && countryCode) {
    console.log('🌍 Modal visible - País del USUARIO (para precio Stripe):', countryCode);
    productDetails = null; // Reset cuando cambia el país
    loadProductDetails();
  }

  async function loadProductDetails() {
    loadingDetails = true;
    console.log('🔍 Cargando detalles para país:', countryCode);
    
    try {
      productDetails = await getProductDetailsByCountry(countryCode);
      console.log('✅ Detalles cargados:', productDetails);
      
      if (!productDetails || !productDetails.priceId) {
        console.error('❌ Detalles incompletos:', productDetails);
      }
    } catch (error) {
      console.error('❌ Error cargando detalles:', error);
    } finally {
      loadingDetails = false;
    }
  }

  async function handlePayment() {
    isLoading = true;
    errorMessage = '';
    
    console.log('💳 Iniciando pago...');
    console.log('País:', countryCode);
    console.log('Detalles del producto:', productDetails);
    
    try {
      if (!productDetails?.priceId) {
        throw new Error('No se pudieron cargar los detalles del producto. Detalles: ' + JSON.stringify(productDetails));
      }

      console.log('💰 Price ID a usar:', productDetails.priceId);

      // Detectar GA Client ID automáticamente
      const gaClientId = getGAClientId();
      console.log('📊 GA Client ID:', gaClientId);

      // Crear sesión de pago con Stripe Kraken
      await crearSesionPago(
        productDetails.priceId,    // price_id (requerido)
        1,                         // unidades: 1 acceso (requerido)
        'payment',                 // mode: pago único (requerido)
        {
          gaCliente: gaClientId,
          sitio: 'svelte-geo',
          app: 'geo'
        }
      );
    } catch (error) {
      console.error('💥 Error completo en pago:', error);
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
          <h2>Cargando...</h2>
          <p class="description">Obteniendo detalles del producto</p>
        {:else if productDetails}
          <h2>{productDetails.product.name}</h2>
          <p class="description">{productDetails.product.description}</p>
          <p class="price">{productDetails.price.formatted}</p>
        {:else}
          <h2>Acceso Premium</h2>
          <p class="description">Obtén acceso a funciones avanzadas de geolocalización</p>
        {/if}
        
        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}
        
        <button 
          class="payment-button"
          on:click={handlePayment}
          disabled={isLoading || loadingDetails || !productDetails}
        >
          {isLoading ? 'Procesando...' : 'Comprar'}
        </button>
        
        {#if productDetails}
          <div class="debug-info">
            <p><small><strong>Debug Info:</strong></p>
            <p><small>País: {countryCode}</small></p>
            <p><small>Price ID: {productDetails.priceId}</small></p>
          </div>
        {/if}
        
        <p class="stripe-text">Pago Seguro con Stripe ®</p>
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
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    background: white;
    border-radius: 24px;
    padding: 2rem 4rem;
    max-width: 600px;
    width: 80%;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 60px rgba(74, 144, 226, 0.4),
      0 0 120px rgba(74, 144, 226, 0.2);
    border: 2px solid rgba(144, 202, 249, 0.3);
  }

  .payment-section {
    width: 100%;
    text-align: center;
  }

  .payment-section h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
    color: #333;
    font-weight: 700;
  }

  .description {
    color: #666;
    font-size: 0.95rem;
    margin: 0 0 1rem 0;
  }

  .price {
    font-size: 2.5rem;
    font-weight: 700;
    color: #667eea;
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .error-message {
    background: #fee;
    color: #c33;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    border-left: 4px solid #c33;
  }

  .payment-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    transition: all 0.3s ease;
  }

  .payment-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
  }

  .payment-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .debug-info {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 0.5rem;
    margin: 1rem 0;
    font-size: 0.75rem;
    text-align: left;
  }

  .debug-info p {
    margin: 0.25rem 0;
    color: #666;
  }

  .stripe-text {
    margin: 1rem 0 0 0;
    font-size: 0.85rem;
    color: #888;
    text-align: center;
  }
</style>