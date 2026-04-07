const { Arbol } = require('../../models');

const obtenerMiArbol = async (req, res) => {
    try {
        const arbol = await Arbol.findOne({ usuario: req.usuario.id });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        
        res.status(200).json({ mensaje: 'Árbol recuperado', arbol });
    } catch (error) {
        console.error('❌ Error al obtener árbol:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { obtenerMiArbol };