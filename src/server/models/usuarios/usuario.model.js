const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    nombreUsuario: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    contrasena: {
        type: String,
        required: true
    },
    imagenPerfil: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    },
    informacionPerfil: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InformacionPerfil'
    },
    arbolPertenencia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol'
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);