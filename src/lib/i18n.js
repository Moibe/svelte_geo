import { addMessages, init, locale } from 'svelte-i18n';

// Importar traducciones
import en from './locales/en.json';
import es from './locales/es.json';

// Registrar traducciones
addMessages('en', en);
addMessages('es', es);

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
  
  // Otros países europeos (pueden tener inglés como fallback)
  '+33': 'en',  // Francia
  '+49': 'en',  // Alemania
  '+39': 'en',  // Italia
  '+351': 'en', // Portugal
  '+55': 'en',  // Brasil (portugués, pero usamos inglés como no tenemos PT)
};

/**
 * Obtiene el idioma basado en el código de país
 * @param {string} countryCode - Código telefónico del país (ej: '+52')
 * @returns {string} Código de idioma ('es' o 'en')
 */
export function getLanguageFromCountry(countryCode) {
  return countryToLanguage[countryCode] || 'en';
}

/**
 * Obtiene el idioma del navegador (navigator.language)
 * @returns {string} Código de idioma ('es' o 'en')
 */
export function getLanguageFromBrowser() {
  const browserLang = navigator.language || navigator.userLanguage;
  // Obtener solo el código de idioma (ej: 'es-MX' -> 'es')
  const langCode = browserLang.split('-')[0].toLowerCase();
  return langCode === 'es' ? 'es' : 'en';
}

/**
 * Obtiene el idioma de la URL path (/es o /en)
 * @returns {string|null} Código de idioma ('es' o 'en') o null si no hay path específico
 */
export function getLanguageFromPath() {
  const path = window.location.pathname;
  if (path.startsWith('/es')) return 'es';
  if (path.startsWith('/en')) return 'en';
  return null;
}

/**
 * Establece el idioma basado en el país detectado
 * Orden de prioridad:
 * 1. localStorage (preferencia guardada del usuario)
 * 2. Detección por país (countryCode)
 * 3. Idioma del navegador
 * 4. URL path (/es o /en)
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
