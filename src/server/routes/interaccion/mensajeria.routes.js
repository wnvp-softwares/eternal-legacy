const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { 
    obtenerContactosPermitidos, 
    obtenerConversacionConContacto, 
    enviarMensaje 
} = require('../../controllers/interaccion/mensajeria.controller');

router.get('/contactos', verificarToken, obtenerContactosPermitidos);
router.get('/conversacion/:contactoId', verificarToken, obtenerConversacionConContacto);
router.post('/enviar', verificarToken, enviarMensaje);

module.exports = router;