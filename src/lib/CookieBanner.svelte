<script>
  import { tick } from 'svelte'
  import { _, locale } from 'svelte-i18n'
  import { usarConsentimiento } from '$lib/consent.svelte.js'
  import { rutaEnIdioma } from '$lib/idiomas.js'

  /**
   * El aviso de cookies de la UE, el Reino Unido y Suiza.
   *
   * Decisiones (el diseño completo está en COOKIES.md):
   *
   *   - "Aceptar todo" y "Rechazar todo" son IGUALES: mismo tamaño, color y lugar. Rechazar no
   *     puede costar más esfuerzo ni verse menos que aceptar.
   *   - Nada viene marcado de antemano en el panel de ajustes.
   *   - No bloquea la página (no es modal, no hay fondo oscuro): se puede leer el sitio
   *     mientras se decide, y Google no se carga hasta que se elige algo. Para eso reserva su
   *     alto al final de la página (--alto-aviso, que lee el pie) y nunca ocupa más de ~70 % de
   *     la pantalla: el texto se desplaza por dentro y los botones quedan siempre a la vista.
   *   - Va PRIMERO en el DOM para que el teclado y los lectores de pantalla lo encuentren
   *     antes que el resto de la página.
   *   - No roba el foco al cargar la página; sí lo recibe cuando la persona lo reabre desde el
   *     pie, y se lo devuelve al botón que lo abrió al cerrarse. Al pulsar «Configurar» el foco
   *     pasa a la primera casilla (el botón se reemplaza y, si no, el foco se perdería).
   *   - Se pinta YA en el servidor cuando la IP es de la región (ver consent.svelte.js), para
   *     que aparezca con la primera pantalla y no unos instantes después.
   *   - Queda POR DEBAJO de la ventana de pago (z-index 1900 frente a 2000): pagar no depende de
   *     contestar el aviso, y en pantallas chicas el aviso tapaba el botón «Comprar».
   *
   * `conPrivacidad`: solo se enlaza la política si existe (ver $lib/server/sitio.js).
   */
  let { conPrivacidad = false } = $props()

  const estado = usarConsentimiento()

  // Google exige, en la primera capa de un aviso que le entrega datos, un enlace a cómo los usa
  // (https://business.safety.google/privacy/). El parámetro hl elige el idioma de esa página.
  const IDIOMA_DE_GOOGLE = { es: 'es', en: 'en', pt: 'pt-BR', fr: 'fr', de: 'de', ar: 'ar' }
  const enlaceDeGoogle = $derived(`https://business.safety.google/privacy/?hl=${IDIOMA_DE_GOOGLE[$locale] ?? 'en'}`)

  // El panel de ajustes (las categorías con sus casillas). Arranca cerrado salvo cuando se
  // reabre desde el pie: ahí la persona ya eligió una vez y viene a cambiarlo.
  let panel = $state(false)
  let analitica = $state(false)
  let publicidad = $state(false)

  /** @type {HTMLElement | undefined} */
  let contenedor = $state()

  // «Cerrar» y Escape solo existen cuando HAY una elección que conservar: sin ella el aviso no se
  // puede cerrar sin contestar (Escape no decide nada por la persona), así que ofrecerlos sería
  // un botón que no hace nada.
  const sePuedeCerrar = $derived(Boolean(estado?.reabierto && estado.decision))

  // Al reabrirlo se parte de lo que ya eligió, y el foco entra al aviso.
  $effect(() => {
    if (!estado?.reabierto) return

    panel = true
    analitica = Boolean(estado.decision?.analitica)
    publicidad = Boolean(estado.decision?.publicidad)

    tick().then(() => contenedor?.focus())
  })

  // La página reserva el alto del aviso (--alto-aviso) para que el final del documento —el pie, la
  // atribución, el final de la política— se pueda leer por encima de él, y el foco del teclado no
  // caiga oculto debajo. El pie suma esa variable a su relleno; scroll-padding-bottom (abajo, en
  // :global) hace lo mismo con el desplazamiento hacia un elemento enfocado.
  $effect(() => {
    const aviso = contenedor

    if (!aviso || typeof ResizeObserver === 'undefined') return

    const raiz = document.documentElement
    const medir = () => {
      // Del borde de arriba del aviso al borde de abajo de la pantalla: incluye su margen inferior.
      const alto = Math.ceil(window.innerHeight - aviso.getBoundingClientRect().top) + 8

      raiz.style.setProperty('--alto-aviso', `${alto}px`)
    }

    medir()

    const observador = new ResizeObserver(medir)
    observador.observe(aviso)

    return () => {
      observador.disconnect()
      raiz.style.removeProperty('--alto-aviso')
    }
  })

  function aceptarTodo() {
    estado?.elegir(true, true)
  }

  function rechazarTodo() {
    estado?.elegir(false, false)
  }

  function guardarEleccion() {
    estado?.elegir(analitica, publicidad)
  }

  async function abrirPanel() {
    panel = true
    analitica = false
    publicidad = false

    // El botón «Configurar» se reemplaza por «Guardar mi elección» y, sin esto, el foco caería al
    // <body>: el teclado se saltaría las casillas y un lector de pantalla no sabría que se abrió algo.
    await tick()
    document.getElementById('cc-analitica')?.focus()
  }

  // Escape cierra el aviso SOLO si se reabrió con una elección que conservar. Cuando todavía no hay
  // elección, Escape no decide nada por la persona: ni acepta ni rechaza.
  function alTeclear(evento) {
    if (evento.key === 'Escape' && sePuedeCerrar) {
      evento.stopPropagation()
      estado.cerrar()
    }
  }
</script>

{#if estado?.visible}
  <div
    class="aviso"
    class:con-panel={panel}
    class:con-cerrar={sePuedeCerrar}
    role="dialog"
    aria-modal="false"
    aria-labelledby="cc-titulo"
    aria-describedby="cc-texto"
    tabindex="-1"
    bind:this={contenedor}
    onkeydown={alTeclear}
  >
    <div class="cuerpo">
      <p id="cc-titulo" class="titulo">{$_('consent.title')}</p>
      <p id="cc-texto" class="texto">
        {$_('consent.intro')}
        <a href={enlaceDeGoogle} target="_blank" rel="noopener noreferrer">{$_('consent.googleInfo')}</a>
        {#if conPrivacidad}
          <a href={rutaEnIdioma('/privacy', $locale)}>{$_('consent.policy')}</a>
        {/if}
      </p>

      {#if panel}
        <fieldset class="categorias">
          <legend class="solo-lectores">{$_('consent.legend')}</legend>

          <div class="categoria">
            <div class="fila">
              <span class="nombre">{$_('consent.necessary.title')}</span>
              <span class="siempre">{$_('consent.necessary.always')}</span>
            </div>
            <p class="detalle">{$_('consent.necessary.text')}</p>
          </div>

          <div class="categoria">
            <label class="fila" for="cc-analitica">
              <span class="nombre">{$_('consent.analytics.title')}</span>
              <input id="cc-analitica" type="checkbox" bind:checked={analitica} aria-describedby="cc-analitica-texto" />
            </label>
            <p class="detalle" id="cc-analitica-texto">{$_('consent.analytics.text')}</p>
          </div>

          <div class="categoria">
            <label class="fila" for="cc-publicidad">
              <span class="nombre">{$_('consent.advertising.title')}</span>
              <input id="cc-publicidad" type="checkbox" bind:checked={publicidad} aria-describedby="cc-publicidad-texto" />
            </label>
            <p class="detalle" id="cc-publicidad-texto">{$_('consent.advertising.text')}</p>
          </div>
        </fieldset>
      {/if}
    </div>

    <div class="acciones">
      <button type="button" class="boton" onclick={aceptarTodo}>{$_('consent.acceptAll')}</button>
      <button type="button" class="boton" onclick={rechazarTodo}>{$_('consent.rejectAll')}</button>
      {#if panel}
        <button type="button" class="boton" onclick={guardarEleccion}>{$_('consent.save')}</button>
      {:else}
        <button type="button" class="boton secundario" onclick={abrirPanel}>{$_('consent.configure')}</button>
      {/if}
    </div>

    {#if sePuedeCerrar}
      <button type="button" class="cerrar" aria-label={$_('consent.close')} onclick={() => estado.cerrar()}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  /* El desplazamiento hacia un elemento enfocado (Tab hasta el pie) tiene que dejarlo POR ENCIMA del
     aviso, no oculto debajo. --alto-aviso lo pone el componente mientras está en pantalla. */
  :global(html) {
    scroll-padding-bottom: var(--alto-aviso, 0px);
  }

  .aviso {
    position: fixed;
    inset-inline: 0.75rem;
    bottom: 0.75rem;
    /* POR DEBAJO de la ventana de pago (z-index 2000): pagar no depende de contestar el aviso, y en
       pantallas chicas el aviso, encima, tapaba el botón «Comprar». Por encima de todo lo demás. */
    z-index: 1900;
    box-sizing: border-box;
    max-width: 64rem;
    margin-inline: auto;
    /* Nunca más de ~70 % de la pantalla: el texto se desplaza por dentro (.cuerpo) y los botones
       quedan siempre a la vista. La primera línea es el respaldo para navegadores sin dvh. */
    max-height: calc(100vh - 4rem);
    /* ~70 % de la pantalla; con la letra grande (rem crece) el tope sube hasta 92 % para que el texto conserve
       su mínimo y los botones sigan a la vista sin desplazarse. */
    /* Nunca invade la franja de arriba (4 rem) donde está el selector de idioma, que es fijo: en un móvil
       horizontal el aviso, más alto que la pantalla corta, tapaba su botón «Cerrar». */
    max-height: min(92dvh, max(70dvh, 22rem), calc(100dvh - 4rem));
    /* Una columna: el texto (.cuerpo) cede alto y los botones (.acciones) no. Con flex, el alto máximo
       sí limita al texto (con una rejilla de filas «1fr» y alto automático, no lo hacía en escritorio). */
    display: flex;
    flex-direction: column;
    gap: 0.9rem 1.5rem;
    padding: 1.1rem 1.25rem;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: #fff;
    color: #1b2733;
    /* El borde cuenta en modo de alto contraste (Windows), donde las sombras y los fondos se
       anulan y el aviso, sin borde, no tendría orillas. */
    border: 1px solid #cfd8e3;
    border-radius: 14px;
    box-shadow: 0 10px 40px rgba(0, 20, 60, 0.4);
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 0.95rem;
    line-height: 1.45;
    text-align: start;
  }

  /* Con el panel de ajustes hay más que leer: se le deja más alto. */
  .aviso.con-panel {
    max-height: min(94dvh, max(88dvh, 28rem), calc(100dvh - 4rem));
  }

  .aviso:focus {
    outline: none;
  }

  /* El aviso recibe el foco al reabrirse y queda sobre el fondo azul de la página: un aro de dos
     tonos (blanco por fuera del borde y azul oscuro alrededor) se ve sobre cualquier fondo. */
  .aviso:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 0;
    box-shadow:
      0 0 0 6px #003366,
      0 10px 40px rgba(0, 20, 60, 0.4);
  }

  @media (min-width: 760px) {
    /* Escritorio: el texto a la izquierda y los botones en columna a la derecha. El texto se estira a
       todo el alto del aviso (y se desplaza por dentro si no cabe); los botones quedan centrados. */
    .aviso {
      flex-direction: row;
      align-items: stretch;
      padding: 1.25rem 1.5rem;
    }

    .cuerpo {
      flex: 1 1 0;
      /* El texto, centrado en vertical frente a los botones. Con márgenes automáticos (y no con
         justify-content: center) para que, cuando el texto es más alto que el aviso y se desplaza,
         su principio no quede cortado por arriba. */
      display: flex;
      flex-direction: column;
    }

    .cuerpo > :first-child {
      margin-block-start: auto;
    }

    .cuerpo > :last-child {
      margin-block-end: auto;
    }

    .acciones {
      align-self: center;
    }

    /* Con el panel de ajustes abierto, todo en una columna y los botones en una fila debajo. */
    .aviso.con-panel {
      flex-direction: column;
    }

    .aviso.con-panel .acciones {
      align-self: stretch;
    }
  }

  .cuerpo {
    min-width: 0;
    /* Contiene a los elementos con position: absolute de adentro (la leyenda solo-lectores): sin esto
       su caja de referencia es el aviso entero y, al estar dentro de un texto que se desplaza, estiraba
       el área desplazable del aviso con cientos de píxeles vacíos. */
    position: relative;
    /* El texto SIEMPRE conserva un mínimo a la vista (en rem: crece con la letra grande; con un tope de
       ~26 % de la pantalla): sin él, con letra al 200 % o en un móvil horizontal los botones se llevaban
       todo el alto y el texto quedaba en 0 px. Si aun así no cabe todo, el aviso entero se desplaza
       (overflow-y: auto en .aviso) en vez de recortarse: nada queda inalcanzable. */
    min-height: min(9rem, 26dvh);
    flex: 1 1 auto;
    overflow-y: auto;
  }

  .titulo {
    margin: 0 0 0.35rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: #003366;
  }

  /* El botón de cerrar va en la esquina: el título deja lugar para que no se encimen. */
  .aviso.con-cerrar .titulo {
    padding-inline-end: 2.75rem;
  }

  .texto {
    margin: 0;
    /* Una palabra o un enlace largo (alemán) con letra grande parte en vez de empujar el texto hacia un
       desplazamiento horizontal que recortaba los botones. */
    overflow-wrap: anywhere;
  }

  .texto a {
    color: #0052cc;
    font-weight: 700;
    text-decoration: underline;
  }

  /* Los dos enlaces seguidos no se pegan entre sí. */
  .texto a + a {
    margin-inline-start: 0.6rem;
  }

  /* ── Panel de ajustes ─────────────────────────────────────────────────────── */
  .categorias {
    display: grid;
    /* Una columna que PUEDE encogerse: con la letra grande del sistema (200 %) una pista "auto" crecía
       más que el aviso y las casillas quedaban fuera de él. */
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    margin: 1rem 0 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .categoria {
    min-width: 0;
    padding: 0.7rem 0.85rem;
    border: 1px solid #cfd8e3;
    border-radius: 10px;
    background: #f5f8fc;
    overflow-wrap: anywhere;
  }

  .fila {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem 1rem;
    cursor: pointer;
  }

  .nombre {
    font-weight: 700;
    color: #003366;
  }

  .siempre {
    font-size: 0.85rem;
    font-weight: 700;
    color: #1b6e3c;
  }

  input[type='checkbox'] {
    flex: none;
    width: 1.35rem;
    height: 1.35rem;
    margin: 0;
    accent-color: #0052cc;
    cursor: pointer;
  }

  input[type='checkbox']:focus-visible {
    outline: 3px solid #003366;
    outline-offset: 2px;
  }

  .detalle {
    margin: 0.3rem 0 0;
    font-size: 0.88rem;
    color: #3d4b5a;
  }

  /* ── Botones ──────────────────────────────────────────────────────────────── */
  .acciones {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  @media (min-width: 760px) {
    .acciones {
      flex-direction: column;
      min-width: 13rem;
    }

    .aviso.con-panel .acciones {
      flex-direction: row;
      min-width: 0;
    }
  }

  .boton {
    flex: 1 1 9rem;
    min-height: 2.75rem;
    padding: 0.6rem 1.1rem;
    border: 2px solid #0052cc;
    border-radius: 8px;
    background: #0052cc;
    color: #fff;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  /* Con los botones en columna (escritorio), "flex: 1 1 9rem" fijaría la ALTURA en 9rem. */
  @media (min-width: 760px) {
    .boton {
      flex: none;
    }

    .aviso.con-panel .boton {
      flex: 1 1 0;
    }
  }

  .boton:hover {
    background: #003f9e;
    border-color: #003f9e;
  }

  .boton:focus-visible {
    outline: 3px solid #003366;
    outline-offset: 2px;
  }

  /* "Configurar" es una opción más y se ve como botón (no escondida en un enlace), pero
     con menos peso que aceptar y rechazar, que son las dos decisiones. */
  .boton.secundario {
    background: #fff;
    color: #0052cc;
  }

  .boton.secundario:hover {
    background: #eaf1fb;
  }

  .cerrar {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #3d4b5a;
    cursor: pointer;
  }

  .cerrar:hover {
    background: #eaf1fb;
  }

  .cerrar:focus-visible {
    outline: 3px solid #003366;
    outline-offset: 1px;
  }

  .solo-lectores {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
