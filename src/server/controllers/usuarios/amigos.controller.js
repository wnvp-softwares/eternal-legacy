const { Amigo } = require('../../models/index.model');

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

const obtenerMisAmigos = async (req, res) => {
    try {
        // Buscamos relaciones aceptadas donde el usuario sea solicitante o receptor
        const amigosRelacion = await Amigo.find({
            $or: [
                { usuarioSolicitante: req.usuario.id },
                { usuarioReceptor: req.usuario.id }
            ],
            estado: 'Aceptado'
        })
            .populate({
                path: 'usuarioSolicitante',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            })
            .populate({
                path: 'usuarioReceptor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        const lista = amigosRelacion.map(a => {
            // Identificar cuál de los dos extremos es el amigo y no el usuario logueado
            const esSolicitante = a.usuarioSolicitante._id.toString() === req.usuario.id;
            const amigo = esSolicitante ? a.usuarioReceptor : a.usuarioSolicitante;

            return {
                id: a._id,
                idConexion: amigo._id,
                nombre: amigo.nombreUsuario,
                relacion: 'Amigo',
                info: 'Conexión aceptada',
                img: amigo.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(amigo.nombreUsuario)}&background=bae6fd&color=0c4a6e`
            };
        });

        res.status(200).json(lista);
    } catch (error) {
        console.error('❌ Error al obtener amigos:', error);
        res.status(500).json({ mensaje: 'Error al cargar amigos' });
    }
};

module.exports = { enviarSolicitudAmistad, verMisSolicitudes, obtenerMisAmigos };