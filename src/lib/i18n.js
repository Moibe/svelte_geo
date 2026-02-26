import { addMessages, init, locale } from 'svelte-i18n';

// Importar traducciones
import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

// Registrar traducciones
addMessages('en', en);
addMessages('es', es);
addMessages('pt', pt);
addMessages('fr', fr);
addMessages('de', de);

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
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0].toLowerCase();
  if (langCode === 'es') return 'es';
  if (langCode === 'pt') return 'pt';
  if (langCode === 'fr') return 'fr';
  if (langCode === 'de') return 'de';
  return 'en';
}

/**
 * Obtiene el idioma de la URL path (/es, /en o /pt)
 * @returns {string|null} Código de idioma ('es', 'en' o 'pt') o null si no hay path específico
 */
export function getLanguageFromPath() {
  const path = window.location.pathname;
  if (path.startsWith('/es')) return 'es';
  if (path.startsWith('/en')) return 'en';
  if (path.startsWith('/pt')) return 'pt';
  if (path.startsWith('/fr')) return 'fr';
  if (path.startsWith('/de')) return 'de';
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
export function setLanguageFromCountry(countryCode) {
  // Prioridad 1: Si el usuario ya seleccionó un idioma manualmente, respetarlo
  const savedLanguage = localStorage.getItem('preferred_language');
  if (savedLanguage) {
    locale.set(savedLanguage);
    return;
  }
  
  // Prioridad 2: Usar el idioma del país detectado
  if (countryCode) {
    const language = getLanguageFromCountry(countryCode);
    locale.set(language);
    return;
  }
  
  // Prioridad 3: Idioma del navegador
  const browserLanguage = getLanguageFromBrowser();
  if (browserLanguage) {
    locale.set(browserLanguage);
    return;
  }
  
  // Prioridad 4: URL path (campaña marketing)
  const pathLanguage = getLanguageFromPath();
  if (pathLanguage) {
    locale.set(pathLanguage);
    return;
  }
  
  // Prioridad 5: Fallback a inglés
  locale.set('en');
}

// Inicializar con el idioma apropiado según las prioridades
function initializeLanguage() {
  const savedLanguage = localStorage.getItem('preferred_language');
  if (savedLanguage) {
    return savedLanguage;
  }
  
  const pathLanguage = getLanguageFromPath();
  if (pathLanguage) {
    return pathLanguage;
  }
  
  const browserLanguage = getLanguageFromBrowser();
  return browserLanguage || 'en';
}

init({
  fallbackLocale: 'en',
  initialLocale: initializeLanguage(),
});
