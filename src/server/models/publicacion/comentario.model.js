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
        required: true,
        trim: true
    },

    reacciones: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

comentarioSchema.index({ publicacionPadre: 1, createdAt: 1 });
comentarioSchema.index({ autor: 1, createdAt: -1 });

module.exports = mongoose.model('Comentario', comentarioSchema);