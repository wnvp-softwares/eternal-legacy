const mongoose = require('mongoose');

const amigoSchema = new mongoose.Schema({
    usuarioSolicitante: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    usuarioReceptor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Aceptado', 'Rechazado'],
        default: 'Pendiente'
    }
}, { timestamps: true });

module.exports = mongoose.model('Amigo', amigoSchema);