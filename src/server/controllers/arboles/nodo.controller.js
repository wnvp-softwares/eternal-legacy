const { Arbol, Nodo, Hilo, InvitacionFamiliar } = require('../../models/index.model');
const { construirRutaPublicaUpload } = require('../../configs/uploads.config');
const {
    ejecutarOperacionLayout,
    normalizarGeneracionesPersistidas: normalizarGeneracionesPersistidasCentral,
    prepararGeneracionObjetivo,
    moverNodoAtomico
} = require('../../services/layoutArbol.service');

const obtenerIdSeguro = (valor) => {
    if (!valor) return null;

    if (typeof valor === 'string') return valor;

    if (valor._id) return String(valor._id);

    if (valor.id) return String(valor.id);

    return String(valor);
};

const sonMismoId = (id1, id2) => {
    const valor1 = obtenerIdSeguro(id1);
    const valor2 = obtenerIdSeguro(id2);

    if (!valor1 || !valor2) return false;

    return valor1 === valor2;
};

const obtenerIniciales = (nombre = '') => {
    const partes = nombre.trim().split(' ').filter(Boolean);

    if (partes.length === 0) return 'NA';

    if (partes.length === 1) {
        return partes[0].slice(0, 2).toUpperCase();
    }

    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
};

const usuarioPuedeVerArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const admins = Array.isArray(arbol.admins) ? arbol.admins : [];
    const esAdmin = admins.some(adminId => sonMismoId(adminId, usuarioId));

    if (esAdmin) return true;

    const miembros = Array.isArray(arbol.miembros) ? arbol.miembros : [];

    return miembros.some(miembro =>
        sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
    );
};

const usuarioPuedeEditarArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const admins = Array.isArray(arbol.admins) ? arbol.admins : [];

    return admins.some(adminId => sonMismoId(adminId, usuarioId));
};

const obtenerUrlArchivoSubido = (archivo) => {
    if (!archivo) return null;

    const candidatos = [
        archivo.secure_url,
        archivo.location,
        archivo.path,
        archivo.url
    ];

    const urlDirecta = candidatos.find(valor =>
        typeof valor === 'string' && /^https?:\/\//i.test(valor.trim())
    );

    if (urlDirecta) return urlDirecta.trim();

    if (archivo.filename) {
        return construirRutaPublicaUpload(archivo.filename);
    }

    return null;
};

const normalizarFotoPerfilNodo = (valor = '') => {
    const url = String(valor || '').trim();

    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return '';
    }

    return url;
};

const normalizarFecha = (valor, valorPorDefecto = null) => {
    if (!valor) return valorPorDefecto;

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? valorPorDefecto : fecha;
};

const normalizarFotoNodo = (foto) => {
    const url = typeof foto === 'string'
        ? foto.trim()
        : String(foto?.url || foto?.urlArchivo || '').trim();

    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
        return null;
    }

    return {
        url,
        fechaSubida: normalizarFecha(foto?.fechaSubida, new Date()),
        fechaReal: normalizarFecha(foto?.fechaReal, null),
        personas: String(foto?.personas || '').trim(),
        lugar: String(foto?.lugar || '').trim(),
        descripcion: String(foto?.descripcion || '').trim(),
        // Las fotos antiguas sin este campo se consideran fotografías de galería.
        esFotoPerfil: foto?.esFotoPerfil === true
    };
};

const normalizarFotosNodo = (fotos = []) => {
    if (!Array.isArray(fotos)) return [];

    let yaExisteFotoPerfil = false;

    return fotos
        .map(normalizarFotoNodo)
        .filter(Boolean)
        .map((foto) => {
            const conservarComoPerfil = foto.esFotoPerfil === true && !yaExisteFotoPerfil;

            if (conservarComoPerfil) {
                yaExisteFotoPerfil = true;
            }

            return {
                ...foto,
                esFotoPerfil: conservarComoPerfil
            };
        });
};

const convertirEntero = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;

    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : null;
};

const validarFila = (fila) => {
    const filaNormalizada = convertirEntero(fila);

    if (filaNormalizada === null || filaNormalizada < 0) {
        return {
            error: 'La fila debe ser un número entero mayor o igual a cero.'
        };
    }

    return { valor: filaNormalizada };
};

const normalizarGeneracionesPersistidas = async (arbolId) => (
    normalizarGeneracionesPersistidasCentral({ arbolId })
);

const prepararGeneracionParaGuardar = async ({ arbolId, generacion, session = null }) => {
    try {
        const resultado = await prepararGeneracionObjetivo({ arbolId, generacion, session });
        return {
            valor: resultado.generacion,
            arbolDesplazado: resultado.desplazamiento > 0
        };
    } catch (error) {
        return { error: error.message || 'La generación no es válida.' };
    }
};

const subirFotoNodo = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const nodoId = obtenerIdSeguro(req.body?.nodoId);

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        }

        const esAdministrador = usuarioPuedeEditarArbol(arbol, req.usuario.id);
        let esPropietarioNodo = false;

        if (nodoId) {
            const nodoDestino = await Nodo.findOne({
                _id: nodoId,
                arbol: arbolId,
                visible: true
            }).select('usuario');

            esPropietarioNodo = Boolean(
                nodoDestino && sonMismoId(nodoDestino.usuario, req.usuario.id)
            );
        }

        if (!esAdministrador && !esPropietarioNodo) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para subir fotografías para esta persona.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                mensaje: 'Selecciona una fotografía para subir.'
            });
        }

        if (!String(req.file.mimetype || '').startsWith('image/')) {
            return res.status(400).json({
                mensaje: 'El archivo seleccionado no es una imagen válida.'
            });
        }

        const url = obtenerUrlArchivoSubido(req.file);

        if (!url) {
            return res.status(500).json({
                mensaje: 'La imagen se recibió, pero no fue posible obtener su URL pública.'
            });
        }

        return res.status(201).json({
            mensaje: 'Fotografía subida correctamente.',
            url,
            fechaSubida: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error al subir fotografía del nodo:', error);
        return res.status(500).json({
            mensaje: error.message || 'Error interno al subir la fotografía.'
        });
    }
};

const actualizarFotoPerfilNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;

        const [arbol, nodo] = await Promise.all([
            Arbol.findOne({ _id: arbolId, activo: true }),
            Nodo.findOne({ _id: nodoId, arbol: arbolId, visible: true })
        ]);

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        }

        if (!nodo) {
            return res.status(404).json({ mensaje: 'La persona seleccionada no existe en el árbol.' });
        }

        const puedeAdministrar = usuarioPuedeEditarArbol(arbol, req.usuario.id);
        const esNodoPropio = sonMismoId(nodo.usuario, req.usuario.id);

        if (!puedeAdministrar && !esNodoPropio) {
            return res.status(403).json({
                mensaje: 'Solo puedes cambiar la fotografía de tu propio nodo.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ mensaje: 'Selecciona una fotografía.' });
        }

        if (!String(req.file.mimetype || '').startsWith('image/')) {
            return res.status(400).json({ mensaje: 'El archivo seleccionado no es una imagen válida.' });
        }

        const url = normalizarFotoPerfilNodo(obtenerUrlArchivoSubido(req.file));
        if (!url) {
            return res.status(500).json({
                mensaje: 'La imagen se recibió, pero no fue posible obtener su URL pública.'
            });
        }

        nodo.fotoPerfilNodo = url;
        nodo.fotoPerfilNodoActualizadaEn = new Date();
        await nodo.save();

        return res.status(200).json({
            mensaje: 'Fotografía del nodo actualizada correctamente.',
            url,
            nodo
        });
    } catch (error) {
        console.error('❌ Error al actualizar la fotografía del nodo:', error);
        return res.status(500).json({
            mensaje: error.message || 'No se pudo actualizar la fotografía del nodo.'
        });
    }
};

const obtenerNodosPorArbol = async (req, res) => {
    try {
        const { arbolId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver los nodos de este árbol.'
            });
        }

        // Repara automáticamente árboles antiguos que todavía tengan generaciones negativas.
        await normalizarGeneracionesPersistidas(arbolId);

        const nodos = await Nodo.find({
            arbol: arbolId,
            visible: true
        })
            .populate({
                path: 'usuario',
                select: 'nombreUsuario imagenPerfil informacionPerfil',
                populate: [
                    {
                        path: 'imagenPerfil',
                        select: 'urlArchivo'
                    },
                    {
                        path: 'informacionPerfil',
                        select: 'biografia fechaNacimiento lugarNacimiento ubicacionActual ocupacionEducacion genero'
                    }
                ]
            })
            .sort({ generacion: 1, fila: 1, createdAt: 1 });

        res.status(200).json({
            mensaje: 'Nodos recuperados correctamente',
            total: nodos.length,
            nodos
        });
    } catch (error) {
        console.error('❌ Error al obtener nodos:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerDetalleNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver este nodo.'
            });
        }

        await normalizarGeneracionesPersistidas(arbolId);

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId,
            visible: true
        }).populate({
            path: 'usuario',
            select: 'nombreUsuario imagenPerfil informacionPerfil',
            populate: [
                {
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                },
                {
                    path: 'informacionPerfil',
                    select: 'biografia fechaNacimiento lugarNacimiento ubicacionActual ocupacionEducacion genero'
                }
            ]
        });

        if (!nodo) {
            return res.status(404).json({ mensaje: 'Nodo no encontrado' });
        }

        const relaciones = await Hilo.find({
            arbol: arbolId,
            estado: 'Activa',
            $or: [
                { nodoOrigen: nodoId },
                { nodoDestino: nodoId }
            ]
        })
            .populate('nodoOrigen')
            .populate('nodoDestino');

        const hijos = relaciones
            .filter(rel =>
                rel.tipoRelacion === 'padre_hijo' &&
                sonMismoId(rel.nodoOrigen?._id, nodoId)
            )
            .map(rel => rel.nodoDestino);

        const padres = relaciones
            .filter(rel =>
                rel.tipoRelacion === 'padre_hijo' &&
                sonMismoId(rel.nodoDestino?._id, nodoId)
            )
            .map(rel => rel.nodoOrigen);

        const parejas = relaciones
            .filter(rel =>
                ['pareja', 'matrimonio', 'divorcio'].includes(rel.tipoRelacion)
            )
            .map(rel => ({
                tipoRelacion: rel.tipoRelacion,
                fechaInicio: rel.fechaInicio,
                fechaFin: rel.fechaFin,
                descripcion: rel.descripcion,
                persona: sonMismoId(rel.nodoOrigen?._id, nodoId)
                    ? rel.nodoDestino
                    : rel.nodoOrigen
            }));

        res.status(200).json({
            mensaje: 'Detalle del nodo recuperado correctamente',
            nodo,
            estadoFamiliar: {
                padres,
                hijos,
                parejas,
                generacion: nodo.generacion
            }
        });
    } catch (error) {
        console.error('❌ Error al obtener detalle del nodo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const crearPerfilSinCuenta = async (req, res) => {
    try {
        const {
            arbolId,
            nombre,
            iniciales,
            colorFondo = '#e2e8f0',
            colorTexto = '#0f172a',
            fechaNacimiento = null,
            fechaFallecimiento = null,
            fechaCorta = 'Pendiente',
            estaFallecido = false,
            edad = null,
            tipo = 'normal',
            estado = 'Incompleto',
            generacion,
            fila,
            fotoPerfilNodo = '',
            fotos = [],
            biografia = '',
            perfilPrivado = false
        } = req.body;

        if (!arbolId || !nombre || generacion === undefined || fila === undefined) {
            return res.status(400).json({
                mensaje: 'Faltan datos obligatorios: arbolId, nombre, generacion y fila.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para crear nodos en este árbol.'
            });
        }

        const resultadoFila = validarFila(fila);

        if (resultadoFila.error) {
            return res.status(400).json({ mensaje: resultadoFila.error });
        }

        const fotosFormateadas = normalizarFotosNodo(fotos);

        const { nuevoNodo, arbolDesplazado } = await ejecutarOperacionLayout(async (session) => {
            await normalizarGeneracionesPersistidasCentral({ arbolId, session });

            const resultadoGeneracion = await prepararGeneracionObjetivo({
                arbolId,
                generacion,
                session
            });

            const documentos = await Nodo.create([{
                arbol: arbolId,
                usuario: null,
                creadoPor: req.usuario.id,
                nombre,
                iniciales: iniciales || obtenerIniciales(nombre),
                colorFondo,
                colorTexto,
                fechaNacimiento,
                fechaFallecimiento,
                fechaCorta,
                estaFallecido,
                edad,
                tipo,
                estado,
                origen: 'perfil_sin_cuenta',
                generacion: resultadoGeneracion.generacion,
                fila: resultadoFila.valor,
                fotoPerfilNodo: normalizarFotoPerfilNodo(fotoPerfilNodo),
                fotoPerfilNodoActualizadaEn: fotoPerfilNodo ? new Date() : null,
                fotos: fotosFormateadas,
                biografia,
                perfilPrivado,
                visible: true
            }], session ? { session } : {});

            return {
                nuevoNodo: documentos[0],
                arbolDesplazado: resultadoGeneracion.desplazamiento > 0
            };
        });

        res.status(201).json({
            mensaje: arbolDesplazado
                ? 'Perfil agregado y generaciones anteriores recorridas correctamente.'
                : 'Perfil sin cuenta agregado al árbol correctamente',
            nodo: nuevoNodo
        });
    } catch (error) {
        console.error('❌ Error al crear perfil sin cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const actualizarNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        await normalizarGeneracionesPersistidas(arbolId);

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId,
            visible: true
        });

        if (!nodo) {
            return res.status(404).json({ mensaje: 'Nodo no encontrado' });
        }

        const esAdministrador = usuarioPuedeEditarArbol(arbol, req.usuario.id);
        const esNodoPropio = sonMismoId(nodo.usuario, req.usuario.id);

        if (!esAdministrador && !esNodoPropio) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para editar esta persona.'
            });
        }

        if (!esAdministrador) {
            const camposPropiosPermitidos = new Set(['fotos', 'fotoPerfilNodo']);
            const campoNoPermitido = Object.keys(req.body || {})
                .find(campo => !camposPropiosPermitidos.has(campo));

            if (campoNoPermitido) {
                return res.status(403).json({
                    mensaje: 'Solo puedes administrar las imágenes de tu propio nodo.'
                });
            }
        }

        const camposPermitidos = [
            'nombre',
            'iniciales',
            'colorFondo',
            'colorTexto',
            'fechaNacimiento',
            'fechaFallecimiento',
            'fechaCorta',
            'estaFallecido',
            'edad',
            'tipo',
            'estado',
            'biografia',
            'perfilPrivado'
        ];

        camposPermitidos.forEach(campo => {
            if (req.body[campo] !== undefined) {
                nodo[campo] = req.body[campo];
            }
        });

        if (req.body.generacion !== undefined) {
            const resultadoGeneracion = await prepararGeneracionParaGuardar({
                arbolId,
                generacion: req.body.generacion
            });

            if (resultadoGeneracion.error) {
                return res.status(400).json({ mensaje: resultadoGeneracion.error });
            }

            nodo.generacion = resultadoGeneracion.valor;
        }

        if (req.body.fila !== undefined) {
            const resultadoFila = validarFila(req.body.fila);

            if (resultadoFila.error) {
                return res.status(400).json({ mensaje: resultadoFila.error });
            }

            nodo.fila = resultadoFila.valor;
        }

        if (req.body.fotoPerfilNodo !== undefined) {
            nodo.fotoPerfilNodo = normalizarFotoPerfilNodo(req.body.fotoPerfilNodo);
            nodo.fotoPerfilNodoActualizadaEn = nodo.fotoPerfilNodo ? new Date() : null;
        }

        if (req.body.fotos !== undefined) {
            if (!Array.isArray(req.body.fotos)) {
                return res.status(400).json({
                    mensaje: 'El campo fotos debe ser un arreglo.'
                });
            }

            nodo.fotos = normalizarFotosNodo(req.body.fotos);
        }

        if (req.body.nombre && !req.body.iniciales) {
            nodo.iniciales = obtenerIniciales(req.body.nombre);
        }

        await nodo.save();

        res.status(200).json({
            mensaje: 'Nodo actualizado correctamente',
            nodo
        });
    } catch (error) {
        console.error('❌ Error al actualizar nodo:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                mensaje: error.message || 'Los datos del nodo no son válidos.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const moverNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;
        const {
            generacionDestino,
            filaDestino = null,
            parejaDestinoId = null
        } = req.body;

        if (generacionDestino === undefined && !parejaDestinoId) {
            return res.status(400).json({
                mensaje: 'Selecciona una generación o una persona para completar el movimiento.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para reorganizar este árbol.'
            });
        }

        const resultado = await moverNodoAtomico({
            arbolId,
            nodoId,
            generacionDestino,
            filaDestino,
            parejaDestinoId,
            creadoPor: req.usuario.id
        });

        return res.status(200).json({
            mensaje: resultado.movidoComoPareja
                ? 'Familiar movido y relación de pareja actualizada correctamente.'
                : 'Familiar movido correctamente.',
            nodo: resultado.nodo,
            union: resultado.union,
            relacionesEliminadas: resultado.relacionesEliminadas
        });
    } catch (error) {
        console.error('❌ Error al mover nodo:', error);
        return res.status(error.status || 500).json({
            mensaje: error.message || 'No se pudo mover el familiar.'
        });
    }
};

const eliminarNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;
        const usuarioId = req.usuario.id;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, usuarioId)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para eliminar nodos de este árbol.'
            });
        }

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId
        });

        if (!nodo) {
            return res.status(404).json({ mensaje: 'Nodo no encontrado' });
        }

        if (sonMismoId(nodo.usuario, arbol.creador)) {
            return res.status(400).json({
                mensaje: 'No puedes eliminar al creador principal del árbol.'
            });
        }

        await Hilo.updateMany(
            {
                arbol: arbolId,
                estado: { $ne: 'Eliminada' },
                $or: [
                    { nodoOrigen: nodoId },
                    { nodoDestino: nodoId }
                ]
            },
            {
                $set: { estado: 'Eliminada' }
            }
        );

        if (nodo.usuario) {
            const nodoUsuarioId = nodo.usuario;

            arbol.miembros = arbol.miembros.filter(miembro =>
                !sonMismoId(miembro.usuario, nodoUsuarioId)
            );

            arbol.admins = arbol.admins.filter(adminId =>
                !sonMismoId(adminId, nodoUsuarioId)
            );

            await arbol.save();

            await InvitacionFamiliar.updateMany(
                {
                    arbol: arbolId,
                    invitado: nodoUsuarioId,
                    estado: { $in: ['Pendiente', 'Aceptada'] }
                },
                {
                    $set: {
                        estado: 'Cancelada',
                        respondidaEn: new Date()
                    }
                }
            );

            await Nodo.deleteOne({ _id: nodoId });

            return res.status(200).json({
                mensaje: 'Usuario eliminado del árbol correctamente. Ya puede volver a recibir invitación.'
            });
        }

        nodo.visible = false;
        await nodo.save();

        res.status(200).json({
            mensaje: 'Perfil sin cuenta eliminado del árbol correctamente.'
        });
    } catch (error) {
        console.error('❌ Error al eliminar nodo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    subirFotoNodo,
    actualizarFotoPerfilNodo,
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    actualizarNodo,
    moverNodo,
    eliminarNodo
};