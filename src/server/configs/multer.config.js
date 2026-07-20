const path = require('path');
const multer = require('multer');

const {
    UPLOADS_ABSOLUTE_DIR,
    MAX_UPLOAD_SIZE_BYTES
} = require('./uploads.config');

const limpiarNombreArchivo = (nombre = '') => {
    return String(nombre || 'archivo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_ABSOLUTE_DIR);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || '');
        const nombreBase = path.basename(file.originalname || 'archivo', extension);
        const nombreLimpio = limpiarNombreArchivo(nombreBase);
        const nombreFinal = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${nombreLimpio}${extension.toLowerCase()}`;

        cb(null, nombreFinal);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: MAX_UPLOAD_SIZE_BYTES
    },

    fileFilter(req, file, cb) {
        if (
            file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('video/')
        ) {
            return cb(null, true);
        }

        cb(new Error('Formato no soportado'));
    }
});

module.exports = upload;