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

const crearHilo = async (req, res) => {
    try {
        const {
            arbolId,
            nodoOrigenId,
            nodoDestinoId,
            tipoRelacion,
            fechaInicio = null,
            fechaFin = null,
            descripcion = ''
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

        const nuevoHilo = await Hilo.create({
            arbol: arbolId,
            nodoOrigen: nodoOrigenId,
            nodoDestino: nodoDestinoId,
            tipoRelacion,
            estado: 'Activa',
            creadoPor: req.usuario.id,
            fechaInicio,
            fechaFin,
            descripcion
        });

        const hiloPoblado = await Hilo.findById(nuevoHilo._id)
            .populate('nodoOrigen')
            .populate('nodoDestino');

        res.status(201).json({
            mensaje: 'Relación creada correctamente',
            hilo: hiloPoblado || nuevoHilo
        });
    } catch (error) {
        console.error('❌ Error al crear hilo:', error);

        if (error.code === 11000) {
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
            descripcion
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

        const hiloActualizado = await Hilo.findById(hilo._id)
            .populate('nodoOrigen')
            .populate('nodoDestino');

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