const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const {
    obtenerContactosPermitidos,
    obtenerBandejaMensajes,
    obtenerConversacionConContacto,
    enviarMensaje,
    marcarComoLeido,
    obtenerConversacionGrupoFamiliar,
    enviarMensajeGrupoFamiliar,
    marcarGrupoFamiliarComoLeido
} = require('../../controllers/interaccion/mensajeria.controller');

router.get('/bandeja', verificarToken, obtenerBandejaMensajes);
router.get('/contactos', verificarToken, obtenerContactosPermitidos);

router.get('/grupos/:arbolId/conversacion', verificarToken, obtenerConversacionGrupoFamiliar);
router.post('/grupos/:arbolId/enviar', verificarToken, enviarMensajeGrupoFamiliar);
router.put('/grupos/:arbolId/marcar-leido', verificarToken, marcarGrupoFamiliarComoLeido);

router.get('/conversacion/:contactoId', verificarToken, obtenerConversacionConContacto);
router.post('/enviar', verificarToken, enviarMensaje);
router.put('/marcar-leido/:contactoId', verificarToken, marcarComoLeido);

module.exports = router;
