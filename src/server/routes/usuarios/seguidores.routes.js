const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    seguirUsuario,
    obtenerSeguidores,
    obtenerSiguiendo,
    obtenerAmigos,
    dejarDeSeguirUsuario
} = require('../../controllers/usuarios/seguidores.controller');

router.post('/seguir', verificarToken, seguirUsuario);

router.delete('/dejar-de-seguir/:seguidoId', verificarToken, dejarDeSeguirUsuario);

router.get('/mis-amigos', verificarToken, obtenerAmigos);

router.get('/mis-seguidores', verificarToken, obtenerSeguidores);

router.get('/a-quienes-sigo', verificarToken, obtenerSiguiendo);

module.exports = router;