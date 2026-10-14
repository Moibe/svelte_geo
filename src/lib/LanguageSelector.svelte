<script>
  import { locale, _ } from "svelte-i18n";
  import { createEventDispatcher } from "svelte";
  import { goto } from "$app/navigation";
  import { guardarPreferencia, aplicarIdiomaAlDocumento, cambioDeIdioma } from "./i18n.js";
  import { rutaEnIdioma } from "./idiomas.js";

  const dispatch = createEventDispatcher();

  const languages = [
    { code: "es", label: "Español" },
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "ar", label: "العربية" },
    // Agregar nuevos idiomas aquí — entran al menú solos.
  ];

  let menuOpen = false;
  let disparador; // el botón, para devolverle el foco al cerrar

  // El idioma activo, con respaldo: si $locale trae algo que no está en la
  // lista (un 'en-US' sin normalizar, por ejemplo), el botón igual muestra
  // algo en vez de quedar vacío.
  $: activo = languages.find((l) => l.code === $locale) || languages[1];

  async function changeLanguage(lang) {
    // Mientras dura el cambio, el layout no debe revertir el idioma a lo que diga
    // la URL (que sigue siendo la vieja hasta que la navegación termina).
    cambioDeIdioma.enCurso = true;
    locale.set(lang);
    // Guarda en cookie ADEMÁS de localStorage: la cookie es la única que el
    // servidor puede leer, y sin ella el primer render server-side ignoraría
    // la elección explícita del usuario y le pintaría otro idioma.
    guardarPreferencia(lang);
    // Mantener el <html lang> y la dirección en sintonía con la elección.
    aplicarIdiomaAlDocumento(lang);
    cerrar();
    dispatch("change", { language: lang });

    // Navegar a la URL de ese idioma (/es, /en/privacy…). Como el idioma de la
    // URL manda sobre la cookie, quedarse en la URL anterior dejaría a quien
    // recarga con el idioma que ya había descartado, y quien comparte el enlace
    // compartiría una URL que dice una cosa y muestra otra. Se conservan la
    // página y la búsqueda (UTM, gclid), y no se mueve el scroll ni el foco.
    //
    // La URL de partida se lee de window.location y NO de page.url: al volver de
    // Stripe la página principal limpia `?payment=success` con history.replaceState
    // nativo, que SvelteKit no ve, y page.url seguía diciendo `?payment=success`.
    // Leerlo de ahí volvía a escribir el parámetro en la barra, y recargar
    // entonces restauraba el mapa pagado sin pagar de nuevo.
    const { pathname, search } = window.location;
    try {
      await goto(rutaEnIdioma(pathname, lang) + search, {
        noScroll: true,
        keepFocus: true,
      });
    } finally {
      cambioDeIdioma.enCurso = false;
    }
  }

  function cerrar() {
    if (!menuOpen) return;
    menuOpen = false;
    // Devolver el foco al botón: sin esto, quien navega con teclado queda
    // "suelto" al principio del documento después de elegir.
    disparador?.focus();
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function handleOutsideClick(e) {
    if (!e.target.closest(".selector-idioma")) menuOpen = false;
  }

  function handleKeydown(e) {
    if (e.key === "Escape") cerrar();
  }

  // Flechas para recorrer las opciones sin mouse.
  function navegarConFlechas(e, indice) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();

    const opciones = e.currentTarget.parentElement.querySelectorAll(".opcion");
    const siguiente =
      e.key === "ArrowDown"
        ? (indice + 1) % opciones.length
        : (indice - 1 + opciones.length) % opciones.length;

    opciones[siguiente].focus();
  }
</script>

<svelte:window on:click={handleOutsideClick} on:keydown={handleKeydown} />

<div class="selector-idioma">
  <button
    bind:this={disparador}
    class="disparador"
    class:abierto={menuOpen}
    on:click|stopPropagation={toggleMenu}
    aria-haspopup="listbox"
    aria-expanded={menuOpen}
  >
    <svg class="globo" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
    <span class="etiqueta">{activo.label}</span>
    <svg class="flecha" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>

  {#if menuOpen}
    <ul class="menu" role="listbox" aria-label={$_('footer.languages')}>
      {#each languages as lang, i (lang.code)}
        <li>
          <button
            class="opcion"
            class:activa={$locale === lang.code}
            role="option"
            aria-selected={$locale === lang.code}
            on:click={() => changeLanguage(lang.code)}
            on:keydown={(e) => navegarConFlechas(e, i)}
          >
            <span class="texto" lang={lang.code}>{lang.label}</span>
            {#if $locale === lang.code}<span class="tilde" aria-hidden="true">✓</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .selector-idioma {
    position: relative;
  }

  .disparador {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.85rem;
    font-size: 0.9rem;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
    white-space: nowrap;
  }

  .disparador:hover,
  .disparador.abierto {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .disparador:focus-visible {
    outline: 2px solid #90caf9;
    outline-offset: 2px;
  }

  .etiqueta {
    /* Ancho fijo para que el botón no salte de tamaño al cambiar de idioma:
       "Español" y "Português" miden distinto y el movimiento se nota. */
    min-width: 5.5rem;
    text-align: start;
  }

  .globo,
  .flecha {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .globo {
    opacity: 0.8;
  }

  .flecha {
    width: 0.85rem;
    height: 0.85rem;
    transition: transform 0.2s ease;
  }

  .disparador.abierto .flecha {
    transform: rotate(180deg);
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    /* Anclado a la derecha porque el selector vive en la esquina superior
       derecha: así el menú nunca se sale de la pantalla al desplegarse. */
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    min-width: 100%;
    background: #14233f;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    z-index: 1000;
  }

  .opcion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 0.45rem 0.7rem;
    font-size: 0.9rem;
    font-family: inherit;
    background: transparent;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: start;
    white-space: nowrap;
    transition: background 0.15s ease;
  }

  .opcion:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .opcion:focus-visible {
    outline: 2px solid #90caf9;
    outline-offset: -2px;
  }

  .opcion.activa {
    background: rgba(255, 255, 255, 0.9);
    color: #0052cc;
    font-weight: 600;
  }

  .tilde {
    font-size: 0.8rem;
  }

  @media (max-width: 420px) {
    .etiqueta {
      min-width: 4.5rem;
    }
  }
</style>
