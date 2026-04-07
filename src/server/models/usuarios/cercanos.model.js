const mongoose = require('mongoose');

const cercanoSchema = new mongoose.Schema({
    usuarioPrincipal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    usuarioCercano: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Cercano', cercanoSchema);