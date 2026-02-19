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
 * Establece el idioma basado en el país detectado
 * @param {string} countryCode - Código telefónico del país
 */
export function setLanguageFromCountry(countryCode) {
  const savedLanguage = localStorage.getItem('preferred_language');
  
  // Si el usuario ya seleccionó un idioma manualmente, respetarlo
  if (savedLanguage) {
    locale.set(savedLanguage);
    return;
  }
  
  // Si no, usar el idioma del país
  const language = getLanguageFromCountry(countryCode);
  locale.set(language);
}

// Inicializar con inglés por defecto (se actualizará cuando se detecte el país)
init({
  fallbackLocale: 'en',
  initialLocale: 'en',
});
