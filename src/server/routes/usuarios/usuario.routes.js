const express = require('express');
const router = express.Router();

// 1. Asegúrate de incluir verificarCodigo en la desestructuración
const { 
    crearUsuario, 
    loginUsuario, 
    actualizarFotoPerfil, 
    verificarCodigo
} = require('../../controllers/usuarios/usuario.controller');

const { verificarToken } = require('../../middlewares/auth.middleware');

// Rutas Públicas
router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);
router.post('/verificar-codigo', verificarCodigo); // Ahora sí funcionará

// Rutas Protegidas (Requieren Token)
router.put('/foto-perfil', verificarToken, actualizarFotoPerfil);

router.get('/zona-vip', verificarToken, (req, res) => {
    res.status(200).json({
        mensaje: '¡Bienvenido a la Zona VIP de Eternal Legacy!',
        tuIdEs: req.usuario.id
    });
});

module.exports = router;