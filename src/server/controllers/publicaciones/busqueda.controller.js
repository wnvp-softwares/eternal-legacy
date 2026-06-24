const { Publicacion, Usuario } = require('../../models/index.model');

const buscarTodo = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') {
            return res.status(200).json({ publicaciones: [], personas: [] });
        }

        // Crear una expresión regular insensible a mayúsculas/minúsculas
        const regex = new RegExp(q, 'i');

        // 1. Buscar en Publicaciones (contenido o coincidencia con nombre de autor)
        // Primero buscamos usuarios que coincidan con el nombre para incluir sus posts
        const usuariosCoincidentes = await Usuario.find({ nombreUsuario: regex }).select('_id');
        const idsUsuarios = usuariosCoincidentes.map(u => u._id);

        const publicaciones = await Publicacion.find({
            $or: [
                { contenido: regex },
                { autor: { $in: idsUsuarios } }
            ]
        })
        .sort({ createdAt: -1 })
        .populate('autor', 'nombreUsuario imagenPerfil')
        .populate('multimedia');

        // 2. Buscar en Personas (Usuarios del sistema excluyéndose a sí mismo)
        const personas = await Usuario.find({
            _id: { $ne: req.usuario.id }, // No mostrarse a sí mismo en los resultados
            nombreUsuario: regex
        })
        .select('nombreUsuario email imagenPerfil')
        .populate('imagenPerfil');

        // Formatear la respuesta
        res.status(200).json({
            publicaciones,
            personas: personas.map(p => ({
                id: p._id,
                nombre: p.nombreUsuario,
                img: p.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombreUsuario)}&background=cbd5e1`
            }))
        });

    } catch (error) {
        console.error('❌ Error en la búsqueda unificada:', error);
        res.status(500).json({ mensaje: 'Error al realizar la búsqueda' });
    }
};

module.exports = { buscarTodo };