const { readFileSync, readdirSync, statSync } = require('node:fs');
const { dirname, extname, join, resolve } = require('node:path');

const rutas = [];
const recorrer = (directorio) => {
    for (const nombre of readdirSync(directorio)) {
        const ruta = join(directorio, nombre);
        const stat = statSync(ruta);
        if (stat.isDirectory()) recorrer(ruta);
        else if (extname(ruta) === '.js') rutas.push(ruta);
    }
};

recorrer(join(process.cwd(), 'src', 'server', 'routes'));
const errores = [];

for (const archivoRuta of rutas) {
    const textoRuta = readFileSync(archivoRuta, 'utf8');
    const patronImportacion = /const\s*\{([^}]*)\}\s*=\s*require\(['"]([^'"]*controllers[^'"]*)['"]\)/g;
    let coincidencia;

    while ((coincidencia = patronImportacion.exec(textoRuta))) {
        const nombres = coincidencia[1]
            .split(',')
            .map((valor) => valor.trim().split(/\s+as\s+/)[0].trim())
            .filter((valor) => /^[A-Za-z_$][\w$]*$/.test(valor));

        let rutaControlador = resolve(dirname(archivoRuta), coincidencia[2]);
        if (!rutaControlador.endsWith('.js')) rutaControlador += '.js';

        let textoControlador;
        try {
            textoControlador = readFileSync(rutaControlador, 'utf8');
        } catch (error) {
            errores.push(`${archivoRuta}: no se pudo leer ${rutaControlador}`);
            continue;
        }

        const exportados = new Set();
        for (const exportacion of textoControlador.matchAll(/module\.exports\s*=\s*\{([\s\S]*?)\};/g)) {
            exportacion[1]
                .split(',')
                .map((valor) => valor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim())
                .map((valor) => valor.split(':')[0].trim())
                .filter((valor) => /^[A-Za-z_$][\w$]*$/.test(valor))
                .forEach((valor) => exportados.add(valor));
        }

        for (const match of textoControlador.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
            exportados.add(match[1]);
        }

        if (exportados.size === 0) {
            errores.push(`${archivoRuta}: ${rutaControlador} no tiene exportaciones reconocibles`);
            continue;
        }

        for (const nombre of nombres) {
            if (!exportados.has(nombre)) {
                errores.push(`${archivoRuta}: importa ${nombre}, pero ${rutaControlador} no lo exporta`);
            }
        }
    }
}

if (errores.length) {
    console.error('Se encontraron handlers de ruta inválidos:');
    errores.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
}

console.log(`Handlers de rutas validados: ${rutas.length} archivos de rutas.`);
