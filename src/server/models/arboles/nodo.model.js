const mongoose = require('mongoose');

const nodoSchema = new mongoose.Schema({
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },

    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },

    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    nombre: {
        type: String,
        required: true,
        trim: true
    },

    iniciales: {
        type: String,
        trim: true,
        uppercase: true,
        default: 'NA'
    },

    colorFondo: {
        type: String,
        default: '#e2e8f0'
    },

    colorTexto: {
        type: String,
        default: '#0f172a'
    },

    fechaNacimiento: {
        type: Date,
        default: null
    },

    fechaFallecimiento: {
        type: Date,
        default: null
    },

    fechaCorta: {
        type: String,
        trim: true,
        default: 'Pendiente'
    },

    estaFallecido: {
        type: Boolean,
        default: false
    },

    edad: {
        type: Number,
        default: null
    },

    tipo: {
        type: String,
        enum: ['creador', 'admin', 'normal'],
        default: 'normal'
    },

    estado: {
        type: String,
        enum: ['Verificado', 'Pendiente', 'Incompleto'],
        default: 'Pendiente'
    },

    origen: {
        type: String,
        enum: ['usuario_real', 'perfil_sin_cuenta'],
        default: 'perfil_sin_cuenta'
    },

    generacion: {
        type: Number,
        required: true
    },

    fila: {
        type: Number,
        required: true
    },

    fotos: [{
        type: String
    }],

    biografia: {
        type: String,
        trim: true,
        default: ''
    },

    perfilPrivado: {
        type: Boolean,
        default: false
    },

    visible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Permite consultar rápido los nodos por árbol, generación y fila.
nodoSchema.index({ arbol: 1, generacion: 1, fila: 1 });

// Evita que un usuario real se agregue dos veces al mismo árbol.
// No afecta perfiles sin cuenta porque usuario = null.
nodoSchema.index(
    { arbol: 1, usuario: 1 },
    {
        unique: true,
        partialFilterExpression: {
            usuario: { $type: 'objectId' }
        }
    }
);

module.exports = mongoose.model('Nodo', nodoSchema);