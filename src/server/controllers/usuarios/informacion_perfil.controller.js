const { Usuario, InformacionPerfil } = require('../../models/index.model');

// 1. Ver mi propio perfil
const obtenerMiPerfil = async (req, res) => {
    try {
        // req.usuario.id viene de nuestro cadenero (el token)
        // Usamos .populate() que es la magia de Mongoose para traer los datos del perfil
        // en lugar de traernos solo el ID.
        const usuario = await Usuario.findById(req.usuario.id).populate('informacionPerfil');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.status(200).json({
            mensaje: 'Perfil recuperado con éxito',
            perfil: usuario.informacionPerfil
        });
    } catch (error) {
        console.error('❌ Error al obtener perfil:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

// 2. Editar mi propio perfil
const actualizarMiPerfil = async (req, res) => {
    try {
        // Buscamos al usuario para saber cuál es el ID de su perfil
        const usuario = await Usuario.findById(req.usuario.id);

        // Extraemos los datos que el usuario quiere actualizar desde el Body (Postman/Flutter)
        const { biografia, genero, ubicacionActual, ocupacionEducacion } = req.body;

        // Actualizamos el documento en la colección de InformacionPerfil
        // { new: true } le dice a Mongoose que nos devuelva el perfil ya actualizado
        const perfilActualizado = await InformacionPerfil.findByIdAndUpdate(
            usuario.informacionPerfil,
            { biografia, genero, ubicacionActual, ocupacionEducacion },
            { new: true }
        );

        res.status(200).json({
            mensaje: '¡Perfil actualizado con éxito!',
            perfil: perfilActualizado
        });

    } catch (error) {
        console.error('❌ Error al actualizar perfil:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerMiPerfil,
    actualizarMiPerfil
};