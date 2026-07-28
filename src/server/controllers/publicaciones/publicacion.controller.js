const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Publicacion, Upload, Usuario, Arbol, EtapaDestacada } = require('../../models/index.model');
const Nodo = require('../../models/arboles/nodo.model');
const Comentario = require('../../models/publicacion/comentario.model');

const EventoFamiliar = require('../../models/arboles/eventoFamiliar.model');
const {
    construirFiltroVisibilidadPublicaciones: construirFiltroVisibilidadPublicacionesCentral,
    puedeVerPerfilCompleto,
    usuarioPuedeVerPublicacion
} = require('../../services/privacidadPerfil.service');
const {
    crearNotificacion,
    crearClaveEvento,
    eliminarNotificacionPorClave,
    eliminarNotificaciones,
    sincronizarMencionesPublicacion
} = require('../../services/notificacion.service');
const cloudinary = require('../../configs/cloudinary.config');
const {
    MAX_UPLOAD_SIZE_MB,
    MAX_PUBLICATION_MEDIA_FILES,
    MAX_PUBLICATION_TOTAL_SIZE_BYTES
} = require('../../configs/uploads.config');

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

const sonMismoId = (id1, id2) => {
    const valor1 = obtenerIdSeguro(id1);
    const valor2 = obtenerIdSeguro(id2);

    if (!valor1 || !valor2) return false;

    return valor1 === valor2;
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


const obtenerArchivosSubidos = (req) => {
    if (Array.isArray(req.files)) return req.files.filter(Boolean);
    if (req.file) return [req.file];
    return [];
};

const obtenerResourceTypeCloudinary = (archivo = {}) => {
    return String(archivo.mimetype || '').startsWith('video/') ? 'video' : 'image';
};

const eliminarArchivosDeCloudinary = async (archivos = []) => {
    const resultados = await Promise.allSettled(
        archivos.map((archivo) => {
            const publicId = archivo?.filename || archivo?.public_id;
            if (!publicId) return Promise.resolve();

            return cloudinary.uploader.destroy(publicId, {
                resource_type: obtenerResourceTypeCloudinary(archivo),
                invalidate: true
            });
        })
    );

    resultados.forEach((resultado) => {
        if (resultado.status === 'rejected') {
            console.error('❌ No se pudo limpiar un archivo de Cloudinary:', resultado.reason);
        }
    });
};

const limpiarCargaFallida = async ({ archivos = [], idsUploads = [] } = {}) => {
    await Promise.allSettled([
        eliminarArchivosDeCloudinary(archivos),
        idsUploads.length > 0
            ? Upload.deleteMany({ _id: { $in: idsUploads } })
            : Promise.resolve()
    ]);
};


const DIRECTORIO_UPLOADS_LOCAL = path.resolve(__dirname, '../../../uploads');

const obtenerPublicIdDesdeUrl = (url = '') => {
    const valor = String(url || '').trim();
    if (!valor || !valor.includes('/upload/')) return '';

    try {
        const pathname = new URL(valor).pathname;
        const despuesUpload = pathname.split('/upload/')[1] || '';
        const sinVersion = despuesUpload.replace(/^(?:[^/]+\/)*v\d+\//, '');
        return decodeURIComponent(sinVersion).replace(/\.[^/.]+$/, '').replace(/^\/+|\/+$/g, '');
    } catch (error) {
        const despuesUpload = valor.split('/upload/')[1] || '';
        const sinQuery = despuesUpload.split('?')[0];
        const sinVersion = sinQuery.replace(/^(?:[^/]+\/)*v\d+\//, '');
        return sinVersion.replace(/\.[^/.]+$/, '').replace(/^\/+|\/+$/g, '');
    }
};

const obtenerResourceTypeUpload = (upload = {}) => {
    if (['image', 'video', 'raw'].includes(upload.resourceType)) return upload.resourceType;
    return String(upload.formato || '').startsWith('video/') ? 'video' : 'image';
};

const eliminarArchivoLocalUpload = async (upload = {}) => {
    const url = String(upload.urlArchivo || '').replace(/\\/g, '/');
    const indiceUploads = url.lastIndexOf('/uploads/');
    if (indiceUploads < 0) return false;

    let rutaRelativa = url.slice(indiceUploads + '/uploads/'.length).split('?')[0];
    try {
        rutaRelativa = decodeURIComponent(rutaRelativa);
    } catch (error) {
        // Se conserva el valor original cuando la URL no está codificada correctamente.
    }

    const rutaFinal = path.resolve(DIRECTORIO_UPLOADS_LOCAL, rutaRelativa);
    const prefijoSeguro = `${DIRECTORIO_UPLOADS_LOCAL}${path.sep}`;

    if (rutaFinal !== DIRECTORIO_UPLOADS_LOCAL && !rutaFinal.startsWith(prefijoSeguro)) {
        console.error('❌ Se rechazó una ruta de archivo local fuera de src/uploads:', rutaFinal);
        return false;
    }

    try {
        await fs.promises.unlink(rutaFinal);
        return true;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('❌ No se pudo eliminar un archivo local de publicación:', error);
        }
        return false;
    }
};

const eliminarRecursoPersistenteUpload = async (upload = {}) => {
    const publicId = String(upload.publicId || obtenerPublicIdDesdeUrl(upload.urlArchivo) || '').trim();

    if (publicId) {
        try {
            await cloudinary.uploader.destroy(publicId, {
                resource_type: obtenerResourceTypeUpload(upload),
                invalidate: true
            });
            return;
        } catch (error) {
            console.error('❌ No se pudo eliminar un recurso persistente de Cloudinary:', error);
        }
    }

    await eliminarArchivoLocalUpload(upload);
};

const limpiarUploadsRetirados = async ({ uploads = [], publicacionExcluidaId = null } = {}) => {
    for (const upload of uploads.filter(Boolean)) {
        const uploadId = obtenerIdSeguro(upload);
        if (!uploadId) continue;

        const filtroReferencia = {
            multimedia: uploadId,
            ...(publicacionExcluidaId ? { _id: { $ne: publicacionExcluidaId } } : {})
        };

        const sigueReferenciado = await Publicacion.exists(filtroReferencia);
        if (sigueReferenciado) continue;

        await Promise.allSettled([
            eliminarRecursoPersistenteUpload(upload),
            Upload.deleteOne({ _id: uploadId })
        ]);
    }
};

const crearUploadDesdeArchivo = async ({ archivo, propietario }) => {
    const resourceType = obtenerResourceTypeCloudinary(archivo);
    const nuevoUpload = new Upload({
        propietario,
        urlArchivo: archivo.path,
        formato: archivo.mimetype,
        pesoBytes: Number(archivo.size) || 0,
        publicId: archivo.filename || archivo.public_id || '',
        resourceType
    });

    return nuevoUpload.save();
};

const validarCombinacionMultimedia = (archivos = []) => {
    const tieneVideo = archivos.some((archivo) => String(archivo?.mimetype || '').startsWith('video/'));
    const tieneGif = archivos.some((archivo) => archivo?.mimetype === 'image/gif');

    if ((tieneVideo || tieneGif) && archivos.length > 1) {
        return 'Los videos y GIF se publican de uno en uno y no se pueden mezclar con fotografías.';
    }

    return null;
};

const normalizarHandleMencion = (valor = '', { minusculas = false } = {}) => {
    let handle = String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^@+/, '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^[_\-.]+|[_\-.]+$/g, '');

    if (minusculas) handle = handle.toLowerCase();
    return handle;
};

const normalizarTextoBusqueda = (valor = '') => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const construirListaPersonas = async (valor, { incluirHandle = false } = {}) => {
    const lista = parseJSONSeguro(valor, []);
    if (!Array.isArray(lista)) return [];

    const ids = Array.from(new Set(
        lista.map(obtenerIdSeguro).filter(esObjectIdValido).map(String)
    ));

    const usuarios = ids.length > 0
        ? await Usuario.find({ _id: { $in: ids } }).select('_id nombreUsuario nickname')
        : [];
    const usuariosPorId = new Map(usuarios.map(usuario => [String(usuario._id), usuario]));
    const clavesUsadas = new Set();
    const resultado = [];

    for (const persona of lista) {
        const id = obtenerIdSeguro(persona);
        const usuario = id ? usuariosPorId.get(String(id)) : null;
        const nombre = String(
            usuario?.nombreUsuario ||
            persona?.nombre ||
            persona?.nombreUsuario ||
            persona?.nombreCompleto ||
            persona?.nickname ||
            ''
        ).trim();

        const handle = normalizarHandleMencion(
            usuario?.nickname ||
            persona?.nickname ||
            usuario?.nombreUsuario ||
            persona?.nombreUsuario ||
            nombre
        );

        // Si llegó un ID, debe corresponder a un usuario real; no se aceptan referencias inventadas.
        if (id && esObjectIdValido(id) && !usuario) continue;
        if (!usuario && !nombre) continue;

        const clave = usuario
            ? `usuario:${usuario._id}`
            : `handle:${normalizarHandleMencion(handle || nombre, { minusculas: true })}`;
        if (clavesUsadas.has(clave)) continue;
        clavesUsadas.add(clave);

        resultado.push({
            usuario: usuario?._id || null,
            nombre,
            ...(incluirHandle ? { handle } : {})
        });
    }

    return resultado;
};


const normalizarFechaMomento = (valor) => {
    if (!valor) return null;

    const texto = String(valor).trim();
    // Los inputs type=date no incluyen zona horaria. Se fija al mediodía UTC para
    // evitar que el calendario cambie al día anterior al mostrarse en México.
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto)
        ? new Date(`${texto}T12:00:00.000Z`)
        : new Date(texto);

    if (Number.isNaN(fecha.getTime())) return undefined;
    return fecha;
};

const normalizarFechaRecuerdo = normalizarFechaMomento;

const obtenerEtapaPropiaValida = async ({ etapaId, usuarioId }) => {
    if (!etapaId) return null;

    if (!esObjectIdValido(etapaId)) {
        const error = new Error('La Etapa seleccionada no es válida.');
        error.status = 400;
        throw error;
    }

    const etapa = await EtapaDestacada.findOne({
        _id: etapaId,
        propietario: usuarioId
    });

    if (!etapa) {
        const error = new Error('La Etapa no existe o no pertenece al autor de la publicación.');
        error.status = 403;
        throw error;
    }

    return etapa;
};

const obtenerIdsNodosRelacionados = (valor) => {
    const lista = parseJSONSeguro(valor, []);
    if (!Array.isArray(lista)) return [];

    return Array.from(new Set(
        lista
            .map(item => obtenerIdSeguro(item?.nodo || item?.nodoId || item))
            .filter(esObjectIdValido)
            .map(String)
    ));
};

const construirPersonasRelacionadas = async ({ valor, arbolId }) => {
    const idsNodos = obtenerIdsNodosRelacionados(valor);
    if (idsNodos.length === 0) return [];

    const nodos = await Nodo.find({
        _id: { $in: idsNodos },
        arbol: arbolId,
        visible: { $ne: false }
    }).select('_id usuario nombre');

    if (nodos.length !== idsNodos.length) {
        const error = new Error('Una o más personas relacionadas no pertenecen al árbol seleccionado.');
        error.status = 400;
        throw error;
    }

    const mapa = new Map(nodos.map(nodo => [String(nodo._id), nodo]));

    return idsNodos.map(id => {
        const nodo = mapa.get(String(id));
        return {
            nodo: nodo._id,
            usuario: nodo.usuario || null,
            nombreSnapshot: String(nodo.nombre || 'Familiar').trim()
        };
    });
};

const esFotografiaPublicacion = (archivo = {}) => {
    const formato = String(archivo?.formato || archivo?.mimetype || archivo?.mimeType || '').toLowerCase();
    const url = String(archivo?.urlArchivo || archivo?.url || archivo?.path || '').toLowerCase();

    if (formato === 'image/gif' || /\.gif(?:$|\?)/i.test(url)) return false;
    if (formato.startsWith('image/')) return true;

    return /\.(?:jpe?g|png|webp|avif|bmp|heic|heif)(?:$|\?)/i.test(url);
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

const usuarioPerteneceAlArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    if (Array.isArray(arbol.admins) && arbol.admins.some(adminId => sonMismoId(adminId, usuarioId))) {
        return true;
    }

    return (Array.isArray(arbol.miembros) ? arbol.miembros : []).some((miembro) => {
        return sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo';
    });
};

const obtenerArbolesPermitidosUsuario = async (usuarioId) => {
    if (!usuarioId || !esObjectIdValido(usuarioId)) return [];

    return Arbol.find({
        activo: true,
        $or: [
            { creador: usuarioId },
            { admins: usuarioId },
            {
                miembros: {
                    $elemMatch: {
                        usuario: usuarioId,
                        estado: 'Activo'
                    }
                }
            }
        ]
    }).select('_id nombreFamilia nombre titulo creador admins miembros');
};

const obtenerIdsArbolesPermitidosUsuario = async (usuarioId) => {
    const arboles = await obtenerArbolesPermitidosUsuario(usuarioId);
    return arboles.map(arbol => arbol._id);
};

const construirFiltroVisibilidadPublicaciones = async (usuarioId) => (
    construirFiltroVisibilidadPublicacionesCentral(usuarioId)
);


const crearContextoPreferenciasFeedVacio = () => ({
    publicacionesOcultas: new Set(),
    autoresPausados: new Map()
});

const obtenerContextoPreferenciasFeed = async (usuarioId, { limpiarExpiradas = false } = {}) => {
    if (!usuarioId || !esObjectIdValido(usuarioId)) {
        return crearContextoPreferenciasFeedVacio();
    }

    const usuario = await Usuario.findById(usuarioId).select('preferenciasFeed');
    if (!usuario) return crearContextoPreferenciasFeedVacio();

    const ahora = new Date();
    const publicacionesOcultas = new Set(
        (Array.isArray(usuario.preferenciasFeed?.publicacionesOcultas)
            ? usuario.preferenciasFeed.publicacionesOcultas
            : [])
            .map(obtenerIdSeguro)
            .filter(Boolean)
            .map(String)
    );

    const autoresPausados = new Map();
    const pausasExpiradas = [];

    for (const pausa of (Array.isArray(usuario.preferenciasFeed?.autoresPausados)
        ? usuario.preferenciasFeed.autoresPausados
        : [])) {
        const autorId = obtenerIdSeguro(pausa?.autor);
        const hasta = pausa?.hasta ? new Date(pausa.hasta) : null;

        if (!autorId || !hasta || Number.isNaN(hasta.getTime()) || hasta.getTime() <= ahora.getTime()) {
            if (hasta && !Number.isNaN(hasta.getTime()) && hasta.getTime() <= ahora.getTime()) {
                pausasExpiradas.push(autorId);
            }
            continue;
        }

        autoresPausados.set(String(autorId), hasta);
    }

    if (limpiarExpiradas && pausasExpiradas.length > 0) {
        await Usuario.updateOne(
            { _id: usuarioId },
            { $pull: { 'preferenciasFeed.autoresPausados': { hasta: { $lte: ahora } } } }
        ).catch(error => {
            console.error('⚠️ No se pudieron limpiar pausas vencidas del Inicio:', error);
        });
    }

    return { publicacionesOcultas, autoresPausados };
};

const construirFiltroMuroConPreferencias = (filtroVisibilidad, contextoPreferencias) => {
    const condiciones = [filtroVisibilidad];
    const idsOcultos = Array.from(contextoPreferencias?.publicacionesOcultas || []);
    const idsAutoresPausados = Array.from(contextoPreferencias?.autoresPausados?.keys?.() || []);

    if (idsOcultos.length > 0) {
        condiciones.push({ _id: { $nin: idsOcultos } });
    }

    if (idsAutoresPausados.length > 0) {
        condiciones.push({ autor: { $nin: idsAutoresPausados } });
    }

    return condiciones.length === 1 ? filtroVisibilidad : { $and: condiciones };
};

const obtenerArbolAudienciaValido = async ({ usuarioId, arbolAudienciaId, eventoRelacionado }) => {
    let arbolId = arbolAudienciaId || null;

    if (!arbolId) {
        const eventoPayload = parseJSONSeguro(eventoRelacionado, null);
        arbolId =
            obtenerIdSeguro(eventoPayload?.arbol) ||
            eventoPayload?.arbolId ||
            null;
    }

    if (!arbolId || !esObjectIdValido(arbolId)) {
        return {
            error: {
                status: 400,
                mensaje: 'Selecciona la familia o árbol donde será visible este Momento Familiar.'
            }
        };
    }

    const arbol = await Arbol.findOne({
        _id: arbolId,
        activo: true
    });

    if (!arbol) {
        return {
            error: {
                status: 404,
                mensaje: 'El árbol seleccionado no existe o ya no está activo.'
            }
        };
    }

    if (!usuarioPerteneceAlArbol(arbol, usuarioId)) {
        return {
            error: {
                status: 403,
                mensaje: 'No puedes publicar un Momento Familiar en un árbol al que no perteneces.'
            }
        };
    }

    return { arbol };
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

        if (!eventoBD) {
            const error = new Error('El evento familiar seleccionado no existe o ya no está disponible.');
            error.status = 404;
            throw error;
        }
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


const validarEventoCompatibleConArbol = ({ eventoRelacionado, arbol }) => {
    if (!eventoRelacionado) return;

    const arbolEventoId = obtenerIdSeguro(eventoRelacionado.arbol);
    const arbolAudienciaId = obtenerIdSeguro(arbol);

    if (!arbolEventoId || !arbolAudienciaId || !sonMismoId(arbolEventoId, arbolAudienciaId)) {
        const error = new Error('El evento relacionado no pertenece al árbol seleccionado.');
        error.status = 400;
        throw error;
    }
};

const crearPopulatePublicacionOriginal = (filtroOriginal) => ({
    path: 'publicacionOriginal',
    match: filtroOriginal,
    populate: [
        {
            path: 'autor',
            select: 'nombreUsuario nickname imagenPerfil',
            populate: { path: 'imagenPerfil' }
        },
        { path: 'multimedia' },
        { path: 'menciones.usuario', select: 'nombreUsuario nickname imagenPerfil' },
        { path: 'etiquetasMultimedia.usuario', select: 'nombreUsuario nickname imagenPerfil' },
        { path: 'personasRelacionadas.nodo', select: 'nombre usuario origen' },
        { path: 'personasRelacionadas.usuario', select: 'nombreUsuario nickname imagenPerfil' },
        { path: 'eventoRelacionado.evento' },
        { path: 'eventoRelacionado.arbol', select: 'nombreFamilia nombre titulo' },
        { path: 'arbolAudiencia', select: 'nombreFamilia nombre titulo' },
        { path: 'etapaDestacada', select: 'propietario nombre color icono orden' }
    ]
});

const aplicarPobladoPublicacion = (consulta, filtroOriginal) => consulta
    .populate({
        path: 'autor',
        select: 'nombreUsuario nickname imagenPerfil',
        populate: { path: 'imagenPerfil' }
    })
    .populate('multimedia')
    .populate('menciones.usuario', 'nombreUsuario nickname imagenPerfil')
    .populate('etiquetasMultimedia.usuario', 'nombreUsuario nickname imagenPerfil')
    .populate('personasRelacionadas.nodo', 'nombre usuario origen')
    .populate('personasRelacionadas.usuario', 'nombreUsuario nickname imagenPerfil')
    .populate('eventoRelacionado.evento')
    .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo')
    .populate('arbolAudiencia', 'nombreFamilia nombre titulo')
    .populate('etapaDestacada', 'propietario nombre color icono orden')
    .populate(crearPopulatePublicacionOriginal(filtroOriginal));

const poblarPublicacion = async (publicacionId, usuarioId) => {
    const filtroOriginal = await construirFiltroVisibilidadPublicaciones(usuarioId);
    return aplicarPobladoPublicacion(Publicacion.findById(publicacionId), filtroOriginal);
};

const poblarConsultaPublicaciones = async (consulta, usuarioId) => {
    const filtroOriginal = await construirFiltroVisibilidadPublicaciones(usuarioId);
    return aplicarPobladoPublicacion(consulta, filtroOriginal);
};


const serializarEntidadPublicacion = (objetoEntrada, usuarioId, contextoPreferencias = null) => {
    if (!objetoEntrada) return null;

    const objeto = typeof objetoEntrada.toObject === 'function'
        ? objetoEntrada.toObject()
        : { ...objetoEntrada };

    const guardadaPor = Array.isArray(objeto.guardadaPor) ? objeto.guardadaPor : [];
    const guardadaPorMi = guardadaPor.some((idUsuario) => sonMismoId(idUsuario, usuarioId));
    const publicacionId = obtenerIdSeguro(objeto);
    const autorId = obtenerIdSeguro(objeto.autor);
    const pausaAutor = autorId
        ? contextoPreferencias?.autoresPausados?.get(String(autorId)) || null
        : null;

    delete objeto.guardadaPor;

    return {
        ...objeto,
        guardadaPorMi,
        fijadaEnPerfil: Boolean(objeto.fijadaEnPerfilAt),
        ocultaDeMiInicio: Boolean(
            publicacionId && contextoPreferencias?.publicacionesOcultas?.has(String(publicacionId))
        ),
        autorPausadoEnInicio: Boolean(pausaAutor),
        autorPausadoHasta: pausaAutor || null
    };
};

const serializarPublicacionParaUsuario = (publicacion, usuarioId, contextoPreferencias = null) => {
    const serializada = serializarEntidadPublicacion(publicacion, usuarioId, contextoPreferencias);
    if (!serializada) return null;

    const esRepost = Boolean(serializada.compartidoDesde || serializada.publicacionOriginal);

    if (!esRepost) {
        // Los campos de referencia existen con valor null por definición del esquema.
        // No deben hacer que una publicación normal sea interpretada como un repost.
        delete serializada.publicacionOriginal;
        delete serializada.compartidoDesde;
        delete serializada.publicacionOriginalDisponible;

        return {
            ...serializada,
            esRepost: false
        };
    }

    const original = serializada.publicacionOriginal
        ? serializarEntidadPublicacion(serializada.publicacionOriginal, usuarioId, null)
        : null;

    return {
        ...serializada,
        esRepost: true,
        publicacionOriginalDisponible: Boolean(original),
        publicacionOriginal: original
    };
};

const serializarListaPublicaciones = (publicaciones = [], usuarioId, contextoPreferencias = null) => (
    publicaciones
        .map(publicacion => serializarPublicacionParaUsuario(publicacion, usuarioId, contextoPreferencias))
        .filter(Boolean)
);

const obtenerPublicacionVisiblePorId = async ({ publicacionId, usuarioId }) => {
    if (!esObjectIdValido(publicacionId)) return null;

    const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(usuarioId);
    const publicacion = await poblarConsultaPublicaciones(
        Publicacion.findOne({
            $and: [
                { _id: publicacionId },
                filtroVisibilidad
            ]
        }),
        usuarioId
    );

    return publicacion;
};

const asegurarAutorPublicacion = (publicacion, usuarioId) => {
    if (!publicacion || !sonMismoId(publicacion.autor, usuarioId)) {
        const error = new Error('Solo el autor puede administrar esta publicación.');
        error.status = 403;
        throw error;
    }
};

// CREAR PUBLICACIÓN CON HASTA 5 ARCHIVOS MULTIMEDIA
const crearPublicacion = async (req, res) => {
    const archivosSubidos = obtenerArchivosSubidos(req);
    const idsMultimedia = [];
    let publicacionGuardada = false;

    try {
        const {
            tipo,
            contenido,
            ubicacionTexto,
            menciones,
            etiquetasMultimedia,
            eventoRelacionadoId,
            eventoRelacionado,
            arbolAudienciaId,
            fechaRecuerdo,
            fechaMomento,
            personasRelacionadas,
            etapaDestacadaId
        } = req.body || {};

        const contenidoLimpio = String(contenido || '').trim();

        if (!contenidoLimpio && archivosSubidos.length === 0) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'Escribe un mensaje o agrega al menos una foto, video o GIF.'
            });
        }

        if (archivosSubidos.length > MAX_PUBLICATION_MEDIA_FILES) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: `Solo puedes agregar hasta ${MAX_PUBLICATION_MEDIA_FILES} archivos por publicación.`
            });
        }

        const pesoTotal = archivosSubidos.reduce(
            (total, archivo) => total + (Number(archivo?.size) || 0),
            0
        );

        if (pesoTotal > MAX_PUBLICATION_TOTAL_SIZE_BYTES) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(413).json({
                mensaje: `El conjunto de archivos supera el límite de ${MAX_UPLOAD_SIZE_MB} MB.`
            });
        }

        const errorCombinacion = validarCombinacionMultimedia(archivosSubidos);
        if (errorCombinacion) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({ mensaje: errorCombinacion });
        }

        const tipoSeguro = tipo === 'familiar' ? 'familiar' : 'historico';
        let arbolAudiencia = null;

        if (tipoSeguro === 'familiar') {
            const resultadoArbol = await obtenerArbolAudienciaValido({
                usuarioId: req.usuario.id,
                arbolAudienciaId,
                eventoRelacionado
            });

            if (resultadoArbol.error) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(resultadoArbol.error.status).json({
                    mensaje: resultadoArbol.error.mensaje
                });
            }

            arbolAudiencia = resultadoArbol.arbol;
        }

        const etapaSeleccionada = await obtenerEtapaPropiaValida({
            etapaId: etapaDestacadaId,
            usuarioId: req.usuario.id
        });

        if (!etapaSeleccionada && (String(fechaRecuerdo || '').trim() || String(fechaMomento || '').trim())) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'Selecciona una Etapa antes de establecer una fecha cronológica.'
            });
        }

        const fechaRecuerdoNormalizada = etapaSeleccionada && tipoSeguro === 'historico'
            ? normalizarFechaRecuerdo(fechaRecuerdo)
            : null;

        if (fechaRecuerdoNormalizada === undefined) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({ mensaje: 'La fecha de la Etapa no es válida.' });
        }

        const fechaMomentoNormalizada = etapaSeleccionada && tipoSeguro === 'familiar'
            ? normalizarFechaMomento(fechaMomento)
            : null;

        if (fechaMomentoNormalizada === undefined) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({ mensaje: 'La fecha de la Etapa no es válida.' });
        }

        const fechaEtapa = tipoSeguro === 'historico'
            ? fechaRecuerdoNormalizada
            : fechaMomentoNormalizada;

        if (etapaSeleccionada && !fechaEtapa) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'Selecciona la fecha que corresponde a esta Etapa.'
            });
        }

        let personasRelacionadasNormalizadas = [];
        if (tipoSeguro === 'familiar' && arbolAudiencia) {
            personasRelacionadasNormalizadas = await construirPersonasRelacionadas({
                valor: personasRelacionadas,
                arbolId: arbolAudiencia._id
            });
        }

        for (const archivo of archivosSubidos) {
            const uploadGuardado = await crearUploadDesdeArchivo({
                archivo,
                propietario: req.usuario.id
            });
            idsMultimedia.push(uploadGuardado._id);
        }

        const eventoNormalizado = await construirEventoRelacionado({
            eventoRelacionadoId,
            eventoRelacionado
        });

        if (tipoSeguro === 'familiar' && eventoNormalizado) {
            validarEventoCompatibleConArbol({
                eventoRelacionado: eventoNormalizado,
                arbol: arbolAudiencia
            });
        }

        const [mencionesNormalizadas, etiquetasMultimediaNormalizadas] = await Promise.all([
            construirListaPersonas(menciones, { incluirHandle: true }),
            construirListaPersonas(etiquetasMultimedia)
        ]);

        const nuevaPublicacion = new Publicacion({
            autor: req.usuario.id,
            tipo: tipoSeguro,
            privacidad: tipoSeguro === 'familiar' ? 'familia' : 'publico',
            arbolAudiencia: arbolAudiencia?._id || null,
            nombreFamiliaAudienciaSnapshot: arbolAudiencia ? obtenerNombreFamiliaDesdeArbol(arbolAudiencia) : '',
            contenido: contenidoLimpio,
            fechaRecuerdo: fechaRecuerdoNormalizada || null,
            fechaMomento: fechaMomentoNormalizada || null,
            multimedia: idsMultimedia,
            ubicacionTexto: ubicacionTexto || '',
            menciones: mencionesNormalizadas,
            etiquetasMultimedia: etiquetasMultimediaNormalizadas,
            personasRelacionadas: personasRelacionadasNormalizadas,
            eventoRelacionado: eventoNormalizado,
            etapaDestacada: etapaSeleccionada?._id || null,
            reacciones: [],
            compartido: 0
        });

        await nuevaPublicacion.save();
        publicacionGuardada = true;

        await sincronizarMencionesPublicacion({
            publicacion: nuevaPublicacion,
            actorId: req.usuario.id,
            mencionesAnteriores: []
        });

        let publicacionCompleta = nuevaPublicacion;

        try {
            publicacionCompleta = await poblarPublicacion(nuevaPublicacion._id, req.usuario.id) || nuevaPublicacion;
        } catch (errorPopulate) {
            console.error('⚠️ La publicación se creó, pero no se pudo poblar completamente:', errorPopulate);
        }

        return res.status(201).json({
            mensaje: 'Publicación creada con éxito',
            publicacion: serializarPublicacionParaUsuario(publicacionCompleta, req.usuario.id)
        });
    } catch (error) {
        console.error('❌ Error al crear publicación:', error);

        if (!publicacionGuardada) {
            await limpiarCargaFallida({
                archivos: archivosSubidos,
                idsUploads: idsMultimedia
            });
        }

        return res.status(error.status || 500).json({
            mensaje: error.status ? error.message : 'Error interno al crear la publicación.'
        });
    }
};

// OBTENER LAS PUBLICACIONES DEL MURO
const obtenerPublicaciones = async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario._id;
        const [filtroVisibilidad, contextoPreferencias] = await Promise.all([
            construirFiltroVisibilidadPublicaciones(usuarioId),
            obtenerContextoPreferenciasFeed(usuarioId, { limpiarExpiradas: true })
        ]);
        const filtroMuro = construirFiltroMuroConPreferencias(filtroVisibilidad, contextoPreferencias);

        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find(filtroMuro).sort({ createdAt: -1 }),
            usuarioId
        );

        res.status(200).json(
            serializarListaPublicaciones(publicaciones, usuarioId, contextoPreferencias)
        );
    } catch (error) {
        console.error('❌ Error al obtener publicaciones:', error);
        res.status(500).json({
            mensaje: 'Error al obtener las publicaciones del servidor.'
        });
    }
};


// OBTENER LA COLECCIÓN PRIVADA DE PUBLICACIONES GUARDADAS DEL USUARIO
const obtenerPublicacionesGuardadas = async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario._id;
        const paginaSolicitada = Number.parseInt(req.query.page, 10);
        const limiteSolicitado = Number.parseInt(req.query.limit, 10);
        const pagina = Number.isInteger(paginaSolicitada) && paginaSolicitada > 0
            ? paginaSolicitada
            : 1;
        const limite = Math.min(
            48,
            Number.isInteger(limiteSolicitado) && limiteSolicitado > 0
                ? limiteSolicitado
                : 24
        );
        const salto = (pagina - 1) * limite;

        const [filtroVisibilidad, contextoPreferencias] = await Promise.all([
            construirFiltroVisibilidadPublicaciones(usuarioId),
            obtenerContextoPreferenciasFeed(usuarioId, { limpiarExpiradas: true })
        ]);

        const filtroGuardadas = {
            $and: [
                filtroVisibilidad,
                { guardadaPor: usuarioId }
            ]
        };

        const [total, publicaciones] = await Promise.all([
            Publicacion.countDocuments(filtroGuardadas),
            poblarConsultaPublicaciones(
                Publicacion.find(filtroGuardadas)
                    .sort({ createdAt: -1 })
                    .skip(salto)
                    .limit(limite),
                usuarioId
            )
        ]);

        const idsPublicaciones = publicaciones
            .map(publicacion => publicacion?._id)
            .filter(Boolean);

        const conteosComentarios = idsPublicaciones.length > 0
            ? await Comentario.aggregate([
                {
                    $match: {
                        publicacionPadre: { $in: idsPublicaciones }
                    }
                },
                {
                    $group: {
                        _id: '$publicacionPadre',
                        total: { $sum: 1 }
                    }
                }
            ])
            : [];

        const comentariosPorPublicacion = new Map(
            conteosComentarios.map(item => [String(item._id), Number(item.total) || 0])
        );

        const publicacionesSerializadas = serializarListaPublicaciones(
            publicaciones,
            usuarioId,
            contextoPreferencias
        ).map(publicacion => ({
            ...publicacion,
            totalComentarios: comentariosPorPublicacion.get(String(publicacion._id)) || 0
        }));

        const totalPaginas = total > 0 ? Math.ceil(total / limite) : 0;

        return res.status(200).json({
            publicaciones: publicacionesSerializadas,
            total,
            pagina,
            limite,
            totalPaginas,
            hayMas: pagina * limite < total
        });
    } catch (error) {
        console.error('❌ Error al obtener publicaciones guardadas:', error);
        return res.status(500).json({
            mensaje: 'No se pudieron obtener tus publicaciones guardadas.'
        });
    }
};

// OBTENER PUBLICACIONES VISIBLES DE UN PERFIL CONCRETO
const obtenerPublicacionesPorUsuario = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        if (!esObjectIdValido(usuarioId)) {
            return res.status(400).json({
                mensaje: 'El identificador del usuario no es válido.'
            });
        }

        const usuarioExiste = await Usuario.exists({ _id: usuarioId });
        if (!usuarioExiste) {
            return res.status(404).json({
                mensaje: 'No se encontró el usuario solicitado.'
            });
        }

        const usuarioSolicitanteId = req.usuario.id || req.usuario._id;
        const [filtroVisibilidad, contextoPreferencias] = await Promise.all([
            construirFiltroVisibilidadPublicaciones(usuarioSolicitanteId),
            obtenerContextoPreferenciasFeed(usuarioSolicitanteId, { limpiarExpiradas: true })
        ]);
        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find({
                $and: [
                    filtroVisibilidad,
                    { autor: usuarioId }
                ]
            }).sort({ fijadaEnPerfilAt: -1, createdAt: -1 }),
            usuarioSolicitanteId
        );

        return res.status(200).json(
            serializarListaPublicaciones(publicaciones, usuarioSolicitanteId, contextoPreferencias)
        );
    } catch (error) {
        console.error('❌ Error al obtener publicaciones del perfil:', error);
        return res.status(500).json({
            mensaje: 'Error al obtener las publicaciones de este perfil.'
        });
    }
};

// BÚSQUEDA GLOBAL DE PUBLICACIONES Y PERSONAS
const buscarTodo = async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();

        if (!query) {
            return res.status(200).json({
                personas: [],
                publicaciones: []
            });
        }

        const querySinArroba = query.replace(/^@+/, '').trim();
        if (!querySinArroba) {
            return res.status(200).json({ personas: [], publicaciones: [] });
        }

        const queryComoNombre = querySinArroba.replace(/_+/g, ' ').trim();
        const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexDirecto = new RegExp(escaparRegex(querySinArroba), 'i');
        const regexNombre = new RegExp(escaparRegex(queryComoNombre), 'i');
        const usuarioId = req.usuario.id || req.usuario._id;
        const [filtroVisibilidad, contextoPreferencias] = await Promise.all([
            construirFiltroVisibilidadPublicaciones(usuarioId),
            obtenerContextoPreferenciasFeed(usuarioId, { limpiarExpiradas: true })
        ]);

        const [personasEncontradas, publicaciones] = await Promise.all([
            Usuario.find({
                $or: [
                    { nickname: regexDirecto },
                    { nombreUsuario: regexDirecto },
                    { nombreUsuario: regexNombre }
                ]
            })
                .select('nombreUsuario nickname imagenPerfil')
                .populate('imagenPerfil')
                .limit(30),

            poblarConsultaPublicaciones(
                Publicacion.find({
                    $and: [
                        filtroVisibilidad,
                        {
                            $or: [
                                { contenido: regexDirecto },
                                { ubicacionTexto: regexDirecto },
                                { tipo: regexDirecto },
                                { nombreFamiliaAudienciaSnapshot: regexDirecto },
                                { 'eventoRelacionado.tituloSnapshot': regexDirecto },
                                { 'eventoRelacionado.nombreFamiliaSnapshot': regexDirecto }
                            ]
                        }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .limit(20),
                usuarioId
            )
        ]);

        const queryHandle = normalizarHandleMencion(querySinArroba, { minusculas: true });
        const queryNombreNormalizado = normalizarTextoBusqueda(queryComoNombre);
        const puntuarPersona = (persona) => {
            const nickname = normalizarHandleMencion(persona.nickname, { minusculas: true });
            const nombre = normalizarTextoBusqueda(persona.nombreUsuario);
            if (nickname && nickname === queryHandle) return 0;
            if (nickname && nickname.startsWith(queryHandle)) return 1;
            if (nickname && nickname.includes(queryHandle)) return 2;
            if (nombre === queryNombreNormalizado) return 3;
            if (nombre.startsWith(queryNombreNormalizado)) return 4;
            if (nombre.includes(queryNombreNormalizado)) return 5;
            return 6;
        };

        const personas = personasEncontradas
            .sort((a, b) => {
                const diferencia = puntuarPersona(a) - puntuarPersona(b);
                if (diferencia !== 0) return diferencia;
                return String(a.nombreUsuario || '').localeCompare(String(b.nombreUsuario || ''), 'es');
            })
            .slice(0, 10);

        const personasSeguras = personas.map((persona) => {
            const objeto = typeof persona.toObject === 'function' ? persona.toObject() : { ...persona };
            delete objeto.email;
            return objeto;
        });

        res.status(200).json({
            personas: personasSeguras,
            publicaciones: serializarListaPublicaciones(publicaciones, usuarioId, contextoPreferencias)
        });
    } catch (error) {
        console.error('❌ Error al buscar publicaciones/personas:', error);
        res.status(500).json({
            mensaje: 'Error interno al realizar la búsqueda.',
            personas: [],
            publicaciones: []
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

        const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(req.usuario.id);

        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find({
                $and: [
                    { 'eventoRelacionado.evento': eventoId },
                    filtroVisibilidad
                ]
            })
                .sort({ createdAt: -1 }),
            req.usuario.id
        );

        const totalMultimedia = publicaciones.reduce((acumulado, publicacion) => {
            const multimedia = Array.isArray(publicacion?.multimedia) ? publicacion.multimedia : [];
            return acumulado + multimedia.filter(Boolean).length;
        }, 0);

        res.status(200).json({
            mensaje: 'Publicaciones del evento recuperadas correctamente.',
            total: publicaciones.length,
            resumen: {
                totalPublicaciones: publicaciones.length,
                totalMultimedia
            },
            publicaciones: serializarListaPublicaciones(publicaciones, req.usuario.id)
        });
    } catch (error) {
        console.error('❌ Error al obtener publicaciones por evento:', error);
        res.status(500).json({
            mensaje: 'Error interno al obtener publicaciones del evento.'
        });
    }
};


// OBTENER MOMENTOS FAMILIARES FOTOGRÁFICOS DE UN NODO DEL ÁRBOL
const obtenerMomentosFamiliaresPorNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(arbolId) || !esObjectIdValido(nodoId)) {
            return res.status(400).json({
                mensaje: 'El árbol o la persona seleccionada no tienen un ID válido.'
            });
        }

        const arbol = await Arbol.findOne({ _id: arbolId, activo: true })
            .select('_id nombreFamilia nombre titulo creador admins miembros');

        if (!arbol) {
            return res.status(404).json({ mensaje: 'El árbol seleccionado no existe o ya no está activo.' });
        }

        if (!usuarioPerteneceAlArbol(arbol, usuarioId)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para consultar los momentos de este árbol.' });
        }

        const nodo = await Nodo.findOne({ _id: nodoId, arbol: arbolId, visible: { $ne: false } })
            .select('_id usuario nombre origen');

        if (!nodo) {
            return res.status(404).json({ mensaje: 'La persona seleccionada no pertenece a este árbol.' });
        }

        const condicionesPersona = [
            { 'personasRelacionadas.nodo': nodo._id }
        ];

        if (nodo.usuario) {
            condicionesPersona.push(
                { autor: nodo.usuario },
                { 'personasRelacionadas.usuario': nodo.usuario },
                { 'menciones.usuario': nodo.usuario },
                { 'etiquetasMultimedia.usuario': nodo.usuario }
            );
        }

        const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(usuarioId);
        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find({
                $and: [
                    filtroVisibilidad,
                    { tipo: 'familiar' },
                    {
                        $or: [
                            { arbolAudiencia: arbol._id },
                            { 'eventoRelacionado.arbol': arbol._id }
                        ]
                    },
                    { $or: condicionesPersona }
                ]
            }),
            usuarioId
        );

        const publicacionesConFotos = publicaciones
            .map(publicacion => {
                const objeto = typeof publicacion.toObject === 'function'
                    ? publicacion.toObject()
                    : publicacion;
                const fotografias = (Array.isArray(objeto.multimedia) ? objeto.multimedia : [])
                    .filter(esFotografiaPublicacion);

                if (fotografias.length === 0) return null;

                const fechaEfectiva = objeto.fechaMomento || objeto.createdAt;
                return {
                    ...objeto,
                    multimedia: fotografias,
                    fechaEfectiva
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(a.fechaEfectiva).getTime() - new Date(b.fechaEfectiva).getTime());

        const idsPublicaciones = publicacionesConFotos.map(item => item._id);
        const conteos = idsPublicaciones.length > 0
            ? await Comentario.aggregate([
                { $match: { publicacionPadre: { $in: idsPublicaciones } } },
                { $group: { _id: '$publicacionPadre', total: { $sum: 1 } } }
            ])
            : [];
        const mapaConteos = new Map(conteos.map(item => [String(item._id), item.total]));

        const respuesta = publicacionesConFotos.map(publicacion => ({
            ...serializarPublicacionParaUsuario(publicacion, req.usuario.id),
            totalComentarios: mapaConteos.get(String(publicacion._id)) || 0
        }));

        return res.status(200).json({
            nodo: {
                _id: nodo._id,
                nombre: nodo.nombre,
                origen: nodo.origen
            },
            totalPublicaciones: respuesta.length,
            totalFotos: respuesta.reduce((total, pub) => total + pub.multimedia.length, 0),
            publicaciones: respuesta
        });
    } catch (error) {
        console.error('❌ Error al obtener Momentos Familiares del nodo:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'Error interno al obtener los Momentos Familiares.'
        });
    }
};


// OBTENER UNA PUBLICACIÓN VISIBLE POR ID
const obtenerPublicacionPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await obtenerPublicacionVisiblePorId({
            publicacionId: id,
            usuarioId: req.usuario.id
        });

        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada o sin permiso para verla.' });
        }

        return res.status(200).json({
            publicacion: serializarPublicacionParaUsuario(publicacion, req.usuario.id)
        });
    } catch (error) {
        console.error('❌ Error al obtener una publicación:', error);
        return res.status(500).json({ mensaje: 'Error interno al obtener la publicación.' });
    }
};

// CREAR UN REPOST INMEDIATO SIN ABRIR EL COMPOSITOR
const compartirPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacionVisible = await obtenerPublicacionVisiblePorId({
            publicacionId: id,
            usuarioId
        });
        if (!publicacionVisible) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada o sin permiso para compartirla.'
            });
        }

        const compartidoDesde = await Publicacion.findById(id)
            .select('_id autor publicacionOriginal compartido');
        if (!compartidoDesde) {
            return res.status(404).json({ mensaje: 'La publicación ya no existe.' });
        }

        const publicacionOriginalId = compartidoDesde.publicacionOriginal || compartidoDesde._id;
        const originalVisible = await obtenerPublicacionVisiblePorId({
            publicacionId: publicacionOriginalId,
            usuarioId
        });

        if (!originalVisible) {
            return res.status(403).json({
                mensaje: 'El contenido original no está disponible para compartir.'
            });
        }

        const existente = await Publicacion.findOne({
            autor: usuarioId,
            publicacionOriginal: publicacionOriginalId
        });

        if (existente) {
            const existenteCompleta = await poblarPublicacion(existente._id, usuarioId) || existente;
            return res.status(200).json({
                mensaje: 'Ya habías compartido esta publicación.',
                compartidaExistente: true,
                publicacion: serializarPublicacionParaUsuario(existenteCompleta, usuarioId)
            });
        }

        let repost;
        let repostCreadoAhora = true;
        try {
            repost = await Publicacion.create({
                autor: usuarioId,
                tipo: 'historico',
                privacidad: 'publico',
                publicacionOriginal: publicacionOriginalId,
                compartidoDesde: compartidoDesde._id,
                contenido: '',
                multimedia: [],
                reacciones: [],
                compartido: 0,
                guardadaPor: []
            });
        } catch (error) {
            if (error?.code !== 11000) throw error;
            repostCreadoAhora = false;
            repost = await Publicacion.findOne({
                autor: usuarioId,
                publicacionOriginal: publicacionOriginalId
            });
        }

        if (!repost) {
            return res.status(409).json({ mensaje: 'No se pudo crear el repost.' });
        }

        if (!repostCreadoAhora) {
            const repostCompletoExistente = await poblarPublicacion(repost._id, usuarioId) || repost;
            return res.status(200).json({
                mensaje: 'Ya habías compartido esta publicación.',
                compartidaExistente: true,
                publicacion: serializarPublicacionParaUsuario(repostCompletoExistente, usuarioId)
            });
        }

        await Publicacion.updateOne(
            { _id: compartidoDesde._id },
            { $inc: { compartido: 1 } }
        );

        await crearNotificacion({
            destinatarioId: compartidoDesde.autor,
            actorId: usuarioId,
            tipo: 'compartido_publicacion',
            publicacionId: repost._id,
            enlaceReferencia: `/perfil/${usuarioId}?publicacion=${repost._id}`,
            claveEvento: crearClaveEvento('compartido_publicacion', repost._id)
        });

        const repostCompleto = await poblarPublicacion(repost._id, usuarioId) || repost;
        return res.status(201).json({
            mensaje: 'Publicación compartida en tu perfil.',
            compartidaExistente: false,
            publicacion: serializarPublicacionParaUsuario(repostCompleto, usuarioId),
            compartidoDesdeId: compartidoDesde._id
        });
    } catch (error) {
        console.error('❌ Error al compartir publicación:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo compartir la publicación.'
        });
    }
};

const tieneCampo = (objeto, campo) => Object.prototype.hasOwnProperty.call(objeto || {}, campo);

// EDITAR PUBLICACIÓN Y SU MULTIMEDIA
const editarPublicacion = async (req, res) => {
    const archivosSubidos = obtenerArchivosSubidos(req);
    const idsUploadsNuevos = [];
    let edicionGuardada = false;

    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;
        const body = req.body || {};

        if (!esObjectIdValido(id)) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await Publicacion.findById(id).populate('multimedia');
        if (!publicacion) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(404).json({ mensaje: 'La publicación no existe.' });
        }

        asegurarAutorPublicacion(publicacion, usuarioId);

        if (publicacion.publicacionOriginal) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'Los reposts no permiten editar contenido ni multimedia.'
            });
        }

        const mencionesAnteriores = Array.isArray(publicacion.menciones)
            ? publicacion.menciones.map((mencion) => ({
                usuario: mencion.usuario,
                nombre: mencion.nombre,
                handle: mencion.handle
            }))
            : [];

        const tipoSeguro = publicacion.tipo === 'familiar' ? 'familiar' : 'historico';
        const etapaFueEnviada = tieneCampo(body, 'etapaDestacadaId');
        let etapaFinal = publicacion.etapaDestacada || null;

        if (etapaFueEnviada) {
            etapaFinal = body.etapaDestacadaId
                ? await obtenerEtapaPropiaValida({ etapaId: body.etapaDestacadaId, usuarioId })
                : null;
        }

        const uploadsOriginales = (Array.isArray(publicacion.multimedia) ? publicacion.multimedia : []).filter(Boolean);
        const mapaUploadsOriginales = new Map(
            uploadsOriginales.map(upload => [String(obtenerIdSeguro(upload)), upload])
        );

        let idsMultimediaConservada = uploadsOriginales.map(upload => String(obtenerIdSeguro(upload))).filter(Boolean);
        if (tieneCampo(body, 'multimediaExistenteIds')) {
            const solicitados = parseJSONSeguro(body.multimediaExistenteIds, []);
            if (!Array.isArray(solicitados)) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(400).json({ mensaje: 'La lista de multimedia existente no es válida.' });
            }

            idsMultimediaConservada = Array.from(new Set(solicitados.map(obtenerIdSeguro).filter(Boolean).map(String)));
            const contieneIdAjeno = idsMultimediaConservada.some(uploadId => !mapaUploadsOriginales.has(uploadId));
            if (contieneIdAjeno) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(400).json({ mensaje: 'Uno de los archivos indicados no pertenece a esta publicación.' });
            }
        }

        const uploadsConservados = idsMultimediaConservada.map(uploadId => mapaUploadsOriginales.get(uploadId)).filter(Boolean);
        const totalMultimediaFinal = uploadsConservados.length + archivosSubidos.length;

        if (totalMultimediaFinal > MAX_PUBLICATION_MEDIA_FILES) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: `Solo puedes conservar hasta ${MAX_PUBLICATION_MEDIA_FILES} archivos por publicación.`
            });
        }

        const pesoTotal = uploadsConservados.reduce(
            (total, upload) => total + (Number(upload.pesoBytes) || 0),
            archivosSubidos.reduce((total, archivo) => total + (Number(archivo?.size) || 0), 0)
        );

        if (pesoTotal > MAX_PUBLICATION_TOTAL_SIZE_BYTES) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(413).json({
                mensaje: `El conjunto de archivos supera el límite de ${MAX_UPLOAD_SIZE_MB} MB.`
            });
        }

        const archivosCombinados = [
            ...uploadsConservados.map(upload => ({ mimetype: upload.formato })),
            ...archivosSubidos
        ];
        const errorCombinacion = validarCombinacionMultimedia(archivosCombinados);
        if (errorCombinacion) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({ mensaje: errorCombinacion });
        }

        const contenidoFinal = tieneCampo(body, 'contenido')
            ? String(body.contenido || '').trim()
            : String(publicacion.contenido || '').trim();

        if (!contenidoFinal && totalMultimediaFinal === 0) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'La publicación debe conservar texto o al menos un archivo multimedia.'
            });
        }

        let arbolAudiencia = null;
        let arbolCambio = false;
        let eventoFinal = publicacion.eventoRelacionado || null;

        if (tipoSeguro === 'familiar') {
            const arbolSolicitado = tieneCampo(body, 'arbolAudienciaId')
                ? body.arbolAudienciaId
                : obtenerIdSeguro(publicacion.arbolAudiencia);

            const resultadoArbol = await obtenerArbolAudienciaValido({
                usuarioId,
                arbolAudienciaId: arbolSolicitado,
                eventoRelacionado: body.eventoRelacionado
            });

            if (resultadoArbol.error) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(resultadoArbol.error.status).json({ mensaje: resultadoArbol.error.mensaje });
            }

            arbolAudiencia = resultadoArbol.arbol;
            arbolCambio = !sonMismoId(publicacion.arbolAudiencia, arbolAudiencia._id);

            const eventoFueEnviado = tieneCampo(body, 'eventoRelacionadoId') || tieneCampo(body, 'eventoRelacionado');
            if (eventoFueEnviado) {
                eventoFinal = await construirEventoRelacionado({
                    eventoRelacionadoId: body.eventoRelacionadoId,
                    eventoRelacionado: body.eventoRelacionado
                });
            } else if (arbolCambio && eventoFinal && !sonMismoId(eventoFinal.arbol, arbolAudiencia._id)) {
                eventoFinal = null;
            }

            if (eventoFinal) {
                validarEventoCompatibleConArbol({ eventoRelacionado: eventoFinal, arbol: arbolAudiencia });
            }
        }

        let fechaRecuerdoFinal = null;
        let fechaMomentoFinal = null;

        if (etapaFinal) {
            fechaRecuerdoFinal = tipoSeguro === 'historico'
                ? (tieneCampo(body, 'fechaRecuerdo')
                    ? normalizarFechaRecuerdo(body.fechaRecuerdo)
                    : publicacion.fechaRecuerdo)
                : null;
            fechaMomentoFinal = tipoSeguro === 'familiar'
                ? (tieneCampo(body, 'fechaMomento')
                    ? normalizarFechaMomento(body.fechaMomento)
                    : publicacion.fechaMomento)
                : null;

            const fechaEtapaFinal = tipoSeguro === 'historico' ? fechaRecuerdoFinal : fechaMomentoFinal;
            if (fechaEtapaFinal === undefined) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(400).json({ mensaje: 'La fecha de la Etapa no es válida.' });
            }
            if (!fechaEtapaFinal) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(400).json({ mensaje: 'Selecciona la fecha que corresponde a esta Etapa.' });
            }
        } else if (etapaFueEnviada) {
            // Al retirar una Etapa, su fecha cronológica también se elimina.
            fechaRecuerdoFinal = null;
            fechaMomentoFinal = null;
        } else {
            // Compatibilidad: se conservan fechas legadas mientras no se intenten modificar.
            if (tieneCampo(body, 'fechaRecuerdo') || tieneCampo(body, 'fechaMomento')) {
                await limpiarCargaFallida({ archivos: archivosSubidos });
                return res.status(400).json({
                    mensaje: 'Selecciona una Etapa antes de modificar la fecha cronológica.'
                });
            }
            fechaRecuerdoFinal = tipoSeguro === 'historico' ? publicacion.fechaRecuerdo : null;
            fechaMomentoFinal = tipoSeguro === 'familiar' ? publicacion.fechaMomento : null;
        }

        let mencionesFinales = publicacion.menciones;
        if (tieneCampo(body, 'menciones')) {
            mencionesFinales = await construirListaPersonas(body.menciones, { incluirHandle: true });
        }

        let etiquetasFinales = publicacion.etiquetasMultimedia;
        if (tieneCampo(body, 'etiquetasMultimedia')) {
            etiquetasFinales = await construirListaPersonas(body.etiquetasMultimedia);
        }

        let personasRelacionadasFinales = publicacion.personasRelacionadas;
        if (tipoSeguro === 'familiar') {
            if (tieneCampo(body, 'personasRelacionadas')) {
                personasRelacionadasFinales = await construirPersonasRelacionadas({
                    valor: body.personasRelacionadas,
                    arbolId: arbolAudiencia._id
                });
            } else if (arbolCambio) {
                personasRelacionadasFinales = [];
            }
        } else {
            personasRelacionadasFinales = [];
        }

        for (const archivo of archivosSubidos) {
            const uploadGuardado = await crearUploadDesdeArchivo({ archivo, propietario: usuarioId });
            idsUploadsNuevos.push(uploadGuardado._id);
        }

        const idsFinalesMultimedia = [
            ...idsMultimediaConservada,
            ...idsUploadsNuevos.map(String)
        ];

        publicacion.contenido = contenidoFinal;
        publicacion.ubicacionTexto = tieneCampo(body, 'ubicacionTexto')
            ? String(body.ubicacionTexto || '').trim()
            : publicacion.ubicacionTexto;
        publicacion.fechaRecuerdo = fechaRecuerdoFinal || null;
        publicacion.fechaMomento = fechaMomentoFinal || null;
        publicacion.etapaDestacada = etapaFinal?._id || etapaFinal || null;
        publicacion.menciones = mencionesFinales;
        publicacion.etiquetasMultimedia = etiquetasFinales;
        publicacion.personasRelacionadas = personasRelacionadasFinales;
        publicacion.multimedia = idsFinalesMultimedia;

        if (tipoSeguro === 'familiar') {
            publicacion.privacidad = 'familia';
            publicacion.arbolAudiencia = arbolAudiencia._id;
            publicacion.nombreFamiliaAudienciaSnapshot = obtenerNombreFamiliaDesdeArbol(arbolAudiencia);
            publicacion.eventoRelacionado = eventoFinal;
        } else {
            publicacion.privacidad = 'publico';
        }

        await publicacion.save();
        edicionGuardada = true;

        await sincronizarMencionesPublicacion({
            publicacion,
            actorId: usuarioId,
            mencionesAnteriores
        });

        const idsConservadosSet = new Set(idsMultimediaConservada.map(String));
        const uploadsRetirados = uploadsOriginales.filter(upload => !idsConservadosSet.has(String(obtenerIdSeguro(upload))));
        try {
            await limpiarUploadsRetirados({ uploads: uploadsRetirados, publicacionExcluidaId: publicacion._id });
        } catch (errorLimpieza) {
            console.error('⚠️ La publicación se actualizó, pero quedó multimedia pendiente de limpieza:', errorLimpieza);
        }

        const publicacionCompleta = await poblarPublicacion(publicacion._id, usuarioId) || publicacion;
        return res.status(200).json({
            mensaje: 'Publicación actualizada correctamente.',
            publicacion: serializarPublicacionParaUsuario(publicacionCompleta, usuarioId)
        });
    } catch (error) {
        console.error('❌ Error al editar publicación:', error);

        if (!edicionGuardada) {
            await limpiarCargaFallida({
                archivos: archivosSubidos,
                idsUploads: idsUploadsNuevos
            });
        }

        return res.status(error.status || 500).json({
            mensaje: error.status ? error.message : 'Error interno al editar la publicación.'
        });
    }
};

// FIJAR O DESFIJAR UNA PUBLICACIÓN EN EL PERFIL DEL AUTOR
const alternarFijacionPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await Publicacion.findById(id);
        if (!publicacion) return res.status(404).json({ mensaje: 'La publicación no existe.' });
        asegurarAutorPublicacion(publicacion, usuarioId);

        const estabaFijada = Boolean(publicacion.fijadaEnPerfilAt);
        let fijadaEnPerfilAt = null;

        if (estabaFijada) {
            publicacion.fijadaEnPerfilAt = null;
            await publicacion.save();
        } else {
            await Publicacion.updateMany(
                { autor: usuarioId, fijadaEnPerfilAt: { $ne: null } },
                { $set: { fijadaEnPerfilAt: null } }
            );

            fijadaEnPerfilAt = new Date();
            publicacion.fijadaEnPerfilAt = fijadaEnPerfilAt;
            await publicacion.save();
        }

        return res.status(200).json({
            mensaje: estabaFijada ? 'Publicación desfijada.' : 'Publicación fijada en tu perfil.',
            publicacionId: publicacion._id,
            fijadaEnPerfil: !estabaFijada,
            fijadaEnPerfilAt
        });
    } catch (error) {
        console.error('❌ Error al fijar publicación:', error);
        return res.status(error.code === 11000 ? 409 : (error.status || 500)).json({
            mensaje: error.code === 11000
                ? 'Ya existe otra publicación fijada. Intenta nuevamente.'
                : (error.message || 'No se pudo actualizar la fijación.')
        });
    }
};

// GUARDAR O QUITAR UNA PUBLICACIÓN DE LOS ELEMENTOS GUARDADOS DEL USUARIO
const alternarGuardadoPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await obtenerPublicacionVisiblePorId({ publicacionId: id, usuarioId });
        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada o sin permiso para verla.' });
        }

        const guardadaPorMi = (Array.isArray(publicacion.guardadaPor) ? publicacion.guardadaPor : [])
            .some(idUsuario => sonMismoId(idUsuario, usuarioId));

        await Publicacion.updateOne(
            { _id: id },
            guardadaPorMi
                ? { $pull: { guardadaPor: usuarioId } }
                : { $addToSet: { guardadaPor: usuarioId } }
        );

        const claveGuardado = crearClaveEvento('guardado_publicacion', id, usuarioId);
        if (guardadaPorMi) {
            await eliminarNotificacionPorClave(claveGuardado);
        } else {
            await crearNotificacion({
                destinatarioId: obtenerIdSeguro(publicacion.autor),
                actorId: usuarioId,
                tipo: 'guardado_publicacion',
                publicacionId: id,
                enlaceReferencia: `/perfil/${obtenerIdSeguro(publicacion.autor)}?publicacion=${id}`,
                claveEvento: claveGuardado
            });
        }

        return res.status(200).json({
            mensaje: guardadaPorMi ? 'Publicación eliminada de guardados.' : 'Publicación guardada.',
            publicacionId: id,
            guardadaPorMi: !guardadaPorMi
        });
    } catch (error) {
        console.error('❌ Error al guardar publicación:', error);
        return res.status(500).json({ mensaje: 'No se pudo actualizar la publicación guardada.' });
    }
};

// OCULTAR UNA PUBLICACIÓN AJENA ÚNICAMENTE DEL INICIO DEL USUARIO
const ocultarPublicacionDeInicio = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await obtenerPublicacionVisiblePorId({ publicacionId: id, usuarioId });
        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada o sin permiso para verla.' });
        }

        if (sonMismoId(publicacion.autor, usuarioId)) {
            return res.status(400).json({ mensaje: 'No puedes ocultar de tu Inicio una publicación propia.' });
        }

        await Usuario.updateOne(
            { _id: usuarioId },
            { $addToSet: { 'preferenciasFeed.publicacionesOcultas': publicacion._id } }
        );

        return res.status(200).json({
            mensaje: 'La publicación dejará de aparecer en tu Inicio.',
            publicacionId: publicacion._id,
            ocultaDeMiInicio: true
        });
    } catch (error) {
        console.error('❌ Error al ocultar publicación del Inicio:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo ocultar la publicación de tu Inicio.'
        });
    }
};

// VOLVER A MOSTRAR EN INICIO UNA PUBLICACIÓN OCULTA POR EL USUARIO
const mostrarPublicacionEnInicio = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await obtenerPublicacionVisiblePorId({ publicacionId: id, usuarioId });
        if (!publicacion) {
            return res.status(404).json({ mensaje: 'Publicación no encontrada o sin permiso para verla.' });
        }

        await Usuario.updateOne(
            { _id: usuarioId },
            { $pull: { 'preferenciasFeed.publicacionesOcultas': publicacion._id } }
        );

        return res.status(200).json({
            mensaje: 'La publicación volverá a aparecer en tu Inicio.',
            publicacionId: publicacion._id,
            ocultaDeMiInicio: false
        });
    } catch (error) {
        console.error('❌ Error al volver a mostrar publicación en Inicio:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo volver a mostrar la publicación en tu Inicio.'
        });
    }
};

// PAUSAR DURANTE 30 DÍAS LAS PUBLICACIONES DE OTRO AUTOR EN INICIO
const pausarAutorEnInicio = async (req, res) => {
    try {
        const { autorId } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(autorId)) {
            return res.status(400).json({ mensaje: 'El ID del autor no es válido.' });
        }

        if (sonMismoId(autorId, usuarioId)) {
            return res.status(400).json({ mensaje: 'No puedes pausar tus propias publicaciones.' });
        }

        const [autorExiste, filtroVisibilidad] = await Promise.all([
            Usuario.exists({ _id: autorId }),
            construirFiltroVisibilidadPublicaciones(usuarioId)
        ]);

        if (!autorExiste) {
            return res.status(404).json({ mensaje: 'No se encontró al autor solicitado.' });
        }

        const tienePublicacionVisible = await Publicacion.exists({
            $and: [
                { autor: autorId },
                filtroVisibilidad
            ]
        });

        if (!tienePublicacionVisible) {
            return res.status(404).json({ mensaje: 'No tienes publicaciones visibles de este autor para pausar.' });
        }

        const hasta = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

        await Usuario.updateOne(
            { _id: usuarioId },
            { $pull: { 'preferenciasFeed.autoresPausados': { autor: autorId } } }
        );
        await Usuario.updateOne(
            { _id: usuarioId },
            { $push: { 'preferenciasFeed.autoresPausados': { autor: autorId, hasta } } }
        );

        return res.status(200).json({
            mensaje: 'Las publicaciones de este autor se pausaron durante 30 días.',
            autorId,
            autorPausadoEnInicio: true,
            autorPausadoHasta: hasta
        });
    } catch (error) {
        console.error('❌ Error al pausar autor en Inicio:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudieron pausar las publicaciones de este autor.'
        });
    }
};

// REANUDAR LAS PUBLICACIONES DE UN AUTOR EN INICIO
const reanudarAutorEnInicio = async (req, res) => {
    try {
        const { autorId } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(autorId)) {
            return res.status(400).json({ mensaje: 'El ID del autor no es válido.' });
        }

        await Usuario.updateOne(
            { _id: usuarioId },
            { $pull: { 'preferenciasFeed.autoresPausados': { autor: autorId } } }
        );

        return res.status(200).json({
            mensaje: 'Las publicaciones de este autor volverán a aparecer en tu Inicio.',
            autorId,
            autorPausadoEnInicio: false,
            autorPausadoHasta: null
        });
    } catch (error) {
        console.error('❌ Error al reanudar autor en Inicio:', error);
        return res.status(500).json({
            mensaje: 'No se pudieron reanudar las publicaciones de este autor.'
        });
    }
};

// ELIMINAR DEFINITIVAMENTE UNA PUBLICACIÓN DEL AUTOR
const eliminarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await Publicacion.findById(id).populate('multimedia');
        if (!publicacion) return res.status(404).json({ mensaje: 'La publicación no existe.' });
        asegurarAutorPublicacion(publicacion, usuarioId);

        const uploads = (Array.isArray(publicacion.multimedia) ? publicacion.multimedia : []).filter(Boolean);

        const resultadoEliminacion = await Publicacion.deleteOne({ _id: publicacion._id });
        if (resultadoEliminacion.deletedCount !== 1) {
            const error = new Error('La publicación no pudo eliminarse.');
            error.status = 409;
            throw error;
        }

        if (publicacion.publicacionOriginal && publicacion.compartidoDesde) {
            await Publicacion.updateOne(
                { _id: publicacion.compartidoDesde, compartido: { $gt: 0 } },
                { $inc: { compartido: -1 } }
            );
        }

        await eliminarNotificaciones({
            $or: [
                { publicacion: publicacion._id },
                { claveEvento: crearClaveEvento('compartido_publicacion', publicacion._id) }
            ]
        });

        try {
            await Comentario.deleteMany({ publicacionPadre: publicacion._id });
        } catch (errorComentarios) {
            console.error('⚠️ La publicación se eliminó, pero quedaron comentarios pendientes de limpieza:', errorComentarios);
        }

        try {
            await Usuario.updateMany(
                { 'preferenciasFeed.publicacionesOcultas': publicacion._id },
                { $pull: { 'preferenciasFeed.publicacionesOcultas': publicacion._id } }
            );
        } catch (errorPreferencias) {
            console.error('⚠️ La publicación se eliminó, pero quedaron preferencias de Inicio pendientes de limpieza:', errorPreferencias);
        }

        try {
            await limpiarUploadsRetirados({ uploads, publicacionExcluidaId: publicacion._id });
        } catch (errorLimpieza) {
            console.error('⚠️ La publicación se eliminó, pero quedó multimedia pendiente de limpieza:', errorLimpieza);
        }

        return res.status(200).json({
            mensaje: 'Publicación eliminada definitivamente.',
            publicacionId: publicacion._id
        });
    } catch (error) {
        console.error('❌ Error al eliminar publicación:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo eliminar la publicación.'
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

        const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(usuarioId);
        const publicacion = await Publicacion.findOne({
            $and: [
                { _id: id },
                filtroVisibilidad
            ]
        });

        if (!publicacion) {
            return res.status(404).json({
                mensaje: 'Publicación no encontrada o sin permiso para verla.'
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

        const claveReaccion = crearClaveEvento('reaccion_publicacion', id, usuarioId);
        if (yaReacciono) {
            await eliminarNotificacionPorClave(claveReaccion);
        } else {
            await crearNotificacion({
                destinatarioId: publicacion.autor,
                actorId: usuarioId,
                tipo: 'reaccion_publicacion',
                publicacionId: publicacion._id,
                enlaceReferencia: `/perfil/${obtenerIdSeguro(publicacion.autor)}?publicacion=${publicacion._id}`,
                claveEvento: claveReaccion
            });
        }

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


// ASIGNAR UNA ETAPA A UNA PUBLICACIÓN DEL AUTOR
const asignarEtapaPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;
        const { etapaDestacadaId, fecha } = req.body || {};

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await Publicacion.findById(id);
        if (!publicacion) return res.status(404).json({ mensaje: 'La publicación no existe.' });
        asegurarAutorPublicacion(publicacion, usuarioId);

        const etapa = await obtenerEtapaPropiaValida({ etapaId: etapaDestacadaId, usuarioId });
        if (!etapa) return res.status(400).json({ mensaje: 'Selecciona una Etapa.' });

        const fechaNormalizada = normalizarFechaMomento(fecha);
        if (fechaNormalizada === undefined || !fechaNormalizada) {
            return res.status(400).json({ mensaje: 'Selecciona una fecha válida para la Etapa.' });
        }

        publicacion.etapaDestacada = etapa._id;
        if (publicacion.tipo === 'familiar') {
            publicacion.fechaMomento = fechaNormalizada;
            publicacion.fechaRecuerdo = null;
        } else {
            publicacion.fechaRecuerdo = fechaNormalizada;
            publicacion.fechaMomento = null;
        }
        await publicacion.save();

        const completa = await poblarPublicacion(publicacion._id, usuarioId) || publicacion;
        return res.status(200).json({
            mensaje: 'Etapa agregada correctamente.',
            publicacion: serializarPublicacionParaUsuario(completa, usuarioId)
        });
    } catch (error) {
        console.error('❌ Error al asignar Etapa a publicación:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo agregar la Etapa.'
        });
    }
};

// RETIRAR LA ETAPA SIN ELIMINAR LA PUBLICACIÓN NI SU MULTIMEDIA
const eliminarEtapaPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id || req.usuario._id;

        if (!esObjectIdValido(id)) {
            return res.status(400).json({ mensaje: 'El ID de la publicación no es válido.' });
        }

        const publicacion = await Publicacion.findById(id);
        if (!publicacion) return res.status(404).json({ mensaje: 'La publicación no existe.' });
        asegurarAutorPublicacion(publicacion, usuarioId);

        publicacion.etapaDestacada = null;
        publicacion.fechaRecuerdo = null;
        publicacion.fechaMomento = null;
        await publicacion.save();

        const completa = await poblarPublicacion(publicacion._id, usuarioId) || publicacion;
        return res.status(200).json({
            mensaje: 'Etapa retirada. La publicación y sus archivos se conservaron.',
            publicacion: serializarPublicacionParaUsuario(completa, usuarioId)
        });
    } catch (error) {
        console.error('❌ Error al retirar Etapa de publicación:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo retirar la Etapa.'
        });
    }
};

module.exports = {
    crearPublicacion,
    obtenerPublicaciones,
    obtenerPublicacionesGuardadas,
    obtenerPublicacionesPorUsuario,
    obtenerPublicacionPorId,
    editarPublicacion,
    alternarFijacionPublicacion,
    alternarGuardadoPublicacion,
    ocultarPublicacionDeInicio,
    mostrarPublicacionEnInicio,
    pausarAutorEnInicio,
    reanudarAutorEnInicio,
    eliminarPublicacion,
    buscarTodo,
    obtenerPublicacionesPorEvento,
    obtenerMomentosFamiliaresPorNodo,
    asignarEtapaPublicacion,
    eliminarEtapaPublicacion,
    reaccionarPublicacion,
    compartirPublicacion
};