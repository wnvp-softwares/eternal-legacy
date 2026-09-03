# Build del frontend

El directorio `dist/` precompilado fue eliminado intencionalmente porque pertenecía a una versión anterior del frontend y podía hacer que se siguiera mostrando el layout viejo aunque `src/` ya estuviera actualizado.

Para generar la versión desplegable con la interfaz **Tree-first**:

```bash
cd src/client
npm install
npm run build
```

El build generado debe provenir de este código fuente. El workflow de CI del repositorio también ejecuta la instalación y compilación del frontend.
