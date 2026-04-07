const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearHilo, obtenerHilosPorArbol } = require('../../controllers/arboles/hilo.controller');

router.post('/crear', verificarToken, crearHilo);
router.get('/arbol/:arbolId', verificarToken, obtenerHilosPorArbol);

module.exports = router;