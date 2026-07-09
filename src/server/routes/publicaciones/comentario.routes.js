const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    crearComentario,
    obtenerComentariosPorPublicacion
} = require('../../controllers/publicaciones/comentario.controller');

// Crear comentario
router.post('/crear', verificarToken, crearComentario);

// Obtener comentarios de una publicación
router.get('/publicacion/:publicacionId', verificarToken, obtenerComentariosPorPublicacion);

module.exports = router;