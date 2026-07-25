const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    propietario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    urlArchivo: {
        type: String,
        required: true
    },
    formato: {
        type: String,
        required: true
    },
    pesoBytes: {
        type: Number,
        default: 0
    },

    // Identificador persistente del recurso dentro de Cloudinary.
    // Es opcional para conservar compatibilidad con archivos antiguos.
    publicId: {
        type: String,
        trim: true,
        default: ''
    },

    resourceType: {
        type: String,
        enum: ['image', 'video', 'raw'],
        default: 'image'
    }
}, { timestamps: true });

uploadSchema.index({ propietario: 1, createdAt: -1 });
uploadSchema.index({ publicId: 1 }, { sparse: true });

module.exports = mongoose.model('Upload', uploadSchema);
