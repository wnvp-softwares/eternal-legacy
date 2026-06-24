const { Seguidor } = require('../../models/index.model');

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

const obtenerSeguidores = async (req, res) => {
    try {
        const lista = await Seguidor.find({ seguido: req.usuario.id })
            .populate({
                path: 'seguidor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        const formateado = lista.map(s => ({
            id: s._id,
            idConexion: s.seguidor._id,
            nombre: s.seguidor.nombreUsuario,
            relacion: 'Seguidor',
            info: 'Te sigue',
            img: s.seguidor.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguidor.nombreUsuario)}&background=f1f5f9`
        }));
        res.status(200).json(formateado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener seguidores' });
    }
};

const obtenerSiguiendo = async (req, res) => {
    try {
        const lista = await Seguidor.find({ seguidor: req.usuario.id })
            .populate({
                path: 'seguido',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        const formateado = lista.map(s => ({
            id: s._id,
            idConexion: s.seguido._id,
            nombre: s.seguido.nombreUsuario,
            relacion: 'Siguiendo',
            info: 'Lo sigues',
            img: s.seguido.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguido.nombreUsuario)}&background=e2e8f0`
        }));
        res.status(200).json(formateado);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener seguidos' });
    }
};

module.exports = { seguirUsuario, obtenerSeguidores, obtenerSiguiendo };