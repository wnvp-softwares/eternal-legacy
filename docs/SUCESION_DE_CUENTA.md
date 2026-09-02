# Política técnica provisional de sucesión de cuenta

**Estado:** base funcional implementada; aprobación/transferencia automática no implementada por falta de definición de negocio en la minuta.

## Flujo implementado

1. Durante el registro, el usuario puede indicar si desea designar una persona sucesora y proporcionar su correo.
2. Desde **Configuración → Seguridad → Sucesión de cuenta** puede modificar o retirar la designación.
3. Si el correo pertenece a un usuario existente, el sistema puede asociar internamente ese usuario como contacto sucesor.
4. La designación queda en estado `CONFIGURADA`; no da acceso a la cuenta.
5. El modelo contempla estados posteriores `SOLICITADA`, `EN_REVISION`, `APROBADA` y `RECHAZADA` para un proceso futuro.

## Regla de seguridad

Ninguna contraseña, JWT, llave privada o sesión del titular debe transferirse al sucesor. Una futura sucesión deberá generar una autorización nueva y limitada después de una revisión explícita.

## Definiciones que debe aprobar el cliente

- Quién puede declarar/iniciar el proceso por fallecimiento.
- Evidencias requeridas.
- Quién revisa el caso.
- Alcance de acceso heredado (árbol, fotos, publicaciones, administración, descarga, borrado).
- Tratamiento de conversaciones privadas.
- Posibles copropietarios/administradores del árbol.
- Revocación o cambio de sucesor en vida.
