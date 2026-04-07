const mongoose = require('mongoose');

const familiaSchema = new mongoose.Schema({
    usuarioPrincipal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    familiar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    parentesco: {
        type: String,
        required: true
    } 
}, { timestamps: true });

module.exports = mongoose.model('Familia', familiaSchema);