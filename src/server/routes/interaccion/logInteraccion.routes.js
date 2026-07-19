const express = require('express');
const router = express.Router();
const { registrarEvento } = require('../../controllers/interaccion/logInteraccion.controller');

// Puedes quitar el authMiddleware si quieres trackear también a usuarios no logueados
router.post('/track', registrarEvento);

module.exports = router;