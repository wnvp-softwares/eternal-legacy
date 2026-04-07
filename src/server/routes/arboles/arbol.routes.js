const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { obtenerMiArbol } = require('../../controllers/arboles/arbol.controller');

router.get('/mi-arbol', verificarToken, obtenerMiArbol);

module.exports = router;