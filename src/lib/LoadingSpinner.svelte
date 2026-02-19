<script>
  import { _ } from 'svelte-i18n';
  import { getCarriers } from './carriers.js';
  
  export let isVisible = true;
  export let countryCode = '+52'; // Código de país por defecto

  let messages = [];

  // Generar mensajes dinámicamente cuando cambia el país o el idioma
  $: {
    const carriers = getCarriers(countryCode);
    messages = [
      $_('spinner.generatingGPS'),
      $_('spinner.triangulating'),
      $_('spinner.reactivating'),
      ...carriers,  // Despliega cada carrier como un mensaje individual
      $_('spinner.positionDefined'),
      $_('spinner.deviceFound'),
    ];
  }

  let currentMessageIndex = 0;

  $: if (isVisible) {
    currentMessageIndex = 0;
  }

  $: {
    if (isVisible && currentMessageIndex < messages.length) {
      // El último mensaje dura el doble de tiempo
      const isLastMessage = currentMessageIndex === messages.length - 1;
      const delay = isLastMessage ? 3000 : 1500;
      
      setTimeout(() => {
        currentMessageIndex += 1;
      }, delay);
    }
  }
</script>

{#if isVisible && currentMessageIndex < messages.length}
  <div class="spinner-overlay">
    <div class="spinner-container">
      <div class="spinner"></div>
      <p class="message">{messages[currentMessageIndex]}</p>
    </div>
  </div>
{/if}

<style>
  .spinner-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(5, 82, 204, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .message {
    color: white;
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    text-align: center;
    letter-spacing: 0.5px;
  }
</style>
