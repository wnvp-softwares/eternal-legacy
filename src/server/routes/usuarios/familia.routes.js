const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { agregarFamiliar } = require('../../controllers/usuarios/familia.controller');

router.post('/agregar', verificarToken, agregarFamiliar);

module.exports = router;