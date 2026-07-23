const { Arbol, Nodo, Hilo, InvitacionFamiliar } = require('../../models/index.model');

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

        const fotosFormateadas = (Array.isArray(fotos) ? fotos : []).map(f => {
            if (typeof f === 'string') return { url: f, fechaSubida: new Date() };
            return {
                url: f.url,
                fechaSubida: f.fechaSubida || new Date(),
                fechaReal: f.fechaReal ? new Date(f.fechaReal) : null,
                personas: f.personas || '',
                lugar: f.lugar || '',
                descripcion: f.descripcion || ''
            };
        });

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
            fotos: fotosFormateadas,
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
                if (req.body.fotos && Array.isArray(req.body.fotos)) {
                    nodo.fotos = req.body.fotos.map(foto => {
                        if (typeof foto === 'string') {
                            return { url: foto, fechaSubida: new Date() };
                        }
                        return {
                            url: foto.url,
                            fechaSubida: foto.fechaSubida ? new Date(foto.fechaSubida) : new Date(),
                            fechaReal: foto.fechaReal ? new Date(foto.fechaReal) : null,
                            personas: foto.personas || '',
                            lugar: foto.lugar || '',
                            descripcion: foto.descripcion || ''
                        };
                    });
                } else {
                    nodo[campo] = req.body[campo];
                }
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
    obtenerNodosPorArbol,
    obtenerDetalleNodo,
    crearPerfilSinCuenta,
    actualizarNodo,
    eliminarNodo
};