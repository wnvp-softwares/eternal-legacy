const { Cercano } = require('../../models/index.model');

const agregarCercano = async (req, res) => {
    try {
        const { usuarioCercanoId } = req.body;
        const nuevoCercano = new Cercano({
            usuarioPrincipal: req.usuario.id,
            usuarioCercano: usuarioCercanoId
        });
        await nuevoCercano.save();
        res.status(201).json({ mensaje: 'Usuario agregado a tu lista de cercanos' });
    } catch (error) {
        console.error('❌ Error al agregar cercano:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { agregarCercano };