#!/usr/bin/env node

/**
 * Script para obtener prices de Stripe y mapearlos por país
 * Uso: node scripts/fetch-stripe-prices.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
const PRODUCT_ID = process.env.STRIPE_PRODUCT_ID || 'prod_TzbGHlbKHkeGiq';

if (!STRIPE_API_KEY) {
  console.error('❌ Error: STRIPE_API_KEY no encontrada en .env');
  process.exit(1);
}

// Mapeo completo de país en español → código de teléfono + moneda
const countryMapping = {
  'Zambia': { code: '+260', currency: 'ZMW' },
  'Yibuti': { code: '+253', currency: 'DJF' },
  'Yemen': { code: '+967', currency: 'YER' },
  'Vietnam': { code: '+84', currency: 'VND' },
  'Vanuatu': { code: '+678', currency: 'VUV' },
  'Uzbekistán': { code: '+998', currency: 'UZS' },
  'Uruguay': { code: '+598', currency: 'UYU' },
  'Unión Europea': { code: '+34', currency: 'EUR' }, // España por defecto
  'Uganda': { code: '+256', currency: 'UGX' },
  'Ucrania': { code: '+380', currency: 'UAH' },
  'Turquía': { code: '+90', currency: 'TRY' },
  'Trinidad y Tobago': { code: '+1', currency: 'TTD' },
  'Tonga': { code: '+676', currency: 'TOP' },
  'Tayikistán': { code: '+992', currency: 'TJS' },
  'Tanzania': { code: '+255', currency: 'TZS' },
  'Taiwán': { code: '+886', currency: 'TWD' },
  'Tailandia': { code: '+66', currency: 'THB' },
  'Surinam': { code: '+597', currency: 'SRD' },
  'Suiza': { code: '+41', currency: 'CHF' },
  'Suecia': { code: '+46', currency: 'SEK' },
  'Sudáfrica': { code: '+27', currency: 'ZAR' },
  'Sri Lanka': { code: '+94', currency: 'LKR' },
  'Somalia': { code: '+252', currency: 'SOS' },
  'Singapur': { code: '+65', currency: 'SGD' },
  'Sierra Leona': { code: '+232', currency: 'SLE' },
  'Seychelles': { code: '+248', currency: 'SCR' },
  'Serbia': { code: '+381', currency: 'RSD' },
  'Santa Elena': { code: '+290', currency: 'SHP' },
  'Samoa': { code: '+685', currency: 'WST' },
  'Rusia': { code: '+7', currency: 'RUB' },
  'Rumanía': { code: '+40', currency: 'RON' },
  'Ruanda': { code: '+250', currency: 'RWF' },
  'República Dominicana': { code: '+1', currency: 'DOP' },
  'República Democrática del Congo': { code: '+243', currency: 'CDF' },
  'Reino Unido': { code: '+44', currency: 'GBP' },
  'Polonia': { code: '+48', currency: 'PLN' },
  'Polinesia Francesa': { code: '+689', currency: 'XPF' },
  'Perú': { code: '+51', currency: 'PEN' },
  'Paraguay': { code: '+595', currency: 'PYG' },
  'Papúa Nueva Guinea': { code: '+675', currency: 'PGK' },
  'Panamá': { code: '+507', currency: 'PAB' },
  'Pakistán': { code: '+92', currency: 'PKR' },
  'Nueva Zelanda': { code: '+64', currency: 'NZD' },
  'Noruega': { code: '+47', currency: 'NOK' },
  'Nigeria': { code: '+234', currency: 'NGN' },
  'Nicaragua': { code: '+505', currency: 'NIO' },
  'Nepal': { code: '+977', currency: 'NPR' },
  'Namibia': { code: '+264', currency: 'NAD' },
  'Myanmar': { code: '+95', currency: 'MMK' },
  'Mozambique': { code: '+258', currency: 'MZN' },
  'Mongolia': { code: '+976', currency: 'MNT' },
  'Moldavia': { code: '+373', currency: 'MDL' },
  'Mauricio': { code: '+230', currency: 'MUR' },
  'Marruecos': { code: '+212', currency: 'MAD' },
  'Maldivas': { code: '+960', currency: 'MVR' },
  'Malaui': { code: '+265', currency: 'MWK' },
  'Malasia': { code: '+60', currency: 'MYR' },
  'Madagascar': { code: '+261', currency: 'MGA' },
  'Macedonia del Norte': { code: '+389', currency: 'MKD' },
  'Macao': { code: '+853', currency: 'MOP' },
  'Liberia': { code: '+231', currency: 'LRD' },
  'Líbano': { code: '+961', currency: 'LBP' },
  'Lesoto': { code: '+266', currency: 'LSL' },
  'Laos': { code: '+856', currency: 'LAK' },
  'Kirguistán': { code: '+996', currency: 'KGS' },
  'Kenia': { code: '+254', currency: 'KES' },
  'Kazajistán': { code: '+7', currency: 'KZT' },
  'Japón': { code: '+81', currency: 'JPY' },
  'Jamaica': { code: '+1', currency: 'JMD' },
  'Israel': { code: '+972', currency: 'ILS' },
  'Islas Salomón': { code: '+677', currency: 'SBD' },
  'Islas Malvinas': { code: '+500', currency: 'FKP' },
  'Islas Caimán': { code: '+1', currency: 'KYD' },
  'Islandia': { code: '+354', currency: 'ISK' },
  'Indonesia': { code: '+62', currency: 'IDR' },
  'India': { code: '+91', currency: 'INR' },
  'Hungría': { code: '+36', currency: 'HUF' },
  'Hong Kong': { code: '+852', currency: 'HKD' },
  'Honduras': { code: '+504', currency: 'HNL' },
  'Haití': { code: '+509', currency: 'HTG' },
  'Guyana': { code: '+592', currency: 'GYD' },
  'Guinea': { code: '+224', currency: 'GNF' },
  'Guatemala': { code: '+502', currency: 'GTQ' },
  'Gibraltar': { code: '+350', currency: 'GIP' },
  'Georgia': { code: '+995', currency: 'GEL' },
  'Gambia': { code: '+220', currency: 'GMD' },
  'Fiyi': { code: '+679', currency: 'FJD' },
  'Filipinas': { code: '+63', currency: 'PHP' },
  'Etiopía': { code: '+251', currency: 'ETB' },
  'Esuatini': { code: '+268', currency: 'SZL' },
  'Estados Unidos': { code: '+1', currency: 'USD' },
  'Emiratos Árabes Unidos': { code: '+971', currency: 'AED' },
  'Egipto': { code: '+20', currency: 'EGP' },
  'Dinamarca': { code: '+45', currency: 'DKK' },
  'Costa Rica': { code: '+506', currency: 'CRC' },
  'Corea del Sur': { code: '+82', currency: 'KRW' },
  'Comoras': { code: '+269', currency: 'KMF' },
  'Colombia': { code: '+57', currency: 'COP' },
  'China': { code: '+86', currency: 'CNY' },
  'Chile': { code: '+56', currency: 'CLP' },
  'Chipre': { code: '+357', currency: 'EUR' },
  'Chad': { code: '+235', currency: 'XAF' },
  'Ceuta': { code: '+34', currency: 'EUR' },
  'Camerún': { code: '+237', currency: 'XAF' },
  'Can': { code: '+1', currency: 'CAD' },
  'Canadá': { code: '+1', currency: 'CAD' },
  'Camboya': { code: '+855', currency: 'KHR' },
  'Catar': { code: '+974', currency: 'QAR' },
  'Bulgaria': { code: '+359', currency: 'BGN' },
  'Brumania': { code: '+673', currency: 'BND' },
  'Brunei': { code: '+673', currency: 'BND' },
  'Brasil': { code: '+55', currency: 'BRL' },
  'Bosnia': { code: '+387', currency: 'BAM' },
  'Botsuana': { code: '+267', currency: 'BWP' },
  'Bolivia': { code: '+591', currency: 'BOB' },
  'Bielorrusia': { code: '+375', currency: 'BYN' },
  'Bielorrusia ': { code: '+375', currency: 'BYN' },
  'Benín': { code: '+229', currency: 'XOF' },
  'Bélgica': { code: '+32', currency: 'EUR' },
  'Bangladés': { code: '+880', currency: 'BDT' },
  'Bahamas': { code: '+1', currency: 'BSD' },
  'Baréin': { code: '+973', currency: 'BHD' },
  'Barbados': { code: '+1', currency: 'BBD' },
  'Bangladés': { code: '+880', currency: 'BDT' },
  'Bahrain': { code: '+973', currency: 'BHD' },
  'Bah': { code: '+1', currency: 'BSD' },
  'Austriá': { code: '+43', currency: 'EUR' },
  'Austria': { code: '+43', currency: 'EUR' },
  'Australia': { code: '+61', currency: 'AUD' },
  'Argelia': { code: '+213', currency: 'DZD' },
  'Argentina': { code: '+54', currency: 'ARS' },
  'Andorra': { code: '+376', currency: 'EUR' },
  'Angola': { code: '+244', currency: 'AOA' },
  'Anguila': { code: '+1', currency: 'XCD' },
  'Antigua y Barbuda': { code: '+1', currency: 'XCD' },
  'Angola': { code: '+244', currency: 'AOA' },
  'Alemania': { code: '+49', currency: 'EUR' },
  'Albania': { code: '+355', currency: 'ALL' },
  'Aland': { code: '+358', currency: 'EUR' },
  'Åland': { code: '+358', currency: 'EUR' },
  'Afganistán': { code: '+93', currency: 'AFN' },
  'Criptomoneda Genérica': { code: '+999', currency: 'XCG' }, // Crypto
};

/**
 * Realiza petición HTTPS a la API de Stripe
 */
function stripeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${STRIPE_API_KEY}:`).toString('base64');
    
    const requestOptions = {
      hostname: 'api.stripe.com',
      port: 443,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Error parseando respuesta: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Extrae información del país del nombre del price
 */
function extractCountryInfo(priceName) {
  if (!priceName) return null;

  // El formato es: "País - GPS SMS Location (MONEDA)"
  // Extraer la parte del país (antes del guión)
  const countryPart = priceName.split(' -')[0].trim();
  
  // Buscar en el mapeo de países
  if (countryMapping[countryPart]) {
    return countryMapping[countryPart].code;
  }

  // Como fallback, buscar en el nombre completo
  for (const [country, info] of Object.entries(countryMapping)) {
    if (priceName.includes(country)) {
      return info.code;
    }
  }

  return null;
}

/**
 * Obtiene todos los prices del producto
 */
async function fetchPrices() {
  try {
    console.log('🔄 Consultando Stripe API...\n');
    console.log(`📦 Producto: ${PRODUCT_ID}`);
    
    const response = await stripeRequest(`/v1/prices?product=${PRODUCT_ID}&limit=100`);
    
    if (response.error) {
      throw new Error(`Error de Stripe: ${response.error.message}`);
    }

    const prices = response.data;
    console.log(`✅ Se encontraron ${prices.length} prices\n`);

    const priceMap = { 'default': 'price_default_id' };
    const unmappedPrices = [];

    prices.forEach((price) => {
      const countryCode = extractCountryInfo(price.nickname || price.id);
      
      if (countryCode) {
        console.log(`✓ ${price.nickname || price.id}`);
        console.log(`  País: ${countryCode}`);
        console.log(`  Price ID: ${price.id}`);
        console.log(`  Moneda: ${price.currency.toUpperCase()}\n`);
        
        priceMap[countryCode] = price.id;
      } else {
        unmappedPrices.push(price);
      }
    });

    if (unmappedPrices.length > 0) {
      console.log('\n⚠️  Prices sin mapeo (revisión manual requerida):');
      unmappedPrices.forEach((price) => {
        console.log(`  - ${price.nickname || price.id} (${price.currency.toUpperCase()})`);
      });
    }

    return priceMap;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

/**
 * Actualiza el archivo JSON con los prices
 */
async function updatePricesJson(priceMap) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'prices-by-country.json');
    
    // Ordenar las claves alfabéticamente
    const sortedMap = {};
    Object.keys(priceMap).sort().forEach((key) => {
      sortedMap[key] = priceMap[key];
    });

    const jsonContent = JSON.stringify(sortedMap, null, 2);
    
    fs.writeFileSync(filePath, jsonContent + '\n');
    
    console.log('\n✅ Archivo actualizado: public/prices-by-country.json');
    console.log(`📝 Total de países/entradas: ${Object.keys(sortedMap).length}`);
  } catch (error) {
    console.error('❌ Error escribiendo archivo:', error.message);
    process.exit(1);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('================================');
  console.log('  Stripe Prices Fetcher');
  console.log('================================\n');

  const priceMap = await fetchPrices();
  await updatePricesJson(priceMap);
  
  console.log('\n✨ ¡Listo! Tus prices están actualizados.\n');
}

main().catch(console.error);
