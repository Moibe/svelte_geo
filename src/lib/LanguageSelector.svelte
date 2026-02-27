<script>
  import { locale } from 'svelte-i18n';

  const languages = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'pt', label: 'Português' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' }
  ];

  function changeLanguage(lang) {
    locale.set(lang);
    localStorage.setItem('preferred_language', lang);
  }
</script>

<div class="language-selector">
  {#each languages as lang}
    <button
      class="lang-button"
      class:active={$locale === lang.code}
      on:click={() => changeLanguage(lang.code)}
    >
      {lang.label}
    </button>
  {/each}
</div>

<style>
  .language-selector {
    display: flex;
    gap: 0.5rem;
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
</style>
