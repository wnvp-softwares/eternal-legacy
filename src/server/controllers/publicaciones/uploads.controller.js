const { Upload } = require('../../models/index.model');

const subirArchivo = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                mensaje: 'Por favor, selecciona un archivo válido'
            });
        }

        const nuevoUpload = new Upload({
            propietario: req.usuario.id,
            urlArchivo: req.file.path,
            formato: req.file.mimetype,
            pesoBytes: req.file.size
        });

        await nuevoUpload.save();

        res.status(201).json({
            mensaje: '¡Archivo subido y guardado con éxito en la Base de Datos!',
            upload: nuevoUpload
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error interno al procesar el archivo'
        });
    }
};

module.exports = { subirArchivo };