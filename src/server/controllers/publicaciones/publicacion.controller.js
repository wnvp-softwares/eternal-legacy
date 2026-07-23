const mongoose = require('mongoose');
const { Publicacion, Upload, Usuario, Arbol } = require('../../models/index.model');
const Nodo = require('../../models/arboles/nodo.model');
const Comentario = require('../../models/publicacion/comentario.model');

const EventoFamiliar = require('../../models/arboles/eventoFamiliar.model');
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

const construirFiltroVisibilidadPublicaciones = async (usuarioId) => {
    const idsArbolesPermitidos = await obtenerIdsArbolesPermitidosUsuario(usuarioId);

    return {
        $or: [
            { tipo: 'historico' },
            { privacidad: 'publico' },
            { autor: usuarioId },

            // Publicaciones familiares nuevas.
            {
                tipo: 'familiar',
                privacidad: 'familia',
                arbolAudiencia: { $in: idsArbolesPermitidos }
            },

            // Compatibilidad con publicaciones familiares antiguas que estaban ligadas a evento.
            {
                tipo: 'familiar',
                privacidad: { $exists: false },
                'eventoRelacionado.arbol': { $in: idsArbolesPermitidos }
            },
            {
                tipo: 'familiar',
                arbolAudiencia: { $exists: false },
                'eventoRelacionado.arbol': { $in: idsArbolesPermitidos }
            }
        ]
    };
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
            select: 'nombreUsuario nickname email imagenPerfil',
            populate: {
                path: 'imagenPerfil'
            }
        })
        .populate('multimedia')
        .populate('menciones.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('etiquetasMultimedia.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('personasRelacionadas.nodo', 'nombre usuario origen')
        .populate('personasRelacionadas.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('eventoRelacionado.evento')
        .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo')
        .populate('arbolAudiencia', 'nombreFamilia nombre titulo');
};

const poblarConsultaPublicaciones = (consulta) => {
    return consulta
        .populate({
            path: 'autor',
            select: 'nombreUsuario nickname email imagenPerfil',
            populate: {
                path: 'imagenPerfil'
            }
        })
        .populate('multimedia')
        .populate('menciones.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('etiquetasMultimedia.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('personasRelacionadas.nodo', 'nombre usuario origen')
        .populate('personasRelacionadas.usuario', 'nombreUsuario nickname email imagenPerfil')
        .populate('eventoRelacionado.evento')
        .populate('eventoRelacionado.arbol', 'nombreFamilia nombre titulo')
        .populate('arbolAudiencia', 'nombreFamilia nombre titulo');
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
            fechaMomento,
            personasRelacionadas
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

        const fechaMomentoNormalizada = tipoSeguro === 'familiar'
            ? normalizarFechaMomento(fechaMomento)
            : null;

        if (fechaMomentoNormalizada === undefined) {
            await limpiarCargaFallida({ archivos: archivosSubidos });
            return res.status(400).json({
                mensaje: 'La fecha del momento no es válida.'
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
            const nuevoUpload = new Upload({
                propietario: req.usuario.id,
                urlArchivo: archivo.path,
                formato: archivo.mimetype,
                pesoBytes: Number(archivo.size) || 0
            });

            const uploadGuardado = await nuevoUpload.save();
            idsMultimedia.push(uploadGuardado._id);
        }

        const eventoNormalizado = await construirEventoRelacionado({
            eventoRelacionadoId,
            eventoRelacionado
        });

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
            fechaMomento: fechaMomentoNormalizada || null,
            multimedia: idsMultimedia,
            ubicacionTexto: ubicacionTexto || '',
            menciones: mencionesNormalizadas,
            etiquetasMultimedia: etiquetasMultimediaNormalizadas,
            personasRelacionadas: personasRelacionadasNormalizadas,
            eventoRelacionado: eventoNormalizado,
            reacciones: [],
            compartido: 0
        });

        await nuevaPublicacion.save();
        publicacionGuardada = true;

        let publicacionCompleta = nuevaPublicacion;

        try {
            publicacionCompleta = await poblarPublicacion(nuevaPublicacion._id) || nuevaPublicacion;
        } catch (errorPopulate) {
            console.error('⚠️ La publicación se creó, pero no se pudo poblar completamente:', errorPopulate);
        }

        return res.status(201).json({
            mensaje: 'Publicación creada con éxito',
            publicacion: publicacionCompleta
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
        const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(req.usuario.id);

        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find(filtroVisibilidad).sort({ createdAt: -1 })
        );

        res.status(200).json(publicaciones);
    } catch (error) {
        console.error('❌ Error al obtener publicaciones:', error);
        res.status(500).json({
            mensaje: 'Error al obtener las publicaciones del servidor.'
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
        const filtroVisibilidad = await construirFiltroVisibilidadPublicaciones(req.usuario.id);

        const [personasEncontradas, publicaciones] = await Promise.all([
            Usuario.find({
                $or: [
                    { nickname: regexDirecto },
                    { nombreUsuario: regexDirecto },
                    { nombreUsuario: regexNombre },
                    { email: regexDirecto }
                ]
            })
                .select('nombreUsuario nickname email imagenPerfil')
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
                    .limit(20)
            )
        ]);

        const queryHandle = normalizarHandleMencion(querySinArroba, { minusculas: true });
        const queryNombreNormalizado = normalizarTextoBusqueda(queryComoNombre);
        const puntuarPersona = (persona) => {
            const nickname = normalizarHandleMencion(persona.nickname, { minusculas: true });
            const nombre = normalizarTextoBusqueda(persona.nombreUsuario);
            const email = normalizarTextoBusqueda(persona.email);

            if (nickname && nickname === queryHandle) return 0;
            if (nickname && nickname.startsWith(queryHandle)) return 1;
            if (nickname && nickname.includes(queryHandle)) return 2;
            if (nombre === queryNombreNormalizado) return 3;
            if (nombre.startsWith(queryNombreNormalizado)) return 4;
            if (nombre.includes(queryNombreNormalizado)) return 5;
            if (email === normalizarTextoBusqueda(querySinArroba)) return 6;
            return 7;
        };

        const personas = personasEncontradas
            .sort((a, b) => {
                const diferencia = puntuarPersona(a) - puntuarPersona(b);
                if (diferencia !== 0) return diferencia;
                return String(a.nombreUsuario || '').localeCompare(String(b.nombreUsuario || ''), 'es');
            })
            .slice(0, 10);

        res.status(200).json({
            personas,
            publicaciones
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
                .sort({ createdAt: -1 })
        );

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

        const publicaciones = await poblarConsultaPublicaciones(
            Publicacion.find({
                tipo: 'familiar',
                $and: [
                    {
                        $or: [
                            { arbolAudiencia: arbol._id },
                            { 'eventoRelacionado.arbol': arbol._id }
                        ]
                    },
                    { $or: condicionesPersona }
                ]
            })
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
            ...publicacion,
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
    buscarTodo,
    obtenerPublicacionesPorEvento,
    obtenerMomentosFamiliaresPorNodo,
    reaccionarPublicacion
};
