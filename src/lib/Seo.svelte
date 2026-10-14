<script>
  import { page } from '$app/state'
  import { locale } from 'svelte-i18n'
  import { alternativas, canonica, jsonSeguroParaHtml, LOCALE_OG } from '$lib/seo.js'

  /**
   * Todo lo que va en el <head> y le habla a buscadores y redes sociales:
   * título, descripción, canonical, hreflang, Open Graph, Twitter y datos
   * estructurados.
   *
   * Una página lo usa UNA vez y le pasa su título y su descripción ya
   * traducidos. El resto sale de la URL actual, así que no se puede
   * desincronizar de la página que describe.
   *
   * `categoriaApp` (opcional) es la categoría de schema.org de la aplicación que
   * la página ofrece. Solo la página principal la pasa: con ella se publican los
   * datos estructurados WebSite + WebApplication. La política de privacidad no
   * describe ninguna aplicación y no los lleva.
   *
   * No se publica FAQPage: Google dejó de mostrar ese resultado enriquecido para
   * casi todos los sitios, y marcar como "datos estructurados" un texto que ya
   * está a la vista no aporta nada.
   */
  let { titulo, descripcion, indexar = true, categoriaApp = null } = $props()

  // page.url.origin sale de ORIGIN (https://geoservices.space) detrás de nginx.
  const origen = $derived(page.url.origin)
  const canonical = $derived(canonica(origen, page.url.pathname))
  const alternas = $derived(alternativas(origen, page.url.pathname))
  const imagen = $derived(`${origen}/og-image.png`)
  const idioma = $derived($locale)
  const otrosLocales = $derived(
    Object.entries(LOCALE_OG)
      .filter(([codigo]) => codigo !== idioma)
      .map(([, valor]) => valor)
  )

  const jsonld = $derived(
    categoriaApp
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${origen}/#sitio`,
              name: 'geoservices.space',
              url: `${origen}/`,
              inLanguage: idioma,
            },
            {
              '@type': 'WebApplication',
              name: 'geoservices.space',
              url: canonical,
              description: descripcion,
              applicationCategory: categoriaApp,
              operatingSystem: 'Any',
              inLanguage: idioma,
              isPartOf: { '@id': `${origen}/#sitio` },
            },
          ],
        }
      : null
  )

  // La etiqueta que cierra el script de datos estructurados se arma por partes a
  // propósito: escrita de corrido dentro de este bloque, el compilador de Svelte
  // la tomaría como el final del bloque de script del propio componente (aunque
  // esté dentro de una cadena o de un comentario).
  const cierre = '</' + 'script>'
</script>

<svelte:head>
  <title>{titulo}</title>
  <meta name="description" content={descripcion} />
  <link rel="canonical" href={canonical} />

  {#each alternas as alterna (alterna.hreflang)}
    <link rel="alternate" hreflang={alterna.hreflang} href={alterna.href} />
  {/each}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="geoservices.space" />
  <meta property="og:title" content={titulo} />
  <meta property="og:description" content={descripcion} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={imagen} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <!-- La imagen solo lleva el nombre del sitio y un pin: su texto alternativo es
       el nombre, igual en todos los idiomas. -->
  <meta property="og:image:alt" content="geoservices.space" />
  <meta property="og:locale" content={LOCALE_OG[idioma] ?? 'en_US'} />
  {#each otrosLocales as otro (otro)}
    <meta property="og:locale:alternate" content={otro} />
  {/each}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={titulo} />
  <meta name="twitter:description" content={descripcion} />
  <meta name="twitter:image" content={imagen} />
  <meta name="twitter:image:alt" content="geoservices.space" />

  {#if !indexar}
    <meta name="robots" content="noindex, nofollow" />
  {/if}

  {#if jsonld}
    {@html `<script type="application/ld+json">${jsonSeguroParaHtml(jsonld)}${cierre}`}
  {/if}
</svelte:head>
