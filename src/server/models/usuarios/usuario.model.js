const mongoose = require('mongoose');


const autorPausadoFeedSchema = new mongoose.Schema({
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    hasta: {
        type: Date,
        required: true
    }
}, { _id: false });

const preferenciasFeedSchema = new mongoose.Schema({
    publicacionesOcultas: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publicacion'
    }],
    autoresPausados: {
        type: [autorPausadoFeedSchema],
        default: []
    }
}, { _id: false });

const usuarioSchema = new mongoose.Schema({
    nombreUsuario: {
        type: String,
        required: true,
        unique: true
    },
    nickname: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
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
    },

    // Respaldo cifrado de la llave privada E2E para usar la misma cuenta en varios dispositivos.
    // La llave privada NO se guarda en texto plano; llega cifrada desde el navegador.
    encryptedPrivateKey: {
        type: String,
        default: null
    },
    e2eSalt: {
        type: String,
        default: null
    },
    e2eIv: {
        type: String,
        default: null
    },
    e2eConfigUpdatedAt: {
        type: Date,
        default: null
    }
,

    // Preferencias privadas que solo afectan el contenido mostrado en Inicio.
    preferenciasFeed: {
        type: preferenciasFeedSchema,
        default: () => ({
            publicacionesOcultas: [],
            autoresPausados: []
        })
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);
