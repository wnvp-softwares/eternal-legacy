const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { seguirUsuario, obtenerSeguidores, obtenerSiguiendo } = require('../../controllers/usuarios/seguidores.controller');

router.post('/seguir', verificarToken, seguirUsuario);
router.get('/mis-seguidores', verificarToken, obtenerSeguidores);
router.get('/a-quienes-sigo', verificarToken, obtenerSiguiendo);

module.exports = router;