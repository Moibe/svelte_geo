import { addMessages, init, locale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { COOKIE_IDIOMA, IDIOMA_POR_DEFECTO, esRTL, normalizarIdioma } from './idiomas.js';

// Importar traducciones
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';

// Registrar traducciones
addMessages('en', en);
addMessages('es', es);
addMessages('pt', pt);
addMessages('fr', fr);
addMessages('de', de);
addMessages('ar', ar);

// Mapeo de códigos de país (+código telefónico) a idiomas
export const countryToLanguage = {
  // Español
  '+34': 'es',  // España
  '+52': 'es',  // México
  '+54': 'es',  // Argentina
  '+56': 'es',  // Chile
  '+57': 'es',  // Colombia
  '+51': 'es',  // Perú
  '+58': 'es',  // Venezuela
  '+593': 'es', // Ecuador
  '+591': 'es', // Bolivia
  '+595': 'es', // Paraguay
  '+598': 'es', // Uruguay
  '+502': 'es', // Guatemala
  '+503': 'es', // El Salvador
  '+504': 'es', // Honduras
  '+505': 'es', // Nicaragua
  '+506': 'es', // Costa Rica
  '+507': 'es', // Panamá
  
  // Inglés (por defecto para otros países)
  '+1': 'en',   // USA/Canadá
  '+44': 'en',  // Reino Unido
  '+61': 'en',  // Australia
  '+64': 'en',  // Nueva Zelanda
  '+27': 'en',  // Sudáfrica
  '+353': 'en', // Irlanda
  
  // Portugués
  '+351': 'pt', // Portugal
  '+55': 'pt',  // Brasil

  // Francés
  '+33': 'fr',  // Francia
  '+32': 'fr',  // Bélgica
  '+41': 'fr',  // Suiza (francófona)
  '+352': 'fr', // Luxemburgo
  '+237': 'fr', // Camerún
  '+225': 'fr', // Costa de Marfil
  '+221': 'fr', // Senegal
  '+243': 'fr', // RD Congo
  '+509': 'fr', // Haití

  // Alemán
  '+49': 'de',  // Alemania
  '+43': 'de',  // Austria
  '+423': 'de', // Liechtenstein

  // Árabe
  '+966': 'ar', // Arabia Saudita
  '+971': 'ar', // Emiratos Árabes Unidos
  '+20':  'ar', // Egipto
  '+212': 'ar', // Marruecos
  '+213': 'ar', // Argelia
  '+216': 'ar', // Túnez
  '+218': 'ar', // Libia
  '+962': 'ar', // Jordania
  '+961': 'ar', // Líbano
  '+963': 'ar', // Siria
  '+964': 'ar', // Iraq
  '+965': 'ar', // Kuwait
  '+968': 'ar', // Omán
  '+974': 'ar', // Qatar
  '+973': 'ar', // Baréin
  '+967': 'ar', // Yemen
  '+970': 'ar', // Palestina
  '+249': 'ar', // Sudán
  '+222': 'ar', // Mauritania
  '+252': 'ar', // Somalia

  // Otros países europeos (inglés como fallback)
  '+39': 'en',  // Italia
};

/**
 * Obtiene el idioma basado en el código de país
 * @param {string} countryCode - Código telefónico del país (ej: '+52')
 * @returns {string} Código de idioma ('es', 'en' o 'pt')
 */
export function getLanguageFromCountry(countryCode) {
  return countryToLanguage[countryCode] || 'en';
}

/**
 * Obtiene el idioma del navegador (navigator.language)
 * @returns {string} Código de idioma ('es', 'en' o 'pt')
 */
export function getLanguageFromBrowser() {
  // En Node `navigator` EXISTE (v22 lo define) y devuelve el locale del
  // proceso: no explota, simplemente daría el idioma del droplet a todo el
  // mundo. Por eso el guard es por `browser` y no por `typeof navigator`.
  if (!browser) return IDIOMA_POR_DEFECTO;

  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0].toLowerCase();
  if (langCode === 'es') return 'es';
  if (langCode === 'pt') return 'pt';
  if (langCode === 'fr') return 'fr';
  if (langCode === 'de') return 'de';
  if (langCode === 'ar') return 'ar';
  return 'en';
}

/**
 * Obtiene el idioma de la URL path (/es, /en o /pt)
 * @returns {string|null} Código de idioma ('es', 'en' o 'pt') o null si no hay path específico
 */
export function getLanguageFromPath() {
  if (!browser) return null;

  const path = window.location.pathname;
  if (path.startsWith('/es')) return 'es';
  if (path.startsWith('/en')) return 'en';
  if (path.startsWith('/pt')) return 'pt';
  if (path.startsWith('/fr')) return 'fr';
  if (path.startsWith('/de')) return 'de';
  if (path.startsWith('/ar')) return 'ar';
  return null;
}

/**
 * Establece el idioma basado en el país detectado
 * Orden de prioridad:
 * 1. localStorage (preferencia guardada del usuario)
 * 2. Detección por país (countryCode)
 * 3. Idioma del navegador
 * 4. URL path (/es, /en o /pt)
 * 5. Fallback a inglés
 * @param {string} countryCode - Código telefónico del país
 */
/**
 * Preferencia explícita del usuario, de la cookie o del localStorage.
 *
 * Se lee primero la cookie porque es la única que el SERVIDOR puede ver: sin
 * ella, un load() del servidor siempre resolvería `undefined` y se perdería la
 * elección del usuario en el primer render. El localStorage queda como
 * respaldo para quien ya venía usando la app desde antes de que existiera la
 * cookie; leerlo aquí es lo que migra esos casos (guardarPreferencia escribe
 * ambos).
 *
 * @returns {string|null}
 */
export function preferenciaGuardada() {
  if (!browser) return null;

  const deCookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_IDIOMA}=`));

  if (deCookie) {
    const valor = normalizarIdioma(decodeURIComponent(deCookie.split('=')[1]));
    if (valor) return valor;
  }

  return normalizarIdioma(localStorage.getItem(COOKIE_IDIOMA));
}

/**
 * Guarda la preferencia en cookie Y en localStorage.
 *
 * La cookie es la que lee el servidor; el localStorage se conserva porque hay
 * código que ya lo leía. Un año de vida y SameSite=Lax: no es un dato sensible
 * y solo tiene que sobrevivir el ida y vuelta a Stripe.
 *
 * @param {string} lang
 */
export function guardarPreferencia(lang) {
  if (!browser) return;

  const unAnio = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_IDIOMA}=${encodeURIComponent(lang)}; path=/; max-age=${unAnio}; SameSite=Lax`;

  try {
    localStorage.setItem(COOKIE_IDIOMA, lang);
  } catch {
    // Modo privado o almacenamiento bloqueado: la cookie ya quedó, alcanza.
  }
}

/**
 * Refleja el idioma en el <html>: el atributo `lang` y la dirección.
 *
 * Antes el árabe aplicaba dir="rtl" sobre <main>, no sobre <html>, así que el
 * documento seguía declarándose `lang="en"` para un usuario árabe. Eso lo leen
 * los lectores de pantalla y los buscadores, no solo el layout.
 *
 * @param {string} lang
 */
export function aplicarIdiomaAlDocumento(lang) {
  if (!browser || !lang) return;

  document.documentElement.lang = lang;
  document.documentElement.dir = esRTL(lang) ? 'rtl' : 'ltr';
}

export function setLanguageFromCountry(countryCode) {
  // Solo tiene sentido en el navegador: en el servidor el idioma lo fija
  // +layout.svelte por request, y llamar locale.set() desde acá escribiría en
  // un store de MÓDULO compartido entre todas las requests concurrentes.
  if (!browser) return;

  // Se resuelve UN idioma y después se aplica una sola vez, en vez de repetir
  // locale.set en cada rama: así el <html lang> nunca queda desfasado.
  const idioma =
    // Prioridad 1: el usuario ya eligió manualmente
    preferenciaGuardada() ||
    // Prioridad 2: el país detectado
    (countryCode ? getLanguageFromCountry(countryCode) : null) ||
    // Prioridad 3: el idioma del navegador
    getLanguageFromBrowser() ||
    // Prioridad 4: el path (campaña de marketing)
    getLanguageFromPath() ||
    // Prioridad 5: inglés
    IDIOMA_POR_DEFECTO;

  locale.set(idioma);
  aplicarIdiomaAlDocumento(idioma);
}

// Inicializar con el idioma apropiado según las prioridades
function initializeLanguage() {
  // En el servidor este módulo se evalúa al importarse, antes de que exista
  // request alguna, así que no hay idioma que resolver todavía: el correcto lo
  // fija +layout.svelte por request, de forma síncrona durante el render.
  // Devolver algo fijo acá evita reventar al cargar el módulo.
  if (!browser) return IDIOMA_POR_DEFECTO;

  const savedLanguage = preferenciaGuardada();
  if (savedLanguage) {
    return savedLanguage;
  }

  const pathLanguage = getLanguageFromPath();
  if (pathLanguage) {
    return pathLanguage;
  }

  const browserLanguage = getLanguageFromBrowser();
  return browserLanguage || IDIOMA_POR_DEFECTO;
}

init({
  fallbackLocale: IDIOMA_POR_DEFECTO,
  initialLocale: initializeLanguage(),
});
