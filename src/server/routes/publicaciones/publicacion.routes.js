const express = require('express');
const router = express.Router(); // 👈 ESTA LÍNEA ES LA QUE FALTA O ESTÁ ESCRITA INCORRECTAMENTE

const { verificarToken } = require('../../middlewares/auth.middleware');

const { buscarTodo } = require('../../controllers/publicaciones/busqueda.controller');

const upload = require('../../configs/multer.config'); 
const { 
    crearPublicacion, 
    obtenerPublicaciones, 
    reaccionarPublicacion 
} = require('../../controllers/publicaciones/publicacion.controller');

router.get('/buscar', verificarToken, buscarTodo);

// Ruta para crear publicaciones con archivos
router.post('/crear', verificarToken, upload.single('archivo'), crearPublicacion);

// Ruta para obtener el muro
router.get('/muro', verificarToken, obtenerPublicaciones);

// Nueva ruta para dar me gusta / reaccionar
router.post('/:id/reaccionar', verificarToken, reaccionarPublicacion);

module.exports = router;