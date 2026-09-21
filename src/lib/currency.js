/**
 * Conversión de `unit_amount` de Stripe a unidades monetarias reales.
 *
 * Stripe expresa `unit_amount` en la subunidad de la moneda (centavos) para la
 * mayoría de monedas, PERO en las llamadas "zero-decimal" el valor ya está en
 * unidades enteras: para JPY, `unit_amount: 1780` son ¥1780, no ¥17.80.
 *
 * Dividir entre 100 a ciegas —que es lo que hacía Modal.svelte y lo que sigue
 * haciendo scripts/fetch-product-details.js para el campo `formatted`— reporta
 * un valor 100 veces menor en esas monedas.
 *
 * Referencia: https://docs.stripe.com/currencies#zero-decimal
 */

/**
 * Monedas sin subunidad según Stripe.
 *
 * OJO con ISK: Stripe la reclasificó como moneda de DOS decimales, así que NO
 * va en esta lista. Si tu catálogo de Stripe es viejo y tiene precios en ISK
 * creados bajo la regla anterior, verificá ese precio a mano en el dashboard.
 */
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/**
 * ¿La moneda carece de subunidad?
 * @param {string} currency - Código ISO de 3 letras (mayúsculas o minúsculas)
 * @returns {boolean}
 */
export function isZeroDecimal(currency) {
  return ZERO_DECIMAL.has(String(currency || '').toLowerCase());
}

/**
 * Convierte el `unit_amount` de Stripe a unidades monetarias.
 *
 * Devuelve `null` —nunca NaN— si el monto no es utilizable, para que quien
 * reporte la conversión pueda distinguir "no hubo valor" de "el valor es 0".
 *
 * @param {number} unitAmount - price.unit_amount tal cual viene de Stripe
 * @param {string} currency   - price.currency
 * @returns {number|null}
 */
export function toMajorUnits(unitAmount, currency) {
  if (typeof unitAmount !== 'number' || !Number.isFinite(unitAmount)) return null;
  return isZeroDecimal(currency) ? unitAmount : unitAmount / 100;
}
