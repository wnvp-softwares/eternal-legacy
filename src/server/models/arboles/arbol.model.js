const mongoose = require('mongoose');

const arbolSchema = new mongoose.Schema({
    creador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },

    nombreFamilia: {
        type: String,
        required: true,
        trim: true,
        default: 'Mi Familia'
    },

    descripcion: {
        type: String,
        trim: true,
        default: ''
    },

    privacidad: {
        type: String,
        enum: ['Publico', 'Privado', 'Familia'],
        default: 'Privado'
    },

    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    }],

    miembros: [{
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true
        },
        rol: {
            type: String,
            enum: ['Creador', 'Admin', 'Miembro'],
            default: 'Miembro'
        },
        estado: {
            type: String,
            enum: ['Activo', 'Pendiente', 'Bloqueado'],
            default: 'Activo'
        },
        agregadoEn: {
            type: Date,
            default: Date.now
        }
    }],

    activo: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Un usuario solo puede crear un árbol.
arbolSchema.index({ creador: 1 }, { unique: true });

// Asegura que el creador siempre quede como admin y miembro del árbol.
arbolSchema.pre('validate', function () {
    if (!this.creador) return;

    const creadorId = String(this.creador);

    const yaEsAdmin = this.admins.some(adminId => String(adminId) === creadorId);

    if (!yaEsAdmin) {
        this.admins.push(this.creador);
    }

    const indiceMiembro = this.miembros.findIndex(
        miembro => String(miembro.usuario) === creadorId
    );

    if (indiceMiembro === -1) {
        this.miembros.push({
            usuario: this.creador,
            rol: 'Creador',
            estado: 'Activo'
        });
    } else {
        this.miembros[indiceMiembro].rol = 'Creador';
        this.miembros[indiceMiembro].estado = 'Activo';
    }
});

module.exports = mongoose.model('Arbol', arbolSchema);