const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const upload = require('../../configs/multer.config');

const {
    subirFotoNodo,
    actualizarFotoPerfilNodo,
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    crearFamiliarRelacionado,
    actualizarNodo,
    moverNodo,
    reorganizarArbol,
    eliminarNodo
} = require('../../controllers/arboles/nodo.controller');

// Subir una sola fotografía y devolver su URL pública.
router.post(
    '/arbol/:arbolId/subir-foto',
    verificarToken,
    upload.single('archivo'),
    subirFotoNodo
);

// Cambiar la fotografía exclusiva del círculo de un nodo.
router.post(
    '/arbol/:arbolId/:nodoId/foto-perfil',
    verificarToken,
    upload.single('archivo'),
    actualizarFotoPerfilNodo
);

// Obtener todos los nodos/personas de un árbol
router.get('/arbol/:arbolId', verificarToken, obtenerNodosPorArbol);

// Obtener detalle familiar de una persona/nodo
router.get('/arbol/:arbolId/:nodoId/detalle', verificarToken, obtenerDetalleNodo);

// Crear persona sin cuenta dentro del árbol
router.post('/perfil-sin-cuenta', verificarToken, crearPerfilSinCuenta);

// Crear un familiar indicando su parentesco respecto a una persona existente.
// El backend crea Nodo + Hilo y calcula su ubicación automáticamente.
router.post('/arbol/:arbolId/familiares-relacionados', verificarToken, crearFamiliarRelacionado);

// Reorganizar todas las familias del árbol con una preferencia vertical de género.
router.patch('/arbol/:arbolId/reorganizar', verificarToken, reorganizarArbol);

// Actualizar datos de una persona/nodo
router.patch('/arbol/:arbolId/:nodoId', verificarToken, actualizarNodo);

// Mover una persona de generación o unirla como pareja en una operación atómica
router.patch('/arbol/:arbolId/:nodoId/mover', verificarToken, moverNodo);

// Eliminar/ocultar persona del árbol
router.delete('/arbol/:arbolId/:nodoId', verificarToken, eliminarNodo);

module.exports = router;
