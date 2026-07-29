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

const indicadoresVistosSchema = new mongoose.Schema({
    seguidores: {
        type: Date,
        default: null
    },
    amigos: {
        type: Date,
        default: null
    }
}, { _id: false });

const usuarioSchema = new mongoose.Schema({
    nombreUsuario: {
        type: String,
        required: true,
        trim: true
    },
    nickname: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres.'],
        maxlength: [30, 'El nombre de usuario no puede superar los 30 caracteres.'],
        match: [/^[a-z0-9_.-]+$/, 'El nombre de usuario contiene caracteres no permitidos.']
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

    // Recuperación segura de contraseña por correo.
    passwordResetCodeHash: {
        type: String,
        default: null
    },
    passwordResetCodeExpires: {
        type: Date,
        default: null
    },
    passwordResetAttempts: {
        type: Number,
        default: 0,
        min: 0
    },
    passwordResetLastSentAt: {
        type: Date,
        default: null
    },
    passwordResetTokenHash: {
        type: String,
        default: null
    },
    passwordResetTokenExpires: {
        type: Date,
        default: null
    },

    // Permite invalidar sesiones previas cuando se recupera la contraseña.
    sessionVersion: {
        type: Number,
        default: 0,
        min: 0
    },

    // Distinción pública otorgada a quienes se registran durante la etapa Beta.
    esBetaTester: {
        type: Boolean,
        default: false
    },
    betaTesterDesde: {
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
    },

    // Fechas privadas usadas para calcular novedades de Red entre dispositivos.
    indicadoresVistos: {
        type: indicadoresVistosSchema,
        default: () => ({
            seguidores: null,
            amigos: null
        })
    },

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
