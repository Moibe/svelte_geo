<script>
  import { enhance } from '$app/forms'

  let { form } = $props()
</script>

<svelte:head>
  <title>Entrar · geoservices</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <form method="POST" use:enhance class="tarjeta">
    <h1>geoservices</h1>
    <p class="sub">Panel de administración</p>

    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <label>
      Usuario
      <input name="usuario" autocomplete="username" value={form?.usuario ?? ''} required autofocus />
    </label>

    <label>
      Contraseña
      <input name="password" type="password" autocomplete="current-password" required />
    </label>

    <button type="submit">Entrar</button>
  </form>
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
    padding: 1.5rem;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
  }

  .tarjeta {
    width: 100%;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
    color: #fff;
  }

  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.01em;
  }

  .sub {
    margin: -0.6rem 0 0.4rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.75);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
  }

  input {
    padding: 0.7rem 0.85rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.95);
    color: #0b2545;
    font-size: 1rem;
  }

  input:focus-visible {
    outline: 2px solid #90caf9;
    outline-offset: 1px;
  }

  button {
    margin-top: 0.4rem;
    padding: 0.8rem;
    border: none;
    border-radius: 10px;
    background: #ffffff;
    color: #0052cc;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  button:hover {
    background: #e8f1ff;
  }

  .error {
    margin: 0;
    padding: 0.65rem 0.8rem;
    border-radius: 10px;
    background: rgba(183, 28, 28, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 0.9rem;
  }
</style>
