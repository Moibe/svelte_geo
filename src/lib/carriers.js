/**
 * Mapeo de códigos de país a sus operadores telefónicos principales
 */
export const carriersByCountry = {
  '+1': ['AT&T', 'Verizon', 'T-Mobile', 'Sprint'],
  '+52': ['Telcel', 'AT&T', 'Movistar', 'Unefon'],
  '+54': ['Movistar', 'Claro', 'Personal', 'Tuenti'],
  '+55': ['Vivo', 'Claro', 'TIM', 'Oi'],
  '+56': ['Movistar', 'Entel', 'Claro', 'WOM'],
  '+57': ['Claro', 'Movistar', 'Tigo', 'Avantel'],
  '+51': ['Movistar', 'Claro', 'Entel', 'Bitel'],
  '+58': ['Movistar', 'Digitel', 'Movilnet'],
  '+593': ['Claro', 'Movistar', 'CNT'],
  '+591': ['Entel', 'Tigo', 'Viva'],
  '+595': ['Tigo', 'Claro', 'Personal', 'Vox'],
  '+598': ['Movistar', 'Claro', 'Antel'],
  '+34': ['Movistar', 'Vodafone', 'Orange', 'Yoigo'],
  '+33': ['Orange', 'SFR', 'Bouygues', 'Free'],
  '+49': ['Deutsche Telekom', 'Vodafone', 'O2', 'E-Plus'],
  '+44': ['EE', 'O2', 'Vodafone', 'Three'],
  '+39': ['TIM', 'Vodafone', 'Wind Tre', 'Iliad'],
  '+351': ['MEO', 'NOS', 'Vodafone'],
  '+507': ['Cable & Wireless', 'Claro', 'Movistar', 'Digicel'],
  '+506': ['Kolbi', 'Claro', 'Movistar'],
  '+503': ['Claro', 'Tigo', 'Movistar', 'Digicel'],
  '+502': ['Claro', 'Tigo', 'Movistar'],
  '+504': ['Claro', 'Tigo', 'Hondutel'],
  '+505': ['Claro', 'Movistar', 'Cootel'],
};

/**
 * Obtiene los carriers del país especificado
 * @param {string} countryCode - Código de país (ej: '+52')
 * @returns {string[]} Array de nombres de carriers
 */
export function getCarriers(countryCode) {
  return carriersByCountry[countryCode] || ['Carrier 1', 'Carrier 2', 'Carrier 3'];
}

/**
 * Genera mensaje dinámico con los carriers del país
 * @param {string} countryCode - Código de país (ej: '+52')
 * @returns {string} Mensaje formateado con los carriers
 */
export function getCarriersMessage(countryCode) {
  const carriers = getCarriers(countryCode);
  return carriers.join(' • ');
}
