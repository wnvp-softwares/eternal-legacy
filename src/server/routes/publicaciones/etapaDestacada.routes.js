const express = require('express');
const router = express.Router();
const { verificarToken } = require('../../middlewares/auth.middleware');
const {
    obtenerMisEtapas,
    crearEtapa,
    actualizarEtapa,
    eliminarEtapa
} = require('../../controllers/publicaciones/etapaDestacada.controller');

router.get('/mias', verificarToken, obtenerMisEtapas);
router.post('/', verificarToken, crearEtapa);
router.patch('/:etapaId', verificarToken, actualizarEtapa);
router.delete('/:etapaId', verificarToken, eliminarEtapa);

module.exports = router;
