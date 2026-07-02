const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');

const { 
    enviarSolicitudAmistad, 
    verMisSolicitudes, 
    obtenerMisAmigos,
    responderSolicitudAmistad // Agregamos el controlador para aceptar/rechazar
} = require('../../controllers/usuarios/amigos.controller');

// Obtener la lista de amigos aceptados
router.get('/listar', verificarToken, obtenerMisAmigos);

// Ver las solicitudes pendientes que te han enviado
router.get('/solicitudes', verificarToken, verMisSolicitudes);

// Enviar una nueva solicitud de amistad
router.post('/solicitar', verificarToken, enviarSolicitudAmistad);

// Aceptar o rechazar una solicitud
router.put('/responder/:idInvitacion', verificarToken, responderSolicitudAmistad);

module.exports = router;