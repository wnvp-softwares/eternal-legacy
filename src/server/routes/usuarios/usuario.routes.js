const express = require('express');
const router = express.Router();

const {
    crearUsuario,
    loginUsuario,
    actualizarFotoPerfil,
    actualizarImagenesPerfil,
    verificarCodigo,
    verificarCodigo2FALogin,
    actualizarContrasena,
    toggle2FA,
    actualizarPreferencias,
    actualizarClavePublica,
    obtenerConfiguracionE2E,
    actualizarConfiguracionE2E,
    obtenerClavePublicaUsuario,
    enviarFeedback
} = require('../../controllers/usuarios/usuario.controller');

const { verificarToken } = require('../../middlewares/auth.middleware');

// Rutas públicas
router.post('/registro', crearUsuario);
router.post('/login', loginUsuario);
router.post('/verificar-codigo', verificarCodigo);
router.post('/verificar-2fa-login', verificarCodigo2FALogin);

// Rutas protegidas
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

router.put('/clave-publica', verificarToken, actualizarClavePublica);
router.get('/e2e-config', verificarToken, obtenerConfiguracionE2E);
router.put('/e2e-config', verificarToken, actualizarConfiguracionE2E);
router.get('/clave-publica/:id', verificarToken, obtenerClavePublicaUsuario);

router.post('/feedback', verificarToken, enviarFeedback);

module.exports = router;
