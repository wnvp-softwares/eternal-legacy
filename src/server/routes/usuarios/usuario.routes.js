const express = require('express');
const router = express.Router();

const { crearUsuario, loginUsuario, actualizarFotoPerfil } = require('../../controllers/usuarios/usuario.controller');
const { verificarToken } = require('../../middlewares/auth.middleware');

router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);
router.put('/foto-perfil', verificarToken, actualizarFotoPerfil);

router.get('/zona-vip', verificarToken, (req, res) => {
    res.status(200).json({
        mensaje: '¡Bienvenido a la Zona VIP de Eternal Legacy!',
        tuIdEs: req.usuario.id
    });
});

module.exports = router;