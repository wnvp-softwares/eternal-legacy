const mongoose = require('mongoose');

const ICONOS_ETAPAS_PERMITIDOS = [
    'bi-stars', 'bi-heart-fill', 'bi-people-fill', 'bi-house-heart-fill',
    'bi-mortarboard-fill', 'bi-book-fill', 'bi-briefcase-fill', 'bi-trophy-fill',
    'bi-airplane-fill', 'bi-geo-alt-fill', 'bi-camera-fill', 'bi-music-note-beamed',
    'bi-cake2-fill', 'bi-balloon-heart-fill', 'bi-gift-fill', 'bi-flower1',
    'bi-tree-fill', 'bi-sun-fill', 'bi-moon-stars-fill', 'bi-cloud-sun-fill',
    'bi-bicycle', 'bi-car-front-fill', 'bi-controller', 'bi-palette-fill',
    'bi-brush-fill', 'bi-pencil-fill', 'bi-lightning-charge-fill', 'bi-fire',
    'bi-gem', 'bi-award-fill', 'bi-flag-fill', 'bi-compass-fill',
    'bi-map-fill', 'bi-building-fill', 'bi-hospital-fill', 'bi-heart-pulse-fill',
    'bi-person-hearts', 'bi-emoji-smile-fill', 'bi-paw-fill', 'bi-camera-reels-fill',
    'bi-film', 'bi-headphones', 'bi-mic-fill', 'bi-basket-fill',
    'bi-cup-hot-fill', 'bi-journal-richtext', 'bi-calendar-heart-fill', 'bi-infinity'
];

const normalizarNombre = (valor = '') => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const etapaDestacadaSchema = new mongoose.Schema({
    propietario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
    },
    nombreNormalizado: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        required: true,
        uppercase: true,
        match: /^#[0-9A-F]{6}$/
    },
    icono: {
        type: String,
        required: true,
        enum: ICONOS_ETAPAS_PERMITIDOS
    },
    orden: {
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps: true });

etapaDestacadaSchema.pre('validate', function () {
    this.nombre = String(this.nombre || '').trim().replace(/\s+/g, ' ');
    this.nombreNormalizado = normalizarNombre(this.nombre);
    this.color = String(this.color || '').trim().toUpperCase();
    this.icono = String(this.icono || '').trim();
});

etapaDestacadaSchema.index(
    { propietario: 1, nombreNormalizado: 1 },
    { unique: true, name: 'etapa_nombre_unico_por_propietario' }
);
etapaDestacadaSchema.index({ propietario: 1, orden: 1, createdAt: 1 });

const EtapaDestacada = mongoose.model('EtapaDestacada', etapaDestacadaSchema);
EtapaDestacada.ICONOS_PERMITIDOS = ICONOS_ETAPAS_PERMITIDOS;
EtapaDestacada.normalizarNombre = normalizarNombre;

module.exports = EtapaDestacada;
