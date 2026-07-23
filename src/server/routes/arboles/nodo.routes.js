const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const upload = require('../../configs/multer.config');

const {
    subirFotoNodo,
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    actualizarNodo,
    eliminarNodo
} = require('../../controllers/arboles/nodo.controller');

// Subir una sola fotografía y devolver su URL pública.
router.post(
    '/arbol/:arbolId/subir-foto',
    verificarToken,
    upload.single('archivo'),
    subirFotoNodo
);

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