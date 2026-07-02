const mongoose = require('mongoose');

const hiloSchema = new mongoose.Schema({
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },

    nodoOrigen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo',
        required: true
    },

    nodoDestino: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo',
        required: true
    },

    tipoRelacion: {
        type: String,
        enum: ['padre_hijo', 'pareja', 'matrimonio', 'divorcio'],
        required: true
    },

    estado: {
        type: String,
        enum: ['Activa', 'Pendiente', 'Eliminada'],
        default: 'Activa'
    },

    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    fechaInicio: {
        type: Date,
        default: null
    },

    fechaFin: {
        type: Date,
        default: null
    },

    descripcion: {
        type: String,
        trim: true,
        default: ''
    }
}, { timestamps: true });

// Evita relaciones duplicadas exactamente iguales.
hiloSchema.index(
    { arbol: 1, nodoOrigen: 1, nodoDestino: 1, tipoRelacion: 1 },
    { unique: true }
);

// Evita que un nodo se relacione consigo mismo.
// También normaliza relaciones no direccionales para evitar A-B y B-A duplicados.
hiloSchema.pre('validate', function (next) {
    if (!this.nodoOrigen || !this.nodoDestino) return next();

    const origen = String(this.nodoOrigen);
    const destino = String(this.nodoDestino);

    if (origen === destino) {
        return next(new Error('Un nodo no puede relacionarse consigo mismo.'));
    }

    const relacionesNoDireccionales = ['pareja', 'matrimonio', 'divorcio'];

    if (relacionesNoDireccionales.includes(this.tipoRelacion)) {
        if (origen > destino) {
            const temp = this.nodoOrigen;
            this.nodoOrigen = this.nodoDestino;
            this.nodoDestino = temp;
        }
    }

    next();
});

module.exports = mongoose.model('Hilo', hiloSchema);