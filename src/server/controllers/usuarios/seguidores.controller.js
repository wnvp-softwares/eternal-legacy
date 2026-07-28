const { Seguidor } = require('../../models/index.model');
const {
    crearNotificacion,
    crearNotificacionesMultiples,
    crearClaveEvento,
    eliminarNotificacionPorClave,
    eliminarNotificaciones
} = require('../../services/notificacion.service');

const seguirUsuario = async (req, res) => {
    try {
        const { seguidoId } = req.body;

        if (!seguidoId) {
            return res.status(400).json({ mensaje: 'Falta el ID del usuario a seguir' });
        }

        if (seguidoId === req.usuario.id) {
            return res.status(400).json({ mensaje: 'No puedes seguirte a ti mismo' });
        }

        const yaExiste = await Seguidor.findOne({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        if (yaExiste) {
            return res.status(200).json({ mensaje: 'Ya sigues a este usuario' });
        }

        const seguimientoReciproco = await Seguidor.findOne({
            seguidor: seguidoId,
            seguido: req.usuario.id
        });

        const nuevoSeguidor = new Seguidor({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        await nuevoSeguidor.save();

        await crearNotificacion({
            destinatarioId: seguidoId,
            actorId: req.usuario.id,
            tipo: 'nuevo_seguidor',
            enlaceReferencia: `/perfil/${req.usuario.id}`,
            claveEvento: crearClaveEvento('nuevo_seguidor', req.usuario.id, seguidoId)
        });

        if (seguimientoReciproco) {
            const par = [String(req.usuario.id), String(seguidoId)].sort().join('-');
            await crearNotificacionesMultiples([
                {
                    destinatarioId: seguidoId,
                    actorId: req.usuario.id,
                    tipo: 'nuevo_amigo',
                    enlaceReferencia: `/perfil/${req.usuario.id}`,
                    claveEvento: crearClaveEvento('nuevo_amigo', par, seguidoId)
                },
                {
                    destinatarioId: req.usuario.id,
                    actorId: seguidoId,
                    tipo: 'nuevo_amigo',
                    enlaceReferencia: `/perfil/${seguidoId}`,
                    claveEvento: crearClaveEvento('nuevo_amigo', par, req.usuario.id)
                }
            ]);
        }

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

        const formateado = lista
            .filter(s => s.seguidor)
            .map(s => ({
                id: s._id,
                idConexion: s.seguidor._id,
                nombre: s.seguidor.nombreUsuario,
                relacion: 'Seguidor',
                info: 'Te sigue',
                img: s.seguidor.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguidor.nombreUsuario)}&background=f1f5f9`
            }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener seguidores:', error);
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

        const formateado = lista
            .filter(s => s.seguido)
            .map(s => ({
                id: s._id,
                idConexion: s.seguido._id,
                nombre: s.seguido.nombreUsuario,
                relacion: 'Siguiendo',
                info: 'Lo sigues',
                img: s.seguido.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguido.nombreUsuario)}&background=e2e8f0`
            }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener seguidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener seguidos' });
    }
};

const obtenerAmigos = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        // 1. Buscar a quién sigo yo
        const siguiendo = await Seguidor.find({ seguidor: usuarioId }).select('seguido');

        const idsQueSigo = siguiendo.map(s => s.seguido);

        if (idsQueSigo.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Buscar cuáles de esas personas también me siguen a mí
        const amigos = await Seguidor.find({
            seguidor: { $in: idsQueSigo },
            seguido: usuarioId
        })
            .populate({
                path: 'seguidor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        // 3. Evitar duplicados por si en la BD hay relaciones repetidas
        const amigosUnicos = new Map();

        amigos.forEach(s => {
            if (s.seguidor) {
                amigosUnicos.set(String(s.seguidor._id), s);
            }
        });

        const formateado = Array.from(amigosUnicos.values()).map(s => ({
            id: s._id,
            idConexion: s.seguidor._id,
            nombre: s.seguidor.nombreUsuario,
            relacion: 'Amigo',
            info: 'Se siguen mutuamente',
            img: s.seguidor.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguidor.nombreUsuario)}&background=f1f5f9`
        }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener amigos:', error);
        res.status(500).json({ mensaje: 'Error al obtener amigos' });
    }
};

const dejarDeSeguirUsuario = async (req, res) => {
    try {
        const { seguidoId } = req.params;

        if (!seguidoId) {
            return res.status(400).json({ mensaje: 'Falta el ID del usuario' });
        }

        const relacionEliminada = await Seguidor.findOneAndDelete({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        if (!relacionEliminada) {
            return res.status(404).json({ mensaje: 'No sigues a este usuario' });
        }

        const par = [String(req.usuario.id), String(seguidoId)].sort().join('-');
        await Promise.allSettled([
            eliminarNotificacionPorClave(crearClaveEvento('nuevo_seguidor', req.usuario.id, seguidoId)),
            eliminarNotificaciones({
                claveEvento: {
                    $in: [
                        crearClaveEvento('nuevo_amigo', par, seguidoId),
                        crearClaveEvento('nuevo_amigo', par, req.usuario.id)
                    ]
                }
            })
        ]);

        res.status(200).json({ mensaje: 'Has dejado de seguir a este usuario' });
    } catch (error) {
        console.error('❌ Error al dejar de seguir usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    seguirUsuario,
    obtenerSeguidores,
    obtenerSiguiendo,
    obtenerAmigos,
    dejarDeSeguirUsuario
};