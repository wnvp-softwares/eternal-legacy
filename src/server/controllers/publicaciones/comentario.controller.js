const mongoose = require('mongoose');
const { Comentario, Publicacion, Arbol } = require('../../models/index.model');

const esObjectIdValido = (id) => {
    return Boolean(id) && mongoose.Types.ObjectId.isValid(String(id));
};


const obtenerIdSeguro = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    return valor._id ? String(valor._id) : (valor.id ? String(valor.id) : null);
};

const sonMismoId = (a, b) => {
    const idA = obtenerIdSeguro(a);
    const idB = obtenerIdSeguro(b);
    return Boolean(idA && idB && idA === idB);
};

const usuarioPerteneceAlArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;
    if (sonMismoId(arbol.creador, usuarioId)) return true;
    if (Array.isArray(arbol.admins) && arbol.admins.some(id => sonMismoId(id, usuarioId))) return true;

    return (Array.isArray(arbol.miembros) ? arbol.miembros : []).some(miembro => (
        sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
    ));
};

const usuarioPuedeVerPublicacion = async (publicacion, usuarioId) => {
    if (!publicacion || !usuarioId) return false;
    if (sonMismoId(publicacion.autor, usuarioId)) return true;
    if (publicacion.tipo === 'historico' || publicacion.privacidad === 'publico') return true;

    const arbolId = obtenerIdSeguro(publicacion.arbolAudiencia) ||
        obtenerIdSeguro(publicacion.eventoRelacionado?.arbol);
    if (!arbolId || !esObjectIdValido(arbolId)) return false;

    const arbol = await Arbol.findById(arbolId).select('creador admins miembros activo');
    return Boolean(arbol?.activo !== false && usuarioPerteneceAlArbol(arbol, usuarioId));
};

const poblarComentario = async (comentarioId) => {
    return Comentario.findById(comentarioId)
        .populate({
            path: 'autor',
            select: 'nombreUsuario email imagenPerfil',
            populate: {
                path: 'imagenPerfil'
            }
        });
};

const crearComentario = async (req, res) => {
    try {
        const { publicacionId, texto } = req.body || {};

        if (!publicacionId || !esObjectIdValido(publicacionId)) {
            return res.status(400).json({
                mensaje: 'El ID de la publicación no es válido.'
            });
        }

        if (!texto || texto.trim() === '') {
            return res.status(400).json({
                mensaje: 'El comentario no puede estar vacío.'
            });
        }

        const publicacion = await Publicacion.findById(publicacionId);

        if (!publicacion) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada.'
            });
        }

        if (!(await usuarioPuedeVerPublicacion(publicacion, req.usuario.id || req.usuario._id))) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para comentar esta publicación.'
            });
        }

        const nuevoComentario = new Comentario({
            publicacionPadre: publicacionId,
            autor: req.usuario.id || req.usuario._id,
            texto: texto.trim(),
            reacciones: 0
        });

        await nuevoComentario.save();

        const comentarioCompleto = await poblarComentario(nuevoComentario._id);

        res.status(201).json({
            mensaje: 'Comentario agregado',
            comentario: comentarioCompleto || nuevoComentario
        });
    } catch (error) {
        console.error('❌ Error al crear comentario:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor al crear el comentario.'
        });
    }
};

const obtenerComentariosPorPublicacion = async (req, res) => {
    try {
        const { publicacionId } = req.params;

        if (!publicacionId || !esObjectIdValido(publicacionId)) {
            return res.status(400).json({
                mensaje: 'El ID de la publicación no es válido.'
            });
        }

        const publicacion = await Publicacion.findById(publicacionId)
            .select('_id autor tipo privacidad arbolAudiencia eventoRelacionado');

        if (!publicacion) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada.'
            });
        }

        if (!(await usuarioPuedeVerPublicacion(publicacion, req.usuario.id || req.usuario._id))) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para consultar los comentarios de esta publicación.'
            });
        }

        const comentarios = await Comentario.find({
            publicacionPadre: publicacionId
        })
            .sort({ createdAt: 1 })
            .populate({
                path: 'autor',
                select: 'nombreUsuario email imagenPerfil',
                populate: {
                    path: 'imagenPerfil'
                }
            });

        res.status(200).json(comentarios);
    } catch (error) {
        console.error('❌ Error al obtener comentarios:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor al obtener comentarios.'
        });
    }
};

module.exports = {
    crearComentario,
    obtenerComentariosPorPublicacion
};