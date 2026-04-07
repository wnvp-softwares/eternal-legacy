const { Nodo, Usuario } = require('../../models');

const crearNodo = async (req, res) => {
    try {
        const { tipoDato, contenidoTexto } = req.body;

        const usuario = await Usuario.findById(req.usuario.id);

        if (!usuario || !usuario.arbolPertenencia) {
            return res.status(404).json({ mensaje: 'No se encontró el árbol del usuario.' });
        }

        const nuevoNodo = new Nodo({
            arbolPadre: usuario.arbolPertenencia,
            creador: req.usuario.id,
            tipoDato: tipoDato,
            contenidoTexto: contenidoTexto
            // Nota: "archivosAdjuntos" lo dejamos vacío por hoy hasta que implementemos la subida de imágenes.
        });

        await nuevoNodo.save();

        res.status(201).json({
            mensaje: `¡Nuevo nodo de tipo ${tipoDato} agregado a tu árbol con éxito!`,
            nodo: nuevoNodo
        });

    } catch (error) {
        console.error('❌ Error al crear nodo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerMisNodos = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        
        // Buscamos todos los nodos que pertenezcan a mi árbol
        // .sort({ createdAt: -1 }) los ordena del más nuevo al más viejo
        const nodos = await Nodo.find({ arbolPadre: usuario.arbolPertenencia }).sort({ createdAt: -1 });

        res.status(200).json({
            mensaje: 'Nodos recuperados con éxito',
            total: nodos.length,
            nodos: nodos
        });
    } catch (error) {
        console.error('❌ Error al obtener nodos:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    crearNodo,
    obtenerMisNodos
};