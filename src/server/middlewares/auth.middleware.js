const jwt = require('jsonwebtoken');
const { Usuario } = require('../models/index.model');

const verificarToken = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            mensaje: 'Acceso denegado: Token no proporcionado o formato inválido.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);

        if (!verificado?.id) {
            return res.status(401).json({
                mensaje: 'Acceso denegado: Token no válido o expirado.'
            });
        }

        const usuario = await Usuario.findById(verificado.id)
            .select('_id sessionVersion');

        if (!usuario) {
            return res.status(401).json({
                mensaje: 'Acceso denegado: La cuenta ya no está disponible.'
            });
        }

        const versionToken = Number(verificado.sessionVersion || 0);
        const versionActual = Number(usuario.sessionVersion || 0);

        if (versionToken !== versionActual) {
            return res.status(401).json({
                mensaje: 'Tu sesión dejó de ser válida. Inicia sesión nuevamente.'
            });
        }

        req.usuario = {
            ...verificado,
            id: String(usuario._id),
            sessionVersion: versionActual
        };

        next();
    } catch (error) {
        console.error('❌ Error al verificar token:', error.message);
        return res.status(401).json({
            mensaje: 'Acceso denegado: Token no válido o expirado.'
        });
    }
};

module.exports = {
    verificarToken
};
