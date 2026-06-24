const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { agregarFamiliar, obtenerMisFamiliares } = require('../../controllers/usuarios/familia.controller');

router.post('/agregar', verificarToken, agregarFamiliar);
router.get('/listar', verificarToken, obtenerMisFamiliares);

module.exports = router;