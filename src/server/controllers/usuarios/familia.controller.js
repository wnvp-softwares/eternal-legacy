const mongoose = require('mongoose');
const { Familia } = require('../../models/index.model');

// 1. ENVIAR INVITACIÓN AL ÁRBOL GENEALÓGICO
const enviarInvitacionFamiliar = async (req, res) => {
    try {
        const { familiarId, parentesco } = req.body;

        // Verificar si ya existe una invitación o relación para no duplicar
        const existeRelacion = await Familia.findOne({
            usuarioPrincipal: req.usuario.id,
            familiar: familiarId
        });

        if (existeRelacion) {
            return res.status(400).json({ mensaje: 'Ya existe una relación o invitación pendiente con este usuario.' });
        }

        const nuevaRelacion = new Familia({
            usuarioPrincipal: req.usuario.id,
            familiar: familiarId,
            parentesco,
            estado: 'Pendiente' // Entra en estado de invitación
        });
        await nuevaRelacion.save();
        res.status(201).json({ mensaje: 'Invitación familiar enviada con éxito' });
    } catch (error) {
        console.error('❌ Error al invitar familiar:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// 2. ACEPTAR O RECHAZAR LA INVITACIÓN
const responderInvitacionFamiliar = async (req, res) => {
    try {
        const { idInvitacion } = req.params;
        const { respuesta } = req.body; // Debe ser 'Aceptado' o 'Rechazado'

        if (!['Aceptado', 'Rechazado'].includes(respuesta)) {
            return res.status(400).json({ mensaje: 'Respuesta no válida' });
        }

        const invitacion = await Familia.findByIdAndUpdate(
            idInvitacion,
            { estado: respuesta },
            { new: true }
        );

        if (!invitacion) return res.status(404).json({ mensaje: 'Invitación no encontrada' });

        res.status(200).json({ mensaje: `Invitación familiar ${respuesta.toLowerCase()}`, invitacion });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al responder la invitación' });
    }
};

// 3. OBTENER EL ÁRBOL (Solo los Aceptados)
const obtenerMisFamiliares = async (req, res) => {
    try {
        // Buscamos donde yo invité O me invitaron, PERO que ya esté aceptado
        const familiares = await Familia.find({
            $or: [
                { usuarioPrincipal: req.usuario.id },
                { familiar: req.usuario.id }
            ],
            estado: 'Aceptado'
        })
            .populate({
                path: 'familiar',
                select: 'nombreUsuario email imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            })
            .populate({
                path: 'usuarioPrincipal',
                select: 'nombreUsuario email imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        // Formateamos para el frontend
        const lista = familiares.map(f => {
            const esPrincipal = f.usuarioPrincipal._id.toString() === req.usuario.id;
            const pariente = esPrincipal ? f.familiar : f.usuarioPrincipal;

            return {
                id: f._id,
                idConexion: pariente._id,
                nombre: pariente.nombreUsuario,
                relacion: f.parentesco,
                info: 'Miembro de la familia',
                img: pariente.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(pariente.nombreUsuario)}&background=cbd5e1`
            };
        });

        res.status(200).json(lista);
    } catch (error) {
        console.error('❌ Error al obtener familiares:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// 4. OBTENER INVITACIONES RECIBIDAS PENDIENTES
const obtenerInvitacionesPendientes = async (req, res) => {
    try {
        // Buscamos donde yo soy el destinatario y está pendiente
        const invitaciones = await Familia.find({
            familiar: req.usuario.id,
            estado: 'Pendiente'
        })
            .populate({
                path: 'usuarioPrincipal',
                select: 'nombreUsuario email imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        // Formateamos los datos para consumirlos de forma limpia en React
        const lista = invitaciones.map(inv => ({
            idInvitacion: inv._id,
            idSender: inv.usuarioPrincipal._id,
            nombre: inv.usuarioPrincipal.nombreUsuario,
            relacion: inv.parentesco,
            img: inv.usuarioPrincipal.imagenPerfil?.urlArchivo
                ? `http://localhost:3000${inv.usuarioPrincipal.imagenPerfil.urlArchivo}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.usuarioPrincipal.nombreUsuario)}&background=cbd5e1`
        }));

        res.status(200).json(lista);
    } catch (error) {
        console.error('❌ Error al obtener invitaciones pendientes:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};


// 5. ELIMINAR UNA RELACIÓN FAMILIAR DE MI RED
const eliminarRelacionFamiliar = async (req, res) => {
    try {
        const { relacionId } = req.params;
        const usuarioId = String(req.usuario.id || req.usuario._id || '');

        if (!relacionId || !mongoose.Types.ObjectId.isValid(String(relacionId))) {
            return res.status(400).json({ mensaje: 'El ID de la relación familiar no es válido.' });
        }

        const relacion = await Familia.findById(relacionId);

        if (!relacion) {
            return res.status(404).json({ mensaje: 'La relación familiar no existe o ya fue eliminada.' });
        }

        const esParticipante =
            String(relacion.usuarioPrincipal) === usuarioId ||
            String(relacion.familiar) === usuarioId;

        if (!esParticipante) {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar esta relación familiar.' });
        }

        await relacion.deleteOne();

        return res.status(200).json({
            mensaje: 'La relación familiar fue eliminada de Mi Red.',
            relacionId: relacion._id
        });
    } catch (error) {
        console.error('❌ Error al eliminar relación familiar:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor al eliminar la relación familiar.' });
    }
};

// 🌟 REPLANTEA EL EXPORTS PARA INCLUIR LA NUEVA FUNCIÓN
module.exports = {
    enviarInvitacionFamiliar,
    responderInvitacionFamiliar,
    obtenerMisFamiliares,
    obtenerInvitacionesPendientes,
    eliminarRelacionFamiliar
};