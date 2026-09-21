// SSR ENCENDIDO.
//
// Se apago durante el aterrizaje a SvelteKit (F6) para que esa fase fuera mover
// archivos y no reescribir logica. Ahora se enciende, con los dos bloqueantes
// reales ya resueltos:
//
//   * Map.svelte carga Leaflet con import() dinamico dentro de onMount. Leaflet
//     toca `window` al evaluarse y reventaria el bundle del servidor.
//   * i18n.js ya no lee localStorage ni window al importarse: su init() usa un
//     idioma fijo en el servidor y el real lo fija +layout.svelte por request.
//
// prerender=false es explicito y NO sobra: si las rutas se hornearan en el
// build, los flags de Firestore quedarian congelados en el HTML y los toggles
// dejarian de funcionar SIN ningun error ni log.
export const prerender = false
