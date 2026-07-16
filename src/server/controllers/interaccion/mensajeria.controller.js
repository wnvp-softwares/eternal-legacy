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

        // A. IDs de Amigos Aceptados
        const relacionesAmigos = await Amigo.find({
            $or: [{ usuarioSolicitante: miId }, { usuarioReceptor: miId }],
            estado: 'Aceptado'
        });
        const idsAmigos = relacionesAmigos.map(a => 
            a.usuarioSolicitante.toString() === miId ? a.usuarioReceptor.toString() : a.usuarioSolicitante.toString()
        );

        // B. IDs de Familiares Aceptados
        const relacionesFamilia = await Familia.find({
            $or: [{ usuarioPrincipal: miId }, { familiar: miId }],
            estado: 'Aceptado'
        });
        const idsFamilia = relacionesFamilia.map(f => 
            f.usuarioPrincipal.toString() === miId ? f.familiar.toString() : f.usuarioPrincipal.toString()
        );

        // C. IDs de Seguimiento Mutuo
        const siguiendo = await Seguidor.find({ seguidor: miId }).select('seguido');
        const idsQueSigo = siguiendo.map(s => s.seguido);
        
        const seguidoresMutuos = await Seguidor.find({
            seguidor: { $in: idsQueSigo },
            seguido: miId
        });
        const idsMutuos = seguidoresMutuos.map(s => s.seguidor.toString());

        // D. Unir todos los IDs únicos
        const idsPermitidos = Array.from(new Set([...idsAmigos, ...idsFamilia, ...idsMutuos]));

        // E. Obtener perfiles de usuarios
        const contactos = await Usuario.find({ _id: { $in: idsPermitidos } })
            .select('nombreUsuario email publicKey imagenPerfil')
            .populate({ path: 'imagenPerfil', select: 'urlArchivo' });

        res.status(200).json(contactos);
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

module.exports = {
    obtenerContactosPermitidos,
    obtenerConversacionConContacto,
    enviarMensaje
};