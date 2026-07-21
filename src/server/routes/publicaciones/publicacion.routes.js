const express = require('express');
const multer = require('multer');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const upload = require('../../configs/multer.config');
const cloudinary = require('../../configs/cloudinary.config');
const {
    MAX_UPLOAD_SIZE_MB,
    MAX_PUBLICATION_MEDIA_FILES
} = require('../../configs/uploads.config');

const {
    crearPublicacion,
    obtenerPublicaciones,
    buscarTodo,
    obtenerPublicacionesPorEvento,
    reaccionarPublicacion
} = require('../../controllers/publicaciones/publicacion.controller');

const subirMultimediaPublicacion = upload.array('archivo', MAX_PUBLICATION_MEDIA_FILES);

const obtenerResourceTypeCloudinary = (archivo = {}) => {
    return String(archivo.mimetype || '').startsWith('video/') ? 'video' : 'image';
};

const limpiarArchivosSubidos = async (archivos = []) => {
    await Promise.allSettled(
        archivos.map((archivo) => {
            const publicId = archivo?.filename || archivo?.public_id;
            if (!publicId) return Promise.resolve();

            return cloudinary.uploader.destroy(publicId, {
                resource_type: obtenerResourceTypeCloudinary(archivo),
                invalidate: true
            });
        })
    );
};

const manejarCargaPublicacion = (req, res, next) => {
    subirMultimediaPublicacion(req, res, async (error) => {
        if (!error) return next();

        await limpiarArchivosSubidos(Array.isArray(req.files) ? req.files : []);

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    mensaje: `Cada archivo debe pesar como máximo ${MAX_UPLOAD_SIZE_MB} MB.`
                });
            }

            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    mensaje: `Solo puedes agregar hasta ${MAX_PUBLICATION_MEDIA_FILES} archivos por publicación.`
                });
            }

            return res.status(400).json({
                mensaje: 'No se pudieron procesar los archivos seleccionados.'
            });
        }

        console.error('❌ Error al cargar multimedia de publicación:', error);
        return res.status(400).json({
            mensaje: error.message || 'No se pudieron cargar los archivos seleccionados.'
        });
    });
};

router.get('/buscar', verificarToken, buscarTodo);

// Ruta para crear publicaciones con entre 0 y 5 archivos.
router.post('/crear', verificarToken, manejarCargaPublicacion, crearPublicacion);

// Ruta para obtener el muro.
router.get('/muro', verificarToken, obtenerPublicaciones);

// Ruta para obtener publicaciones relacionadas a un evento familiar.
router.get('/evento/:eventoId', verificarToken, obtenerPublicacionesPorEvento);

// Ruta para dar me gusta / reaccionar.
router.post('/:id/reaccionar', verificarToken, reaccionarPublicacion);

module.exports = router;
