const mongoose = require('mongoose');
const { Notificacion } = require('../../models/index.model');

const LIMITE_MAXIMO = 50;

const obtenerMisNotificaciones = async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario._id;
        const paginaSolicitada = Number.parseInt(req.query?.pagina || req.query?.page, 10);
        const limiteSolicitado = Number.parseInt(req.query?.limite || req.query?.limit, 10);
        const pagina = Number.isInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : 1;
        const limite = Math.min(
            LIMITE_MAXIMO,
            Number.isInteger(limiteSolicitado) && limiteSolicitado > 0 ? limiteSolicitado : 20
        );
        const filtro = { usuarioDestino: usuarioId };

        if (String(req.query?.estado || '').toLowerCase() === 'no-leidas') {
            filtro.fueLeida = false;
        }

        const [total, totalNoLeidas, notificaciones] = await Promise.all([
            Notificacion.countDocuments(filtro),
            Notificacion.countDocuments({ usuarioDestino: usuarioId, fueLeida: false }),
            Notificacion.find(filtro)
                .sort({ createdAt: -1 })
                .skip((pagina - 1) * limite)
                .limit(limite)
                .populate({
                    path: 'usuarioOrigen',
                    select: 'nombreUsuario nickname imagenPerfil',
                    populate: { path: 'imagenPerfil', select: 'urlArchivo secure_url url path' }
                })
                .populate('arbol', 'nombreFamilia')
                .lean()
        ]);

        return res.status(200).json({
            notificaciones,
            totalNoLeidas,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.max(1, Math.ceil(total / limite)),
                hayMas: pagina * limite < total
            }
        });
    } catch (error) {
        console.error('❌ Error al obtener notificaciones:', error);
        return res.status(500).json({ mensaje: 'No se pudieron obtener las notificaciones.' });
    }
};

const marcarNotificacionLeida = async (req, res) => {
    try {
        const { notificacionId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(notificacionId))) {
            return res.status(400).json({ mensaje: 'La notificación no es válida.' });
        }

        const notificacion = await Notificacion.findOneAndUpdate(
            {
                _id: notificacionId,
                usuarioDestino: req.usuario.id || req.usuario._id
            },
            {
                $set: {
                    fueLeida: true,
                    leidaEn: new Date()
                }
            },
            { new: true }
        );

        if (!notificacion) {
            return res.status(404).json({ mensaje: 'Notificación no encontrada.' });
        }

        const totalNoLeidas = await Notificacion.countDocuments({
            usuarioDestino: req.usuario.id || req.usuario._id,
            fueLeida: false
        });

        return res.status(200).json({
            mensaje: 'Notificación marcada como leída.',
            notificacion,
            totalNoLeidas
        });
    } catch (error) {
        console.error('❌ Error al marcar notificación:', error);
        return res.status(500).json({ mensaje: 'No se pudo actualizar la notificación.' });
    }
};

const marcarTodasLeidas = async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario._id;
        const resultado = await Notificacion.updateMany(
            { usuarioDestino: usuarioId, fueLeida: false },
            { $set: { fueLeida: true, leidaEn: new Date() } }
        );

        return res.status(200).json({
            mensaje: 'Todas las notificaciones fueron marcadas como leídas.',
            actualizadas: resultado.modifiedCount || 0,
            totalNoLeidas: 0
        });
    } catch (error) {
        console.error('❌ Error al marcar todas las notificaciones:', error);
        return res.status(500).json({ mensaje: 'No se pudieron actualizar las notificaciones.' });
    }
};

module.exports = {
    obtenerMisNotificaciones,
    marcarNotificacionLeida,
    marcarTodasLeidas
};
