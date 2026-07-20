const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const upload = require('../../configs/multer.config');

const {
    crearPublicacion,
    obtenerPublicaciones,
    buscarTodo,
    obtenerPublicacionesPorEvento,
    reaccionarPublicacion
} = require('../../controllers/publicaciones/publicacion.controller');

router.get('/buscar', verificarToken, buscarTodo);

// Ruta para crear publicaciones con archivos
router.post('/crear', verificarToken, upload.single('archivo'), crearPublicacion);

// Ruta para obtener el muro
router.get('/muro', verificarToken, obtenerPublicaciones);

// Ruta para obtener publicaciones relacionadas a un evento familiar
router.get('/evento/:eventoId', verificarToken, obtenerPublicacionesPorEvento);

// Ruta para dar me gusta / reaccionar
router.post('/:id/reaccionar', verificarToken, reaccionarPublicacion);

module.exports = router;
