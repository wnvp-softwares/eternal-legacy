const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const {
    obtenerMiPerfil,
    actualizarMiPerfil,
    obtenerPerfilPorId,
    obtenerPrivacidadMiPerfil,
    actualizarPrivacidadMiPerfil
} = require('../../controllers/usuarios/informacion_perfil.controller');

router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
router.put('/actualizar', verificarToken, actualizarMiPerfil);
router.get('/privacidad', verificarToken, obtenerPrivacidadMiPerfil);
router.patch('/privacidad', verificarToken, actualizarPrivacidadMiPerfil);
router.get('/:id', verificarToken, obtenerPerfilPorId);

module.exports = router;