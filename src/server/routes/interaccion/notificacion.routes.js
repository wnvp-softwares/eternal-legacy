const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearNotificacionInterna, obtenerMisNotificaciones } = require('../../controllers/interaccion/notificacion.controller');

router.post('/crear-prueba', verificarToken, crearNotificacionInterna);
router.get('/mis-notificaciones', verificarToken, obtenerMisNotificaciones);

module.exports = router;