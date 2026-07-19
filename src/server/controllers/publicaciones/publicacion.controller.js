const mongoose = require('mongoose');
const { Publicacion, Upload } = require('../../models/index.model');

const EventoFamiliar = require('../../models/arboles/eventoFamiliar.model');
const { construirRutaPublicaUpload } = require('../../configs/uploads.config');

const obtenerIdSeguro = (valor) => {
    if (!valor) return null;

    if (typeof valor === 'string') return valor;

    if (valor._id) return String(valor._id);

    if (valor.id) return String(valor.id);

    return null;
};

const esObjectIdValido = (id) => {
    return Boolean(id) && mongoose.Types.ObjectId.isValid(String(id));
};

const parseJSONSeguro = (valor, valorPorDefecto = null) => {
    if (!valor) return valorPorDefecto;

    if (typeof valor === 'object') return valor;

    try {
        return JSON.parse(valor);
    } catch (error) {
        return valorPorDefecto;
    }
};

const normalizarListaPersonas = (valor) => {
    const lista = parseJSONSeguro(valor, []);

    if (!Array.isArray(lista)) return [];

    return lista
        .map((persona) => {
            const id = obtenerIdSeguro(persona);
            const nombre = String(
                persona?.nombre ||
                persona?.nombreUsuario ||
                persona?.nombreCompleto ||
                ''
            ).trim();

            return {
                usuario: esObjectIdValido(id) ? id : null,
                nombre
            };
        })
        .filter((persona) => persona.usuario || persona.nombre);
};

const obtenerNombreFamiliaDesdeArbol = (arbol) => {
    if (!arbol) return '';

    return String(
        arbol.nombreFamilia ||
        arbol.nombre ||
        arbol.titulo ||
        ''
    ).trim();
};

const construirEventoRelacionado = async ({ eventoRelacionadoId, eventoRelacionado }) => {
    const eventoPayload = parseJSONSeguro(eventoRelacionado, null);

    const idDesdeBody =
        eventoRelacionadoId ||
        obtenerIdSeguro(eventoPayload) ||
        obtenerIdSeguro(eventoPayload?.evento) ||
        obtenerIdSeguro(eventoPayload?.eventoRelacionado);

    if (!idDesdeBody && !eventoPayload) return null;

    let eventoBD = null;

    if (esObjectIdValido(idDesdeBody)) {
        eventoBD = await EventoFamiliar.findById(idDesdeBody)
            .populate('arbol', 'nombreFamilia nombre titulo');
    }

    const eventoFinal = eventoBD || eventoPayload || {};

    const arbolId =
        obtenerIdSeguro(eventoBD?.arbol) ||
        obtenerIdSeguro(eventoFinal?.arbol) ||
        eventoFinal?.arbolId ||
        null;

    const titulo = String(
        eventoBD?.titulo ||
        eventoFinal?.titulo ||
        eventoFinal?.nombre ||
        eventoFinal?.tituloSnapshot ||
        'Evento familiar'
    ).trim();

    const fechaInicio =
        eventoBD?.fechaInicio ||
        eventoFinal?.fechaInicio ||
        eventoFinal?.fecha ||
        eventoFinal?.fechaInicioSnapshot ||
        null;

    const tipoEvento = String(
        eventoBD?.tipoEvento ||
        eventoFinal?.tipoEvento ||
        eventoFinal?.tipoEventoSnapshot ||
        'otro'
    ).trim();

    const nombreFamilia = String(
        obtenerNombreFamiliaDesdeArbol(eventoBD?.arbol) ||
        eventoFinal?.nombreFamilia ||
        eventoFinal?.nombreFamiliaSnapshot ||
        ''
    ).trim();

    if (!idDesdeBody && !titulo) return null;

    return {
        evento: esObjectIdValido(idDesdeBody) ? idDesdeBody : null,
        arbol: esObjectIdValido(arbolId) ? arbolId : null,
        tituloSnapshot: titulo,
        fechaInicioSnapshot: fechaInicio ? new Date(fechaInicio) : null,
        tipoEventoSnapshot: tipoEvento || 'otro',
        nombreFamiliaSnapshot: nombreFamilia
    };
};

const poblarPublicacion = async (publicacionId) => {
    return Publicacion.findById(publicacionId)
        .populate({
            path: 'autor',
            select: 'nombreUsuario email imagenPerfil',
            populate: {
                path: 'imagenPerfil'
            }
        })
        .populate('multimedia')
        .populate('menciones.usuario', 'nombreUsuario email imagenPerfil')
        .populate('etiquetasMultimedia.usuario', 'nombreUsuario email imagenPerfil')
        .populate('eventoRelacionado.evento')
        .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo');
};

// CREAR PUBLICACIÓN CON ARCHIVO MULTIMEDIA REAL
const crearPublicacion = async (req, res) => {
    try {
        const {
            tipo,
            contenido,
            ubicacionTexto,
            menciones,
            etiquetasMultimedia,
            eventoRelacionadoId,
            eventoRelacionado
        } = req.body || {};

        if (!contenido || contenido.trim() === '') {
            return res.status(400).json({
                mensaje: 'El contenido no puede estar vacío.'
            });
        }

        const idsMultimedia = [];

        if (req.file) {
            const urlArchivo = construirRutaPublicaUpload(req.file.filename);

            const nuevoUpload = new Upload({
                propietario: req.usuario.id,
                urlArchivo,
                formato: req.file.mimetype,
                pesoBytes: req.file.size
            });

            const uploadGuardado = await nuevoUpload.save();
            idsMultimedia.push(uploadGuardado._id);
        }

        const eventoNormalizado = await construirEventoRelacionado({
            eventoRelacionadoId,
            eventoRelacionado
        });

        const nuevaPublicacion = new Publicacion({
            autor: req.usuario.id,
            tipo: tipo || 'historico',
            contenido: contenido.trim(),
            multimedia: idsMultimedia,
            ubicacionTexto: ubicacionTexto || '',
            menciones: normalizarListaPersonas(menciones),
            etiquetasMultimedia: normalizarListaPersonas(etiquetasMultimedia),
            eventoRelacionado: eventoNormalizado,
            reacciones: [],
            compartido: 0
        });

        await nuevaPublicacion.save();

        const publicacionCompleta = await poblarPublicacion(nuevaPublicacion._id);

        res.status(201).json({
            mensaje: 'Publicación creada con éxito',
            publicacion: publicacionCompleta || nuevaPublicacion
        });
    } catch (error) {
        console.error('❌ Error al crear publicación:', error);
        res.status(500).json({
            mensaje: 'Error interno al crear la publicación.'
        });
    }
};

// OBTENER LAS PUBLICACIONES DEL MURO
const obtenerPublicaciones = async (req, res) => {
    try {
        const publicaciones = await Publicacion.find()
            .sort({ createdAt: -1 })
            .populate({
                path: 'autor',
                select: 'nombreUsuario email imagenPerfil',
                populate: {
                    path: 'imagenPerfil'
                }
            })
            .populate('multimedia')
            .populate('menciones.usuario', 'nombreUsuario email imagenPerfil')
            .populate('etiquetasMultimedia.usuario', 'nombreUsuario email imagenPerfil')
            .populate('eventoRelacionado.evento')
            .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo');

        res.status(200).json(publicaciones);
    } catch (error) {
        console.error('❌ Error al obtener publicaciones:', error);
        res.status(500).json({
            mensaje: 'Error al obtener las publicaciones del servidor.'
        });
    }
};

// OBTENER PUBLICACIONES DE UN EVENTO FAMILIAR
const obtenerPublicacionesPorEvento = async (req, res) => {
    try {
        const { eventoId } = req.params;

        if (!esObjectIdValido(eventoId)) {
            return res.status(400).json({
                mensaje: 'El ID del evento no es válido.'
            });
        }

        const publicaciones = await Publicacion.find({
            'eventoRelacionado.evento': eventoId
        })
            .sort({ createdAt: -1 })
            .populate({
                path: 'autor',
                select: 'nombreUsuario email imagenPerfil',
                populate: {
                    path: 'imagenPerfil'
                }
            })
            .populate('multimedia')
            .populate('menciones.usuario', 'nombreUsuario email imagenPerfil')
            .populate('etiquetasMultimedia.usuario', 'nombreUsuario email imagenPerfil')
            .populate('eventoRelacionado.evento')
            .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo');

        res.status(200).json({
            mensaje: 'Publicaciones del evento recuperadas correctamente.',
            total: publicaciones.length,
            publicaciones
        });
    } catch (error) {
        console.error('❌ Error al obtener publicaciones por evento:', error);
        res.status(500).json({
            mensaje: 'Error interno al obtener publicaciones del evento.'
        });
    }
};

// REACCIONAR A UNA PUBLICACIÓN
const reaccionarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!usuarioId) {
            return res.status(400).json({
                mensaje: 'ID de usuario no detectado.'
            });
        }

        const publicacion = await Publicacion.findById(id);

        if (!publicacion) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada'
            });
        }

        if (!Array.isArray(publicacion.reacciones)) {
            await Publicacion.updateOne(
                { _id: id },
                { $set: { reacciones: [] } }
            );

            publicacion.reacciones = [];
        }

        const yaReacciono = publicacion.reacciones.some(
            (reaccion) => reaccion.toString() === usuarioId.toString()
        );

        const operacion = yaReacciono
            ? { $pull: { reacciones: usuarioId } }
            : { $addToSet: { reacciones: usuarioId } };

        const publicacionActualizada = await Publicacion.findByIdAndUpdate(
            id,
            operacion,
            { returnDocument: 'after' }
        );

        res.status(200).json({
            mensaje: yaReacciono ? 'Reacción eliminada' : 'Reacción registrada',
            reacciones: publicacionActualizada.reacciones || []
        });
    } catch (error) {
        console.error('❌ Error al gestionar la reacción:', error);
        res.status(500).json({
            mensaje: 'Error interno al procesar la reacción'
        });
    }
};

module.exports = {
    crearPublicacion,
    obtenerPublicaciones,
    obtenerPublicacionesPorEvento,
    reaccionarPublicacion
};