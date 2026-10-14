<script>
  import { page } from '$app/state'
  import { locale } from 'svelte-i18n'
  import { rutaEnIdioma } from '$lib/idiomas.js'
</script>

<!-- Antes las páginas de error (404, o /privacy sin contacto configurado) salían
     SIN <title>: este trabajo quitó el título fijo de app.html y el único que queda
     sale de <Seo>, que usan la portada y la política. Un título con el código
     basta (y no depende de ningún idioma). Un 404 tampoco se indexa. -->
<svelte:head>
  <title>{page.status} | geoservices.space</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <h1>{page.status}</h1>
  <p>{page.error?.message}</p>
  <a href={rutaEnIdioma('/', $locale)}>geoservices.space</a>
</main>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  }

  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
    box-sizing: border-box;
    text-align: center;
    color: #fff;
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
  }

  h1 {
    margin: 0;
    font-size: 4rem;
    line-height: 1;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  a {
    margin-top: 1rem;
    color: #fff;
    font-weight: 700;
  }
</style>
