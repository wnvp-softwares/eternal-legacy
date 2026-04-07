const mongoose = require('mongoose');

const nodoSchema = new mongoose.Schema({
    arbolPadre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },
    creador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    tipoDato: {
        type: String,
        enum: ['Foto', 'Biografia', 'Recuerdo', 'Video'],
        required: true
    },
    contenidoTexto: {
        type: String
    },
    archivosAdjuntos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    }],
    reacciones: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Nodo', nodoSchema);