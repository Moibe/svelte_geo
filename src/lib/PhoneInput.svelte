<script>
  export let value = '';
  export let onSubmit = () => {};

  function handleInput(e) {
    let input = e.target.value;
    // Remover caracteres no numéricos y limitar a 15 dígitos
    input = input.replace(/\D/g, '').slice(0, 15);
    value = input;
    e.target.value = input;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      onSubmit();
    }
  }
</script>

<input 
  type="text" 
  inputmode="numeric"
  class="phone-input"
  on:input={handleInput}
  on:keydown={handleKeydown}
  bind:value
  placeholder="Ingresa tu número"
/>

<style>
  .phone-input {
    flex: 1;
    padding: 1rem 1.5rem;
    font-size: 1.5rem;
    border: 2px solid #90caf9;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    color: #0052cc;
    font-weight: bold;
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .phone-input:focus {
    outline: none;
    border-color: #4A90E2;
    box-shadow: 0 0 12px rgba(74, 144, 226, 0.4);
  }
</style>
