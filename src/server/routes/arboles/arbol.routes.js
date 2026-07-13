const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');

const {
    crearMiArbol,
    obtenerMiArbol,
    obtenerArbolPorId,
    obtenerArbolesDondeParticipo,
    actualizarMiArbol,
    eliminarMiArbol,
    obtenerAdminsArbol,
    agregarAdminArbol,
    quitarAdminArbol,
    salirDeArbol
} = require('../../controllers/arboles/arbol.controller');

// Crear mi único árbol
router.post('/crear', verificarToken, crearMiArbol);

// Obtener el árbol que yo creé
router.get('/mi-arbol', verificarToken, obtenerMiArbol);

// Obtener todos los árboles donde participo
router.get('/mis-arboles', verificarToken, obtenerArbolesDondeParticipo);

// Actualizar el árbol que yo creé
router.patch('/mi-arbol', verificarToken, actualizarMiArbol);

// Eliminar definitivamente el árbol que yo creé
router.delete('/mi-arbol', verificarToken, eliminarMiArbol);

// Gestión de admins adicionales del árbol
// Importante: estas rutas van antes de /:arbolId para evitar conflictos.
router.get('/:arbolId/admins', verificarToken, obtenerAdminsArbol);
router.patch('/:arbolId/admins/agregar', verificarToken, agregarAdminArbol);
router.patch('/:arbolId/admins/quitar', verificarToken, quitarAdminArbol);

// Salir de un árbol donde fui invitado
router.patch('/:arbolId/salir', verificarToken, salirDeArbol);

// Obtener un árbol específico donde tengo acceso
// IMPORTANTE: esta ruta va al final
router.get('/:arbolId', verificarToken, obtenerArbolPorId);

module.exports = router;
