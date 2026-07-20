const mongoose = require('mongoose');

const mencionSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    nombre: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const etiquetaMultimediaSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    nombre: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const eventoRelacionadoSchema = new mongoose.Schema({
    evento: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EventoFamiliar',
        default: null
    },

    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        default: null
    },

    tituloSnapshot: {
        type: String,
        trim: true,
        default: ''
    },

    fechaInicioSnapshot: {
        type: Date,
        default: null
    },

    tipoEventoSnapshot: {
        type: String,
        trim: true,
        default: 'otro'
    },

    nombreFamiliaSnapshot: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const publicacionSchema = new mongoose.Schema({
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    tipo: {
        type: String,
        enum: ['historico', 'familiar'],
        default: 'historico'
    },

    privacidad: {
        type: String,
        enum: ['publico', 'familia'],
        default: 'publico'
    },

    arbolAudiencia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        default: null
    },

    nombreFamiliaAudienciaSnapshot: {
        type: String,
        trim: true,
        default: ''
    },

    contenido: {
        type: String,
        trim: true,
        default: ''
    },

    multimedia: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    }],

    ubicacionTexto: {
        type: String,
        trim: true,
        default: ''
    },

    menciones: [mencionSchema],

    etiquetasMultimedia: [etiquetaMultimediaSchema],

    eventoRelacionado: {
        type: eventoRelacionadoSchema,
        default: null
    },

    reacciones: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    }],

    compartido: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

publicacionSchema.pre('validate', function () {
    if (this.tipo === 'familiar') {
        this.privacidad = 'familia';
    }

    if (this.tipo === 'historico') {
        this.privacidad = 'publico';
        this.arbolAudiencia = null;
        this.nombreFamiliaAudienciaSnapshot = '';
    }
});

publicacionSchema.index({ autor: 1, createdAt: -1 });
publicacionSchema.index({ tipo: 1, createdAt: -1 });
publicacionSchema.index({ privacidad: 1, createdAt: -1 });
publicacionSchema.index({ arbolAudiencia: 1, createdAt: -1 });
publicacionSchema.index({ 'eventoRelacionado.evento': 1, createdAt: -1 });
publicacionSchema.index({ 'eventoRelacionado.arbol': 1, createdAt: -1 });

module.exports = mongoose.model('Publicacion', publicacionSchema);
