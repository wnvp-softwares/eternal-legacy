# Cambios aplicados — Minuta 09 Agosto 2026

Fecha de implementación: 2026-09-02

Este documento resume los cambios aplicados directamente al código de `legacy.zip` para atender los compromisos técnicos de la 5ta minuta del proyecto Legacy/Eternal.

## 1. Árbol genealógico como pantalla principal

- Se conserva `/arbol-genealogico` como ruta inicial de la aplicación.
- En la vista del árbol se oculta el sidebar de escritorio para entregar el espacio principal al lienzo.
- Se eliminan borde, tarjeta exterior y espaciados innecesarios alrededor del lienzo.
- Los accesos secundarios superiores se muestran como iconos compactos con `title`/`aria-label`.
- El usuario actual se resalta visualmente con una insignia `Tú`.
- Al abrir un árbol por primera vez, el lienzo intenta centrarse automáticamente en el usuario actual.
- El botón de restablecer zoom también centra al usuario actual.

Archivos principales:
- `src/client/src/components/Layout.jsx`
- `src/client/src/components/Layout.css`
- `src/client/src/pages/ArbolGenealogico.jsx`
- `src/client/src/pages/ArbolGenealogico.css`

## 2. Alta de familiares por parentesco

Se añadió un flujo basado en la relación respecto a una persona existente:

- Padre / madre
- Hijo / hija
- Pareja

El usuario ya no tiene que decidir manualmente la generación/fila en este flujo. El backend calcula la orientación de la relación y la ubicación solicitada.

Nuevo endpoint:

`POST /api/nodos/arbol/:arbolId/familiares-relacionados`

Payload conceptual:

```json
{
  "nodoRelacionadoId": "...",
  "tipoParentesco": "progenitor | hijo | pareja",
  "persona": {
    "nombre": "..."
  }
}
```

La operación crea Nodo + Hilo como una sola operación lógica y evita dejar un nodo huérfano cuando Mongo se ejecuta sin transacciones.

Archivos principales:
- `src/server/controllers/arboles/nodo.controller.js`
- `src/server/routes/arboles/nodo.routes.js`
- `src/server/services/parentescoArbol.service.js`

## 3. Reacomodo automático del árbol

Después de crear, reactivar, actualizar o eliminar relaciones, el servidor intenta ejecutar automáticamente `reorganizarArbolCompleto`.

También se ejecuta después de aceptar una invitación familiar. De esta forma, el botón de acomodo automático queda como herramienta de reparación/reorganización y no como paso normal de captura.

Archivos:
- `src/server/controllers/arboles/hilo.controller.js`
- `src/server/controllers/arboles/invitacionFamiliar.controller.js`

## 4. Invitaciones con parentesco propuesto

Al agregar desde el contexto de una persona, las invitaciones a usuarios existentes ahora transportan la relación propuesta:

- progenitor → `padre_hijo`, rol `padre`
- descendiente → `padre_hijo`, rol `hijo`
- pareja → `pareja`, rol `conyuge`

Al aceptar la invitación se crea la relación y se reorganiza el árbol.

## 5. Sucesión de cuenta

Se agregó una base técnica segura para la designación de una persona sucesora.

Durante el registro el usuario puede:
- no configurar sucesión; o
- designar un correo de contacto sucesor.

Desde `Configuración → Seguridad` puede modificar o desactivar esta designación.

Nuevas rutas protegidas:

- `GET /api/usuarios/sucesion`
- `PUT /api/usuarios/sucesion`

Estados contemplados en el modelo:

- `NO_CONFIGURADA`
- `CONFIGURADA`
- `SOLICITADA`
- `EN_REVISION`
- `APROBADA`
- `RECHAZADA`

**Regla aplicada:** designar un sucesor no concede acceso automático ni transfiere contraseñas, tokens o llaves.

La aprobación efectiva queda deliberadamente pendiente hasta que el cliente defina evidencia, revisor y alcance de facultades.

Ver: `docs/SUCESION_DE_CUENTA.md`.

## 6. Seguridad y privacidad

Cambios aplicados:

- Códigos nuevos de registro y 2FA almacenados como HMAC en lugar de texto plano.
- Expiración y máximo de intentos para códigos temporales.
- Reenvío real de códigos de registro y 2FA con espera mínima.
- JWT de sesión configurable; valor por defecto reducido a 7 días.
- Rate limiting en autenticación, códigos y recuperación.
- Cabeceras HTTP de seguridad.
- HSTS en producción.
- Límite general de body reducido a 2 MB por defecto (`JSON_BODY_LIMIT`).
- Eliminación de logs de configuración sensible de correo en `server.js`.
- Registro de versión/fecha de aceptación de términos y privacidad.
- Declaración de mayoría de edad registrada junto a la cuenta.
- Se añadió un resumen visible de las medidas técnicas en Configuración → Privacidad.

Nuevas rutas públicas:

- `POST /api/usuarios/reenviar-codigo-registro`
- `POST /api/usuarios/reenviar-2fa-login`

Ver: `docs/SEGURIDAD_Y_PRIVACIDAD.md`.

## 7. Onboarding / guía de uso

Se agregó una guía global de cinco pasos que cubre:

1. Árbol genealógico.
2. Recuerdos/fotografías.
3. Eventos familiares.
4. Privacidad, seguridad y sucesión.
5. Mensajes y acceso posterior a la guía.

La guía se abre automáticamente cuando la cuenta no ha registrado esta versión y puede reabrirse desde el menú de perfil mediante `Guía de uso`.

El progreso se guarda en el usuario mediante:

`PUT /api/usuarios/onboarding`

No depende únicamente de `localStorage`.

## 8. Pruebas y CI

Se agregaron pruebas unitarias para resolver parentescos:

- padre/madre;
- hijo/hija;
- pareja;
- normalización de nombres;
- rechazo de parentesco no soportado.

Comando:

```bash
npm run verify
```

Este comando valida:

1. sintaxis de todos los archivos JS del servidor;
2. consistencia entre handlers importados por las rutas y exports de controladores;
3. pruebas unitarias.

También se agregó `.github/workflows/ci.yml`, que ejecuta las verificaciones del backend y compila el frontend.

## 9. Validación realizada en esta entrega

Resultado local:

- 74 archivos JS del servidor: sintaxis válida.
- 20 archivos de rutas: handlers/controladores consistentes.
- 5/5 pruebas unitarias: aprobadas.

El build local del frontend no pudo ejecutarse en el entorno de modificación porque el ZIP no incluye `node_modules` y la instalación de paquetes externos no concluyó en dicho entorno. El workflow de CI queda configurado para instalar dependencias y ejecutar `npm run build` del frontend en GitHub.

## 10. Pendientes que no deben inventarse en código

### Nueva idea creativa

La minuta indica que el cliente debe definir el concepto que sustituirá la idea anterior de “RED SOCIAL”. No se renombraron ni eliminaron módulos sociales porque no existe una definición aprobada que indique qué debe sustituirlos.

### Sucesión por fallecimiento — aprobación real

La estructura técnica está creada, pero faltan reglas aprobadas por el cliente para iniciar y aprobar un caso real. Ver `docs/SUCESION_DE_CUENTA.md`.

### Compromisos de minuta anterior

La minuta del 09 de agosto indica concluir compromisos incompletos de la minuta anterior, pero dicha minuta no está incluida en los archivos suministrados. Por ello no se modificó código con base en supuestos.

### Monetización / ingresos

El comentario de analistas recomienda definir ingresos, pero la minuta no define el modelo de monetización. No se implementaron cobros ni suscripciones sin una decisión de negocio.
<<<<<<< HEAD

## Ajuste visual adicional — árbol como superficie principal

Se reforzó el modo inmersivo del Árbol Genealógico para que la vista del árbol sea la superficie dominante de la aplicación:

- En `/arbol-genealogico` se ocultan la navbar tradicional, la sidebar de escritorio y la navegación inferior móvil.
- El lienzo ocupa el 100% del viewport disponible, sin marco, tarjeta exterior ni radios de borde.
- La navegación global se concentra en un dock compacto flotante.
- El dock permite abrir una barra lateral colapsable superpuesta; al abrirla, el árbol no se redimensiona ni se desplaza.
- Mensajes, notificaciones y perfil conservan accesos rápidos en el dock.
- La cabecera propia del árbol deja de ocupar una franja completa; título y antetítulo se ocultan para priorizar el lienzo.
- Los controles específicos del árbol permanecen como una barra flotante compacta sobre el lienzo.
- En móvil se mantiene el mismo principio: árbol dominante y controles compactos superpuestos.

La intención visual es que el usuario perciba el Árbol Genealógico como la ventana principal de Legacy/Eternal y que el resto del sistema aparezca únicamente cuando sea necesario.
=======
>>>>>>> ff12bff02b5f522e89a7927d2515708e307c284d
