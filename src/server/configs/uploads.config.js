const obtenerMaximoUploadMB = () => {
    const valor = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);

    if (!Number.isFinite(valor) || valor <= 0) {
        return 50;
    }

    return valor;
};

const MAX_UPLOAD_SIZE_MB = obtenerMaximoUploadMB();
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

module.exports = {
    MAX_UPLOAD_SIZE_MB,
    MAX_UPLOAD_SIZE_BYTES
};