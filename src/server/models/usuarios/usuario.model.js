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

    // Verificación inicial de cuenta por correo
    verificationCode: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },

    // Autenticación en dos pasos por correo
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorCode: {
        type: String,
        default: null
    },
    twoFactorCodeExpires: {
        type: Date,
        default: null
    },

    imagenPerfil: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    },
    imagenPortada: {
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
    },
    idioma: {
        type: String,
        default: 'es-MX'
    },
    zonaHoraria: {
        type: String,
        default: 'America/Mexico_City'
    },
    formatoFecha: {
        type: String,
        default: 'DD/MM/AAAA'
    },
    publicKey: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
