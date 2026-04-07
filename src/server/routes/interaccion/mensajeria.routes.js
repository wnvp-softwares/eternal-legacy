const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { enviarMensaje, obtenerMisMensajes } = require('../../controllers/interaccion/mensajeria.controller');

router.post('/enviar', verificarToken, enviarMensaje);
router.get('/mis-mensajes', verificarToken, obtenerMisMensajes);

module.exports = router;