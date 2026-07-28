const mongoose = require('mongoose');
const { EtapaDestacada, Publicacion } = require('../../models/index.model');

const MAX_ETAPAS_POR_USUARIO = 20;
const COLOR_POR_DEFECTO = '#D4AF37';
const ICONO_POR_DEFECTO = 'bi-stars';

const obtenerUsuarioId = (req) => req.usuario?.id || req.usuario?._id;
const esObjectIdValido = (valor) => Boolean(valor) && mongoose.Types.ObjectId.isValid(String(valor));

const serializarEtapa = (etapa, totalPublicaciones = undefined) => {
    const objeto = typeof etapa?.toObject === 'function' ? etapa.toObject() : { ...etapa };
    delete objeto.nombreNormalizado;
    return {
        ...objeto,
        ...(totalPublicaciones !== undefined ? { totalPublicaciones } : {})
    };
};

const validarEntrada = ({ nombre, color, icono }) => {
    const nombreLimpio = String(nombre || '').trim().replace(/\s+/g, ' ');
    const colorLimpio = String(color || COLOR_POR_DEFECTO).trim().toUpperCase();
    const iconoLimpio = String(icono || ICONO_POR_DEFECTO).trim();

    if (!nombreLimpio) return { error: 'Escribe un nombre para la Etapa.' };
    if (nombreLimpio.length > 30) return { error: 'El nombre de la Etapa no puede superar 30 caracteres.' };
    if (!/^#[0-9A-F]{6}$/.test(colorLimpio)) return { error: 'El color de la Etapa no es válido.' };
    if (!EtapaDestacada.ICONOS_PERMITIDOS.includes(iconoLimpio)) {
        return { error: 'El icono seleccionado no está permitido.' };
    }

    return { nombreLimpio, colorLimpio, iconoLimpio };
};

const manejarErrorDuplicado = (error, res) => {
    if (error?.code === 11000) {
        res.status(409).json({ mensaje: 'Ya tienes una Etapa con ese nombre.' });
        return true;
    }
    return false;
};

const obtenerMisEtapas = async (req, res) => {
    try {
        const propietario = obtenerUsuarioId(req);
        const etapas = await EtapaDestacada.find({ propietario })
            .sort({ orden: 1, createdAt: 1 });

        const ids = etapas.map(etapa => etapa._id);
        const conteos = ids.length > 0
            ? await Publicacion.aggregate([
                { $match: { etapaDestacada: { $in: ids } } },
                { $group: { _id: '$etapaDestacada', total: { $sum: 1 } } }
            ])
            : [];
        const conteosPorId = new Map(conteos.map(item => [String(item._id), Number(item.total) || 0]));

        return res.status(200).json({
            etapas: etapas.map(etapa => serializarEtapa(etapa, conteosPorId.get(String(etapa._id)) || 0)),
            limite: MAX_ETAPAS_POR_USUARIO
        });
    } catch (error) {
        console.error('❌ Error al obtener Etapas destacadas:', error);
        return res.status(500).json({ mensaje: 'No se pudieron obtener tus Etapas.' });
    }
};

const crearEtapa = async (req, res) => {
    try {
        const propietario = obtenerUsuarioId(req);
        const entrada = validarEntrada(req.body || {});
        if (entrada.error) return res.status(400).json({ mensaje: entrada.error });

        const totalActual = await EtapaDestacada.countDocuments({ propietario });
        if (totalActual >= MAX_ETAPAS_POR_USUARIO) {
            return res.status(409).json({ mensaje: `Solo puedes crear hasta ${MAX_ETAPAS_POR_USUARIO} Etapas.` });
        }

        const ultima = await EtapaDestacada.findOne({ propietario }).sort({ orden: -1 }).select('orden');
        const etapa = await EtapaDestacada.create({
            propietario,
            nombre: entrada.nombreLimpio,
            color: entrada.colorLimpio,
            icono: entrada.iconoLimpio,
            orden: Number(ultima?.orden || 0) + 1
        });

        return res.status(201).json({
            mensaje: 'Etapa creada correctamente.',
            etapa: serializarEtapa(etapa, 0)
        });
    } catch (error) {
        if (manejarErrorDuplicado(error, res)) return;
        console.error('❌ Error al crear Etapa:', error);
        return res.status(500).json({ mensaje: 'No se pudo crear la Etapa.' });
    }
};

const actualizarEtapa = async (req, res) => {
    try {
        const propietario = obtenerUsuarioId(req);
        const { etapaId } = req.params;
        if (!esObjectIdValido(etapaId)) return res.status(400).json({ mensaje: 'La Etapa no es válida.' });

        const etapa = await EtapaDestacada.findOne({ _id: etapaId, propietario });
        if (!etapa) return res.status(404).json({ mensaje: 'No se encontró la Etapa.' });

        const entrada = validarEntrada({
            nombre: Object.prototype.hasOwnProperty.call(req.body || {}, 'nombre') ? req.body.nombre : etapa.nombre,
            color: Object.prototype.hasOwnProperty.call(req.body || {}, 'color') ? req.body.color : etapa.color,
            icono: Object.prototype.hasOwnProperty.call(req.body || {}, 'icono') ? req.body.icono : etapa.icono
        });
        if (entrada.error) return res.status(400).json({ mensaje: entrada.error });

        etapa.nombre = entrada.nombreLimpio;
        etapa.color = entrada.colorLimpio;
        etapa.icono = entrada.iconoLimpio;
        await etapa.save();

        const totalPublicaciones = await Publicacion.countDocuments({ etapaDestacada: etapa._id });
        return res.status(200).json({
            mensaje: 'Etapa actualizada correctamente.',
            etapa: serializarEtapa(etapa, totalPublicaciones)
        });
    } catch (error) {
        if (manejarErrorDuplicado(error, res)) return;
        console.error('❌ Error al actualizar Etapa:', error);
        return res.status(500).json({ mensaje: 'No se pudo actualizar la Etapa.' });
    }
};

const eliminarEtapa = async (req, res) => {
    try {
        const propietario = obtenerUsuarioId(req);
        const { etapaId } = req.params;
        if (!esObjectIdValido(etapaId)) return res.status(400).json({ mensaje: 'La Etapa no es válida.' });

        const etapa = await EtapaDestacada.findOne({ _id: etapaId, propietario });
        if (!etapa) return res.status(404).json({ mensaje: 'No se encontró la Etapa.' });

        const resultado = await Publicacion.updateMany(
            { autor: propietario, etapaDestacada: etapa._id },
            {
                $set: {
                    etapaDestacada: null,
                    fechaRecuerdo: null,
                    fechaMomento: null
                }
            }
        );

        await etapa.deleteOne();

        return res.status(200).json({
            mensaje: 'Etapa eliminada. Sus publicaciones se conservaron sin etiqueta.',
            publicacionesDesvinculadas: Number(resultado.modifiedCount || 0),
            etapaId: String(etapa._id)
        });
    } catch (error) {
        console.error('❌ Error al eliminar Etapa:', error);
        return res.status(500).json({ mensaje: 'No se pudo eliminar la Etapa.' });
    }
};

module.exports = {
    obtenerMisEtapas,
    crearEtapa,
    actualizarEtapa,
    eliminarEtapa
};
