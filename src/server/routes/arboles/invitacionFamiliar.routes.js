const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    obtenerAmigosDisponiblesParaInvitar,
    enviarInvitacionFamiliar,
    obtenerInvitacionesPendientes,
    aceptarInvitacionFamiliar,
    rechazarInvitacionFamiliar,
    cancelarInvitacionFamiliar
} = require('../../controllers/arboles/invitacionFamiliar.controller');

// Obtener amigos reales disponibles para invitar a un árbol
router.get('/arbol/:arbolId/amigos-disponibles', verificarToken, obtenerAmigosDisponiblesParaInvitar);

// Enviar invitación familiar
router.post('/enviar', verificarToken, enviarInvitacionFamiliar);

// Obtener invitaciones pendientes que recibí
router.get('/pendientes', verificarToken, obtenerInvitacionesPendientes);

// Aceptar invitación
router.patch('/:invitacionId/aceptar', verificarToken, aceptarInvitacionFamiliar);

// Rechazar invitación
router.patch('/:invitacionId/rechazar', verificarToken, rechazarInvitacionFamiliar);

// Cancelar invitación enviada
router.patch('/:invitacionId/cancelar', verificarToken, cancelarInvitacionFamiliar);

module.exports = router;