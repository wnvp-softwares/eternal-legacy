const { Upload } = require("../../models/index.model");

const subirArchivo = async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({
                mensaje: "Selecciona un archivo."
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

            mensaje: "Archivo subido correctamente.",

            upload: nuevoUpload

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            mensaje: "Error interno."

        });

    }

};

module.exports = {
    subirArchivo
};