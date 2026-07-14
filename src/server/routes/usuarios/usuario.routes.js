const express = require('express');
const router = express.Router();

// 1. Asegúrate de incluir verificarCodigo en la desestructuración
const { 
    crearUsuario, 
    loginUsuario, 
    actualizarFotoPerfil, 
    actualizarImagenesPerfil,
    verificarCodigo,
    actualizarContrasena, // 👈 Importar
    toggle2FA,             // 👈 Importar
    actualizarPreferencias
} = require('../../controllers/usuarios/usuario.controller');

const { verificarToken } = require('../../middlewares/auth.middleware');

// Rutas Públicas
router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);
router.post('/verificar-codigo', verificarCodigo); // Ahora sí funcionará

// Rutas Protegidas (Requieren Token)
router.put('/foto-perfil', verificarToken, actualizarFotoPerfil);
router.put('/actualizar-imagenes', verificarToken, actualizarImagenesPerfil);

router.get('/zona-vip', verificarToken, (req, res) => {
    res.status(200).json({
        mensaje: '¡Bienvenido a la Zona VIP de Eternal Legacy!',
        tuIdEs: req.usuario.id
    });
});

router.put('/actualizar-contrasena', verificarToken, actualizarContrasena);
router.patch('/toggle-2fa', verificarToken, toggle2FA);
router.put('/actualizar-preferencias', verificarToken, actualizarPreferencias);

module.exports = router;