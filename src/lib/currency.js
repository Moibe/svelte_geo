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

/**
 * El importe que Stripe va a cobrar, escrito para mostrarse: símbolo, cifra y
 * código de la moneda (`$200 MXN`, `€10 EUR`, `¥1,780 JPY`).
 *
 * Sale de `unit_amount` y de la moneda del PRECIO, o sea de lo que de verdad se
 * cobra. El campo `formatted` del catálogo no sirve para esto: lo calcula
 * scripts/fetch-product-details.js dividiendo entre 100 a ciegas, y en las
 * monedas sin subunidad eso muestra un importe 100 veces menor al cobrado.
 * Tampoco sirve la moneda del país del visitante: cuando el catálogo no tiene
 * precio para su país se cobra el de México, y rotularlo con la moneda del
 * visitante ("$200 BRL") decía una moneda que no era la que se cobraba.
 *
 * El formato es el de siempre en este modal (símbolo antes de la cifra, sin
 * separador de miles y sin decimales cuando el importe es entero), a propósito
 * fijo en inglés y no según el idioma de la interfaz: en español, portugués,
 * francés o alemán una coma de miles ("42,600") se lee como decimal, y el orden
 * "200 $" de esos idiomas es otro cambio visual que nadie pidió.
 *
 * Devuelve `null` si el importe no es utilizable (el que llama decide qué
 * mostrar en su lugar).
 *
 * @param {number} unitAmount - price.unit_amount tal cual viene de Stripe
 * @param {string} currency   - price.currency
 * @returns {string|null}
 */
export function formatearImporte(unitAmount, currency) {
  const importe = toMajorUnits(unitAmount, currency);
  const codigo = String(currency || '').toUpperCase();
  if (importe === null || !codigo) return null;

  let texto;
  try {
    texto = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: codigo,
      currencyDisplay: 'narrowSymbol',
      useGrouping: false,
      minimumFractionDigits: Number.isInteger(importe) ? 0 : 2,
    }).format(importe);
  } catch {
    // Código de moneda que Intl no conoce: la cifra sola es mejor que nada, y el
    // código va igual al final.
    texto = String(importe);
  }

  // Muchos símbolos son ambiguos ("$" es peso, dólar, etc.): el código siempre
  // va, salvo que Intl ya lo haya usado como símbolo.
  return texto.includes(codigo) ? texto : `${texto} ${codigo}`;
}
