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
    // --- CAMPOS NUEVOS PARA VERIFICACIÓN ---
    verificationCode: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    twoFactorEnabled: { // 👈 Nuevo campo para el estado del 2FA
        type: Boolean,
        default: false
    },
    // ---------------------------------------
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
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);