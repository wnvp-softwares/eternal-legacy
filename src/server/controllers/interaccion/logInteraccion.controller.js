const LogInteraccion = require('../../models/interaccion/logInteraccion.model');

exports.registrarEvento = async (req, res) => {
    try {
        const { seccion, accion, elementoId, metadata } = req.body;

        // Si tienes un middleware de autenticación, puedes extraer el id del usuario
        const usuarioId = req.usuario?.id || null;

        const nuevoLog = new LogInteraccion({
            usuarioId,
            seccion,
            accion,
            elementoId,
            metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata
        });

        await nuevoLog.save();
        return res.status(201).json({ ok: true });
    } catch (error) {
        // Fallar en silencio o loguear local para que un error de métricas no tumbe la app del usuario
        console.error('Error al guardar log de telemetría:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};