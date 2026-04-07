const mongoose = require('mongoose');

const seguidorSchema = new mongoose.Schema({
    seguidor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    seguido: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Seguidor', seguidorSchema);