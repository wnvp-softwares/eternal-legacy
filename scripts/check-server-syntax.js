const { spawnSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const archivos = [];
const recorrer = (directorio) => {
    for (const nombre of readdirSync(directorio)) {
        const ruta = join(directorio, nombre);
        const stat = statSync(ruta);
        if (stat.isDirectory()) recorrer(ruta);
        else if (ruta.endsWith('.js')) archivos.push(ruta);
    }
};

recorrer(join(process.cwd(), 'src', 'server'));

for (const archivo of archivos) {
    const resultado = spawnSync(process.execPath, ['--check', archivo], { stdio: 'inherit' });
    if (resultado.status !== 0) process.exit(resultado.status || 1);
}

console.log(`Sintaxis de servidor validada: ${archivos.length} archivos.`);
