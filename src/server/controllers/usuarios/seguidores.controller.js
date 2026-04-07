const { Seguidor } = require('../../models');

const seguirUsuario = async (req, res) => {
    try {
        const { seguidoId } = req.body;
        const nuevoSeguidor = new Seguidor({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });
        await nuevoSeguidor.save();
        res.status(201).json({ mensaje: '¡Ahora sigues a este usuario!' });
    } catch (error) {
        console.error('❌ Error al seguir usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { seguirUsuario };