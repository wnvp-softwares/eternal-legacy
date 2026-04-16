const { Publicacion } = require('../../models/index.model');

const crearPublicacion = async (req, res) => {
    try {
        const { tipo, contenido } = req.body;
        const nuevaPublicacion = new Publicacion({
            autor: req.usuario.id, // Viene del token
            tipo: tipo || 'Texto',
            contenido: contenido
        });
        await nuevaPublicacion.save();
        res.status(201).json({ mensaje: 'Publicación creada', publicacion: nuevaPublicacion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear publicación' });
    }
};

const obtenerPublicaciones = async (req, res) => {
    try {
        // Obtenemos todas las publicaciones ordenadas de la más nueva a la más vieja
        // .populate() nos trae el nombre del autor en lugar de solo su ID
        const publicaciones = await Publicacion.find()
            .sort({ createdAt: -1 })
            .populate('autor', 'nombreUsuario');
        res.status(200).json(publicaciones);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener publicaciones' });
    }
};

module.exports = { crearPublicacion, obtenerPublicaciones };