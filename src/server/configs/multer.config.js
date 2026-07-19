const multer = require('multer');
const path = require('path');

const {
    UPLOADS_DIR,
    MAX_UPLOAD_SIZE_BYTES,
    asegurarDirectorioUploads
} = require('./uploads.config');

const limpiarNombreArchivo = (nombreOriginal = 'archivo') => {
    const extension = path.extname(nombreOriginal);
    const nombreBase = path.basename(nombreOriginal, extension);

    const nombreSeguro = nombreBase
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'archivo';

    return `${nombreSeguro}${extension.toLowerCase()}`;
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        asegurarDirectorioUploads();
        cb(null, UPLOADS_DIR);
    },

    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const nombreSeguro = limpiarNombreArchivo(file.originalname);

        cb(null, `${uniqueSuffix}-${nombreSeguro}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato no soportado. Solo se permiten imágenes y videos.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_UPLOAD_SIZE_BYTES
    },
    fileFilter: fileFilter
});

module.exports = upload;
