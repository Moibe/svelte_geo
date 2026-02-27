<script>
  import { locale } from 'svelte-i18n';

  // Los 6 idiomas siempre visibles
  const PINNED = ['es', 'en', 'pt', 'fr', 'de', 'ar'];

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'pt', label: 'Português' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'ar', label: 'العربية' }
    // Agregar nuevos idiomas aquí — aparecerán en el menú "···" automáticamente
  ];

  // Visible: los 6 fijos + el idioma activo si está en overflow
  $: pinned = languages.filter(l => PINNED.includes(l.code));
  $: overflow = languages.filter(l => !PINNED.includes(l.code));
  $: activeInOverflow = overflow.find(l => l.code === $locale) || null;
  $: visible = activeInOverflow
    ? [...pinned, activeInOverflow]
    : pinned;

  let menuOpen = false;

  function changeLanguage(lang) {
    locale.set(lang);
    localStorage.setItem('preferred_language', lang);
    menuOpen = false;
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  // Cerrar menú al hacer click fuera
  function handleOutsideClick(e) {
    if (!e.target.closest('.lang-overflow')) {
      menuOpen = false;
    }
  }
</script>

<svelte:window on:click={handleOutsideClick} />

<div class="language-selector">
  {#each visible as lang}
    <button
      class="lang-button"
      class:active={$locale === lang.code}
      on:click={() => changeLanguage(lang.code)}
    >
      {lang.label}
    </button>
  {/each}

  {#if overflow.length > 0}
    <div class="lang-overflow">
      <button
        class="lang-button more-button"
        class:active={menuOpen}
        on:click|stopPropagation={toggleMenu}
      >
        ···
      </button>
      {#if menuOpen}
        <div class="overflow-menu">
          {#each overflow as lang}
            <button
              class="overflow-item"
              class:active={$locale === lang.code}
              on:click={() => changeLanguage(lang.code)}
            >
              {lang.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .language-selector {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    position: relative;
  }

  .lang-button {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .lang-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .lang-button.active {
    background: rgba(255, 255, 255, 0.9);
    color: #0052cc;
    border-color: white;
    font-weight: 600;
  }

  .more-button {
    padding: 0.5rem 0.75rem;
    letter-spacing: 0.05em;
  }

  .lang-overflow {
    position: relative;
  }

  .overflow-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #1a2a4a;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    z-index: 1000;
    min-width: 130px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }

  .overflow-item {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    background: transparent;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .overflow-item:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .overflow-item.active {
    background: rgba(255, 255, 255, 0.9);
    color: #0052cc;
    font-weight: 600;
  }
</style>

