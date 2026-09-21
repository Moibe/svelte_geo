<script>
  import { enhance } from '$app/forms'

  let { data } = $props()

  // Agrupadas por el campo `grupo` de la base, conservando el orden.
  let grupos = $derived(
    data.filas.reduce((acc, fila) => {
      ;(acc[fila.grupo] ??= []).push(fila)
      return acc
    }, {})
  )

  // Clave -> estado de la última operación, para dar feedback por fila sin
  // recargar ni mostrar un cartel global que tape lo que se acaba de tocar.
  let estados = $state({})

  /**
   * use:enhance por fila. Un toggle se manda solo; un campo de texto o número
   * se manda al salir del campo o al apretar Enter.
   */
  function enviar() {
    return ({ formData }) => {
      const clave = formData.get('clave')
      estados[clave] = { guardando: true }

      return async ({ result, update }) => {
        if (result.type === 'failure') {
          estados[clave] = { error: result.data?.error ?? 'No se pudo guardar' }
        } else {
          estados[clave] = { ok: true }
          // Se limpia el tilde para que no quede pegado en pantalla.
          setTimeout(() => {
            if (estados[clave]?.ok) estados[clave] = {}
          }, 2000)
        }
        await update({ reset: false })
      }
    }
  }
</script>

<svelte:head>
  <title>Flags · geoservices</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="contenido">
  <header>
    <h1>Flags</h1>
    <p class="sub">
      Los cambios se aplican al instante. Las pestañas abiertas se enteran en
      pocos segundos, sin recargar.
    </p>
  </header>

  {#each Object.entries(grupos) as [grupo, filas] (grupo)}
    <section>
      <h2>{grupo}</h2>

      {#each filas as fila (fila.clave)}
        <form
          method="POST"
          action={fila.tipo === 'boolean' ? '?/alternar' : '?/guardar'}
          use:enhance={enviar}
          class="fila"
          class:error={estados[fila.clave]?.error}
        >
          <input type="hidden" name="clave" value={fila.clave} />

          <div class="texto">
            <span class="etiqueta">
              {fila.etiqueta}
              {#if estados[fila.clave]?.ok}<span class="tilde" aria-label="guardado">✓</span>{/if}
              {#if estados[fila.clave]?.guardando}<span class="tilde">…</span>{/if}
            </span>
            {#if fila.descripcion}<span class="ayuda">{fila.descripcion}</span>{/if}
            {#if estados[fila.clave]?.error}
              <span class="msg-error" role="alert">{estados[fila.clave].error}</span>
            {/if}
          </div>

          <div class="control">
            {#if fila.tipo === 'boolean'}
              <!-- No se manda ningún valor: lo invierte el servidor leyendo el
                   actual de la base. Ver la acción `alternar`. -->
              <button
                type="submit"
                class="switch"
                class:on={fila.valor}
                role="switch"
                aria-checked={fila.valor}
                aria-label={fila.etiqueta}
              >
                <span class="perilla"></span>
              </button>
            {:else if fila.tipo === 'number'}
              <input
                class="campo"
                type="number"
                name="valor"
                value={fila.valor}
                onblur={(e) => e.currentTarget.form.requestSubmit()}
                onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
              <button type="submit" class="aplicar">Aplicar</button>
            {:else}
              <input
                class="campo ancho"
                type="text"
                name="valor"
                value={fila.valor}
                spellcheck="false"
                onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
              />
              <button type="submit" class="aplicar">Aplicar</button>
            {/if}
          </div>
        </form>
      {/each}
    </section>
  {/each}
</div>

<style>
  .contenido {
    max-width: 52rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  header {
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0;
    font-size: 1.8rem;
    letter-spacing: -0.01em;
  }

  .sub {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    max-width: 34rem;
  }

  section {
    margin-bottom: 2rem;
  }

  h2 {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: rgba(255, 255, 255, 0.55);
  }

  .fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 0.9rem 1.1rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  .fila + .fila {
    margin-top: 0.5rem;
  }

  .fila.error {
    border-color: rgba(255, 138, 128, 0.8);
  }

  .texto {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .etiqueta {
    font-size: 0.97rem;
    font-weight: 600;
  }

  .tilde {
    color: #7bdba0;
    margin-left: 0.35rem;
  }

  .ayuda {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.62);
    line-height: 1.35;
  }

  .msg-error {
    font-size: 0.82rem;
    color: #ff8a80;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .switch {
    position: relative;
    width: 3rem;
    height: 1.7rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.16);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s ease;
  }

  .switch.on {
    background: #2e7d32;
    border-color: #4caf50;
  }

  .perilla {
    position: absolute;
    top: 50%;
    left: 0.2rem;
    transform: translateY(-50%);
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: #fff;
    transition: left 0.15s ease;
  }

  .switch.on .perilla {
    left: calc(100% - 1.4rem);
  }

  .campo {
    width: 5.5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.95);
    color: #0b2545;
    font-size: 0.95rem;
  }

  .campo.ancho {
    width: 17rem;
    font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
    font-size: 0.82rem;
  }

  .aplicar {
    padding: 0.5rem 0.75rem;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    cursor: pointer;
    font-size: 0.82rem;
  }

  .aplicar:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  @media (max-width: 560px) {
    .fila {
      flex-direction: column;
      align-items: stretch;
    }

    .control {
      justify-content: flex-end;
    }

    .campo.ancho {
      width: 100%;
    }
  }
</style>
