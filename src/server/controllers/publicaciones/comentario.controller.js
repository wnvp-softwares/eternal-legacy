const { Comentario, Publicacion } = require('../../models/index.model');

const crearComentario = async (req, res) => {
    try {
        const { publicacionId, texto } = req.body;

        // Verificamos que la publicación exista
        const publicacion = await Publicacion.findById(publicacionId);
        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada' });
        }

        const nuevoComentario = new Comentario({
            publicacionPadre: publicacionId,
            autor: req.usuario.id, // Viene del token
            texto
        });

        await nuevoComentario.save();

        res.status(201).json({ mensaje: 'Comentario agregado', comentario: nuevoComentario });
    } catch (error) {
        console.error('❌ Error al crear comentario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerComentariosPorPublicacion = async (req, res) => {
    try {
        const { publicacionId } = req.params;
        const comentarios = await Comentario.find({ publicacionPadre: publicacionId })
            .sort({ createdAt: 1 }) // Orden cronológico
            .populate('autor', 'nombreUsuario');

        res.status(200).json(comentarios);
    } catch (error) {
        console.error('❌ Error al obtener comentarios:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { crearComentario, obtenerComentariosPorPublicacion };