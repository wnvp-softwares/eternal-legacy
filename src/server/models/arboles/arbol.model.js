const mongoose = require('mongoose');

const LIMITE_ADMINS_ARBOL = 5;

const obtenerIdSeguro = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    if (valor._id) return String(valor._id);
    if (valor.id) return String(valor.id);
    return String(valor);
};

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
        enum: ['Publico', 'Privado', 'Familia', 'Conexiones'], // 👈 Añadimos 'Conexiones' al enum
        default: 'Familia' // Puedes cambiar el default si lo deseas
    },

    // Admins adicionales del árbol. El creador NO cuenta dentro de este arreglo.
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

// Mantiene roles consistentes:
// - El creador siempre aparece como miembro activo con rol Creador.
// - El creador nunca ocupa espacio dentro de admins.
// - admins solo guarda admins extra, únicos y máximo 5.
arbolSchema.pre('validate', function () {
    if (!this.creador) return;

    const creadorId = obtenerIdSeguro(this.creador);

    const adminsUnicos = [];
    const idsAdmins = new Set();

    (this.admins || []).forEach((adminId) => {
        const id = obtenerIdSeguro(adminId);
        if (!id) return;
        if (creadorId && id === creadorId) return;
        if (idsAdmins.has(id)) return;

        idsAdmins.add(id);
        adminsUnicos.push(adminId);
    });

    this.admins = adminsUnicos;

    if (this.admins.length > LIMITE_ADMINS_ARBOL) {
        this.invalidate('admins', `Un árbol solo puede tener hasta ${LIMITE_ADMINS_ARBOL} administradores adicionales.`);
    }

    const indiceCreador = this.miembros.findIndex(
        miembro => obtenerIdSeguro(miembro.usuario) === creadorId
    );

    if (indiceCreador === -1) {
        this.miembros.push({
            usuario: this.creador,
            rol: 'Creador',
            estado: 'Activo'
        });
    } else {
        this.miembros[indiceCreador].rol = 'Creador';
        this.miembros[indiceCreador].estado = 'Activo';
    }

    this.miembros.forEach((miembro) => {
        const miembroId = obtenerIdSeguro(miembro.usuario);

        if (!miembroId) return;
        if (miembroId === creadorId) {
            miembro.rol = 'Creador';
            miembro.estado = 'Activo';
            return;
        }

        if (idsAdmins.has(miembroId)) {
            miembro.rol = 'Admin';
        } else if (miembro.rol === 'Admin') {
            miembro.rol = 'Miembro';
        }
    });
});

module.exports = mongoose.model('Arbol', arbolSchema);
