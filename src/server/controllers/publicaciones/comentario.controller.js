const mongoose = require('mongoose');
const { Comentario, Publicacion } = require('../../models/index.model');
const { usuarioPuedeVerPublicacion: usuarioPuedeVerPublicacionCentral } = require('../../services/privacidadPerfil.service');
const { crearNotificacion, crearClaveEvento } = require('../../services/notificacion.service');

const esObjectIdValido = (id) => {
    return Boolean(id) && mongoose.Types.ObjectId.isValid(String(id));
};


const obtenerIdSeguro = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    return valor._id ? String(valor._id) : (valor.id ? String(valor.id) : null);
};

const poblarComentario = async (comentarioId) => {
    return Comentario.findById(comentarioId)
        .populate({
            path: 'autor',
            select: 'nombreUsuario nickname imagenPerfil',
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

        if (!(await usuarioPuedeVerPublicacionCentral({ publicacion, usuarioId: req.usuario.id || req.usuario._id }))) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada o no disponible.'
            });
        }

        const nuevoComentario = new Comentario({
            publicacionPadre: publicacionId,
            autor: req.usuario.id || req.usuario._id,
            texto: texto.trim(),
            reacciones: 0
        });

        await nuevoComentario.save();

        await crearNotificacion({
            destinatarioId: publicacion.autor,
            actorId: req.usuario.id || req.usuario._id,
            tipo: 'comentario_publicacion',
            publicacionId: publicacion._id,
            comentarioId: nuevoComentario._id,
            enlaceReferencia: `/perfil/${obtenerIdSeguro(publicacion.autor)}?publicacion=${publicacion._id}`,
            claveEvento: crearClaveEvento('comentario_publicacion', nuevoComentario._id)
        });

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

        if (!(await usuarioPuedeVerPublicacionCentral({ publicacion, usuarioId: req.usuario.id || req.usuario._id }))) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada o no disponible.'
            });
        }

        const comentarios = await Comentario.find({
            publicacionPadre: publicacionId
        })
            .sort({ createdAt: 1 })
            .populate({
                path: 'autor',
                select: 'nombreUsuario nickname imagenPerfil',
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