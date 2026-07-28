const mongoose = require('mongoose');

const TIPOS_NOTIFICACION = [
    'nuevo_seguidor',
    'nuevo_amigo',
    'solicitud_familiar_recibida',
    'solicitud_familiar_aceptada',
    'mencion_publicacion',
    'comentario_publicacion',
    'reaccion_publicacion',
    'guardado_publicacion',
    'compartido_publicacion',
    'invitacion_arbol',
    'mensaje_directo',
    'mensaje_grupo'
];

const notificacionSchema = new mongoose.Schema({
    usuarioDestino: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    usuarioOrigen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null
    },
    tipoAccion: {
        type: String,
        enum: TIPOS_NOTIFICACION,
        required: true,
        index: true
    },
    categoria: {
        type: String,
        enum: ['red', 'familia', 'publicaciones', 'arbol', 'mensajes'],
        default: 'publicaciones'
    },
    descripcion: {
        type: String,
        trim: true,
        default: ''
    },
    fueLeida: {
        type: Boolean,
        default: false,
        index: true
    },
    leidaEn: {
        type: Date,
        default: null
    },
    enlaceReferencia: {
        type: String,
        trim: true,
        default: ''
    },
    publicacion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publicacion',
        default: null
    },
    comentario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comentario',
        default: null
    },
    arbol: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        default: null
    },
    solicitud: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    conversacionId: {
        type: String,
        trim: true,
        default: ''
    },
    tipoConversacion: {
        type: String,
        enum: ['', 'directo', 'grupo-familiar'],
        default: ''
    },
    claveEvento: {
        type: String,
        trim: true,
        default: ''
    }
}, { timestamps: true });

notificacionSchema.index(
    { claveEvento: 1 },
    {
        unique: true,
        partialFilterExpression: { claveEvento: { $type: 'string', $gt: '' } },
        name: 'notificacion_evento_unico'
    }
);
notificacionSchema.index({ usuarioDestino: 1, fueLeida: 1, createdAt: -1 });
notificacionSchema.index({ usuarioDestino: 1, createdAt: -1 });
notificacionSchema.index({ publicacion: 1, tipoAccion: 1 });
notificacionSchema.index({ conversacionId: 1, tipoAccion: 1, fueLeida: 1 });

const Notificacion = mongoose.model('Notificacion', notificacionSchema);
Notificacion.TIPOS = TIPOS_NOTIFICACION;

module.exports = Notificacion;
