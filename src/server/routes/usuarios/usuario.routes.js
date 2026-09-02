const express = require('express');
const router = express.Router();

const {
    obtenerDisponibilidadNickname,
    crearUsuario,
    loginUsuario,
    actualizarFotoPerfil,
    actualizarImagenesPerfil,
    verificarCodigo,
    reenviarCodigoRegistro,
    verificarCodigo2FALogin,
    reenviarCodigo2FALogin,
    solicitarRestablecimiento,
    verificarCodigoRestablecimiento,
    restablecerContrasena,
    actualizarContrasena,
    toggle2FA,
    actualizarPreferencias,
    obtenerSucesionCuenta,
    actualizarSucesionCuenta,
    actualizarOnboarding,
    actualizarClavePublica,
    obtenerConfiguracionE2E,
    actualizarConfiguracionE2E,
    obtenerClavePublicaUsuario,
    enviarFeedback
} = require('../../controllers/usuarios/usuario.controller');

const { verificarToken } = require('../../middlewares/auth.middleware');
const { crearLimitadorMemoria } = require('../../middlewares/security.middleware');

const limiteAuth = crearLimitadorMemoria({ ventanaMs: 10 * 60 * 1000, max: 20 });
const limiteCodigos = crearLimitadorMemoria({ ventanaMs: 10 * 60 * 1000, max: 12 });

// Rutas públicas
router.get('/disponibilidad-nickname', obtenerDisponibilidadNickname);
router.post('/registro', limiteAuth, crearUsuario);
router.post('/login', limiteAuth, loginUsuario);
router.post('/verificar-codigo', limiteCodigos, verificarCodigo);
router.post('/reenviar-codigo-registro', limiteCodigos, reenviarCodigoRegistro);
router.post('/verificar-2fa-login', limiteCodigos, verificarCodigo2FALogin);
router.post('/reenviar-2fa-login', limiteCodigos, reenviarCodigo2FALogin);
router.post('/solicitar-restablecimiento', limiteCodigos, solicitarRestablecimiento);
router.post('/verificar-restablecimiento', limiteCodigos, verificarCodigoRestablecimiento);
router.post('/restablecer-contrasena', limiteCodigos, restablecerContrasena);

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
router.get('/sucesion', verificarToken, obtenerSucesionCuenta);
router.put('/sucesion', verificarToken, actualizarSucesionCuenta);
router.put('/onboarding', verificarToken, actualizarOnboarding);

router.put('/clave-publica', verificarToken, actualizarClavePublica);
router.get('/e2e-config', verificarToken, obtenerConfiguracionE2E);
router.put('/e2e-config', verificarToken, actualizarConfiguracionE2E);
router.get('/clave-publica/:id', verificarToken, obtenerClavePublicaUsuario);

router.post('/feedback', verificarToken, enviarFeedback);

module.exports = router;
