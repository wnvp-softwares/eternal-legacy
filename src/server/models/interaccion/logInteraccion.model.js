const mongoose = require('mongoose');

const LogInteraccionSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        default: null // null si es un usuario invitado o no logueado
    },
    seccion: {
        type: String,
        required: true // Ej: 'inicio', 'mensajes', 'arbol-genealogico', 'notificaciones'
    },
    accion: {
        type: String,
        required: true // Ej: 'click_menu', 'enviar_mensaje', 'abrir_perfil', 'crear_publicacion'
    },
    elementoId: {
        type: String,
        default: '' // Para identificar qué botón o componente específico tocaron
    },
    metadata: {
        type: String,
        default: '' // Información extra plana en formato string o JSON para minería flexible
    },
    fecha: {
        type: Date,
        default: Date.now
    }
}, { versionKey: false });

module.exports = mongoose.model('LogInteraccion', LogInteraccionSchema);