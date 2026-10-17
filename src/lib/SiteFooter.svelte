<script>
  import { _, locale } from 'svelte-i18n'
  import { page } from '$app/state'
  import { IDIOMAS, rutaEnIdioma } from '$lib/idiomas.js'
  import { guardarPreferencia } from '$lib/i18n.js'
  import { usarConsentimiento } from '$lib/consent.svelte.js'

  /**
   * Pie de página: enlaces a cada versión de idioma de la página actual, a la política
   * de privacidad si existe, y a las preferencias de cookies donde se piden.
   *
   * Los idiomas son <a href> de verdad y no solo el desplegable (que son
   * botones): es lo que un buscador sigue para descubrir /es, /en, /pt… y lo que
   * permite abrir una versión en otra pestaña. Complementan al <link
   * rel="alternate" hreflang> del <head>, no lo reemplazan.
   *
   * `conPrivacidad` lo decide la página: la política solo existe cuando hay un
   * correo de contacto configurado (ver $lib/server/sitio.js).
   *
   * "Preferencias de cookies" solo sale donde se pide consentimiento (UE, Reino Unido,
   * Suiza): ahí retirar el permiso tiene que ser tan fácil como darlo, y poder hacerlo
   * desde cualquier página.
   *
   * `rutaIdiomas`: la ruta a la que apuntan los enlaces de idioma, en vez de la página actual.
   * La página de error la fija a «/»: la página actual no existe (un 404) y ofrecerla en otros
   * seis idiomas serían seis enlaces más al mismo error.
   */
  let { conPrivacidad = false, rutaIdiomas = null } = $props()

  const consentimiento = usarConsentimiento()

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
        href={rutaEnIdioma(rutaIdiomas ?? page.url.pathname, codigo)}
        hreflang={codigo}
        lang={codigo}
        aria-current={$locale === codigo ? 'true' : undefined}
        onclick={() => guardarPreferencia(codigo)}
      >{NOMBRES[codigo]}</a>
    {/each}
  </nav>

  {#if conPrivacidad || consentimiento?.requerido}
    <div class="legal">
      {#if conPrivacidad}
        <a class="privacidad" href={rutaEnIdioma('/privacy', $locale)}>{$_('footer.privacy')}</a>
      {/if}

      {#if consentimiento?.requerido}
        <button type="button" class="privacidad" onclick={() => consentimiento.abrir()}>{$_('consent.reopen')}</button>
      {/if}
    </div>
  {/if}

  <!-- Atribución que exige la licencia (CC BY 4.0) de la base de países por IP que usa el
       sitio: un enlace a DB-IP en las páginas que usan sus datos. -->
  <p class="atribucion"><a href="https://db-ip.com" rel="noopener" target="_blank">IP Geolocation by DB-IP</a></p>
</footer>

<style>
  .pie {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    /* Mientras el aviso de cookies está en pantalla, el pie le suma su alto (--alto-aviso, ver
       CookieBanner.svelte): es lo último de la página, y sin esto el aviso, que es fijo, taparía los
       enlaces de idioma, las preferencias de cookies y la atribución, sin forma de leerlos. */
    padding: 1.5rem 1rem calc(2.5rem + var(--alto-aviso, 0px));
    background: #003366;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 0.9rem;
  }

  .idiomas,
  .legal {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem 1.2rem;
  }

  a,
  button.privacidad {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
  }

  a:hover,
  a:focus-visible,
  button.privacidad:hover,
  button.privacidad:focus-visible {
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

  /* El botón se ve como los enlaces de al lado. */
  button.privacidad {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  .atribucion {
    margin: 0;
    font-size: 0.78rem;
  }

  .atribucion a {
    color: rgba(255, 255, 255, 0.7);
  }
</style>
