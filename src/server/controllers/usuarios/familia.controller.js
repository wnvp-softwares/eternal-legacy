const { Familia } = require('../../models/index.model');

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

const obtenerMisFamiliares = async (req, res) => {
    try {
        const familiares = await Familia.find({ usuarioPrincipal: req.usuario.id })
            .populate({
                path: 'familiar',
                select: 'nombreUsuario email imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        // Formateamos la respuesta para que la UI la procese fácil
        const lista = familiares.map(f => ({
            id: f._id,
            idConexion: f.familiar._id,
            nombre: f.familiar.nombreUsuario,
            relacion: f.parentesco,
            info: 'Miembro de la familia',
            img: f.familiar.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.familiar.nombreUsuario)}&background=cbd5e1`
        }));

        res.status(200).json(lista);
    } catch (error) {
        console.error('❌ Error al obtener familiares:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { agregarFamiliar, obtenerMisFamiliares };