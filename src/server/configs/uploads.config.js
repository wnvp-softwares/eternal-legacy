const path = require('path');
const fs = require('fs');

// Raíz del proyecto: ETERNAL-LEGACY
// Este archivo vive en src/server/configs, por eso subimos 3 niveles.
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const quitarBarraFinal = (valor = '') => String(valor || '').replace(/\/+$/, '');

const normalizarRutaPublica = (ruta = '/uploads') => {
    let rutaLimpia = String(ruta || '/uploads').trim();

    if (!rutaLimpia) rutaLimpia = '/uploads';
    if (!rutaLimpia.startsWith('/')) rutaLimpia = `/${rutaLimpia}`;

    return quitarBarraFinal(rutaLimpia) || '/uploads';
};

const resolverDirectorioUploads = () => {
    const rutaEnv = String(process.env.UPLOADS_DIR || 'src/uploads').trim();

    if (path.isAbsolute(rutaEnv)) {
        return rutaEnv;
    }

    return path.resolve(PROJECT_ROOT, rutaEnv);
};

const obtenerMaximoUploadMB = () => {
    const valor = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);

    if (!Number.isFinite(valor) || valor <= 0) {
        return 50;
    }

    return valor;
};

const UPLOADS_DIR = resolverDirectorioUploads();
const UPLOADS_PUBLIC_PATH = normalizarRutaPublica(process.env.UPLOADS_PUBLIC_PATH || '/uploads');
const MAX_UPLOAD_SIZE_MB = obtenerMaximoUploadMB();
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const asegurarDirectorioUploads = () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
};

const construirRutaPublicaUpload = (nombreArchivo) => {
    if (!nombreArchivo) return null;

    return `${UPLOADS_PUBLIC_PATH}/${path.basename(nombreArchivo)}`;
};

const construirUrlPublicaArchivo = (urlArchivo) => {
    if (!urlArchivo) return null;

    if (
        typeof urlArchivo === 'string' &&
        (
            urlArchivo.startsWith('http://') ||
            urlArchivo.startsWith('https://') ||
            urlArchivo.startsWith('data:') ||
            urlArchivo.startsWith('blob:')
        )
    ) {
        return urlArchivo;
    }

    const backendBaseUrl = quitarBarraFinal(
        process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
    );

    const rutaPublica = String(urlArchivo).startsWith('/')
        ? String(urlArchivo)
        : `/${urlArchivo}`;

    return `${backendBaseUrl}${rutaPublica}`;
};

module.exports = {
    PROJECT_ROOT,
    UPLOADS_DIR,
    UPLOADS_PUBLIC_PATH,
    MAX_UPLOAD_SIZE_MB,
    MAX_UPLOAD_SIZE_BYTES,
    asegurarDirectorioUploads,
    construirRutaPublicaUpload,
    construirUrlPublicaArchivo
};
