# Cumplimiento de la minuta del 09 de agosto de 2026

Proyecto: **Legacy / Eternal**  
Base aplicada: ZIP más reciente entregado por el usuario.

## Criterio de esta entrega

La interfaz se reorganiza con un enfoque **Tree-first**:

- El Árbol Genealógico es la pantalla principal real de la aplicación autenticada.
- El árbol ocupa el viewport completo, incluyendo el espacio que antes pertenecía a navbar, sidebar y navegación móvil.
- En la ruta `/arbol-genealogico` esos componentes tradicionales **no se renderizan**.
- Las funciones globales pasan a un rail compacto con dashboards/paneles desplegables.
- Las funciones propias del árbol quedan como controles flotantes pequeños.
- Los paneles de detalle/filtros/eventos se superponen al lienzo y no reducen su área.

## Compromisos de la minuta

### 1. Eliminar recuadros alrededor del árbol y cubrir la pantalla principal — APLICADO

Archivos principales:

- `src/client/src/App.jsx`
- `src/client/src/components/Layout.jsx`
- `src/client/src/components/Layout.css`
- `src/client/src/pages/ArbolGenealogico.css`

Cambios:

- `/arbol-genealogico` es la ruta inicial.
- Se retiró la pantalla intermedia de bienvenida que bloqueaba el acceso al árbol.
- El árbol usa el 100% del viewport.
- Se eliminan borde, margen y radio del contenedor principal del lienzo.
- Navbar, sidebar y menú inferior no se renderizan en el shell del árbol.
- Los paneles laterales del árbol son overlays.

### 2. Opciones extras en iconos pequeños y desplegables — APLICADO

Se implementaron dos niveles:

**Dock global de Legacy**
- Navegación.
- Búsqueda.
- Actividad.
- Cuenta/configuración.
- Ayuda/soporte.

Cada icono abre un dashboard contextual independiente.

**Dock local del árbol**
- Mis árboles.
- Ayuda del árbol.
- Fotografías / Momentos Familiares.
- Eventos.
- Filtros.
- Acomodo.
- Exportación.
- Zoom/centrado.

Los textos permanentes se ocultan y los controles se explican por tooltip/estado desplegable.

### 3. Agregar familiares ya relacionados y ubicados correctamente — APLICADO

Backend:

- `POST /api/nodos/arbol/:arbolId/familiares-relacionados`
- servicio de parentesco y layout automático.

El alta recibe:
- persona de referencia;
- tipo de parentesco;
- datos de la nueva persona.

El servidor calcula generación/fila, crea nodo + hilo y reacomoda el árbol.

Frontend:

- En árboles con personas ya no se muestra el `+` genérico por generación como flujo normal.
- Se selecciona una persona y se elige:
  - Padre / madre.
  - Hijo / hija.
  - Pareja.
- Para árboles vacíos se conserva únicamente la creación del primer familiar.
- Las invitaciones pueden transportar la relación propuesta para crear el hilo al aceptarse.

### 4. Información de seguridad y privacidad — APLICADO

Archivos:
- `docs/SEGURIDAD_Y_PRIVACIDAD.md`
- `src/client/src/pages/Configuracion.jsx`
- `src/client/src/pages/Configuracion.css`
- middleware y controladores de seguridad.

Incluye:
- contraseñas con bcrypt;
- códigos temporales protegidos y con expiración/intentos;
- 2FA;
- invalidación de sesiones;
- rate limit en autenticación;
- headers HTTP;
- límites de body;
- descripción de privacidad y mensajería E2E;
- trazabilidad de aceptación legal.

### 5. Política/base de sucesión de cuenta por fallecimiento — APLICADO EN EL ALCANCE DEFINIBLE

Se pregunta expresamente durante el registro si la persona desea designar sucesor.

También puede configurarse posteriormente desde Configuración.

La designación **no transfiere acceso automáticamente**. Quedan pendientes de definición por el cliente:
- evidencia válida de fallecimiento;
- autoridad que aprueba;
- facultades exactas del sucesor;
- tratamiento de contenido privado.

No se inventaron esas reglas porque la minuta no las define.

### 6. Introducción e instrucciones de uso — APLICADO

Se implementó onboarding versionado guardado en la cuenta.

La guía explica:
- árbol como pantalla principal;
- navegación secundaria mediante docks;
- alta por parentesco;
- recuerdos/eventos;
- seguridad/privacidad/sucesión;
- acceso posterior a ayuda.

Además permanece la ayuda específica del árbol.

### 7. Compromisos incompletos de la minuta anterior — NO VERIFICABLE

La minuta anterior no forma parte de los archivos proporcionados en esta entrega. No se pueden afirmar ni implementar compromisos desconocidos sin inventarlos.

## Otros puntos de la minuta

La definición de una nueva idea creativa que sustituya el concepto anterior de “red social” está asignada al cliente en la minuta. Por esa razón no se cambió arbitrariamente la identidad de producto ni se inventó un modelo de negocio.

## Validación antes de entrega

La entrega debe comprobar:

1. ausencia de marcadores de conflicto Git;
2. CSS sin bloques `\n` literales;
3. sintaxis del servidor;
4. handlers de rutas;
5. pruebas del parentesco;
6. build del frontend cuando las dependencias de Vite estén disponibles.

