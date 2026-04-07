const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearPublicacion, obtenerPublicaciones } = require('../../controllers/publicaciones/publicacion.controller');

router.post('/crear', verificarToken, crearPublicacion);
router.get('/muro', verificarToken, obtenerPublicaciones);

module.exports = router;