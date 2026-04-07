const { Familia } = require('../../models');

const agregarFamiliar = async (req, res) => {
    try {
        const { familiarId, parentesco } = req.body;
        const nuevaRelacion = new Familia({
            usuarioPrincipal: req.usuario.id,
            familiar: familiarId,
            parentesco
        });
        await nuevaRelacion.save();
        res.status(201).json({ mensaje: 'Familiar agregado con éxito' });
    } catch (error) {
        console.error('❌ Error al agregar familiar:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { agregarFamiliar };