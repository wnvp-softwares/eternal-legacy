const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    crearHilo,
    obtenerHilosPorArbol,
    actualizarHilo,
    eliminarHilo
} = require('../../controllers/arboles/hilo.controller');

// Crear relación entre personas del árbol
// Ejemplo: padre_hijo, pareja, matrimonio, divorcio
router.post('/crear', verificarToken, crearHilo);

// Obtener todas las relaciones/hilos de un árbol
router.get('/arbol/:arbolId', verificarToken, obtenerHilosPorArbol);

// Actualizar una relación/hilo
router.patch('/arbol/:arbolId/:hiloId', verificarToken, actualizarHilo);

// Eliminar/ocultar una relación/hilo
router.delete('/arbol/:arbolId/:hiloId', verificarToken, eliminarHilo);

module.exports = router;