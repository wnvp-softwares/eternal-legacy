const mongoose = require('mongoose');

const hiloSchema = new mongoose.Schema({
    arbolPertenencia: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Arbol',
        required: true
    },
    nodoOrigen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo'
    }, 
    nodoDestino: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nodo',
        required: true
    },
    tipoRelacion: {
        type: String
    } 
}, { timestamps: true });

module.exports = mongoose.model('Hilo', hiloSchema);