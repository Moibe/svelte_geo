<script>
  import { _, json } from 'svelte-i18n'

  /**
   * "Cómo funciona" y preguntas frecuentes, a la vista debajo de la herramienta.
   *
   * Es contenido para las personas primero: dice qué hace el sitio, con qué
   * precisión, cuándo se cobra y qué datos usa. Que además le dé a un buscador
   * texto que indexar es consecuencia de que el sitio, fuera de la herramienta,
   * no tenía nada escrito.
   *
   * `simulacion` es el modo con número de teléfono (el flag safeMode apagado):
   * ahí la herramienta es un simulador de entretenimiento y la sección lo dice.
   * Los dos modos son excluyentes en pantalla, así que cada uno lleva SU
   * explicación de cómo funciona (info.how / info.howSim) y solo las preguntas
   * que siguen siendo ciertas tal cual en ese modo.
   *
   * `conCobro`: el flag `sell` del panel. Apagado, el modal de compra no aparece
   * nunca y la app es gratuita, así que no se anuncia ningún pago. El ÚLTIMO paso
   * de info.how y de info.howSim es el del pago (si se reordenan esas listas hay
   * que cambiar esto).
   *
   * `conPrivacidad`: la política de privacidad solo existe cuando hay un correo
   * de contacto configurado (ver $lib/server/sitio.js). Los textos de esta
   * sección no la mencionan; el enlace a ella se agrega aquí, y solo si existe.
   */
  let { simulacion = false, conCobro = true, conPrivacidad = false, rutaPrivacidad = '' } = $props()

  // Índices de info.faq que se muestran en cada modo. 1 = "¿Puedo localizar el
  // teléfono de otra persona?", 3 = "¿Qué datos se guardan?".
  const PREGUNTAS_UBICACION = [0, 1, 2, 3]
  const PREGUNTAS_SIMULADOR = [1, 3]

  const pasos = $derived.by(() => {
    const lista = $json(simulacion ? 'info.howSim' : 'info.how')
    if (!Array.isArray(lista)) return []

    return conCobro ? lista : lista.slice(0, -1)
  })

  const preguntas = $derived.by(() => {
    const todas = $json('info.faq')
    if (!Array.isArray(todas)) return []

    const indices = simulacion ? PREGUNTAS_SIMULADOR : PREGUNTAS_UBICACION

    return indices
      .filter((i) => todas[i])
      .map((i) => ({
        i,
        q: todas[i].q,
        // La pregunta por el teléfono de otra persona tiene respuesta propia en
        // el simulador: ahí el "no" tiene que explicar qué hace el modo con
        // número (no busca nada) en vez de describir la herramienta de ubicación.
        a: simulacion && i === 1 ? $_('info.faqSimAnswer') : todas[i].a,
      }))
  })
</script>

<section class="info" aria-labelledby="info-faq">
  <div class="contenido">
    {#if pasos.length}
      <h2>{$_('info.howTitle')}</h2>
      <ol>
        {#each pasos as paso}
          <li>{paso}</li>
        {/each}
      </ol>
    {/if}

    <h2 id="info-faq">{$_('info.faqTitle')}</h2>
    {#each preguntas as pregunta (pregunta.i)}
      <h3>{pregunta.q}</h3>
      <p>
        {pregunta.a}
        {#if conPrivacidad && pregunta.i === 3}
          <a href={rutaPrivacidad}>{$_('info.privacyLink')}</a>
        {/if}
      </p>
    {/each}
  </div>
</section>

<style>
  .info {
    background: #003366;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.92);
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    line-height: 1.6;
  }

  .contenido {
    max-width: 760px;
    margin: 0 auto;
    padding: 3rem 1.5rem 1.5rem;
  }

  h2 {
    margin: 2rem 0 1rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
  }

  h2:first-child {
    margin-top: 0;
  }

  h3 {
    margin: 1.5rem 0 0.4rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
  }

  p,
  li {
    margin: 0;
    font-size: 1rem;
  }

  a {
    color: #90caf9;
  }

  a:hover,
  a:focus-visible {
    color: #fff;
  }

  ol {
    margin: 0;
    padding-inline-start: 1.4rem;
  }

  li + li {
    margin-top: 0.7rem;
  }
</style>
