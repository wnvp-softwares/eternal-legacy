# Seguridad y privacidad — Legacy/Eternal

**Versión técnica:** 2026-09-02

Este documento describe las medidas implementadas en el código de esta versión. No sustituye el Aviso de Privacidad ni asesoría legal.

## 1. Credenciales y autenticación

- Las contraseñas se procesan con `bcrypt`; no deben almacenarse en texto plano.
- Los códigos nuevos de verificación de registro y 2FA se almacenan como huellas HMAC, tienen expiración y contador de intentos.
- La recuperación de contraseña conserva su esquema de código protegido existente.
- Los JWT de sesión tienen expiración configurable (`JWT_EXPIRES_IN`, por defecto 7 días).
- `sessionVersion` permite invalidar sesiones emitidas anteriormente después de cambios sensibles.
- Los endpoints públicos de autenticación y códigos están protegidos con limitación de solicitudes en memoria.

## 2. Seguridad HTTP

El servidor aplica cabeceras de seguridad para impedir MIME sniffing y framing, limita referrers/permisos del navegador y habilita HSTS en producción. El tamaño general de JSON/URL encoded queda limitado por `BODY_LIMIT` (2 MB por defecto).

> Para producción distribuida, el limitador en memoria debe migrarse a un almacén compartido (por ejemplo Redis) para que el límite sea global entre instancias.

## 3. Privacidad de perfiles y árbol

- La cuenta puede configurar la visibilidad del perfil.
- El árbol genealógico y los Momentos Familiares asociados se mantienen dentro de los integrantes autorizados del árbol.
- Las operaciones de edición del árbol validan que el usuario sea creador o administrador según la operación.

## 4. Mensajería

La aplicación contiene soporte de cifrado de extremo a extremo para mensajería mediante las utilidades E2E existentes. Las llaves privadas descifradas no deben persistirse indefinidamente ni enviarse al servidor en texto legible.

### Pendiente recomendado antes de Beta

Revisar el almacenamiento local de tokens y llaves privadas y, cuando la arquitectura lo permita, migrar credenciales de sesión a cookies `HttpOnly + Secure + SameSite` y encapsular las llaves privadas con almacenamiento seguro del dispositivo.

## 5. Sucesión de cuenta

La designación de una persona sucesora **no concede acceso automático**. La implementación actual registra la voluntad del titular, el contacto designado y el estado del proceso. La aprobación de una solicitud queda deliberadamente fuera del flujo automático hasta que el cliente defina:

1. evidencia aceptable de fallecimiento;
2. quién revisa y autoriza la solicitud;
3. facultades exactas que recibe la persona sucesora;
4. plazo de oposición o revisión de familiares/autorizados;
5. tratamiento de mensajes privados y otros datos especialmente sensibles.

## 6. Trazabilidad legal

El registro almacena la versión y fecha de aceptación de Términos/Aviso de Privacidad, además de la declaración de mayoría de edad enviada por el usuario.

## 7. Operación de producción pendiente

Antes del Beta deben quedar documentados y probados externamente: TLS del dominio, respaldos/restauración, rotación de secretos, monitoreo, respuesta a incidentes, eliminación/exportación de datos y política de retención.
