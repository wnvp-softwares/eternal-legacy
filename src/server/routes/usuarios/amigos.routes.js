const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { enviarSolicitudAmistad, verMisSolicitudes, obtenerMisAmigos } = require('../../controllers/usuarios/amigos.controller');

router.post('/solicitud', verificarToken, enviarSolicitudAmistad);
router.get('/solicitudes-pendientes', verificarToken, verMisSolicitudes);
router.get('/listar', verificarToken, obtenerMisAmigos);

module.exports = router;