const mongoose = require('mongoose');

const comentarioSchema = new mongoose.Schema({
    publicacionPadre: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publicacion',
        required: true
    },
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    texto: {
        type: String,
        required: true
    },
    reacciones: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Comentario', comentarioSchema);