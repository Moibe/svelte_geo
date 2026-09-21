# Precios de Stripe a corregir — monedas sin subunidad

> Detectado el 2026-09-20 mientras se arreglaba el valor de conversión que
> llegaba `null` a Google Ads. **Esto no se puede arreglar desde el código**:
> hay que tocar el catálogo en el dashboard de Stripe.

## El problema

Stripe expresa `unit_amount` en la subunidad de la moneda (centavos) para la
mayoría de monedas, **pero en las llamadas "zero-decimal" el valor ya está en
unidades enteras**: para JPY, `unit_amount: 1780` son ¥1780, no ¥17.80.

[`scripts/fetch-product-details.js:118`](scripts/fetch-product-details.js#L118)
hace `unit_amount / 100` a ciegas para toda moneda al calcular el campo
`formatted`, y los precios del catálogo se cargaron con esa misma lógica. El
resultado: en esas monedas **Stripe cobra 100× lo que la app muestra**.

Calibrado contra las monedas de dos decimales del mismo catálogo
(USD 600→$6, EUR 500→€5, GBP 400→£4, MXN 10000→$100 en el producto de $100;
USD 1200→$12, EUR 1000→€10 en el de $200), el valor que la app muestra es el
precio que se pretendía cobrar.

La lista de monedas sin subunidad vive en
[`src/lib/currency.js`](src/lib/currency.js).

## Cómo corregirlo

Los precios de Stripe son **inmutables**: no se editan. Por cada uno hay que
crear un precio nuevo con el `unit_amount` corregido, archivar el viejo, y
después regenerar los JSON:

```bash
npm run fetch-product-details
```

---

## Los 14 con el patrón claro: `unit_amount` corregido = actual ÷ 100

### Producto $200 — `static/product-details.json`

| ☐ | País | Moneda | Actual | Stripe cobra | App muestra | **Corregir a** | `price_id` |
|---|---|---|---|---|---|---|---|
| ☐ | +81 | JPY | 178000 | ¥178,000 | ¥1,780 | **1780** | `price_1T1cOpIYi36CbmfWQZ8yh0gE` |
| ☐ | +82 | KRW | 1679000 | ₩1,679,000 | ₩16,790 | **16790** | `price_1T1cLeIYi36CbmfWwXl0Ha8y` |
| ☐ | +84 | VND | 29900000 | ₫29,900,000 | ₫299,000 | **299000** | `price_1T1cgaIYi36CbmfWHF7mejsZ` |

### Producto $100 — `static/product-details-100.json`

| ☐ | País | Moneda | Actual | Stripe cobra | App muestra | **Corregir a** | `price_id` |
|---|---|---|---|---|---|---|---|
| ☐ | +257 | BIF | 1700000 | 1,700,000 | 17,000 | **17000** | `price_1T6n4jIYi36CbmfWLnQKrNjK` |
| ☐ | +253 | DJF | 102600 | 102,600 | 1,026 | **1026** | `price_1T6xJDIYi36CbmfWRs9vDf1B` |
| ☐ | +224 | GNF | 5050000 | 5,050,000 | 50,500 | **50500** | `price_1T6n6lIYi36CbmfWUG7l3JLB` |
| ☐ | +269 | KMF | 240000 | 240,000 | 2,400 | **2400** | `price_1T6n5kIYi36CbmfWErbEdGTU` |
| ☐ | +82 | KRW | 840000 | ₩840,000 | ₩8,400 | **8400** | `price_1T6n5qIYi36CbmfWx53wwOAd` |
| ☐ | +261 | MGA | 2400000 | 2,400,000 | 24,000 | **24000** | `price_1T6negIYi36CbmfW88mbCcJ3` |
| ☐ | +595 | PYG | 3700000 | ₲3,700,000 | ₲37,000 | **37000** | `price_1T6x04IYi36CbmfWelUfLuDf` |
| ☐ | +250 | RWF | 800000 | 800,000 | 8,000 | **8000** | `price_1T6x9oIYi36CbmfWb8usqZGt` |
| ☐ | +256 | UGX | 2090000 | 2,090,000 | 20,900 | **20900** | `price_1T6xImIYi36CbmfW3rjkwL5X` |
| ☐ | +678 | VUV | 68300 | 68,300 | 683 | **683** | `price_1T6xIwIYi36CbmfWyOF05iBo` |
| ☐ | +689 | XPF | 58900 | 58,900 | 589 | **589** | `price_1T6x0AIYi36CbmfWVaBDDUde` |

---

## Los 3 que NO encajan — verificar antes de tocar

### 🇨🇱 CLP (+56) — `price_1T6n5JIYi36CbmfWqEjGbir0` — producto $100

Actual `5000`. Stripe cobra **CLP 5,000**; la app muestra **$50**.

**Acá el patrón se invierte: el cobro parece correcto y lo que está mal es lo
que se muestra.** CLP 5,000 está en el orden del resto del catálogo para ese
producto; CLP 50 sería regalarlo.

**☐ NO aplicar la regla.** Si se "corrige" a 50, se pasa de cobrar bien a
cobrar centavos. Lo que habría que arreglar es el `formatted`.

### 🇻🇳 VND (+84) — `price_1T6xJ3IYi36CbmfWQyVvJuBh` — producto $100

Actual `1500000`. Stripe cobra **₫1,500,000**; la app muestra **₫15,000**.

**Ninguno de los dos valores encaja** con lo que cobran las demás monedas de
ese mismo producto: el cobro queda muy alto y el corregido muy bajo.

**☐ Necesita un valor decidido a mano** contra el tipo de cambio real.

> Ojo: el VND del producto **$200** sí sigue el patrón normal y está en la
> tabla de arriba.

### 🇮🇸 ISK ×2 — producto $200 `price_1T1cOIIYi36CbmfWKjFuCBBc` · producto $100 `price_1T6ncdIYi36CbmfWyFXDYF4x`

Stripe **reclasificó la corona islandesa a dos decimales**, así que estos
probablemente ya están bien. Por eso ISK quedó fuera de la lista de
zero-decimal en `src/lib/currency.js`.

**☐ Confirmar en el dashboard** que Stripe la trata como moneda de dos
decimales antes de decidir.

---

## Qué ya se arregló en el código

- [`src/lib/currency.js`](src/lib/currency.js) — `toMajorUnits()` respeta las
  monedas sin subunidad, así que el valor que se reporta a GA/Ads es el que
  Stripe **realmente cobra**. Analytics no miente aunque el catálogo esté mal.
- [`src/lib/Modal.svelte`](src/lib/Modal.svelte) — usa `price.unit_amount`
  (el campo `price.amount` no existía: daba `NaN`, que `localStorage`
  serializaba como `null`, y así llegaba a Google Ads).
- La moneda ahora sale del objeto `price` de Stripe, no del mapa local.

**Pendiente**: `scripts/fetch-product-details.js:118` sigue dividiendo entre
100 a ciegas, así que el campo `formatted` seguirá mal en estas monedas
mientras no use `toMajorUnits()`. Se dejó sin tocar para no cambiar los JSON
en medio de la migración.
