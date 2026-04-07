const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearNodo, obtenerMisNodos } = require('../../controllers/arboles/nodo.controller');

router.post('/crear', verificarToken, crearNodo);
router.get('/mis-nodos', verificarToken, obtenerMisNodos);

module.exports = router;