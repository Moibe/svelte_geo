# Integración de Stripe en svelte_geo

## Arquitectura Implementada

```
Frontend (Svelte)
    ↓
prices-by-country.json (200+ países → price_ids)
    ↓
Stripe Kraken Backend (Hugging Face Space)
    ↓
Stripe API (con claves secretas)
```

## Archivos Creados/Modificados

### 1. **src/lib/stripe.js** (Nuevo)
Funciones principales para integración de Stripe:
- `crearSesionPago()` - Crea una sesión de checkout
- `getPriceByCountry()` - Obtiene el price_id según el país

### 2. **public/prices-by-country.json** (Nuevo)
Mapeo de códigos de país (ej: +34) → price_ids de Stripe
- Contiene 200+ países con estructura placeholder
- **TODO**: Reemplazar `price_xxx_id` con tus price_ids reales de Stripe

### 3. **src/lib/Modal.svelte** (Modificado)
Componente modal actualizado con:
- Botón "Pagar Ahora" con integración Stripe
- Validación de email y user ID
- Manejo de errores
- Visualización de datos del usuario

### 4. **src/App.svelte** (Modificado)
- Nuevas variables: `userEmail` y `firebaseUserId`
- Inputs de usuario para email y ID
- Paso de datos al Modal
- LocalStorage para persistencia de datos

## Pasos para Completar la Integración

### Paso 1: Obtén tus Price IDs de Stripe
1. Ve a tu dashboard de Stripe
2. Obtén los `price_id` para cada país/producto
3. Formato típico: `price_1A2B3C4D5E6F7G8H9I0J`

### Paso 2: Actualiza prices-by-country.json
```bash
# Reemplaza los placeholders con tus price_ids reales
# Ejemplo:
"+34": "price_1NnqL2AAAAA...",  # España
"+1": "price_1NnqL2BBBBB...",   # USA
"+52": "price_1NnqL2CCCCC...",  # México
```

### Paso 3: Verifica tu Backend de Stripe
El backend debe ser accesible en:
- **DEV**: `https://moibe-stripe-kraken-dev.hf.space/creaLinkSesion/`
- **PROD**: `https://moibe-stripe-kraken-prod.hf.space/creaLinkSesion/`

Puedes cambiar el URL en `src/lib/stripe.js`:
```javascript
const STRIPE_BACKEND = STRIPE_BACKEND_PROD; // o STRIPE_BACKEND_DEV
```

### Paso 4: Configura tu Backend (Hugging Face Spaces)
El backend debe:
1. Recibir POST petition con:
   - `price_id` - ID del precio
   - `customer_email` - Email del cliente
   - `firebase_user` - ID de usuario
   - otros parámetros adicionales

2. Retornar JSON con:
   ```json
   {
     "checkout_url": "https://checkout.stripe.com/pay/cs_..."
   }
   ```

### Paso 5: Integración con Firebase (Opcional)
Si usas Firebase:
```javascript
// En tu auth state listener
auth.onAuthStateChanged((user) => {
  if (user) {
    localStorage.setItem('firebase_user_id', user.uid);
    localStorage.setItem('user_email', user.email);
  }
});
```

## Flujo de Pago

1. Usuario ingresa teléfono y selecciona país
2. Usuario completa email y user ID (inputs en la parte inferior)
3. Se muestra spinner + mapa
4. Después de 6 segundos, modal de pago aparece
5. Usuario hace click en "Pagar Ahora"
6. Se obtiene el price_id según el país
7. Se llama al backend Stripe para crear sesión
8. Se redirige a Stripe Checkout

## Debugging

### Logs en la consola
- Abre DevTools (F12)
- Ve a la pestaña "Console"
- Verás logs de `stripe.js` con detalles de cada paso

### Variables de test
```javascript
// En la consola del navegador:
localStorage.setItem('user_email', 'test@example.com');
localStorage.setItem('firebase_user_id', 'test-user-123');
```

## Endpoints del Backend Esperado

**POST** `/creaLinkSesion/`

Body (form-urlencoded):
```
price_id=price_1A2B3C4D&
customer_email=user@example.com&
firebase_user=user-123&
phone=+34600000000&
country=+34
```

Response (JSON):
```json
{
  "checkout_url": "https://checkout.stripe.com/pay/cs_...",
  "status": "success"
}
```

## Alternativas

Si no quieres usar el backend en Hugging Face Spaces, puedes:
1. Usar Supabase Edge Functions
2. Usar Cloudflare Workers
3. Crear un Lambda en AWS
4. Usar cualquier servidor que ejecute código

Simplemente cambia el URL en `stripe.js`:
```javascript
const STRIPE_BACKEND = 'https://tu-backend.com/payment/create-session/';
```

## Seguridad

⚠️ **Importante**: Nunca incluyas tu STRIPE_SECRET_KEY en el frontend.
La clave secreta DEBE estar solo en el backend.

## Próximos Pasos

- [ ] Reemplazar price_ids en `prices-by-country.json`
- [ ] Verificar/actualizar backend Stripe Kraken
- [ ] Probar en desarrollo (DEV backend)
- [ ] Probar en producción (PROD backend)
- [ ] Integrar Firebase Authentication si lo necesitas
- [ ] Agregar webhooks de Stripe para procesar pagos

## Contacto

Si necesitas ayuda con la integración, revisa:
- Documentación de Stripe: https://stripe.com/docs
- Tu proyecto anterior en Firebase para comparar implementación
