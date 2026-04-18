const { Notificacion } = require('../../models/index.model');

// Función interna para crear notificaciones (no se suele llamar desde una ruta directa, pero la hacemos para pruebas)
const crearNotificacionInterna = async (req, res) => {
    try {
        const { usuarioDestinoId, tipoAccion, descripcion } = req.body;
        const nuevaNotificacion = new Notificacion({
            usuarioDestino: usuarioDestinoId,
            usuarioOrigen: req.usuario.id, // Viene del token
            tipoAccion,
            descripcion
        });
        await nuevaNotificacion.save();
        res.status(201).json({ mensaje: 'Notificación creada', data: nuevaNotificacion });
    } catch (error) {
        console.error('❌ Error al crear notificación:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// Obtener mis propias notificaciones
const obtenerMisNotificaciones = async (req, res) => {
    try {
        const notificaciones = await Notificacion.find({ usuarioDestino: req.usuario.id })
            .sort({ createdAt: -1 })
            .populate('usuarioOrigen', 'nombreUsuario'); // Para ver quién generó la acción

        res.status(200).json(notificaciones);
    } catch (error) {
        console.error('❌ Error al obtener notificaciones:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { crearNotificacionInterna, obtenerMisNotificaciones };