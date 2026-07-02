const { Arbol, Nodo, Hilo, Usuario } = require('../../models/index.model');

const sonMismoId = (id1, id2) => String(id1) === String(id2);

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
                        select: 'biografia fechaNacimiento lugarNacimiento ubicacionActual ocupacionEducacion'
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

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId,
            visible: true
        }).populate({
            path: 'usuario',
            select: 'nombreUsuario imagenPerfil',
            populate: {
                path: 'imagenPerfil',
                select: 'urlArchivo'
            }
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

        const nuevoNodo = await Nodo.create({
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
            generacion,
            fila,
            fotos,
            biografia,
            perfilPrivado,
            visible: true
        });

        res.status(201).json({
            mensaje: 'Perfil sin cuenta agregado al árbol correctamente',
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

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para editar este árbol.'
            });
        }

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId,
            visible: true
        });

        if (!nodo) {
            return res.status(404).json({ mensaje: 'Nodo no encontrado' });
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
            'generacion',
            'fila',
            'fotos',
            'biografia',
            'perfilPrivado'
        ];

        camposPermitidos.forEach(campo => {
            if (req.body[campo] !== undefined) {
                nodo[campo] = req.body[campo];
            }
        });

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
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const eliminarNodo = async (req, res) => {
    try {
        const { arbolId, nodoId } = req.params;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({ mensaje: 'Árbol no encontrado' });
        }

        if (!usuarioPuedeEditarArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para eliminar nodos de este árbol.'
            });
        }

        const nodo = await Nodo.findOne({
            _id: nodoId,
            arbol: arbolId,
            visible: true
        });

        if (!nodo) {
            return res.status(404).json({ mensaje: 'Nodo no encontrado' });
        }

        nodo.visible = false;
        await nodo.save();

        await Hilo.updateMany(
            {
                arbol: arbolId,
                estado: 'Activa',
                $or: [
                    { nodoOrigen: nodoId },
                    { nodoDestino: nodoId }
                ]
            },
            {
                $set: { estado: 'Eliminada' }
            }
        );

        res.status(200).json({
            mensaje: 'Nodo eliminado del árbol correctamente'
        });
    } catch (error) {
        console.error('❌ Error al eliminar nodo:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    actualizarNodo,
    eliminarNodo
};