const mongoose = require('mongoose');

const informacionPerfilSchema = new mongoose.Schema({
    privacidadPerfil: {
        type: String,
        enum: ['publico', 'privado'],
        default: 'publico',
        index: true
    },

    biografia: {
        type: String,
        default: ''
    },

    fechaNacimiento: {
        type: Date,
        default: null
    },

    genero: {
        type: String,
        default: ''
    },

    lugarNacimiento: {
        type: String,
        default: ''
    },

    ubicacionActual: {
        type: String,
        default: ''
    },

    ocupacionEducacion: {
        type: String,
        default: ''
    },

    intereses: [{
        type: String
    }],

    seguidores: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seguidor'
    }],

    seguidos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    }],

    amigos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Amigo'
    }],

    familia: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Familia'
    }]
}, { timestamps: true });

module.exports = mongoose.model('InformacionPerfil', informacionPerfilSchema);