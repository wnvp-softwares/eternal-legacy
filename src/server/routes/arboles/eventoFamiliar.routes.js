const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    crearEventoFamiliar,
    obtenerEventosPorArbol,
    obtenerProximosEventos,
    obtenerEventoPorId,
    actualizarEventoFamiliar,
    cancelarEventoFamiliar,
    eliminarEventoFamiliar
} = require('../../controllers/arboles/eventoFamiliar.controller');

router.post('/crear', verificarToken, crearEventoFamiliar);

router.get('/arbol/:arbolId', verificarToken, obtenerEventosPorArbol);

router.get('/arbol/:arbolId/proximos', verificarToken, obtenerProximosEventos);

router.get('/:eventoId', verificarToken, obtenerEventoPorId);

router.patch('/:eventoId', verificarToken, actualizarEventoFamiliar);

router.patch('/:eventoId/cancelar', verificarToken, cancelarEventoFamiliar);

router.delete('/:eventoId', verificarToken, eliminarEventoFamiliar);

module.exports = router;