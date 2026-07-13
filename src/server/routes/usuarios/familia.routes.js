const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { 
    enviarInvitacionFamiliar, 
    responderInvitacionFamiliar, 
    obtenerMisFamiliares,
    obtenerInvitacionesPendientes
} = require('../../controllers/usuarios/familia.controller');

// Ruta para enviar la invitación (Antes era /agregar)
router.post('/invitar', verificarToken, enviarInvitacionFamiliar);

// NUEVA: Ruta para aceptar o rechazar la invitación
router.put('/responder/:idInvitacion', verificarToken, responderInvitacionFamiliar);

// Ruta para obtener la familia (ya filtrará solo los aceptados)
router.get('/listar', verificarToken, obtenerMisFamiliares);

router.get('/pendientes', verificarToken, obtenerInvitacionesPendientes);

module.exports = router;