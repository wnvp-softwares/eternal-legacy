const mongoose = require('mongoose');

const mensajeriaSchema = new mongoose.Schema({
    creador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    receptor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    contenido: {
        type: String,
        required: true
    },
    fechaVisto: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Mensajeria', mensajeriaSchema);