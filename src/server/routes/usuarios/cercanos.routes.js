const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { agregarCercano } = require('../../controllers/usuarios/cercanos.controller');

router.post('/agregar', verificarToken, agregarCercano);

module.exports = router;