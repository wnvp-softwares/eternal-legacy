const mongoose = require('mongoose');

const arbolSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    descripcion: {
        type: String
    },
    privacidad: {
        type: String,
        enum: ['Publico', 'Privado', 'Familia'],
        default: 'Privado'
    },
    accesos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    }] 
}, { timestamps: true });

module.exports = mongoose.model('Arbol', arbolSchema);