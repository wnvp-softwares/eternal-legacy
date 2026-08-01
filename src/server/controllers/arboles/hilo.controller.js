const { Arbol, Nodo, Hilo } = require('../../models/index.model');

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

const TIPOS_RELACION_VALIDOS = ['padre_hijo', 'pareja', 'matrimonio', 'divorcio'];
const TIPOS_RELACION_PAREJA = ['pareja', 'matrimonio', 'divorcio'];

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

const usuarioEsParteDeRelacion = async ({ arbolId, hilo, usuarioId }) => {
    if (!arbolId || !hilo || !usuarioId) return false;

    const nodosRelacion = await Nodo.find({
        _id: {
            $in: [hilo.nodoOrigen, hilo.nodoDestino]
        },
        arbol: arbolId,
        visible: true
    }).select('usuario');

    return nodosRelacion.some(nodo => sonMismoId(nodo.usuario, usuarioId));
};

const construirFiltroRelacionExacta = ({ arbolId, nodoOrigenId, nodoDestinoId, tipoRelacion }) => {
    if (TIPOS_RELACION_PAREJA.includes(tipoRelacion)) {
        return {
            arbol: arbolId,
            tipoRelacion: { $in: TIPOS_RELACION_PAREJA },
            $or: [
                { nodoOrigen: nodoOrigenId, nodoDestino: nodoDestinoId },
                { nodoOrigen: nodoDestinoId, nodoDestino: nodoOrigenId }
            ]
        };
    }

    return {
        arbol: arbolId,
        nodoOrigen: nodoOrigenId,
        nodoDestino: nodoDestinoId,
        tipoRelacion
    };
};

const poblarHilo = async (hiloId) => {
    return Hilo.findById(hiloId)
        .populate('nodoOrigen')
        .populate('nodoDestino');
};

const anclarParejaEnNodoDestino = async ({ nodoOrigen, nodoDestino, tipoRelacion }) => {
    if (!TIPOS_RELACION_PAREJA.includes(tipoRelacion) || !nodoOrigen || !nodoDestino) return;

    // El destino es la casilla elegida por el usuario. Ambos integrantes comparten
    // esa fila y quedan protegidos frente al reordenamiento automático.
    nodoOrigen.generacion = Number(nodoDestino.generacion);
    nodoOrigen.fila = Number(nodoDestino.fila);
    nodoOrigen.posicionManual = true;
    nodoDestino.posicionManual = true;

    await nodoOrigen.save();
    await nodoDestino.save();
};

const crearHilo = async (req, res) => {
    try {
        const {
            arbolId,
            nodoOrigenId,
            nodoDestinoId,
            tipoRelacion,
            fechaInicio = null,
            fechaFin = null,
            descripcion = '',
            nodoSuperiorId = null
        } = req.body;

        if (!arbolId || !nodoOrigenId || !nodoDestinoId || !tipoRelacion) {
            return res.status(400).json({
                mensaje: 'Faltan datos obligatorios: arbolId, nodoOrigenId, nodoDestinoId y tipoRelacion.'
            });
        }

        if (!TIPOS_RELACION_VALIDOS.includes(tipoRelacion)) {
            return res.status(400).json({
                mensaje: 'Tipo de relación no válido.'
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
                mensaje: 'No tienes permiso para crear relaciones en este árbol.'
            });
        }

        const nodoOrigen = await Nodo.findOne({
            _id: nodoOrigenId,
            arbol: arbolId,
            visible: true
        });

        if (!nodoOrigen) {
            return res.status(404).json({ mensaje: 'Nodo origen no encontrado' });
        }

        const nodoDestino = await Nodo.findOne({
            _id: nodoDestinoId,
            arbol: arbolId,
            visible: true
        });

        if (!nodoDestino) {
            return res.status(404).json({ mensaje: 'Nodo destino no encontrado' });
        }

        if (sonMismoId(nodoOrigen._id, nodoDestino._id)) {
            return res.status(400).json({
                mensaje: 'No puedes relacionar un nodo consigo mismo.'
            });
        }

        if (tipoRelacion === 'padre_hijo') {
            if (Number(nodoOrigen.generacion) >= Number(nodoDestino.generacion)) {
                return res.status(400).json({
                    mensaje: 'La relación padre/hijo no es válida. El familiar destino debe estar en una generación posterior.'
                });
            }
        }

        const filtroRelacion = construirFiltroRelacionExacta({
            arbolId,
            nodoOrigenId,
            nodoDestinoId,
            tipoRelacion
        });

        const relacionExistente = await Hilo.findOne(filtroRelacion);
        const idsPareja = [String(nodoOrigen._id), String(nodoDestino._id)];
        const superiorSolicitado = nodoSuperiorId && idsPareja.includes(String(nodoSuperiorId))
            ? nodoSuperiorId
            : null;
        const nodoSuperiorInicial = superiorSolicitado || (
            Number(nodoOrigen.fila) <= Number(nodoDestino.fila)
                ? nodoOrigen._id
                : nodoDestino._id
        );

        if (relacionExistente) {
            relacionExistente.estado = 'Activa';
            relacionExistente.creadoPor = relacionExistente.creadoPor || req.usuario.id;

            if (TIPOS_RELACION_PAREJA.includes(tipoRelacion)) {
                relacionExistente.tipoRelacion = tipoRelacion;
                if (!relacionExistente.nodoSuperior || superiorSolicitado) {
                    relacionExistente.nodoSuperior = nodoSuperiorInicial;
                }
            }

            if (fechaInicio !== undefined) relacionExistente.fechaInicio = fechaInicio || null;
            if (fechaFin !== undefined) relacionExistente.fechaFin = fechaFin || null;
            if (descripcion !== undefined) relacionExistente.descripcion = descripcion;

            await relacionExistente.save();
            await anclarParejaEnNodoDestino({ nodoOrigen, nodoDestino, tipoRelacion });

            const hiloPoblado = await poblarHilo(relacionExistente._id);

            return res.status(200).json({
                mensaje: 'La relación ya existía y fue reactivada/actualizada correctamente.',
                hilo: hiloPoblado || relacionExistente,
                yaExistia: true
            });
        }

        const nuevoHilo = await Hilo.create({
            arbol: arbolId,
            nodoOrigen: nodoOrigenId,
            nodoDestino: nodoDestinoId,
            nodoSuperior: TIPOS_RELACION_PAREJA.includes(tipoRelacion)
                ? nodoSuperiorInicial
                : null,
            tipoRelacion,
            estado: 'Activa',
            creadoPor: req.usuario.id,
            fechaInicio,
            fechaFin,
            descripcion
        });

        await anclarParejaEnNodoDestino({ nodoOrigen, nodoDestino, tipoRelacion });

        const hiloPoblado = await poblarHilo(nuevoHilo._id);

        res.status(201).json({
            mensaje: 'Relación creada correctamente',
            hilo: hiloPoblado || nuevoHilo,
            yaExistia: false
        });
    } catch (error) {
        console.error('❌ Error al crear hilo:', error);

        if (error.code === 11000) {
            try {
                const {
                    arbolId,
                    nodoOrigenId,
                    nodoDestinoId,
                    tipoRelacion,
                    fechaInicio = null,
                    fechaFin = null,
                    descripcion = '',
                    nodoSuperiorId = null
                } = req.body;

                const filtroRelacion = construirFiltroRelacionExacta({
                    arbolId,
                    nodoOrigenId,
                    nodoDestinoId,
                    tipoRelacion
                });

                const relacionExistente = await Hilo.findOne(filtroRelacion);

                if (relacionExistente) {
                    relacionExistente.estado = 'Activa';

                    if (TIPOS_RELACION_PAREJA.includes(tipoRelacion)) {
                        relacionExistente.tipoRelacion = tipoRelacion;
                        const idsIntegrantes = [String(nodoOrigenId), String(nodoDestinoId)];
                        if (nodoSuperiorId && idsIntegrantes.includes(String(nodoSuperiorId))) {
                            relacionExistente.nodoSuperior = nodoSuperiorId;
                        }
                    }

                    if (fechaInicio !== undefined) relacionExistente.fechaInicio = fechaInicio || null;
                    if (fechaFin !== undefined) relacionExistente.fechaFin = fechaFin || null;
                    if (descripcion !== undefined) relacionExistente.descripcion = descripcion;

                    await relacionExistente.save();

                    const hiloPoblado = await poblarHilo(relacionExistente._id);

                    return res.status(200).json({
                        mensaje: 'La relación ya existía y fue reactivada/actualizada correctamente.',
                        hilo: hiloPoblado || relacionExistente,
                        yaExistia: true
                    });
                }
            } catch (errorRecuperacion) {
                console.error('❌ Error al recuperar relación duplicada:', errorRecuperacion);
            }

            return res.status(400).json({
                mensaje: 'Esta relación ya existe en el árbol.'
            });
        }

        if (error.name === 'ValidationError' || error.message?.includes('relacionarse consigo mismo')) {
            return res.status(400).json({
                mensaje: error.message || 'La relación no es válida.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerHilosPorArbol = async (req, res) => {
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
                mensaje: 'No tienes permiso para ver las relaciones de este árbol.'
            });
        }

        const hilos = await Hilo.find({
            arbol: arbolId,
            estado: { $ne: 'Eliminada' }
        })
            .populate('nodoOrigen')
            .populate('nodoDestino')
            .sort({ createdAt: 1 });

        res.status(200).json({
            mensaje: 'Relaciones recuperadas correctamente',
            total: hilos.length,
            hilos
        });
    } catch (error) {
        console.error('❌ Error al obtener hilos:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const actualizarHilo = async (req, res) => {
    try {
        const { arbolId, hiloId } = req.params;
        const {
            tipoRelacion,
            estado,
            fechaInicio,
            fechaFin,
            descripcion,
            nodoSuperiorId,
            ordenVisualManual
        } = req.body;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        const hilo = await Hilo.findOne({
            _id: hiloId,
            arbol: arbolId,
            estado: { $ne: 'Eliminada' }
        });

        if (!hilo) {
            return res.status(404).json({ mensaje: 'Relación no encontrada' });
        }

        const esEditorGlobal = usuarioPuedeEditarArbol(arbol, req.usuario.id);
        const solicitaOrdenVisual = nodoSuperiorId !== undefined || ordenVisualManual !== undefined;

        const esRelacionDeParejaActual = TIPOS_RELACION_PAREJA.includes(hilo.tipoRelacion);
        const tipoRelacionFinal = tipoRelacion !== undefined ? tipoRelacion : hilo.tipoRelacion;
        const esRelacionDeParejaFinal = TIPOS_RELACION_PAREJA.includes(tipoRelacionFinal);

        const esParteDeLaRelacion = await usuarioEsParteDeRelacion({
            arbolId,
            hilo,
            usuarioId: req.usuario.id
        });

        const puedeEditarComoPareja =
            esRelacionDeParejaActual &&
            esRelacionDeParejaFinal &&
            esParteDeLaRelacion;

        if (!esEditorGlobal && !puedeEditarComoPareja) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para editar esta relación.'
            });
        }

        if (solicitaOrdenVisual && !esEditorGlobal) {
            return res.status(403).json({
                mensaje: 'Solo un administrador puede cambiar el orden visual de una pareja.'
            });
        }

        if (tipoRelacion !== undefined && !TIPOS_RELACION_VALIDOS.includes(tipoRelacion)) {
            return res.status(400).json({
                mensaje: 'Tipo de relación no válido.'
            });
        }

        if (!esEditorGlobal) {
            if (estado !== undefined) {
                return res.status(403).json({
                    mensaje: 'Solo un administrador puede cambiar el estado de una relación.'
                });
            }

            if (!TIPOS_RELACION_PAREJA.includes(tipoRelacionFinal)) {
                return res.status(403).json({
                    mensaje: 'Solo puedes cambiar tu relación a pareja, matrimonio o divorcio.'
                });
            }
        }

        if (solicitaOrdenVisual && !esRelacionDeParejaFinal) {
            return res.status(400).json({
                mensaje: 'El orden visual solo puede aplicarse a una relación de pareja.'
            });
        }

        if (nodoSuperiorId !== undefined) {
            const idsIntegrantes = [String(hilo.nodoOrigen), String(hilo.nodoDestino)];
            if (!idsIntegrantes.includes(String(nodoSuperiorId))) {
                return res.status(400).json({
                    mensaje: 'La persona superior debe pertenecer a esta pareja.'
                });
            }
            hilo.nodoSuperior = nodoSuperiorId;
        }

        if (ordenVisualManual !== undefined) {
            if (typeof ordenVisualManual !== 'boolean') {
                return res.status(400).json({
                    mensaje: 'ordenVisualManual debe ser un valor booleano.'
                });
            }
            hilo.ordenVisualManual = ordenVisualManual;
        }

        if (tipoRelacion !== undefined) {
            hilo.tipoRelacion = tipoRelacion;
        }

        if (esEditorGlobal && estado !== undefined) {
            hilo.estado = estado;
        }

        if (fechaInicio !== undefined) {
            hilo.fechaInicio = fechaInicio || null;
        }

        if (fechaFin !== undefined) {
            hilo.fechaFin = fechaFin || null;
        }

        if (descripcion !== undefined) {
            hilo.descripcion = descripcion;
        }

        await hilo.save();

        const hiloActualizado = await poblarHilo(hilo._id);

        res.status(200).json({
            mensaje: 'Relación actualizada correctamente',
            hilo: hiloActualizado || hilo
        });
    } catch (error) {
        console.error('❌ Error al actualizar hilo:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                mensaje: error.message || 'La relación no es válida.'
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'Ya existe otra relación igual en este árbol.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const eliminarHilo = async (req, res) => {
    try {
        const { arbolId, hiloId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para eliminar relaciones en este árbol.'
            });
        }

        const hilo = await Hilo.findOne({
            _id: hiloId,
            arbol: arbolId,
            estado: { $ne: 'Eliminada' }
        });

        if (!hilo) {
            return res.status(404).json({ mensaje: 'Relación no encontrada' });
        }

        hilo.estado = 'Eliminada';
        await hilo.save();

        res.status(200).json({
            mensaje: 'Relación eliminada correctamente'
        });
    } catch (error) {
        console.error('❌ Error al eliminar hilo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    crearHilo,
    obtenerHilosPorArbol,
    actualizarHilo,
    eliminarHilo
};
