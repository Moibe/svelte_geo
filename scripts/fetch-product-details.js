#!/usr/bin/env node

/**
 * Script para obtener detalles de productos y precios de Stripe
 * Genera product-details.json con información completa
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
 * Obtiene información del producto
 */
async function getProduct() {
  try {
    console.log('📦 Obteniendo información del producto...');
    const product = await stripeRequest(`/v1/products/${PRODUCT_ID}`);
    
    if (product.error) {
      throw new Error(`Error de Stripe: ${product.error.message}`);
    }

    console.log(`✅ Producto: ${product.name}`);
    console.log(`📝 Descripción: ${product.description || 'Sin descripción'}`);
    
    return product;
  } catch (error) {
    console.error('❌ Error obteniendo producto:', error.message);
    process.exit(1);
  }
}

/**
 * Obtiene todos los precios del producto con detalles
 */
async function getPricesWithDetails() {
  try {
    console.log('\n💰 Obteniendo precios y detalles...');
    const response = await stripeRequest(`/v1/prices?product=${PRODUCT_ID}&limit=100`);
    
    if (response.error) {
      throw new Error(`Error de Stripe: ${response.error.message}`);
    }

    const prices = response.data;
    console.log(`✅ Se encontraron ${prices.length} precios\n`);

    return prices;
  } catch (error) {
    console.error('❌ Error obteniendo precios:', error.message);
    process.exit(1);
  }
}

/**
 * Formatea el precio para visualización
 */
function formatPrice(price) {
  if (!price.unit_amount) return 'Precio personalizado';
  
  const amount = price.unit_amount / 100; // Convertir centavos a unidades
  const currency = price.currency.toUpperCase();
  
  // Mapeo de símbolos de moneda
  const currencySymbols = {
    'USD': '$',
    'EUR': '€', 
    'GBP': '£',
    'MXN': '$',
    'BRL': 'R$',
    'JPY': '¥',
    'CNY': '¥',
    'KRW': '₩',
    'INR': '₹'
  };
  
  const symbol = currencySymbols[currency] || currency;
  
  return `${symbol}${amount}`;
}

/**
 * Mapea país por nickname del price
 */
function getCountryFromNickname(nickname) {
  // Manejar explícitamente los precios sin nickname o "Default" como México
  if (!nickname || nickname.trim() === '' || nickname.includes('Default')) {
    return '+52'; // México
  }
  
  const countryPart = nickname.split(' -')[0].trim();
  
  // Mapeo de países a códigos de teléfono
  const countryToCodes = {
    'Estados Unidos': '+1',
    'España': '+34', 
    'Reino Unido': '+44',
    'México': '+52',
    'Brasil': '+55',
    'Argentina': '+54',
    'Chile': '+56',
    'Colombia': '+57',
    'Alemania': '+49',
    'Francia': '+33',
    'Italia': '+39',
    'Japón': '+81',
    'China': '+86',
    'India': '+91',
    'Canadá': '+1',
    'Australia': '+61',
    'Suiza': '+41',
    'Suecia': '+46',
    'Noruega': '+47',
    'Dinamarca': '+45',
    'Polonia': '+48',
    'Chequia': '+420',
    'República Checa': '+420',
    'Catar': '+974',
    'Caribe Oriental': '+1',
    'Camboya': '+855',
    'Cabo Verde': '+238',
    'Burundi': '+257',
    'Brunéi': '+673',
    'Botsuana': '+267',
    'Bosnia y Herzegovina': '+387',
    'Bélgica': '+32',
    'Austria': '+43',
    'Países Bajos': '+31',
    'Holanda': '+31',
    'Portugal': '+351',
    'Grecia': '+30',
    'Turquía': '+90',
    'Rusia': '+7',
    'Ucrania': '+380',
    'Finlandia': '+358',
    'Irlanda': '+353',
    'Islandia': '+354',
    'Luxemburgo': '+352',
    'Estonia': '+372',
    'Letonia': '+371',
    'Lituania': '+370',
    'Eslovenia': '+386',
    'Eslovaquia': '+421',
    'Hungría': '+36',
    'Rumanía': '+40',
    'Bulgaria': '+359',
    'Croacia': '+385',
    'Serbia': '+381',
    'Montenegro': '+382',
    'Macedonia del Norte': '+389',
    'Albania': '+355',
    'Malta': '+356',
    'Chipre': '+357',
    'Israel': '+972',
    'Jordania': '+962',
    'Líbano': '+961',
    'Siria': '+963',
    'Irak': '+964',
    'Irán': '+98',
    'Arabia Saudí': '+966',
    'Emiratos Árabes Unidos': '+971',
    'Kuwait': '+965',
    'Catar': '+974',
    'Bahrein': '+973',
    'Omán': '+968',
    'Yemen': '+967',
    'Afganistán': '+93',
    'Pakistán': '+92',
    'Bangladesh': '+880',
    'Nepal': '+977',
    'Sri Lanka': '+94',
    'Bután': '+975',
    'Maldivas': '+960',
    'Myanmar': '+95',
    'Tailandia': '+66',
    'Laos': '+856',
    'Vietnam': '+84',
    'Camboya': '+855',
    'Malasia': '+60',
    'Singapur': '+65',
    'Indonesia': '+62',
    'Brunéi': '+673',
    'Filipinas': '+63',
    'Taiwán': '+886',
    'Hong Kong': '+852',
    'Macao': '+853',
    'Corea del Sur': '+82',
    'Corea del Norte': '+850',
    'Mongolia': '+976'
  };
  
  return countryToCodes[countryPart] || null;
}

/**
 * Función principal
 */
async function main() {
  console.log('================================');
  console.log('  Stripe Product Details Fetcher');
  console.log('================================');

  const product = await getProduct();
  const prices = await getPricesWithDetails();
  
  // Construir el mapa de detalles
  const productDetails = {};
  
  prices.forEach((price) => {
    const nickname = price.nickname || '';
    
    // Manejo especial para "Unión Europea" - crear entradas para cada país de la UE
    if (nickname.includes('Unión Europea')) {
      const euCountries = ['+33', '+49', '+39', '+34', '+31', '+32', '+43', '+351', '+30', '+353', '+358', '+372', '+371', '+370', '+386', '+421', '+36', '+40', '+359', '+385', '+423'];
      
      euCountries.forEach(countryCode => {
        const formattedPrice = formatPrice(price);
        
        console.log(`✓ ${nickname} (${countryCode})`);
        console.log(`  País: ${countryCode}`);
        console.log(`  Precio: ${formattedPrice}`);
        console.log(`  Moneda: ${price.currency.toUpperCase()}\n`);
        
        productDetails[countryCode] = {
          priceId: price.id,
          product: {
            id: product.id,
            name: product.name,
            description: product.description || 'Acceso a Mapa Completo'
          },
          price: {
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            formatted: formattedPrice,
            nickname: nickname
          }
        };
      });
    } else {
      const countryCode = getCountryFromNickname(nickname);
      
      if (countryCode) {
        const formattedPrice = formatPrice(price);
        
        console.log(`✓ ${nickname || 'Sin nickname'}`);
        console.log(`  País: ${countryCode}`);
        console.log(`  Precio: ${formattedPrice}`);
        console.log(`  Moneda: ${price.currency.toUpperCase()}\n`);
        
        productDetails[countryCode] = {
          priceId: price.id,
          product: {
            id: product.id,
            name: product.name,
            description: product.description || 'Acceso a Mapa Completo'
          },
          price: {
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            formatted: formattedPrice,
            nickname: nickname || 'Default'
          }
        };
      }
    }
  });
  
  // Guardar archivo
  const filePath = path.join(process.cwd(), 'public', 'product-details.json');
  const sortedDetails = {};
  Object.keys(productDetails).sort().forEach((key) => {
    sortedDetails[key] = productDetails[key];
  });

  fs.writeFileSync(filePath, JSON.stringify(sortedDetails, null, 2) + '\n');
  
  console.log('\n✅ Archivo creado: public/product-details.json');
  console.log(`📊 Total de países: ${Object.keys(sortedDetails).length}`);
  console.log('\n✨ ¡Listo! Detalles del producto actualizados.\n');
}

main().catch(console.error);