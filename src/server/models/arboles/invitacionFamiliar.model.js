const mongoose = require('mongoose');

const invitacionFamiliarSchema = new mongoose.Schema({
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },

    invitado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    invitadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    estado: {
        type: String,
        enum: ['Pendiente', 'Aceptada', 'Rechazada', 'Cancelada'],
        default: 'Pendiente'
    },

    datosNodoPropuesto: {
        nombre: {
            type: String,
            required: true
        },

        iniciales: {
            type: String,
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

        generacion: {
            type: Number,
            required: true
        },

        fila: {
            type: Number,
            required: true
        },

        tipo: {
            type: String,
            enum: ['creador', 'admin', 'normal'],
            default: 'normal'
        }
    },

    relacionPropuesta: {
        nodoRelacionado: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Nodo',
            default: null
        },

        tipoRelacion: {
            type: String,
            enum: ['padre_hijo', 'pareja', 'matrimonio', 'divorcio', 'ninguna'],
            default: 'ninguna'
        },

        rolDelInvitado: {
            type: String,
            enum: ['hijo', 'padre', 'pareja', 'conyuge', 'ninguno'],
            default: 'ninguno'
        }
    },

    mensaje: {
        type: String,
        default: ''
    },

    respondidaEn: {
        type: Date,
        default: null
    }
}, { timestamps: true });

invitacionFamiliarSchema.index(
    { arbol: 1, invitado: 1, estado: 1 },
    {
        unique: true,
        partialFilterExpression: { estado: 'Pendiente' }
    }
);

module.exports = mongoose.model('InvitacionFamiliar', invitacionFamiliarSchema);