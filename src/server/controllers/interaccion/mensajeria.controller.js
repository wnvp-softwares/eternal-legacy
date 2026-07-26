const mongoose = require('mongoose');
const { Mensajeria, Usuario, Amigo, Familia, Seguidor } = require('../../models/index.model');

// Función auxiliar para verificar si dos usuarios están conectados (Amigos, Familia o Seguimiento Mutuo)
const sonContactosPermitidos = async (usuarioA, usuarioB) => {
    if (usuarioA === usuarioB) return false;

    // 1. Verificar Amigos Aceptados
    const esAmigo = await Amigo.findOne({
        $or: [
            { usuarioSolicitante: usuarioA, usuarioReceptor: usuarioB },
            { usuarioSolicitante: usuarioB, usuarioReceptor: usuarioA }
        ],
        estado: 'Aceptado'
    });
    if (esAmigo) return true;

    // 2. Verificar Familiares Aceptados
    const esFamilia = await Familia.findOne({
        $or: [
            { usuarioPrincipal: usuarioA, familiar: usuarioB },
            { usuarioPrincipal: usuarioB, familiar: usuarioA }
        ],
        estado: 'Aceptado'
    });
    if (esFamilia) return true;

    // 3. Verificar Seguimiento Mutuo
    const sigueA = await Seguidor.findOne({ seguidor: usuarioA, seguido: usuarioB });
    const sigueB = await Seguidor.findOne({ seguidor: usuarioB, seguido: usuarioA });
    if (sigueA && sigueB) return true;

    return false;
};

// 1. Obtener todos los contactos permitidos (Amigos, Familiares y Seguidores Mutuos)
const obtenerContactosPermitidos = async (req, res) => {
    try {
        const miId = req.usuario.id;

        // A, B, C. (Tu lógica exacta de IDs se mantiene igual...)
        const relacionesAmigos = await Amigo.find({
            $or: [{ usuarioSolicitante: miId }, { usuarioReceptor: miId }],
            estado: 'Aceptado'
        });
        const idsAmigos = relacionesAmigos.map(a =>
            a.usuarioSolicitante.toString() === miId ? a.usuarioReceptor.toString() : a.usuarioSolicitante.toString()
        );

        const relacionesFamilia = await Familia.find({
            $or: [{ usuarioPrincipal: miId }, { familiar: miId }],
            estado: 'Aceptado'
        });
        const idsFamilia = relacionesFamilia.map(f =>
            f.usuarioPrincipal.toString() === miId ? f.familiar.toString() : f.usuarioPrincipal.toString()
        );

        const siguiendo = await Seguidor.find({ seguidor: miId }).select('seguido');
        const idsQueSigo = siguiendo.map(s => s.seguido);
        const seguidoresMutuos = await Seguidor.find({ seguidor: { $in: idsQueSigo }, seguido: miId });
        const idsMutuos = seguidoresMutuos.map(s => s.seguidor.toString());

        const idsPermitidos = Array.from(new Set([...idsAmigos, ...idsFamilia, ...idsMutuos]));

        // E. Obtener perfiles de usuarios
        const contactos = await Usuario.find({ _id: { $in: idsPermitidos } })
            .select('nombreUsuario email publicKey imagenPerfil')
            .populate({ path: 'imagenPerfil', select: 'urlArchivo' });

        // Resume todas las conversaciones en una sola agregación. El texto permanece cifrado.
        const miObjectId = new mongoose.Types.ObjectId(String(miId));
        const idsPermitidosObjectId = idsPermitidos
            .filter(id => mongoose.Types.ObjectId.isValid(String(id)))
            .map(id => new mongoose.Types.ObjectId(String(id)));

        const resumenConversaciones = idsPermitidosObjectId.length > 0
            ? await Mensajeria.aggregate([
                {
                    $match: {
                        $or: [
                            { creador: miObjectId, receptor: { $in: idsPermitidosObjectId } },
                            { creador: { $in: idsPermitidosObjectId }, receptor: miObjectId }
                        ]
                    }
                },
                {
                    $addFields: {
                        contactoId: {
                            $cond: [
                                { $eq: ['$creador', miObjectId] },
                                '$receptor',
                                '$creador'
                            ]
                        }
                    }
                },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$contactoId',
                        ultimoMensaje: { $first: '$$ROOT' },
                        mensajesNoLeidos: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$receptor', miObjectId] },
                                            { $eq: ['$fechaVisto', null] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
            : [];

        const resumenPorContacto = new Map(
            resumenConversaciones.map(item => [String(item._id), item])
        );

        const contactosConEstado = contactos.map(contacto => {
            const contactoObj = contacto.toObject();
            const resumen = resumenPorContacto.get(String(contacto._id));
            const ultimo = resumen?.ultimoMensaje || null;

            contactoObj.mensajesNoLeidos = resumen?.mensajesNoLeidos || 0;
            contactoObj.ultimoMensaje = ultimo
                ? {
                    _id: ultimo._id,
                    creador: ultimo.creador,
                    receptor: ultimo.receptor,
                    contenidoCifrado: ultimo.contenidoCifrado,
                    iv: ultimo.iv,
                    claveCifradaReceptor: ultimo.claveCifradaReceptor,
                    claveCifradaCreador: ultimo.claveCifradaCreador,
                    fechaVisto: ultimo.fechaVisto,
                    createdAt: ultimo.createdAt
                }
                : null;

            return contactoObj;
        });

        contactosConEstado.sort((a, b) => {
            const fechaA = a.ultimoMensaje?.createdAt ? new Date(a.ultimoMensaje.createdAt).getTime() : 0;
            const fechaB = b.ultimoMensaje?.createdAt ? new Date(b.ultimoMensaje.createdAt).getTime() : 0;
            if (fechaA !== fechaB) return fechaB - fechaA;
            return String(a.nombreUsuario || '').localeCompare(String(b.nombreUsuario || ''), 'es');
        });

        res.status(200).json(contactosConEstado);
    } catch (error) {
        console.error('❌ Error al obtener contactos permitidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener contactos' });
    }
};

// 2. Obtener conversación cifrada
const obtenerConversacionConContacto = async (req, res) => {
    try {
        const { contactoId } = req.params;
        const miId = req.usuario.id;

        const esPermitido = await sonContactosPermitidos(miId, contactoId);
        if (!esPermitido) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver esta conversación.' });
        }

        const mensajes = await Mensajeria.find({
            $or: [
                { creador: miId, receptor: contactoId },
                { creador: contactoId, receptor: miId }
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json(mensajes);
    } catch (error) {
        console.error('❌ Error al obtener conversación:', error);
        res.status(500).json({ mensaje: 'Error al obtener la conversación' });
    }
};

// 3. Enviar mensaje cifrado
const enviarMensaje = async (req, res) => {
    try {
        const { receptorId, contenidoCifrado, iv, claveCifradaReceptor, claveCifradaCreador } = req.body;
        const miId = req.usuario.id;

        const esPermitido = await sonContactosPermitidos(miId, receptorId);
        if (!esPermitido) {
            return res.status(403).json({
                mensaje: 'Solo puedes enviar mensajes a tus amigos, familiares o seguidores mutuos.'
            });
        }

        const nuevoMensaje = new Mensajeria({
            creador: miId,
            receptor: receptorId,
            contenidoCifrado,
            iv,
            claveCifradaReceptor,
            claveCifradaCreador
        });

        await nuevoMensaje.save();
        res.status(201).json({ mensaje: 'Mensaje enviado con éxito', data: nuevoMensaje });
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        res.status(500).json({ mensaje: 'Error al enviar mensaje cifrado' });
    }
};

const marcarComoLeido = async (req, res) => {
    try {
        const { contactoId } = req.params;
        const miId = req.usuario.id;

        // Actualiza todos los mensajes que te envió ese contacto y que no has visto
        await Mensajeria.updateMany(
            { creador: contactoId, receptor: miId, fechaVisto: null },
            { $set: { fechaVisto: new Date() } }
        );

        res.status(200).json({ mensaje: 'Mensajes marcados como leídos con éxito.' });
    } catch (error) {
        console.error('❌ Error al marcar mensajes como leídos:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el estado de lectura' });
    }
};

module.exports = {
    obtenerContactosPermitidos,
    obtenerConversacionConContacto,
    enviarMensaje,
    marcarComoLeido
};