const { Publicacion, Upload } = require('../../models/index.model');

// CREAR PUBLICACIÓN CON ARCHIVO MULTIMEDIA REAL (RELACIONAL)
const crearPublicacion = async (req, res) => {
    try {
        const { tipo, contenido } = req.body || {};

        if (!contenido || contenido.trim() === '') {
            return res.status(400).json({ mensaje: 'El contenido no puede estar vacío.' });
        }

        const idsMultimedia = [];

        // Si Multer interceptó un archivo, creamos primero su documento en la colección Upload
        if (req.file) {
            // Creamos la URL pública relativa (ejemplo: /uploads/17189...-foto.jpg)
            const urlArchivo = `/uploads/${req.file.filename}`;

            const nuevoUpload = new Upload({
                propietario: req.usuario.id,
                urlArchivo: urlArchivo,
                formato: req.file.mimetype,
                pesoBytes: req.file.size
            });

            const uploadGuardado = await nuevoUpload.save();
            // Guardamos el ID del documento generado para relacionarlo
            idsMultimedia.push(uploadGuardado._id);
        }

        const nuevaPublicacion = new Publicacion({
            autor: req.usuario.id,
            tipo: tipo || 'historico',
            contenido: contenido,
            multimedia: idsMultimedia, // Guardamos el array de IDs de la colección Upload
            reacciones: [],
            compartido: 0
        });

        await nuevaPublicacion.save();

        // Traemos la publicación completa con los datos de su autor y los detalles del archivo multimedia
        const publicacionCompleta = await Publicacion.findById(nuevaPublicacion._id)
            .populate('autor', 'nombreUsuario')
            .populate('multimedia');

        res.status(201).json({
            mensaje: 'Publicación creada con éxito',
            publicacion: publicacionCompleta
        });
    } catch (error) {
        console.error('❌ Error al crear publicación:', error);
        res.status(500).json({ mensaje: 'Error interno al crear la publicación.' });
    }
};

// OBTENER LAS PUBLICACIONES DEL MURO (CON POPULATE COMPLETO)
const obtenerPublicaciones = async (req, res) => {
    try {
        const publicaciones = await Publicacion.find()
            .sort({ createdAt: -1 })
            .populate('autor', 'nombreUsuario')
            .populate('multimedia'); // Trae urlArchivo, formato, peso, etc.

        res.status(200).json(publicaciones);
    } catch (error) {
        console.error('❌ Error al obtener publicaciones:', error);
        res.status(500).json({ mensaje: 'Error al obtener las publicaciones del servidor.' });
    }
};

// REACCIONAR A UNA PUBLICACIÓN (LIKE)
const reaccionarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id;

        const publicacion = await Publicacion.findById(id);
        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada' });
        }

        // 💡 SOLUCIÓN: Si 'reacciones' no es un arreglo (es un número o undefined), lo inicializamos vacío en memoria
        if (!Array.isArray(publicacion.reacciones)) {
            publicacion.reacciones = [];
        }

        // Ahora .includes() nunca fallará
        const yaReacciono = publicacion.reacciones.includes(usuarioId);

        const operacion = yaReacciono
            ? { $pull: { reacciones: usuarioId } }
            : { $addToSet: { reacciones: usuarioId } };

        const publicacionActualizada = await Publicacion.findByIdAndUpdate(
            id,
            operacion,
            { returnDocument: 'after' }
        );

        res.status(200).json({
            mensaje: yaReacciono ? 'Reacción eliminada' : 'Reacción registrada',
            reacciones: publicacionActualizada.reacciones || []
        });
    } catch (error) {
        console.error('❌ Error al gestionar la reacción:', error);
        res.status(500).json({ mensaje: 'Error al procesar la reacción' });
    }
};

// No olvides exportarla al final de tu archivo junto con las otras:
module.exports = { crearPublicacion, obtenerPublicaciones, reaccionarPublicacion };