# Configuración de Firestore para Safe Mode

## 📋 Estructura de la Base de Datos

Este proyecto utiliza Firestore para controlar el **Safe Mode** de forma centralizada desde el sistema, sin necesidad de modificar código.

### Colección: `configuraciones`

#### Documento: `geo-modes`
  - **Campo**: `safe-mode` (boolean)
    - `true` = Safe Mode activado (búsqueda por navegador/IP sin teléfono)
    - `false` = Modo Normal activado (búsqueda por número telefónico)

#### Documento: `geo-stripe`
  - **Campo**: `prod` (boolean)
    - `true` = Stripe PRODUCTION (precios reales por país, múltiples productos)
    - `false` = Stripe SANDBOX/TEST (precio único de prueba para todos los países)

## 🚀 Pasos para Configurar en Firebase Console

### 1. Acceder a Firestore Database
```
Firebase Console → Tu proyecto (splashmix-ai) → Firestore Database
```

### 2. Crear la Colección
1. Click en **"Start collection"** (si es la primera vez) o **"Add collection"**
2. **Collection ID**: `configuraciones`
3. Click **"Next"**

### 3. Crear el Documento Safe Mode (geo-modes)
1. **Document ID**: `geo-modes` (escribe esto manualmente, no uses auto-ID)
2. **Field**: Agregar el primer campo:
   - **Field name**: `safe-mode`
   - **Field type**: `boolean` (seleccionar del dropdown)
   - **Value**: `false` (para iniciar en Modo Normal) o `true` (para iniciar en Safe Mode)
3. Click **"Save"**

### 4. Crear el Documento Stripe Mode (geo-stripe)
1. En la misma colección `configuraciones`, click en **"Add document"**
2. **Document ID**: `geo-stripe` (escribe esto manualmente, no uses auto-ID)
3. **Field**: Agregar el campo:
   - **Field name**: `prod`
   - **Field type**: `boolean` (seleccionar del dropdown)
   - **Value**: `false` (para SANDBOX/pruebas) o `true` (para PRODUCTION/cobros reales)
4. Click **"Save"**

### 5. Crear el Documento Modal Wait Time (geo-wait)
1. En la misma colección `configuraciones`, click en **"Add document"**
2. **Document ID**: `geo-wait` (escribe esto manualmente, no uses auto-ID)
3. **Campos**: Agregar DOS campos:
   
   **Campo 1:**
   - **Field name**: `wait-safe`
   - **Field type**: `number` (seleccionar del dropdown)
   - **Value**: `30` (30 segundos, para Safe Mode)
   
   Click en **"Add field"** para agregar el segundo campo:
   
   **Campo 2:**
   - **Field name**: `wait-prod`
   - **Field type**: `number` (seleccionar del dropdown)
   - **Value**: `30` (30 segundos, para modo producción)

4. Click **"Save"**

> **💡 Tip**: Los valores están en **segundos**, así que:
> - `15` = 15 segundos (más rápido, para testing)
> - `30` = 30 segundos (estándar) ⭐
> - `45` = 45 segundos (más lento, para usuarios que necesitan más tiempo)
> - `60` = 60 segundos (1 minuto)

### 6. Crear el Documento Sell Control (geo-sell)
1. En la misma colección `configuraciones`, click en **"Add document"**
2. **Document ID**: `geo-sell` (escribe esto manualmente, no uses auto-ID)
3. **Field**: Agregar el campo:
   - **Field name**: `sell`
   - **Field type**: `boolean` (seleccionar del dropdown)
   - **Value**: `true` (para mostrar modal de compra) o `false` (para nunca mostrar el modal)
4. Click **"Save"**

> **💡 Tip**: Usa `false` cuando quieras que los usuarios usen la app gratuitamente sin que aparezca el modal de compra.

### 7. Crear el Documento Verbose Logging (geo-verbose)
1. En la misma colección `configuraciones`, click en **"Add document"**
2. **Document ID**: `geo-verbose` (escribe esto manualmente, no uses auto-ID)
3. **Field**: Agregar el campo:
   - **Field name**: `verbose`
   - **Field type**: `boolean` (seleccionar del dropdown)
   - **Value**: `true` (para desarrollo/mostrar logs) o `false` (para producción/ocultar logs)
4. Click **"Save"**

> **💡 Tip**: Usa `false` en producción para que los usuarios finales no vean logs técnicos en la consola del navegador.

## ✅ Resultado Final

Tu estructura en Firestore debería verse así:

```
📁 configuraciones (collection)
  ├─ 📄 geo-modes (document)
  │   └─ safe-mode: false (boolean)
  ├─ 📄 geo-stripe (document)
  │   └─ prod: false (boolean)
  ├─ 📄 geo-wait (document)
  │   ├─ wait-safe: 30 (number, segundos)
  │   └─ wait-prod: 30 (number, segundos)
  ├─ 📄 geo-sell (document)
  │   └─ sell: true (boolean)
  └─ 📄 geo-verbose (document)
      └─ verbose: true (boolean)
```

## 🔄 Cambiar el Modo en Tiempo Real

### Desde Firebase Console:
1. Ve a `Firestore Database`
2. Navega a `configuraciones > geo-modes`
3. Haz click en el campo `safe-mode`
4. Cambia el valor a `true` o `false`
5. Click **"Update"**

### Efecto:
- ✨ **Todos los usuarios verán el cambio instantáneamente** (sin recargar la página)
- 🔊 En la consola del navegador verás: `🔄 Safe Mode actualizado a: true/false`

## 🔒 Reglas de Seguridad Recomendadas

Para permitir lectura pública pero escritura solo para admins:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura de configuraciones a todos
    match /configuraciones/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == 'TU_ADMIN_UID';
    }
  }
}
```

**Reemplaza `TU_ADMIN_UID`** con tu UID de usuario admin que puedes encontrar en:
```
Firebase Console → Authentication → Users → (tu usuario) → User UID
```

## 🧪 Prueba de Funcionamiento

### En la consola del navegador deberías ver:

```
🔧 Safe Mode inicial: false
🌍 Ubicación del usuario detectada:
   📞 Código telefónico: +52
   🏴 Código ISO país: MX
   🌐 Idioma establecido: Español
```

### Al cambiar el valor en Firestore:

```
🔄 Safe Mode actualizado a: true
```

Y el UI cambiará automáticamente de:
- **Modo Normal** (input de teléfono + dropdown de país)
- **Safe Mode** (botones de Búsqueda por Navegador / IP)

## ⚠️ Troubleshooting

### Error: "Missing or insufficient permissions"
- Revisa las reglas de seguridad en Firestore
- Asegúrate de que `allow read: if true;` esté configurado para `/configuraciones`

### Safe Mode no se actualiza en tiempo real
- Verifica que el documento se llame exactamente `geo-modes` (minúsculas con guión)
- Verifica que el campo se llame exactamente `safe-mode` (minúsculas con guión)
- Revisa la consola del navegador para errores

### Error al cargar Safe Mode
- Si Firebase falla, la app usa `safeMode = false` por defecto (Modo Normal)
- Verifica que las credenciales en `.env` sean correctas
- Asegúrate de que el proyecto Firebase esté activo

## 📝 Notas

- El Safe Mode es 100% controlado desde Firestore, **no hay botones de toggle en el UI**
- Los cambios son **instantáneos** gracias al listener de Firestore (`onSnapshot`)
- El listener se limpia automáticamente cuando el componente se destruye (`onDestroy`)
- Si Firestore falla al cargar, la app continúa funcionando en Modo Normal

---

# 💳 Configuración de Stripe Mode

## 📋 Modos de Stripe

El proyecto soporta dos modos de Stripe controlados desde Firestore:

### 🏭 PRODUCTION Mode (`prod: true`)
- Usa credenciales de producción (Stripe Live Keys)
- Precios específicos por país (desde `product-details.json`)
- Múltiples productos según región
- **Cobros reales a tarjetas**

### 🧪 SANDBOX Mode (`prod: false`)
- Usa credenciales de prueba (Stripe Test Keys)
- Un solo precio para todos los países
- Ideal para desarrollo y testing
- **NO genera cobros reales**

## 🔑 Variables de Entorno Requeridas

En tu archivo `.env` necesitas configurar:

```dotenv
# Stripe Production (Cobros reales)
VITE_STRIPE_PROD_API_KEY=sk_live_XXXXXXXXXXXXX
VITE_STRIPE_PROD_PRODUCT_ID=prod_XXXXXXXXXXXXX

# Stripe Sandbox (Pruebas)
VITE_STRIPE_TEST_API_KEY=sk_test_XXXXXXXXXXXXX
VITE_STRIPE_TEST_PRODUCT_ID=prod_test_XXXXXXXXXXXXX
VITE_STRIPE_TEST_PRICE_ID=price_test_XXXXXXXXXXXXX
```

> **⚠️ Importante**: El prefijo `VITE_` es requerido para que Vite exponga estas variables al navegador. Las API Keys de Stripe serán **públicamente visibles** en el código JavaScript compilado, pero esto es seguro porque Stripe usa restricciones de dominio y las claves secretas están en el backend (Stripe Kraken).

### 🎯 Dónde Obtener las Credenciales

1. **Production Keys**:
   - Stripe Dashboard → Developers → API keys → Reveal live key
   - Copia `Secret key` (empieza con `sk_live_`)
   - Ve a Products → Selecciona tu producto
   - Copia el `Product ID` (empieza con `prod_`)

2. **Test Keys**:
   - Stripe Dashboard → Developers → API keys (toggle a "Test mode")
   - Copia `Secret key` (empieza con `sk_test_`)
   - Ve a Products → Selecciona un producto de prueba
   - Copia el `Product ID` y un `Price ID` cualquiera

## 🔄 Cambiar entre Producción y Sandbox

### Desde Firebase Console:
1. Ve a `Firestore Database`
2. Navega a `configuraciones > geo-stripe`
3. Haz click en el campo `prod`
4. Cambia el valor:
   - `true` = PRODUCTION (cobros reales) 🏭
   - `false` = SANDBOX (pruebas) 🧪
5. Click **"Update"**

### En la consola del navegador verás:
```
💳 Stripe Mode inicial: PRODUCTION
💳 Stripe Mode actualizado: SANDBOX
```

## ⚠️ Recomendaciones de Seguridad

1. **NUNCA subas el `.env` al repositorio** (ya está en `.gitignore`)
2. **Usa SANDBOX durante desarrollo** para evitar cargos accidentales
3. **Prueba pagos completos en SANDBOX** antes de cambiar a PRODUCTION
4. 
---

# ⏱️ Configuración de Tiempos de Espera del Modal

## 📋 Control de Tiempos por Modo

El proyecto permite configurar **tiempos de espera diferentes** para que aparezca el modal de compra, dependiendo del modo de Stripe activo.

### ⚙️ Documento: `geo-wait`

Este documento contiene dos campos numéricos (en segundos):

- **`wait-safe`**: Tiempo de espera cuando la app está en Safe Mode
  - Safe Mode muestra botones para buscar por GPS/IP (no input de teléfono)
  - Ejemplo: `30` (30 segundos)

- **`wait-prod`**: Tiempo de espera cuando la app está en Normal Mode
  - Normal Mode muestra input de teléfono estándar
  - Ejemplo: `30` (30 segundos)

### 🎯 Comportamiento

La aplicación selecciona automáticamente el tiempo correcto:
- Si `geo-modes.safe-mode = true` (Safe Mode activo) → usa `wait-safe`
- Si `geo-modes.safe-mode = false` (Normal Mode activo) → usa `wait-prod`

## 🔄 Cambiar los Tiempos en Tiempo Real

### Desde Firebase Console:
1. Ve a `Firestore Database`
2. Navega a `configuraciones > geo-wait`
3. Haz click en el campo que quieres cambiar (`wait-safe` o `wait-prod`)
4. Ingresa un nuevo valor en segundos:
   - `10` = 10 segundos (muy rápido, solo pruebas)
   - `15` = 15 segundos (rápido)
   - `20` = 20 segundos (moderado)
   - `30` = 30 segundos (estándar) ⭐
   - `45` = 45 segundos (lento)
   - `60` = 60 segundos (muy lento)
5. Click **"Update"

### En la consola del navegador verás:
```
⏱️ Tiempos de espera iniciales - Safe Mode: 30s (30000ms), Normal Mode: 30s (30000ms)
⏱️ Tiempos actualizados - Safe Mode: 15s (15000ms), Normal Mode: 45s (45000ms)
⏱️ Tiempo actual en uso: 15000 ms
⏱️ Modal se mostrará en 15000 ms
```

## 🧪 Casos de Uso Recomendados

### Configuración Estándar
```javascript
wait-safe: 30  // 30 segundos - Safe Mode
wait-prod: 30  // 30 segundos - Normal Mode
```
- Experiencia equilibrada en ambos modos
- Balance entre urgencia y exploración

### Safe Mode más rápido (usuarios experimentan más)
```javascript
wait-safe: 20  // 20 segundos - aparece más rápido
wait-prod: 30  // 30 segundos - tiempo estándar
```
- En Safe Mode los usuarios ya están explorando con botones GPS/IP
- Modal aparece más pronto cuando usan estas funciones

### Modo Agresivo (para aumentar conversiones)
```javascript
wait-safe: 15  // 15 segundos
wait-prod: 20  // 20 segundos
```
- Aparición más rápida del modal en ambos modos
- Mayor presión de conversión

### Modo Relajado (para mejor UX)
```javascript
wait-safe: 45  // 45 segundos
wait-prod: 60  // 60 segundos
```
- Usuario con más tiempo para explorar
- Experiencia menos intrusiva

## ⚠️ Recomendaciones

1. **No uses tiempos menores a 5 segundos**
   - El modal aparecerá demasiado rápido
   - Mala experiencia de usuario

2. **Testing de Safe Mode**
   - Usa `wait-safe: 5` para pruebas ultra-rápidas
   - Usa `wait-safe: 15` para pruebas realistas

3. **Producción**
   - Recomendado: `wait-prod: 30` (30 segundos)
   - Ajusta según métricas de conversión

4. **Cambios en Tiempo Real**
   - ✨ Los cambios se aplican **inmediatamente** sin recargar
   - Todos los usuarios conectados verán el nuevo tiempo
   - El tiempo se aplica al **próximo** setTimeout (no afecta timers ya iniciados)

## 📊 Logs de Debug

```
⏱️ Tiempos de espera iniciales - Safe Mode: 30s (30000ms), Normal Mode: 30s (30000ms)
🛡️ Safe Mode: false
⏱️ Tiempo actual en uso: 30000 ms
⏱️ Modal se mostrará en 30000 ms
```

Después de completar la búsqueda:
```
⏱️ Modal se mostrará en 15000 ms
[después de 15 segundos...]
Modal abierto
```

## 🐛 Troubleshooting

### El modal aparece al tiempo incorrecto
- Verifica que `geo-stripe.prod` esté configurado correctamente
- Revisa la consola: debe mostrar el tiempo en uso
- Los valores deben ser **números** (number), no strings

### El modal no aparece
- Asegúrate de que los valores sean números positivos
- Verifica que el documento `geo-wait` exista
- Si falla, la app usa 30000ms por defecto

### Los cambios no se aplican
- Los cambios solo afectan **nuevos** timers
- Si un timer ya está corriendo, esperará el tiempo original
- Recarga la página para aplicar el nuevo tiempo inmediatamente

---

## 💰 Control de Venta del Modal (geo-sell)

### ⚙️ Documento: `geo-sell`

Este documento contiene un campo booleano que controla si el modal de compra se muestra o no:

- **`sell`**: Habilita o deshabilita el modal de compra
  - `true` = Modal se muestra normalmente después del tiempo configurado
  - `false` = Modal **NUNCA** se muestra, la app es gratuita

### 🎯 Casos de Uso

**Activar ventas (sell: true)**
- Monetización activa
- Cobros habilitados
- Modal aparece según configuración de tiempos

**Desactivar ventas (sell: false)**
- Modo gratuito / promoción
- Testing sin interrupciones del modal
- Período de prueba para usuarios
- Mantenimiento del sistema de pagos

### 🔄 Cambiar el Estado de Venta

1. Ve a `Firestore Database`
2. Navega a `configuraciones > geo-sell`
3. Haz click en el campo `sell`
4. Cambia a `true` o `false`
5. Click **"Update"**

### 📊 Logs en Consola

```
💰 Venta de modal: ACTIVADA
⏱️ Modal se mostrará en 30000 ms
```

Si está desactivada:
```
💰 Venta de modal: DESACTIVADA
⏱️ Modal se mostrará en 30000 ms
🚫 Venta desactivada - Modal no se mostrará
```

### ⚠️ Importante

- Los cambios se aplican **inmediatamente** en tiempo real
- Si el timer del modal ya está corriendo, no se cancelará
- Para aplicar cambios en sesiones activas, los usuarios deben recargar
- El valor por defecto si falla la carga es `true` (siempre muestra modal)

---

---

## 🔊 Control de Verbose Logging (geo-verbose)

### ⚙️ Documento: `geo-verbose`

Este documento controla si se muestran logs en la consola del navegador:

- **`verbose: true`**: **Modo Desarrollo** - Muestra todos los logs (console.log, console.warn, console.error)
  - Útil para debugging
  - Ver estado de configuraciones en tiempo real
  - Monitorear flujo de la aplicación
  
- **`verbose: false`**: **Modo Producción** - Oculta todos los logs técnicos
  - Versión limpia para usuarios finales
  - Sin información técnica en la consola
  - Mejor experiencia de usuario

### 🔄 Cambiar el Estado

1. Ve a `Firestore Database`
2. Navega a `configuraciones > geo-verbose`
3. Haz click en el campo `verbose`
4. Cambia a `true` o `false`
5. Click **"Update"**

**Los cambios se aplican inmediatamente en tiempo real.**

### 📊 Logs Controlados

Cuando `verbose = true`, verás logs como:
```
🔊 Verbose logging: ACTIVADO
🔧 Safe Mode inicial: false
💳 Stripe Mode inicial: SANDBOX
⏱️ Tiempos de espera iniciales - Safe Mode: 30s (30000ms), Normal Mode: 30s (30000ms)
💰 Configuración de venta inicial: ACTIVADA
🌍 Ubicación del usuario detectada:
   📞 Código telefónico: +52
   🌐 Idioma establecido: Español
```

Cuando `verbose = false`, la consola estará limpia (sin logs técnicos).

### ⚠️ Importante

- El cambio se aplica **instantáneamente** a todos los usuarios conectados
- Los errores críticos (console.error) también se ocultan cuando verbose=false
- Valor por defecto si falla la carga: `true` (para desarrollo)
- **Recomendación**: Usa `false` en producción, `true` en desarrollo/staging

---

## 🧪 Probar la Configuración

1. **Modo SANDBOX**:
   - Configura `prod: false` en Firestore
   - Usa tarjetas de prueba de Stripe: `4242 4242 4242 4242`
   - El precio será $1.00 para todos los países
   - Verás `🧪 SANDBOX MODE` en la consola

2. **Modo PRODUCTION**:
   - Configura `prod: true` en Firestore
   - Los precios varían por país
   - **Cobros reales** serán procesados
   - Verás `🏭 PRODUCTION MODE` en la consola

## 📊 Logs de Debug

En la consola del navegador verás información detallada:

```
💳 Stripe Mode: 🏭 PRODUCTION
🔑 Using API Key: sk_live_XXXXXXX...
📦 Product ID: prod_XXXXXXXXXXXXX
🔍 Buscando detalles para país: +52 (Modo: PRODUCTION)
```
