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
    },
    // Handle exacto usado dentro del texto, sin el símbolo @.
    handle: {
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


const personaRelacionadaSchema = new mongoose.Schema({
    nodo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo',
        required: true
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    nombreSnapshot: {
        type: String,
        trim: true,
        required: true
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

    // Fecha en la que ocurrió el Recuerdo Histórico. createdAt conserva la fecha real de publicación.
    fechaRecuerdo: {
        type: Date,
        default: null
    },

    // Fecha en la que ocurrió el Momento Familiar. Si queda vacía se usa createdAt.
    fechaMomento: {
        type: Date,
        default: null
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

    // Nodos del árbol vinculados explícitamente con este Momento Familiar.
    personasRelacionadas: [personaRelacionadaSchema],

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
    },

    // Solo puede existir una publicación fijada por autor.
    fijadaEnPerfilAt: {
        type: Date,
        default: null
    },

    // Preferencia privada de cada usuario; nunca se expone la lista completa al cliente.
    guardadaPor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    }]
}, { timestamps: true });

publicacionSchema.pre('validate', function () {
    if (this.tipo === 'familiar') {
        this.privacidad = 'familia';
    }

    if (this.tipo === 'historico') {
        this.privacidad = 'publico';
        this.arbolAudiencia = null;
        this.nombreFamiliaAudienciaSnapshot = '';
        this.fechaMomento = null;
        this.personasRelacionadas = [];
    }

    if (this.tipo === 'familiar') {
        this.fechaRecuerdo = null;
    }
});

publicacionSchema.index({ autor: 1, createdAt: -1 });
publicacionSchema.index(
    { autor: 1 },
    {
        unique: true,
        partialFilterExpression: { fijadaEnPerfilAt: { $type: 'date' } },
        name: 'una_publicacion_fijada_por_autor'
    }
);
publicacionSchema.index({ guardadaPor: 1, createdAt: -1 });
publicacionSchema.index({ tipo: 1, createdAt: -1 });
publicacionSchema.index({ tipo: 1, fechaRecuerdo: -1, createdAt: -1 });
publicacionSchema.index({ privacidad: 1, createdAt: -1 });
publicacionSchema.index({ arbolAudiencia: 1, createdAt: -1 });
publicacionSchema.index({ 'eventoRelacionado.evento': 1, createdAt: -1 });
publicacionSchema.index({ 'eventoRelacionado.arbol': 1, createdAt: -1 });
publicacionSchema.index({ arbolAudiencia: 1, tipo: 1, fechaMomento: -1, createdAt: -1 });
publicacionSchema.index({ 'personasRelacionadas.nodo': 1, fechaMomento: -1, createdAt: -1 });

module.exports = mongoose.model('Publicacion', publicacionSchema);
