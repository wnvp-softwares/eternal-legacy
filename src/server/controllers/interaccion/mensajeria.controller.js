const { Mensajeria } = require('../../models/index.model');

const enviarMensaje = async (req, res) => {
    try {
        const { receptorId, contenido } = req.body;
        const nuevoMensaje = new Mensajeria({
            creador: req.usuario.id,
            receptor: receptorId,
            contenido: contenido
        });
        await nuevoMensaje.save();
        res.status(201).json({ mensaje: 'Mensaje enviado', data: nuevoMensaje });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al enviar mensaje' });
    }
};

const obtenerMisMensajes = async (req, res) => {
    try {
        // Busca mensajes donde yo sea el creador o el receptor
        const mensajes = await Mensajeria.find({
            $or: [{ creador: req.usuario.id }, { receptor: req.usuario.id }]
        }).sort({ createdAt: 1 }); // Orden cronológico (más viejos primero)
        res.status(200).json(mensajes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener mensajes' });
    }
};

module.exports = { enviarMensaje, obtenerMisMensajes };