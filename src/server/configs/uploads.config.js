const path = require('path');
const fs = require('fs');

const obtenerMaximoUploadMB = () => {
    const valor = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);

    if (!Number.isFinite(valor) || valor <= 0) {
        return 50;
    }

    return valor;
};

const quitarBarraFinal = (valor = '') => String(valor || '').replace(/\/$/, '');

const normalizarPublicPath = (valor = '/uploads') => {
    const ruta = quitarBarraFinal(valor.trim() || '/uploads');
    return ruta.startsWith('/') ? ruta : `/${ruta}`;
};

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const UPLOADS_DIR_ENV = process.env.UPLOADS_DIR || 'src/uploads';

const UPLOADS_ABSOLUTE_DIR = path.isAbsolute(UPLOADS_DIR_ENV)
    ? UPLOADS_DIR_ENV
    : path.resolve(PROJECT_ROOT, UPLOADS_DIR_ENV);

const UPLOADS_PUBLIC_PATH = normalizarPublicPath(
    process.env.UPLOADS_PUBLIC_PATH || '/uploads'
);

const MAX_UPLOAD_SIZE_MB = obtenerMaximoUploadMB();
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

if (!fs.existsSync(UPLOADS_ABSOLUTE_DIR)) {
    fs.mkdirSync(UPLOADS_ABSOLUTE_DIR, { recursive: true });
}

const construirRutaPublicaUpload = (nombreArchivo = '') => {
    const archivo = String(nombreArchivo || '').replace(/\\/g, '/').split('/').pop();

    if (!archivo) return '';

    return `${UPLOADS_PUBLIC_PATH}/${archivo}`;
};

module.exports = {
    PROJECT_ROOT,
    UPLOADS_DIR_ENV,
    UPLOADS_ABSOLUTE_DIR,
    UPLOADS_PUBLIC_PATH,
    MAX_UPLOAD_SIZE_MB,
    MAX_UPLOAD_SIZE_BYTES,
    construirRutaPublicaUpload
};