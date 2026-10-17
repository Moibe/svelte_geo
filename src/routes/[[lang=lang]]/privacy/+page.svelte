<script>
  import { _, json, locale } from 'svelte-i18n'
  import Seo from '$lib/Seo.svelte'
  import SiteFooter from '$lib/SiteFooter.svelte'
  import LanguageSelector from '$lib/LanguageSelector.svelte'
  import { rutaEnIdioma } from '$lib/idiomas.js'

  // `contacto` y `responsable` vienen del layout raíz. La ruta ni siquiera
  // responde si no hay contacto (ver +page.server.js), así que aquí siempre trae
  // un correo; el responsable es opcional.
  let { data } = $props()

  const secciones = $derived.by(() => {
    const lista = $json('privacy.sections')

    return Array.isArray(lista) ? lista : []
  })
</script>

<Seo titulo={$_('seo.privacy.title')} descripcion={$_('seo.privacy.description')} />

<div class="pagina">
  <div class="selector">
    <LanguageSelector />
  </div>

  <main>
    <a class="inicio" href={rutaEnIdioma('/', $locale)}>geoservices.space</a>

    <article>
      <h1>{$_('privacy.title')}</h1>
      <p class="actualizado">{$_('privacy.updated')}</p>

      {#each secciones as seccion}
        <section>
          <h2>{seccion.title}</h2>
          {#each seccion.paragraphs ?? [] as parrafo}
            <p>{parrafo}</p>
          {/each}
          {#if seccion.items?.length}
            <ul>
              {#each seccion.items as item}
                <li>{item}</li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}

      <!-- <bdi>: el nombre del responsable y el correo van casi siempre en alfabeto
           latino, y dentro de un párrafo RTL (árabe) el punto final de "S.A." saltaba
           al otro extremo. -->
      <p class="contacto">
        {#if data.responsable}
          {$_('privacy.operatorLead')} <bdi>{data.responsable}</bdi><br />
        {/if}
        {$_('privacy.contactLead')}
        <a href={`mailto:${data.contacto}`}><bdi>{data.contacto}</bdi></a>
      </p>
    </article>
  </main>

  <SiteFooter />
</div>

<style>
  /* Si esta es la primera página que se carga, el CSS de la principal no está y
     el body traería su margen por defecto. */
  :global(html),
  :global(body) {
    margin: 0;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }

  .pagina {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
  }

  .selector {
    position: fixed;
    top: 1rem;
    right: 1rem;
    /* Por ENCIMA del aviso de cookies (1900) y por debajo de la ventana de pago (2000): quien llega en un idioma que no es el suyo tiene que poder cambiarlo sin contestar el aviso. */
    z-index: 1950;
  }

  /* El selector es fijo y el artículo es una tarjeta BLANCA que pasa por debajo al
     desplazarse. Su botón es texto blanco sobre un fondo casi transparente (pensado
     para el degradado azul de la portada) y sobre la tarjeta desaparecía: contraste
     1:1 durante casi toda la política. Aquí lleva fondo sólido. */
  .selector :global(.disparador) {
    background: #0a3d7a;
  }

  .selector :global(.disparador:hover),
  .selector :global(.disparador.abierto) {
    background: #0e4c96;
  }

  main {
    flex: 1;
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    padding: 4.5rem 1.25rem 2.5rem;
    box-sizing: border-box;
  }

  .inicio {
    display: inline-block;
    margin-bottom: 1.25rem;
    font-family: 'Roboto', system-ui, -apple-system, sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    text-decoration: none;
  }

  .inicio:hover,
  .inicio:focus-visible {
    text-decoration: underline;
  }

  article {
    background: #fff;
    color: #1d2a44;
    border-radius: 14px;
    padding: 2rem 2rem 1.5rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    line-height: 1.65;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.9rem;
    color: #0b2a5b;
  }

  h2 {
    margin: 1.9rem 0 0.5rem;
    font-size: 1.2rem;
    color: #0b2a5b;
  }

  p {
    margin: 0.6rem 0 0;
  }

  .actualizado {
    margin: 0;
    font-size: 0.9rem;
    color: #5a6985;
  }

  ul {
    margin: 0.6rem 0 0;
    padding-inline-start: 1.3rem;
  }

  li + li {
    margin-top: 0.55rem;
  }

  .contacto {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #e3e8f2;
    font-weight: 600;
  }

  a {
    color: #0052cc;
  }

  @media (max-width: 600px) {
    article {
      padding: 1.4rem 1.1rem 1.1rem;
    }

    h1 {
      font-size: 1.5rem;
    }
  }
</style>
