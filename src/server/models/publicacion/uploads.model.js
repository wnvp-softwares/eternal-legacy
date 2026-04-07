const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    propietario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    urlArchivo: {
        type: String,
        required: true
    },
    formato: {
        type: String,
        required: true
    },
    pesoBytes: {
        type: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);