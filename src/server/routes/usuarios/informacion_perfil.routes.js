const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const { obtenerMiPerfil, actualizarMiPerfil } = require('../../controllers/usuarios/informacion_perfil.controller');

router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
router.put('/editar', verificarToken, actualizarMiPerfil);

module.exports = router;