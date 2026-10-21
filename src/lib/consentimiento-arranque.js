import {
  CANAL_CONSENTIMIENTO,
  COOKIE_CONSENTIMIENTO,
  MARCA_RECARGA_POR_CONSENTIMIENTO,
  PATRON_VISTA_PREVIA,
  PREFIJOS_ZONA_FUERA,
  PREFIJOS_ZONA_REGULADA,
  TOLERANCIA_RELOJ_SEGUNDOS,
  VERSION_CONSENTIMIENTO,
  VIGENCIA_DIAS,
  ZONAS_REGULADAS,
} from './consentimiento.js'

/**
 * El script de arranque del consentimiento: va INLINE en el <head>, antes de que
 * se cargue nada de Google, y decide tres cosas en el navegador, de forma
 * síncrona:
 *
 *   1. ¿Este visitante es de una región que exige pedir consentimiento? (la IP la
 *      resolvió el servidor y se inyecta como `regionIp`; la zona horaria la lee
 *      el propio script). Ver requiereConsentimiento en consentimiento.js.
 *   2. Qué estado de Consent Mode v2 se le manda a Google ('default' y, si ya hay
 *      una elección guardada, 'update').
 *   3. Si se carga Google Tag Manager: siempre fuera de la región regulada; dentro,
 *      solo si la persona ya aceptó algo. Sin consentimiento no se descarga NI
 *      UN BYTE de Google.
 *
 * También deja en `window.__consent` lo que necesita el resto de la aplicación
 * (el estado y `aplicar`, que guarda una elección nueva, actualiza Consent Mode,
 * carga GTM si hace falta y borra las cookies de Google de lo que se retiró).
 *
 * ESTÁ ESCRITO COMO TEXTO a propósito (y no como una función que se serializa con
 * toString): el empaquetador puede reescribir una función, y aquí tiene que salir
 * exactamente lo que se ve. Duplica a propósito la lógica de consentimiento.js (el
 * navegador no puede importarla aquí): consentimiento-arranque.test.js ejecuta
 * este script con las mismas tablas de verdad para que ninguna de las dos copias
 * pueda divergir.
 *
 * Sin dependencias y con sintaxis conservadora (var, function): si falla, el
 * efecto es que no se carga GTM — nunca que se cargue sin permiso.
 */

/** La ruta (src/routes/api/consentimiento) que renueva la cookie de la elección desde el servidor. */
export const RUTA_COOKIE_SERVIDOR = '/api/consentimiento'

/** Cookies que crean las etiquetas de Google, por categoría (los comodines son prefijos). */
export const COOKIES_DE_GOOGLE = {
  analitica: ['_ga', '_ga_*', '_gid', '_gat', '_gat_*', '_dc_gtm_*'],
  // _gcl_* (con comodín) y no la lista de sufijos conocidos: el gtag.js real arma _gcl_au, _gcl_aw,
  // _gcl_dc, _gcl_gb, _gcl_gf, _gcl_gs, _gcl_ha, _gcl_ag, _gcl_gp… y puede agregar otros.
  publicidad: ['_gcl_*', '_gac_*', '__gads', '__gpi', 'FPLC', 'FPGSID'],
}

/**
 * Claves de localStorage que usa Google, por categoría. El Conversion Linker guarda en
 * `_gcl_ls` lo mismo que en sus cookies _gcl_* (contador, click id), así que cuenta como
 * publicidad y se borra igual.
 */
export const ALMACENAMIENTO_DE_GOOGLE = {
  analitica: [],
  publicidad: ['_gcl_ls'],
}

const PLANTILLA = `(function (w, d, c) {
  var dl = (w.dataLayer = w.dataLayer || []);
  function gtag() { dl.push(arguments); }

  /* Nivel de precio vigente del SITIO (100 o 200): un dato de la tienda, no de la persona. Va antes de que se
     cargue Tag Manager para que la etiqueta de Analytics lo mande en TODOS sus eventos (visita, compra…). */
  if (c.nivelDePrecio) { dl.push({ price_level: c.nivelDePrecio }); }

  /* ---- 1. ¿región regulada? ---- */
  function empiezaCon(t, prefijos) {
    for (var i = 0; i < prefijos.length; i++) { if (t.indexOf(prefijos[i]) === 0) return true; }
    return false;
  }
  function regionDeZona(z) {
    if (!z || typeof z !== 'string') return '?';
    if (c.zonas.indexOf(z) !== -1 || empiezaCon(z, c.prefijosSi)) return 'si';
    if (empiezaCon(z, c.prefijosNo)) return 'no';
    return '?';
  }
  var zona = '';
  try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var porZona = regionDeZona(zona);
  /* La elección guardada se lee ANTES de decidir la región: quien ya contestó (p. ej. «Rechazar todo»
     desde Alemania) y vuelve con una IP o una zona que dicen «fuera» (VPN, red móvil mal ubicada,
     navegador que esconde la zona) conserva su elección. Una señal más débil no la anula. */
  var decision = leerDecision();
  var requerido = !!decision || c.regionIp === 'si' || porZona === 'si' ? true : (c.regionIp === 'no' || porZona === 'no' ? false : true);
  /* ?cookies=preview fuerza el aviso para poder verlo desde cualquier país. No cambia nada más. */
  try { if (new RegExp(c.vistaPrevia).test(w.location.search)) requerido = true; } catch (e) {}

  /* ---- 2. elección guardada ---- */
  function leerCookie(nombre) {
    var partes = d.cookie ? d.cookie.split(';') : [];
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i], k = p.indexOf('=');
      if (k !== -1 && p.slice(0, k).replace(/^\\s+|\\s+$/g, '') === nombre) return p.slice(k + 1).replace(/^\\s+|\\s+$/g, '');
    }
    return null;
  }
  function leerDecision() {
    var crudo = leerCookie(c.cookie);
    if (!crudo) return null;
    try {
      var o = JSON.parse(decodeURIComponent(crudo));
      var ahora = Math.floor(new Date().getTime() / 1000);
      if (!o || typeof o !== 'object' || o.v !== c.version) return null;
      if (typeof o.t !== 'number' || o.t !== o.t) return null;
      if (o.t > ahora + c.toleranciaReloj || ahora - o.t > c.vigenciaDias * 86400) return null;
      return { v: o.v, a: o.a === 1 || o.a === true, p: o.p === 1 || o.p === true, t: o.t };
    } catch (e) { return null; }
  }
  function estado(req, dec) {
    var a = !req || !!(dec && dec.a), p = !req || !!(dec && dec.p);
    function g(si) { return si ? 'granted' : 'denied'; }
    return {
      ad_storage: g(p), ad_user_data: g(p), ad_personalization: g(p), analytics_storage: g(a),
      functionality_storage: 'granted', personalization_storage: g(p), security_storage: 'granted'
    };
  }

  /* ---- 3. Google Tag Manager ---- */
  function cargarGTM() {
    if (w.__gtmCargado) return;
    w.__gtmCargado = true;
    dl.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + c.gtm;
    (d.head || d.documentElement).appendChild(s);
  }

  /* ---- lo de Google que hay que borrar cuando una categoría no tiene permiso ---- */
  function borrarDe(categoria) {
    borrarCookiesDe(categoria);
    var claves = c.almacenamientoGoogle[categoria] || [];
    for (var i = 0; i < claves.length; i++) {
      try { w.localStorage.removeItem(claves[i]); } catch (e) {}
    }
  }
  function borrarCookiesDe(categoria) {
    var patrones = c.cookiesGoogle[categoria] || [];
    var nombres = d.cookie ? d.cookie.split(';') : [];
    var host = w.location.hostname;
    var dominios = [null, host, '.' + host];
    var partesHost = host.split('.');
    if (partesHost.length > 2) dominios.push('.' + partesHost.slice(-2).join('.'));
    for (var i = 0; i < nombres.length; i++) {
      var n = nombres[i].split('=')[0].replace(/^\\s+|\\s+$/g, '');
      for (var j = 0; j < patrones.length; j++) {
        var pat = patrones[j];
        var coincide = pat.charAt(pat.length - 1) === '*' ? n.indexOf(pat.slice(0, -1)) === 0 : n === pat;
        if (!coincide) continue;
        for (var k = 0; k < dominios.length; k++) {
          d.cookie = n + '=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT' + (dominios[k] ? '; Domain=' + dominios[k] : '');
        }
      }
    }
  }

  /* Lo que Google dejó de una época sin aviso (o de una elección ya vencida) y que ahora no
     tiene permiso se borra al cargar: Google NO borra sus cookies por sí solo al denegar. Es
     lo primero que se hace, antes de cualquier otra cosa. */
  if (requerido) {
    if (!(decision && decision.a)) borrarDe('analitica');
    if (!(decision && decision.p)) borrarDe('publicidad');
  }

  gtag('consent', 'default', estado(requerido, null));
  if (requerido && decision) gtag('consent', 'update', estado(true, decision));
  if (!requerido || (decision && (decision.a || decision.p))) cargarGTM();

  /* ---- lo que usa el resto de la aplicación ---- */
  var api = (w.__consent = {
    requerido: requerido,
    decision: decision,
    zona: zona,
    /* true cuando la última elección RETIRÓ algo y Google ya estaba cargado en esta página: sus
       etiquetas siguen vivas en memoria (siguen mandando señales sin cookies aunque se les
       niegue el permiso), y solo recargar la página las quita. Lo lee quien llama a aplicar. */
    necesitaRecarga: false,
    /* true si la última elección no quedó en la cookie (el navegador no la guarda): se obedece en esta
       página, pero no hay cookie contra la que contrastarla ni que recordar en la próxima visita. */
    sinCookies: false,
    /* A dónde recargar. null = la página tal cual; la portada lo fija cuando muestra el mapa que se
       acaba de pagar (?payment=success), cuyo estado vive solo en la página y se perdería. */
    urlAlRecargar: null,
    /* Recarga la página por un cambio de consentimiento, marcándolo para que quien registra cierres y
       recargas (page_close, page_refresh) no lo anote como actividad de la persona. */
    recargar: function () {
      try { w.sessionStorage.setItem(c.marcaRecarga, '1'); } catch (e) {}
      try {
        if (api.urlAlRecargar) w.location.replace(api.urlAlRecargar);
        else w.location.reload();
      } catch (e) {}
    },
    /* Guarda una elección nueva. Devuelve la decisión resultante. */
    aplicar: function (analitica, publicidad) {
      var previa = api.decision;
      var t = Math.floor(new Date().getTime() / 1000);
      var nueva = { v: c.version, a: !!analitica, p: !!publicidad, t: t };
      var valor = encodeURIComponent(JSON.stringify({ v: nueva.v, a: nueva.a ? 1 : 0, p: nueva.p ? 1 : 0, t: t }));
      d.cookie = c.cookie + '=' + valor + '; Path=/; Max-Age=' + (c.vigenciaDias * 86400) + '; SameSite=Lax' + (w.location.protocol === 'https:' ? '; Secure' : '');
      api.decision = nueva;
      /* ¿El navegador guardó la cookie? (cookies bloqueadas, modo «bloquear todo»). Si no, la elección
         solo existe en esta página: contrastarla con la cookie (sincronizar) la tomaría por RETIRADA y
         recargaría la página, que volvería a preguntar, en cada intento. */
      var guardada = leerDecision();
      api.sinCookies = !(guardada && guardada.a === nueva.a && guardada.p === nueva.p);
      /* Refuerzo: que el SERVIDOR vuelva a poner la cookie. Safari limita a 7 días las que escribe
         JavaScript (y no las que llegan en una cabecera Set-Cookie); sin esto, quien usa Safari
         volvería a ver el aviso cada semana. Si falla no pasa nada: la de arriba ya quedó. */
      try {
        if (typeof w.fetch === 'function') {
          w.fetch(c.rutaCookieServidor, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ a: nueva.a, p: nueva.p }),
            keepalive: true,
            credentials: 'same-origin'
          }).catch(function () {});
        }
      } catch (e) {}
      gtag('consent', 'update', estado(api.requerido, nueva));
      if (nueva.a || nueva.p) cargarGTM();
      /* Lo que no tiene permiso se borra SIEMPRE, no solo lo que ESTA página tenía concedido: las
         cookies son del navegador, y otra pestaña pudo crearlas. */
      if (!nueva.a) borrarDe('analitica');
      if (!nueva.p) borrarDe('publicidad');
      /* Recargar solo si se RETIRÓ algo que esta página había concedido y Google ya está cargado. */
      var retira = !!(previa && ((previa.a && !nueva.a) || (previa.p && !nueva.p)));
      api.necesitaRecarga = retira && !!w.__gtmCargado;
      avisarALasDemasPestanas();
      try { w.dispatchEvent(new CustomEvent('consent:cambio', { detail: nueva })); } catch (e) {}
      return nueva;
    },
    /* La COOKIE es la fuente de verdad: la elección de esta página es una copia en memoria que otra
       pestaña (o el vencimiento de la cookie, o borrarlas) puede dejar vieja. Se contrasta con la
       cookie al volver a la pestaña, al restaurarla del historial, cuando otra pestaña avisa y ANTES
       de cada cosa que pide permiso (registrar actividad, guardar en el dispositivo). Si algo se
       retiró y Google estaba cargado, la página se recarga (es la única forma de quitarlo de memoria).
       Devuelve true si la elección cambió. */
    sincronizar: function () {
      if (!api.requerido || api.sinCookies) return false;
      var actual = leerDecision();
      var antes = api.decision;
      var aA = !!(actual && actual.a), aP = !!(actual && actual.p);
      var bA = !!(antes && antes.a), bP = !!(antes && antes.p);
      if (aA === bA && aP === bP && !actual === !antes) return false;
      api.decision = actual;
      gtag('consent', 'update', estado(true, actual));
      if (!aA) borrarDe('analitica');
      if (!aP) borrarDe('publicidad');
      if (aA || aP) cargarGTM();
      api.necesitaRecarga = ((bA && !aA) || (bP && !aP)) && !!w.__gtmCargado;
      try { w.dispatchEvent(new CustomEvent('consent:cambio', { detail: actual })); } catch (e) {}
      if (api.necesitaRecarga) api.recargar();
      return true;
    }
  });

  /* Las pestañas del mismo navegador se avisan por un canal; y, por si el canal no existe o la
     página estaba congelada, se contrasta al volver a verla. */
  var canal = null;
  try {
    if (typeof w.BroadcastChannel === 'function') {
      canal = new w.BroadcastChannel(c.canal);
      canal.onmessage = function () { api.sincronizar(); };
    }
  } catch (e) {}
  function avisarALasDemasPestanas() {
    try { if (canal) canal.postMessage('cambio'); } catch (e) {}
  }
  try {
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') api.sincronizar(); });
    w.addEventListener('pageshow', function () { api.sincronizar(); });
    w.addEventListener('focus', function () { api.sincronizar(); });
  } catch (e) {}
})(window, document, `

/**
 * El texto del <script> (con las etiquetas), listo para ir en el <head>.
 *
 * @param {{ regionIp: 'si'|'no'|'?', gtmId: string }} opciones
 * @returns {string}
 */
export function scriptDeArranque({ regionIp, gtmId, nivelDePrecio }) {
  const nivel = Number(nivelDePrecio)

  const configuracion = {
    regionIp: ['si', 'no'].includes(regionIp) ? regionIp : '?',
    nivelDePrecio: Number.isFinite(nivel) && nivel > 0 ? nivel : 0,
    gtm: String(gtmId),
    cookie: COOKIE_CONSENTIMIENTO,
    version: VERSION_CONSENTIMIENTO,
    vigenciaDias: VIGENCIA_DIAS,
    toleranciaReloj: TOLERANCIA_RELOJ_SEGUNDOS,
    zonas: ZONAS_REGULADAS,
    prefijosSi: PREFIJOS_ZONA_REGULADA,
    prefijosNo: PREFIJOS_ZONA_FUERA,
    vistaPrevia: PATRON_VISTA_PREVIA,
    rutaCookieServidor: RUTA_COOKIE_SERVIDOR,
    marcaRecarga: MARCA_RECARGA_POR_CONSENTIMIENTO,
    canal: CANAL_CONSENTIMIENTO,
    cookiesGoogle: COOKIES_DE_GOOGLE,
    almacenamientoGoogle: ALMACENAMIENTO_DE_GOOGLE,
  }

  // "<" escapado: el JSON va dentro de un <script>, y nada puede cerrar la etiqueta antes de tiempo.
  const json = JSON.stringify(configuracion).replace(/</g, '\\u003c')

  return `<script>${PLANTILLA}${json});</script>`
}

/** El <noscript> de GTM, solo para quien no necesita dar consentimiento. */
export function noscriptDeGoogle(gtmId) {
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
}
