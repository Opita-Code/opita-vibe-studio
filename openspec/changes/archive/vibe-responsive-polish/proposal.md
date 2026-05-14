# Propuesta Arquitectónica: vibe-responsive-polish

## 1. Problema Principal
Vibe Studio fue diseñado para pantallas anchas (`flex` horizontal con `ChatPanel` a un lado y `EditorPanel` al otro). En pantallas móviles, los paneles se aplastan mutuamente, haciendo imposible la escritura de código o la lectura del chat.

## 2. Solución Propuesta (El patrón "Drawer/Overlay")

### En Desktop (>= md / 768px)
- El comportamiento sigue exactamente igual: un panel dividido que el usuario puede redimensionar libremente.

### En Móvil (< md / 768px)
1. **ChatPanel como Cajón Deslizante (Drawer)**:
   - El chat estará oculto por defecto para dar 100% de la pantalla al `EditorPanel`.
   - Se agregará un **Botón Flotante (FAB)** en la esquina inferior derecha: "✨ Abrir IA" (o un ícono).
   - Al tocarlo, el `ChatPanel` aparecerá como un overlay fijo (absoluto, z-50) cubriendo casi toda la pantalla (con un botón de cerrar).
2. **Top Bar**:
   - Simplificaremos el texto. En vez de mostrar el email completo y los botones largos, mostraremos íconos o lo condensaremos.
3. **EditorPanel**:
   - Ajustar paddings del *Empty State* para que no se desborde en móvil.

### En la Landing Page (`landing/index.html`)
- Reducir el tamaño de las fuentes un poco más en pantallas extra-pequeñas (`xs`).
- Asegurar que la *Feature Card* tenga `flex-col` real (actualmente lo tiene en `md:flex-row`, validaremos que en móvil se vea bien apilado).

## 3. Riesgos y Mitigaciones
- **Pérdida de estado del Chat**: Usar estilos de CSS para ocultar/mostrar (ej. `fixed inset-0 z-50 transform transition-transform` y `translate-x-full` a `translate-x-0`) en lugar de desmontar el componente, para que no pierda su scroll ni el input no enviado.
- **Interferencia de clases Tailwind**: Necesitamos revisar `App.tsx` cuidadosamente para asegurar que las clases `md:` sobrescriban las base de móvil.
