const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    actualizarNodo,
    eliminarNodo
} = require('../../controllers/arboles/nodo.controller');

// Obtener todos los nodos/personas de un árbol
router.get('/arbol/:arbolId', verificarToken, obtenerNodosPorArbol);

// Obtener detalle familiar de una persona/nodo
router.get('/arbol/:arbolId/:nodoId/detalle', verificarToken, obtenerDetalleNodo);

// Crear persona sin cuenta dentro del árbol
router.post('/perfil-sin-cuenta', verificarToken, crearPerfilSinCuenta);

// Actualizar datos de una persona/nodo
router.patch('/arbol/:arbolId/:nodoId', verificarToken, actualizarNodo);

// Eliminar/ocultar persona del árbol
router.delete('/arbol/:arbolId/:nodoId', verificarToken, eliminarNodo);

module.exports = router;