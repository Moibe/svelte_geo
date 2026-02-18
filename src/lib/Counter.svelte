<script>
  let count = 0

  function increment() {
    count++
  }

  function reset() {
    count = 0
  }
</script>

<div class="counter">
  <p class="count-display">{count}</p>
  <div class="button-group">
    <button class="btn btn-primary" on:click={increment}>
      ➕ Incrementar
    </button>
    <button class="btn btn-secondary" on:click={reset}>
      🔄 Resetear
    </button>
  </div>
</div>

<style>
  .counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .count-display {
    font-size: 3rem;
    font-weight: bold;
    margin: 0;
    color: white;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .button-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn {
    border: 2px solid rgba(255, 255, 255, 0.5);
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.3s ease;
    font-family: inherit;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4A90E2, #357ABD);
    color: white;
    border-color: #4A90E2;
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, #357ABD, #2563eb);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.8);
    transform: translateY(-2px);
  }

  .btn-secondary:active {
    transform: translateY(0);
  }
</style>
