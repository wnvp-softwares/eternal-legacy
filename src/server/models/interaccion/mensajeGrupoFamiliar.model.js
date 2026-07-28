const mongoose = require('mongoose');

const claveCifradaMiembroSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    claveCifrada: {
        type: String,
        required: true
    }
}, { _id: false });

const lecturaMensajeGrupoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const mensajeGrupoFamiliarSchema = new mongoose.Schema({
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true,
        index: true
    },
    emisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    contenidoCifrado: {
        type: String,
        required: true
    },
    iv: {
        type: String,
        required: true
    },
    clavesCifradas: {
        type: [claveCifradaMiembroSchema],
        default: []
    },
    leidoPor: {
        type: [lecturaMensajeGrupoSchema],
        default: []
    }
}, { timestamps: true });

mensajeGrupoFamiliarSchema.index({ arbol: 1, createdAt: 1 });
mensajeGrupoFamiliarSchema.index({ arbol: 1, emisor: 1, createdAt: -1 });
mensajeGrupoFamiliarSchema.index({ 'clavesCifradas.usuario': 1 });
mensajeGrupoFamiliarSchema.index({ 'leidoPor.usuario': 1 });

module.exports = mongoose.model('MensajeGrupoFamiliar', mensajeGrupoFamiliarSchema);
