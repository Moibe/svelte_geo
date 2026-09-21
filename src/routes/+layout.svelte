<script>
  // Este import es LOAD-BEARING: era la primera linea de src/main.js y es el
  // unico bootstrap de svelte-i18n (registra los 6 locales y fija el inicial).
  // Al desaparecer main.js tiene que correr aca, en el layout raiz, antes que
  // cualquier pagina; si no, $_ queda sin diccionario y la UI sale en blanco.
  import '$lib/i18n.js'

  let { children } = $props()
</script>

{@render children()}
