const { Upload } = require('../../models');

const subirArchivo = async (req, res) => {
    try {
        // req.file existe mágicamente aquí gracias al middleware de Multer
        if (!req.file) {
            return res.status(400).json({ mensaje: 'Por favor, selecciona un archivo válido' });
        }

        // Creamos el registro en la Base de Datos
        const nuevoUpload = new Upload({
            propietario: req.usuario.id, // Sabemos quién lo sube gracias al Token
            urlArchivo: `/uploads/${req.file.filename}`, // Esta será la URL pública para ver la foto
            formato: req.file.mimetype,
            pesoBytes: req.file.size
        });

        await nuevoUpload.save();

        res.status(201).json({
            mensaje: '¡Archivo subido y guardado con éxito en la Base de Datos!',
            upload: nuevoUpload
        });

    } catch (error) {
        console.error('❌ Error al subir archivo:', error);
        res.status(500).json({ mensaje: 'Error interno al procesar el archivo' });
    }
};

module.exports = { subirArchivo };