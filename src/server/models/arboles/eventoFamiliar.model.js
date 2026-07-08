const mongoose = require('mongoose');

const eventoFamiliarSchema = new mongoose.Schema({
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },

    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    titulo: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },

    descripcion: {
        type: String,
        trim: true,
        default: '',
        maxlength: 1000
    },

    tipoEvento: {
        type: String,
        enum: [
            'reunion',
            'cumpleanos',
            'aniversario',
            'boda',
            'misa',
            'recordatorio',
            'otro'
        ],
        default: 'otro'
    },

    fechaInicio: {
        type: Date,
        required: true
    },

    fechaFin: {
        type: Date,
        default: null
    },

    todoElDia: {
        type: Boolean,
        default: false
    },

    zonaHoraria: {
        type: String,
        trim: true,
        default: 'America/Mexico_City'
    },

    ubicacion: {
        texto: {
            type: String,
            trim: true,
            default: ''
        },

        direccion: {
            type: String,
            trim: true,
            default: ''
        },

        referencia: {
            type: String,
            trim: true,
            default: ''
        },

        lat: {
            type: Number,
            default: null
        },

        lng: {
            type: Number,
            default: null
        },

        proveedor: {
            type: String,
            enum: ['manual', 'ors', 'google', 'ninguno'],
            default: 'manual'
        },

        placeId: {
            type: String,
            trim: true,
            default: ''
        }
    },

    nodosRelacionados: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo'
    }],

    invitados: [{
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },

        estado: {
            type: String,
            enum: ['Pendiente', 'Aceptado', 'Rechazado'],
            default: 'Pendiente'
        },

        respondidoEn: {
            type: Date,
            default: null
        }
    }],

    recordatorio: {
        activo: {
            type: Boolean,
            default: true
        },

        minutosAntes: {
            type: Number,
            default: 1440
        }
    },

    privacidad: {
        type: String,
        enum: ['Arbol', 'Admins'],
        default: 'Arbol'
    },

    estado: {
        type: String,
        enum: ['Activo', 'Cancelado', 'Eliminado'],
        default: 'Activo'
    }
}, { timestamps: true });

eventoFamiliarSchema.index({ arbol: 1, fechaInicio: 1 });
eventoFamiliarSchema.index({ creadoPor: 1, fechaInicio: 1 });
eventoFamiliarSchema.index({ arbol: 1, estado: 1 });

eventoFamiliarSchema.pre('validate', function () {
    if (this.titulo) {
        this.titulo = this.titulo.trim();
    }

    if (this.descripcion) {
        this.descripcion = this.descripcion.trim();
    }

    if (this.ubicacion?.texto) {
        this.ubicacion.texto = this.ubicacion.texto.trim();
    }

    if (this.ubicacion?.direccion) {
        this.ubicacion.direccion = this.ubicacion.direccion.trim();
    }

    if (this.fechaInicio && this.fechaFin) {
        const inicio = new Date(this.fechaInicio).getTime();
        const fin = new Date(this.fechaFin).getTime();

        if (fin < inicio) {
            throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
        }
    }
});

module.exports = mongoose.model('EventoFamiliar', eventoFamiliarSchema);