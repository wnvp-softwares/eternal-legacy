const mongoose = require('mongoose');

const informacionPerfilSchema = new mongoose.Schema({
    biografia: {
        type: String
    },
    genero: {
        type: String
    },
    lugarNacimiento: {
        type: String
    },
    ubicacionActual: {
        type: String
    },
    ocupacionEducacion: {
        type: String
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