const obtenerMaximoUploadMB = () => {
    const valor = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);

    if (!Number.isFinite(valor) || valor <= 0) {
        return 50;
    }

    return valor;
};

const MAX_UPLOAD_SIZE_MB = obtenerMaximoUploadMB();
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// Primera versión de carruseles de publicaciones.
const MAX_PUBLICATION_MEDIA_FILES = 5;

// El conjunto completo de archivos de una publicación comparte el límite global.
const MAX_PUBLICATION_TOTAL_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES;

module.exports = {
    MAX_UPLOAD_SIZE_MB,
    MAX_UPLOAD_SIZE_BYTES,
    MAX_PUBLICATION_MEDIA_FILES,
    MAX_PUBLICATION_TOTAL_SIZE_BYTES
};
