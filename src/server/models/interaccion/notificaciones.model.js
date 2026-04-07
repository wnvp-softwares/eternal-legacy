const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema({
    usuarioDestino: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    usuarioOrigen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    tipoAccion: {
        type: String,
        required: true
    },
    descripcion: {
        type: String
    },
    fueLeida: {
        type: Boolean,
        default: false
    },
    enlaceReferencia: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Notificacion', notificacionSchema);