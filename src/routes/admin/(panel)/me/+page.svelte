<script>
  import { enhance } from '$app/forms'

  let { form } = $props()
</script>

<svelte:head>
  <title>Mi cuenta · geoservices</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="contenido">
  <h1>Mi cuenta</h1>
  <p class="sub">Cambiar la contraseña con la que entrás al panel.</p>

  <form method="POST" use:enhance class="tarjeta">
    {#if form?.error}
      <p class="aviso error" role="alert">{form.error}</p>
    {:else if form?.ok}
      <p class="aviso ok" role="status">
        Contraseña cambiada. Se cerraron las demás sesiones; esta sigue abierta.
      </p>
    {/if}

    <label>
      Contraseña actual
      <input name="actual" type="password" autocomplete="current-password" required />
    </label>

    <label>
      Contraseña nueva
      <input name="nueva" type="password" autocomplete="new-password" minlength="10" required />
      <span class="ayuda">Mínimo 10 caracteres. Una frase larga es más segura que algo corto con símbolos.</span>
    </label>

    <label>
      Repetir la nueva
      <input name="repetida" type="password" autocomplete="new-password" minlength="10" required />
    </label>

    <button type="submit">Cambiar contraseña</button>
  </form>
</div>

<style>
  .contenido {
    max-width: 32rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    letter-spacing: -0.01em;
  }

  .sub {
    margin: 0.35rem 0 1.75rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .tarjeta {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: 1.5rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
  }

  input {
    padding: 0.65rem 0.8rem;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.95);
    color: #0b2545;
    font-size: 1rem;
  }

  .ayuda {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.35;
  }

  button {
    margin-top: 0.3rem;
    padding: 0.75rem;
    border: none;
    border-radius: 10px;
    background: #fff;
    color: #0052cc;
    font-size: 0.97rem;
    font-weight: 700;
    cursor: pointer;
  }

  button:hover {
    background: #e8f1ff;
  }

  .aviso {
    margin: 0;
    padding: 0.7rem 0.85rem;
    border-radius: 10px;
    font-size: 0.88rem;
    line-height: 1.4;
    border: 1px solid rgba(255, 255, 255, 0.28);
  }

  .aviso.error {
    background: rgba(183, 28, 28, 0.85);
  }

  .aviso.ok {
    background: rgba(27, 94, 32, 0.85);
  }
</style>
