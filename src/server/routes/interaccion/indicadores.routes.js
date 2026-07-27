const express = require('express');
const router = express.Router();

const { verificarToken } = require('../../middlewares/auth.middleware');
const {
    obtenerResumenIndicadores,
    marcarIndicadoresRedVistos
} = require('../../controllers/interaccion/indicadores.controller');

router.get('/resumen', verificarToken, obtenerResumenIndicadores);
router.put('/red/vistos', verificarToken, marcarIndicadoresRedVistos);

module.exports = router;
