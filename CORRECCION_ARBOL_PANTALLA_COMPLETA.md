# Corrección: Árbol Genealógico a pantalla completa

Esta versión corrige específicamente el problema por el que los cambios visuales del árbol no se mostraban.

## Resultado esperado

Al entrar a `/arbol-genealogico`:

1. El árbol ocupa todo el ancho y alto de la aplicación.
2. No aparece la navbar grande de Legacy.
3. No aparece el sidebar tradicional.
4. No aparece la navegación inferior móvil.
5. En la esquina superior derecha aparece un dock compacto con menú, mensajes, notificaciones y perfil.
6. El botón de menú abre una barra lateral superpuesta; al cerrarla, el árbol vuelve a quedar completamente libre.
7. Las acciones propias del árbol aparecen como iconos pequeños en una barra flotante.
8. El lienzo ya no está encerrado dentro de una tarjeta con margen/borde/radio.

## Importante sobre `dist`

El ZIP recibido contenía `src/client/dist` compilado antes de estos cambios. Esa carpeta se eliminó intencionalmente en esta entrega para que no se confunda con la versión actual.

Para generar la versión de producción:

```bash
cd src/client
npm install
npm run build
```

Vercel también debe ejecutar el build desde `src/client` si esa carpeta está configurada como Root Directory del frontend.
