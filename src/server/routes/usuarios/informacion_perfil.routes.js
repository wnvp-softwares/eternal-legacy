const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const { obtenerMiPerfil, actualizarMiPerfil, obtenerPerfilPorId } = require('../../controllers/usuarios/informacion_perfil.controller');

router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
router.put('/actualizar', verificarToken, actualizarMiPerfil);
router.get('/:id', verificarToken, obtenerPerfilPorId);

module.exports = router;