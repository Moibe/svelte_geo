# Configuración de Firestore para Safe Mode

## 📋 Estructura de la Base de Datos

Este proyecto utiliza Firestore para controlar el **Safe Mode** de forma centralizada desde el sistema, sin necesidad de modificar código.

### Colección: `configuraciones`
- **Documento**: `geo-modes`
  - **Campo**: `safe-mode` (boolean)
    - `true` = Safe Mode activado (búsqueda por navegador/IP sin teléfono)
    - `false` = Modo Normal activado (búsqueda por número telefónico)

## 🚀 Pasos para Configurar en Firebase Console

### 1. Acceder a Firestore Database
```
Firebase Console → Tu proyecto (splashmix-ai) → Firestore Database
```

### 2. Crear la Colección
1. Click en **"Start collection"** (si es la primera vez) o **"Add collection"**
2. **Collection ID**: `configuraciones`
3. Click **"Next"**

### 3. Crear el Documento
1. **Document ID**: `geo-modes` (escribe esto manualmente, no uses auto-ID)
2. **Field**: Agregar el primer campo:
   - **Field name**: `safe-mode`
   - **Field type**: `boolean` (seleccionar del dropdown)
   - **Value**: `false` (para iniciar en Modo Normal) o `true` (para iniciar en Safe Mode)
3. Click **"Save"**

## ✅ Resultado Final

Tu estructura en Firestore debería verse así:

```
📁 configuraciones (collection)
  └─ 📄 geo-modes (document)
      └─ safe-mode: false (boolean)
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
