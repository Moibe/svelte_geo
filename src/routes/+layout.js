// ATERRIZAJE: se migra el framework con SSR APAGADO a proposito.
//
// Con ssr=false el bundle del servidor nunca evalua i18n.js, Map.svelte,
// firebase.js ni logger.js, asi que esta fase es mover archivos y no
// reescribir logica. Eso parte el trabajo caro en dos mitades que se pueden
// revertir por separado: primero el cambio de framework, despues el SSR.
//
// prerender=false es explicito y NO sobra: si las rutas se hornearan en el
// build, los flags de Firestore quedarian congelados en el HTML y los toggles
// dejarian de funcionar SIN ningun error ni log. Viniendo de un sitio estatico,
// ese es justo el error facil de cometer.
export const ssr = false
export const prerender = false
