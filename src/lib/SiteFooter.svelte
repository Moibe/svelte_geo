<script>
  import { _, locale } from 'svelte-i18n'
  import { page } from '$app/state'
  import { IDIOMAS, rutaEnIdioma } from '$lib/idiomas.js'
  import { guardarPreferencia } from '$lib/i18n.js'

  /**
   * Pie de página: enlaces a cada versión de idioma de la página actual y, si
   * existe, a la política de privacidad.
   *
   * Los idiomas son <a href> de verdad y no solo el desplegable (que son
   * botones): es lo que un buscador sigue para descubrir /es, /en, /pt… y lo que
   * permite abrir una versión en otra pestaña. Complementan al <link
   * rel="alternate" hreflang> del <head>, no lo reemplazan.
   *
   * `conPrivacidad` lo decide la página: la política solo existe cuando hay un
   * correo de contacto configurado (ver $lib/server/sitio.js).
   */
  let { conPrivacidad = false } = $props()

  // Cada idioma con su propio nombre, no traducido: quien lee árabe tiene que
  // poder reconocer "العربية" aunque la página esté en otro idioma.
  const NOMBRES = {
    es: 'Español',
    en: 'English',
    pt: 'Português',
    fr: 'Français',
    de: 'Deutsch',
    ar: 'العربية',
  }
</script>

<footer class="pie">
  <nav class="idiomas" aria-label={$_('footer.languages')}>
    {#each IDIOMAS as codigo (codigo)}
      <a
        href={rutaEnIdioma(page.url.pathname, codigo)}
        hreflang={codigo}
        lang={codigo}
        aria-current={$locale === codigo ? 'true' : undefined}
        onclick={() => guardarPreferencia(codigo)}
      >{NOMBRES[codigo]}</a>
    {/each}
  </nav>

  {#if conPrivacidad}
    <a class="privacidad" href={rutaEnIdioma('/privacy', $locale)}>{$_('footer.privacy')}</a>
  {/if}
</footer>

<style>
  .pie {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    padding: 1.5rem 1rem 2.5rem;
    background: #003366;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 0.9rem;
  }

  .idiomas {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem 1.2rem;
  }

  a {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
  }

  a:hover,
  a:focus-visible {
    color: #fff;
    text-decoration: underline;
  }

  a[aria-current='true'] {
    color: #fff;
    font-weight: 700;
  }

  .privacidad {
    text-decoration: underline;
  }
</style>
