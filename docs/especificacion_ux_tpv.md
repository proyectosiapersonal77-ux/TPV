# Especificación Técnica y Funcional: Optimización de Feedback UX en TPV

## 1. Visión General
El objetivo de estas mejoras es optimizar la experiencia de usuario (UX) en el módulo TPV proporcionando un feedback multisensorial (auditivo y táctil) a las acciones del usuario. Esto reduce la incertidumbre, previene errores y otorga un nivel mayor de autonomía al permitir la gestión individual de preferencias.

---

## 2. Gestión de Preferencias de Usuario (Jerarquía y Permisos)

### 2.1. Nivel Administrador (Global)
- **Ubicación:** Menú Configuración > General (`GeneralManagement.tsx`)
- **Implementación Actual:** Ya existe un control global para los sonidos.
- **Nuevo Requerimiento (Feedback Háptico):** Añadir un nuevo interruptor (Toggle) llamado "Vibración del Sistema".
- **Comportamiento:**
  - Si el administrador desactiva la vibración globalmente (`globalHapticsEnabled = false`), ningún usuario en el dispositivo podrá recibir feedback háptico, independientemente de sus preferencias individuales.
  - Almacenado temporalmente en `localStorage` del dispositivo o base de datos.
  
### 2.2. Nivel Usuario (Mis Preferencias)
- **Ubicación:** Dashboard > Botón "Mis Preferencias" (Modal en `Dashboard.tsx`)
- **Visualización:**
  - **Sonidos:** Interruptor existente. Si está activo (y el global también), el usuario escuchará el feedback.
  - **Vibración (Nuevo):** Si la vibración global está permitida, se muestra el estado de la preferencia individual de Vibración (`preferences.hapticsEnabled`). Si el usuario la activa, su perfil de usuario (`employees.preferences`) registrará el valor como `true`.
- **Base de datos:** Se almacenará en el campo JSONB `preferences` del usuario en la tabla `employees`.

---

## 3. Disparadores y Requerimientos Sensoriales (Módulo TPV)

Se han definido **3 tipos de acciones principales** en el flujo de caja (`POSScreen.tsx`) que recibirán este nuevo tratamiento.

### 3.1. Agregar / Restar / Seleccionar un Producto
- **Componente Afectado:** Botones de producto en la cuadrícula, botones +/- en la línea de la comanda.
- **Auditivo:** Sonido de "Click suave y sutil". Se implementará mediante un archivo de audio corto tipo pop o mediante el sintetizador WebAudio.
- **Háptico:** Patrón de vibración extremadamente corto. `navigator.vibrate(50)`.

### 3.2. Eliminar un Producto de la Comanda
- **Componente Afectado:** Botón "X" o "Papelera" en las líneas de la comanda (`POSScreen.tsx`).
- **Auditivo:** Sonido de "Papel arrugándose" (crumple). Indica una acción destructiva pero temporal con una connotación del mundo físico.
- **Háptico:** Patrón de vibración más pesado y destructivo. `navigator.vibrate([40, 30, 40])`.

### 3.3. Enviar Comanda a Cocina
- **Componente Afectado:** Botón "Enviar" o acción de cobro y finalización de pedido.
- **Auditivo:** Sonido de "Email Enviado" (whoosh/pop ascendente). Indica confirmación y progreso (éxito).
- **Háptico:** Patrón de vibración afirmativo y largo (success). `navigator.vibrate([30, 50, 100])`.

---

## 4. Implementación en la Interfaz (UI)

### 4.1 Pantalla Principal de Configuración (Administrador)
Dentro del componente `GeneralManagement.tsx`:
```tsx
<div className="flex items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50 mt-4">
    <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${globalHapticsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
            <Smartphone size={24} />
        </div>
        <div>
            <h4 className="font-bold text-white">Vibración del Sistema (Feedback Háptico)</h4>
            <p className="text-sm text-gray-400">Permitir que el dispositivo vibre para confirmar acciones de los usuarios.</p>
        </div>
    </div>
    {/* Toggle UI here */}
</div>
```

### 4.2 Modal "Mis Preferencias" (Usuario)
Dentro del componente `Dashboard.tsx`:
```tsx
<div className="flex items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50">
    <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${hapticsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
            <Smartphone size={24} />
        </div>
        <div>
            <h4 className="font-bold text-white">Vibración</h4>
            <p className="text-sm text-gray-400">Activar feedback táctil al interactuar</p>
        </div>
    </div>
    {/* Toggle UI here */}
</div>
```

---

## 5. Notas de Compatibilidad Técnica
- El ecosistema iOS limita fuertemente `navigator.vibrate`, anulándolo completamente en el interior de Safari o aplicaciones PWA en algunos dispositivos antiguos. Se debe incluir un guard clause suave (`if ('vibrate' in navigator)`).
- La reproducción de audio se programará usando APIs web nativas (Web Audio API a través de osciladores para tener 0 latencia, en lugar de pre-cargar ficheros .mp3 externos), o en su defecto una caché `Audio()`.
