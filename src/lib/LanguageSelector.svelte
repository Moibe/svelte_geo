<script>
  import { locale } from "svelte-i18n";
  import { createEventDispatcher } from "svelte";
  import { guardarPreferencia, aplicarIdiomaAlDocumento } from "./i18n.js";

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

  function changeLanguage(lang) {
    locale.set(lang);
    // Guarda en cookie ADEMÁS de localStorage: la cookie es la única que el
    // servidor puede leer, y sin ella el primer render server-side ignoraría
    // la elección explícita del usuario y le pintaría otro idioma.
    guardarPreferencia(lang);
    // Mantener el <html lang> y la dirección en sintonía con la elección.
    aplicarIdiomaAlDocumento(lang);
    cerrar();
    dispatch("change", { language: lang });
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
    <ul class="menu" role="listbox" aria-label="Idioma">
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
            <span class="texto">{lang.label}</span>
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
