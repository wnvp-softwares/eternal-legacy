const { Amigo } = require('../../models');

const enviarSolicitudAmistad = async (req, res) => {
    try {
        const { receptorId } = req.body;
        const nuevaSolicitud = new Amigo({
            usuarioSolicitante: req.usuario.id,
            usuarioReceptor: receptorId
        });
        await nuevaSolicitud.save();
        res.status(201).json({ mensaje: 'Solicitud enviada con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al enviar solicitud' });
    }
};

const verMisSolicitudes = async (req, res) => {
    try {
        // Busca las solicitudes donde yo soy el receptor y están pendientes
        const solicitudes = await Amigo.find({
            usuarioReceptor: req.usuario.id,
            estado: 'Pendiente'
        }).populate('usuarioSolicitante', 'nombreUsuario');
        res.status(200).json(solicitudes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar solicitudes' });
    }
};

module.exports = { enviarSolicitudAmistad, verMisSolicitudes };