const { Arbol, Nodo, Hilo } = require('../../models/index.model');

const sonMismoId = (id1, id2) => String(id1) === String(id2);

const usuarioPuedeVerArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const esAdmin = arbol.admins.some(adminId => sonMismoId(adminId, usuarioId));
    if (esAdmin) return true;

    return arbol.miembros.some(miembro =>
        sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
    );
};

const usuarioPuedeEditarArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;

    if (sonMismoId(arbol.creador, usuarioId)) return true;

    return arbol.admins.some(adminId => sonMismoId(adminId, usuarioId));
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
                    mensaje: 'La relación padre/hijo no es válida. El nodo destino debe estar en una generación posterior.'
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

        res.status(201).json({
            mensaje: 'Relación creada correctamente',
            hilo: nuevoHilo
        });
    } catch (error) {
        console.error('❌ Error al crear hilo:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'Esta relación ya existe en el árbol.'
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
        const { tipoRelacion, estado, fechaInicio, fechaFin, descripcion } = req.body;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para editar relaciones en este árbol.'
            });
        }

        const hilo = await Hilo.findOne({
            _id: hiloId,
            arbol: arbolId
        });

        if (!hilo) {
            return res.status(404).json({ mensaje: 'Relación no encontrada' });
        }

        if (tipoRelacion !== undefined) hilo.tipoRelacion = tipoRelacion;
        if (estado !== undefined) hilo.estado = estado;
        if (fechaInicio !== undefined) hilo.fechaInicio = fechaInicio;
        if (fechaFin !== undefined) hilo.fechaFin = fechaFin;
        if (descripcion !== undefined) hilo.descripcion = descripcion;

        await hilo.save();

        res.status(200).json({
            mensaje: 'Relación actualizada correctamente',
            hilo
        });
    } catch (error) {
        console.error('❌ Error al actualizar hilo:', error);
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