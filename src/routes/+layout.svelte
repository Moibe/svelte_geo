<script>
  // Este import es LOAD-BEARING: era la primera línea de src/main.js y es el
  // único bootstrap de svelte-i18n (registra los 6 locales y fija el inicial).
  // Al desaparecer main.js tiene que correr acá, en el layout raíz, antes que
  // cualquier página; si no, $_ queda sin diccionario y la UI sale en blanco.
  import '$lib/i18n.js'

  // Roboto servida desde el propio sitio. Antes se pedía con un @import de
  // Google Fonts dentro del CSS de la página, que (a) bloqueaba el render
  // (Lighthouse estimaba 1.8 s de ahorro), (b) mandaba la IP de cada visitante a
  // Google solo para bajar una tipografía, y (c) no estaba declarado en ningún
  // aviso de privacidad. Solo el subconjunto latino y los dos pesos que se usan
  // (400 y 700): cubre español, inglés, portugués, francés y alemán.
  import '@fontsource/roboto/latin-400.css'
  import '@fontsource/roboto/latin-700.css'

  import { locale } from 'svelte-i18n'
  import { browser } from '$app/environment'
  import { navigating, page } from '$app/state'
  import { aplicarIdiomaAlDocumento, cambioDeIdioma } from '$lib/i18n.js'
  import { idiomaDeRuta } from '$lib/idiomas.js'
  import { sembrarFlags } from '$lib/flags.js'

  let { children, data } = $props()

  // Los flags que el servidor ya resolvió para esta request se pasan al módulo
  // del cliente antes de que nadie los pida. Sin esto, la primera lectura
  // tendría que esperar un viaje de red y durante ese rato no habría valores —
  // justo el parpadeo que renderizar en el servidor vino a eliminar.
  //
  // Solo en el navegador: `actuales` es una variable de MÓDULO, compartida por
  // todas las requests del proceso. En el servidor los flags salen de
  // $lib/server/flags.js, que lee la base por request.
  if (browser && data?.flags) {
    sembrarFlags(data.flags)
  }

  // Fijar el idioma que el servidor resolvió para ESTA request.
  //
  // Va en el cuerpo del <script> del componente, que durante el SSR se ejecuta
  // de forma SÍNCRONA como parte del render. Eso es lo que lo hace seguro: el
  // store `locale` de svelte-i18n es de MÓDULO, compartido por todas las
  // requests del proceso, así que escribirlo desde un load() asíncrono podría
  // dejar que otra request se cuele entre el set y el render, y un visitante
  // francés le pintaría la página a uno árabe. Entre este set y el render no
  // hay ningún await, así que no hay dónde colarse.
  if (data?.idioma) {
    locale.set(data.idioma)
  }

  // En el navegador, el idioma de la URL manda también DESPUÉS de la primera
  // carga: navegar con atrás/adelante entre /es y /en, o elegir otro idioma en el
  // selector (que navega a la URL de ese idioma), tiene que cambiar el idioma
  // mostrado. Sin esto el cuerpo del script de arriba, que solo corre una vez,
  // dejaría la página en el idioma anterior.
  //
  // En la raíz (/) la URL no dice nada y no se toca: ahí deciden la cookie, el
  // navegador y la detección por país.
  //
  // Mientras el selector de idioma está a mitad de un cambio page.url todavía es la
  // anterior: pone el idioma nuevo y navega a su URL en el mismo instante, y sin
  // esta guarda este efecto veía "URL en español, idioma en inglés" y lo revertía a
  // español hasta que la navegación terminaba (tres cambios de <html lang> en vez
  // de uno). Se mira también `navigating` para los demás casos (atrás/adelante).
  $effect(() => {
    if (cambioDeIdioma.enCurso || navigating.to) return

    const deLaUrl = idiomaDeRuta(page.url.pathname)

    if (browser && deLaUrl && deLaUrl !== $locale) {
      locale.set(deLaUrl)
    }
  })

  // Mantener el <html lang> y la dirección en sintonía. El servidor ya los mandó
  // bien vía transformPageChunk; esto cubre los cambios posteriores.
  $effect(() => {
    if (browser && $locale) {
      aplicarIdiomaAlDocumento($locale)
    }
  })
</script>

{@render children()}
