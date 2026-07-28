const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const {
    obtenerMisNotificaciones,
    marcarNotificacionLeida,
    marcarTodasLeidas
} = require('../../controllers/interaccion/notificacion.controller');

router.get('/', verificarToken, obtenerMisNotificaciones);
router.put('/marcar-todas-leidas', verificarToken, marcarTodasLeidas);
router.put('/:notificacionId/marcar-leida', verificarToken, marcarNotificacionLeida);

module.exports = router;
