const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearComentario, obtenerComentariosPorPublicacion } = require('../../controllers/publicaciones/comentario.controller');

router.post('/crear', verificarToken, crearComentario);
router.get('/publicacion/:publicacionId', verificarToken, obtenerComentariosPorPublicacion);

module.exports = router;