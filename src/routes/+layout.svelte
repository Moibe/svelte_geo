<script>
  // Este import es LOAD-BEARING: era la primera línea de src/main.js y es el
  // único bootstrap de svelte-i18n (registra los 6 locales y fija el inicial).
  // Al desaparecer main.js tiene que correr acá, en el layout raíz, antes que
  // cualquier página; si no, $_ queda sin diccionario y la UI sale en blanco.
  import '$lib/i18n.js'

  import { locale } from 'svelte-i18n'
  import { browser } from '$app/environment'
  import { aplicarIdiomaAlDocumento } from '$lib/i18n.js'
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

  // En el navegador, mantener el <html lang> y la dirección en sintonía. El
  // servidor ya los mandó bien vía transformPageChunk; esto cubre los cambios
  // posteriores (detección por país, o que el usuario elija otro idioma).
  $effect(() => {
    if (browser && $locale) {
      aplicarIdiomaAlDocumento($locale)
    }
  })
</script>

{@render children()}
