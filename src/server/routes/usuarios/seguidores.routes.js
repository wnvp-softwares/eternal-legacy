const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { seguirUsuario } = require('../../controllers/usuarios/seguidores.controller');

router.post('/seguir', verificarToken, seguirUsuario);

module.exports = router;