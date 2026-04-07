const mongoose = require('mongoose');

const publicacionSchema = new mongoose.Schema({
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario', required: true
    },
    tipo: {
        type: String
    }, 
    contenido: {
        type: String
    },
    multimedia: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    }],
    reacciones: {
        type: Number,
        default: 0
    },
    compartido: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Publicacion', publicacionSchema);