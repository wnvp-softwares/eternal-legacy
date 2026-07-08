const Arbol = require('../../models/arboles/arbol.model');
const Nodo = require('../../models/arboles/nodo.model');
const EventoFamiliar = require('../../models/arboles/eventoFamiliar.model');

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

const usuarioPuedeCrearEvento = (arbol, usuarioId) => {
    return usuarioPuedeVerArbol(arbol, usuarioId);
};

const usuarioPuedeGestionarEvento = (arbol, evento, usuarioId) => {
    if (!arbol || !evento || !usuarioId) return false;

    if (usuarioPuedeEditarArbol(arbol, usuarioId)) return true;

    return sonMismoId(evento.creadoPor, usuarioId);
};

const obtenerFechaValida = (fecha) => {
    if (!fecha) return null;

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) return null;

    return date;
};

const normalizarUbicacion = (ubicacion = {}) => {
    if (typeof ubicacion === 'string') {
        return {
            texto: ubicacion.trim(),
            direccion: ubicacion.trim(),
            referencia: '',
            lat: null,
            lng: null,
            proveedor: 'manual',
            placeId: ''
        };
    }

    return {
        texto: ubicacion.texto?.trim() || '',
        direccion: ubicacion.direccion?.trim() || ubicacion.texto?.trim() || '',
        referencia: ubicacion.referencia?.trim() || '',
        lat: typeof ubicacion.lat === 'number' ? ubicacion.lat : null,
        lng: typeof ubicacion.lng === 'number' ? ubicacion.lng : null,
        proveedor: ubicacion.proveedor || 'manual',
        placeId: ubicacion.placeId || ''
    };
};

const poblarEvento = async (eventoId) => {
    return EventoFamiliar.findById(eventoId)
        .populate('creadoPor', 'nombreUsuario email imagenPerfil')
        .populate('nodosRelacionados', 'nombre iniciales fechaNacimiento fechaFallecimiento estaFallecido')
        .populate('invitados.usuario', 'nombreUsuario email imagenPerfil');
};

const crearEventoFamiliar = async (req, res) => {
    try {
        const {
            arbolId,
            titulo,
            descripcion = '',
            tipoEvento = 'otro',
            fechaInicio,
            fechaFin = null,
            todoElDia = false,
            zonaHoraria = 'America/Mexico_City',
            ubicacion = {},
            nodosRelacionados = [],
            invitados = [],
            recordatorio = {},
            privacidad = 'Arbol'
        } = req.body;

        if (!arbolId) {
            return res.status(400).json({
                mensaje: 'El arbolId es obligatorio.'
            });
        }

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({
                mensaje: 'El título del evento es obligatorio.'
            });
        }

        const fechaInicioDate = obtenerFechaValida(fechaInicio);

        if (!fechaInicioDate) {
            return res.status(400).json({
                mensaje: 'La fecha de inicio del evento no es válida.'
            });
        }

        const fechaFinDate = fechaFin ? obtenerFechaValida(fechaFin) : null;

        if (fechaFin && !fechaFinDate) {
            return res.status(400).json({
                mensaje: 'La fecha de fin del evento no es válida.'
            });
        }

        if (fechaFinDate && fechaFinDate.getTime() < fechaInicioDate.getTime()) {
            return res.status(400).json({
                mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeCrearEvento(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para crear eventos en este árbol.'
            });
        }

        const nodosValidos = [];

        if (Array.isArray(nodosRelacionados) && nodosRelacionados.length > 0) {
            const nodos = await Nodo.find({
                _id: { $in: nodosRelacionados },
                arbol: arbolId,
                visible: true
            }).select('_id');

            nodosValidos.push(...nodos.map(nodo => nodo._id));
        }

        const invitadosValidos = Array.isArray(invitados)
            ? invitados
                .map(invitado => obtenerIdSeguro(invitado.usuario || invitado))
                .filter(Boolean)
                .map(usuarioId => ({
                    usuario: usuarioId,
                    estado: 'Pendiente'
                }))
            : [];

        const nuevoEvento = await EventoFamiliar.create({
            arbol: arbolId,
            creadoPor: req.usuario.id,
            titulo: titulo.trim(),
            descripcion,
            tipoEvento,
            fechaInicio: fechaInicioDate,
            fechaFin: fechaFinDate,
            todoElDia: Boolean(todoElDia),
            zonaHoraria,
            ubicacion: normalizarUbicacion(ubicacion),
            nodosRelacionados: nodosValidos,
            invitados: invitadosValidos,
            recordatorio: {
                activo: recordatorio.activo !== undefined ? Boolean(recordatorio.activo) : true,
                minutosAntes: Number(recordatorio.minutosAntes || 1440)
            },
            privacidad,
            estado: 'Activo'
        });

        const eventoPoblado = await poblarEvento(nuevoEvento._id);

        res.status(201).json({
            mensaje: 'Evento familiar creado correctamente.',
            evento: eventoPoblado || nuevoEvento
        });
    } catch (error) {
        console.error('❌ Error al crear evento familiar:', error);

        if (error.name === 'ValidationError' || error.message?.includes('fecha')) {
            return res.status(400).json({
                mensaje: error.message || 'Los datos del evento no son válidos.'
            });
        }

        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const obtenerEventosPorArbol = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const {
            desde,
            hasta,
            estado = 'Activo',
            tipoEvento,
            limite = 50
        } = req.query;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver los eventos de este árbol.'
            });
        }

        const filtro = {
            arbol: arbolId,
            estado: estado === 'Todos' ? { $ne: 'Eliminado' } : estado
        };

        const fechaFiltro = {};

        const desdeDate = obtenerFechaValida(desde);
        const hastaDate = obtenerFechaValida(hasta);

        if (desdeDate) fechaFiltro.$gte = desdeDate;
        if (hastaDate) fechaFiltro.$lte = hastaDate;

        if (Object.keys(fechaFiltro).length > 0) {
            filtro.fechaInicio = fechaFiltro;
        }

        if (tipoEvento && tipoEvento !== 'Todos') {
            filtro.tipoEvento = tipoEvento;
        }

        const eventos = await EventoFamiliar.find(filtro)
            .populate('creadoPor', 'nombreUsuario email imagenPerfil')
            .populate('nodosRelacionados', 'nombre iniciales fechaNacimiento fechaFallecimiento estaFallecido')
            .sort({ fechaInicio: 1 })
            .limit(Math.min(Number(limite) || 50, 100));

        res.status(200).json({
            mensaje: 'Eventos recuperados correctamente.',
            total: eventos.length,
            eventos
        });
    } catch (error) {
        console.error('❌ Error al obtener eventos:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const obtenerProximosEventos = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const { limite = 10 } = req.query;

        const arbol = await Arbol.findOne({
            _id: arbolId,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver los eventos de este árbol.'
            });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const eventos = await EventoFamiliar.find({
            arbol: arbolId,
            estado: 'Activo',
            fechaInicio: { $gte: hoy }
        })
            .populate('creadoPor', 'nombreUsuario email imagenPerfil')
            .populate('nodosRelacionados', 'nombre iniciales fechaNacimiento fechaFallecimiento estaFallecido')
            .sort({ fechaInicio: 1 })
            .limit(Math.min(Number(limite) || 10, 30));

        res.status(200).json({
            mensaje: 'Próximos eventos recuperados correctamente.',
            total: eventos.length,
            eventos
        });
    } catch (error) {
        console.error('❌ Error al obtener próximos eventos:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const obtenerEventoPorId = async (req, res) => {
    try {
        const { eventoId } = req.params;

        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        })
            .populate('creadoPor', 'nombreUsuario email imagenPerfil')
            .populate('nodosRelacionados', 'nombre iniciales fechaNacimiento fechaFallecimiento estaFallecido')
            .populate('invitados.usuario', 'nombreUsuario email imagenPerfil');

        if (!evento) {
            return res.status(404).json({
                mensaje: 'Evento no encontrado.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: evento.arbol,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para ver este evento.'
            });
        }

        res.status(200).json({
            mensaje: 'Evento recuperado correctamente.',
            evento
        });
    } catch (error) {
        console.error('❌ Error al obtener evento:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const actualizarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;

        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) {
            return res.status(404).json({
                mensaje: 'Evento no encontrado.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: evento.arbol,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para editar este evento.'
            });
        }

        const camposPermitidos = [
            'titulo',
            'descripcion',
            'tipoEvento',
            'fechaInicio',
            'fechaFin',
            'todoElDia',
            'zonaHoraria',
            'ubicacion',
            'nodosRelacionados',
            'recordatorio',
            'privacidad',
            'estado'
        ];

        for (const campo of camposPermitidos) {
            if (req.body[campo] === undefined) continue;

            if (campo === 'titulo') {
                if (!req.body.titulo || !req.body.titulo.trim()) {
                    return res.status(400).json({
                        mensaje: 'El título del evento no puede estar vacío.'
                    });
                }

                evento.titulo = req.body.titulo.trim();
                continue;
            }

            if (campo === 'fechaInicio') {
                const fechaInicioDate = obtenerFechaValida(req.body.fechaInicio);

                if (!fechaInicioDate) {
                    return res.status(400).json({
                        mensaje: 'La fecha de inicio no es válida.'
                    });
                }

                evento.fechaInicio = fechaInicioDate;
                continue;
            }

            if (campo === 'fechaFin') {
                evento.fechaFin = req.body.fechaFin ? obtenerFechaValida(req.body.fechaFin) : null;

                if (req.body.fechaFin && !evento.fechaFin) {
                    return res.status(400).json({
                        mensaje: 'La fecha de fin no es válida.'
                    });
                }

                continue;
            }

            if (campo === 'ubicacion') {
                evento.ubicacion = normalizarUbicacion(req.body.ubicacion);
                continue;
            }

            if (campo === 'nodosRelacionados') {
                const nodosRelacionados = Array.isArray(req.body.nodosRelacionados)
                    ? req.body.nodosRelacionados
                    : [];

                const nodos = await Nodo.find({
                    _id: { $in: nodosRelacionados },
                    arbol: evento.arbol,
                    visible: true
                }).select('_id');

                evento.nodosRelacionados = nodos.map(nodo => nodo._id);
                continue;
            }

            if (campo === 'recordatorio') {
                evento.recordatorio = {
                    activo: req.body.recordatorio?.activo !== undefined
                        ? Boolean(req.body.recordatorio.activo)
                        : evento.recordatorio?.activo,
                    minutosAntes: req.body.recordatorio?.minutosAntes !== undefined
                        ? Number(req.body.recordatorio.minutosAntes)
                        : evento.recordatorio?.minutosAntes
                };
                continue;
            }

            evento[campo] = req.body[campo];
        }

        if (evento.fechaInicio && evento.fechaFin) {
            const inicio = new Date(evento.fechaInicio).getTime();
            const fin = new Date(evento.fechaFin).getTime();

            if (fin < inicio) {
                return res.status(400).json({
                    mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.'
                });
            }
        }

        await evento.save();

        const eventoActualizado = await poblarEvento(evento._id);

        res.status(200).json({
            mensaje: 'Evento familiar actualizado correctamente.',
            evento: eventoActualizado || evento
        });
    } catch (error) {
        console.error('❌ Error al actualizar evento:', error);

        if (error.name === 'ValidationError' || error.message?.includes('fecha')) {
            return res.status(400).json({
                mensaje: error.message || 'Los datos del evento no son válidos.'
            });
        }

        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const cancelarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;

        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) {
            return res.status(404).json({
                mensaje: 'Evento no encontrado.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: evento.arbol,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para cancelar este evento.'
            });
        }

        evento.estado = 'Cancelado';
        await evento.save();

        res.status(200).json({
            mensaje: 'Evento cancelado correctamente.',
            evento
        });
    } catch (error) {
        console.error('❌ Error al cancelar evento:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

const eliminarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;

        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) {
            return res.status(404).json({
                mensaje: 'Evento no encontrado.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: evento.arbol,
            activo: true
        });

        if (!arbol) {
            return res.status(404).json({
                mensaje: 'Árbol no encontrado.'
            });
        }

        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para eliminar este evento.'
            });
        }

        evento.estado = 'Eliminado';
        await evento.save();

        res.status(200).json({
            mensaje: 'Evento eliminado correctamente.'
        });
    } catch (error) {
        console.error('❌ Error al eliminar evento:', error);
        res.status(500).json({
            mensaje: 'Error interno del servidor.'
        });
    }
};

module.exports = {
    crearEventoFamiliar,
    obtenerEventosPorArbol,
    obtenerProximosEventos,
    obtenerEventoPorId,
    actualizarEventoFamiliar,
    cancelarEventoFamiliar,
    eliminarEventoFamiliar
};