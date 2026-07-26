const Arbol = require('../../models/arboles/arbol.model');
const Nodo = require('../../models/arboles/nodo.model');
const EventoFamiliar = require('../../models/arboles/eventoFamiliar.model');
const Publicacion = require('../../models/publicacion/publicacion.model');

const ZONA_HORARIA_DEFECTO = 'America/Mexico_City';
const MAX_EVENTOS_CONSULTA = 1000;

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
    return Boolean(valor1 && valor2 && valor1 === valor2);
};


const normalizarBusquedaEvento = (valor = '') => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^#+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^A-Za-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const usuarioPuedeVerArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;
    if (sonMismoId(arbol.creador, usuarioId)) return true;

    const admins = Array.isArray(arbol.admins) ? arbol.admins : [];
    if (admins.some(adminId => sonMismoId(adminId, usuarioId))) return true;

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

const usuarioPuedeCrearEvento = (arbol, usuarioId) => usuarioPuedeVerArbol(arbol, usuarioId);

const usuarioPuedeGestionarEvento = (arbol, evento, usuarioId) => {
    if (!arbol || !evento || !usuarioId) return false;
    if (usuarioPuedeEditarArbol(arbol, usuarioId)) return true;
    return sonMismoId(evento.creadoPor, usuarioId);
};

const normalizarZonaHoraria = (zonaHoraria) => {
    const candidata = String(zonaHoraria || ZONA_HORARIA_DEFECTO).trim();

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: candidata }).format(new Date());
        return candidata;
    } catch (error) {
        return ZONA_HORARIA_DEFECTO;
    }
};

const obtenerPartesEnZona = (fecha, zonaHoraria) => {
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(date.getTime())) return null;

    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: normalizarZonaHoraria(zonaHoraria),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23'
    }).formatToParts(date).reduce((acumulado, parte) => {
        if (parte.type !== 'literal') acumulado[parte.type] = parte.value;
        return acumulado;
    }, {});

    return {
        year: Number(partes.year),
        month: Number(partes.month),
        day: Number(partes.day),
        hour: Number(partes.hour) === 24 ? 0 : Number(partes.hour),
        minute: Number(partes.minute),
        second: Number(partes.second)
    };
};

const convertirPartesLocalesAUTC = (partes, zonaHoraria) => {
    const zona = normalizarZonaHoraria(zonaHoraria);
    const objetivoLocalMs = Date.UTC(
        partes.year,
        partes.month - 1,
        partes.day,
        partes.hour || 0,
        partes.minute || 0,
        partes.second || 0,
        partes.millisecond || 0
    );

    let candidata = new Date(objetivoLocalMs);

    // Dos o tres correcciones permiten resolver offsets y cambios de horario de verano
    // sin depender de una librería adicional.
    for (let intento = 0; intento < 4; intento += 1) {
        const actuales = obtenerPartesEnZona(candidata, zona);
        if (!actuales) return null;

        const actualLocalMs = Date.UTC(
            actuales.year,
            actuales.month - 1,
            actuales.day,
            actuales.hour,
            actuales.minute,
            actuales.second,
            partes.millisecond || 0
        );

        const diferencia = objetivoLocalMs - actualLocalMs;
        if (diferencia === 0) break;
        candidata = new Date(candidata.getTime() + diferencia);
    }

    return candidata;
};

const obtenerFechaValida = (
    fecha,
    { zonaHoraria = ZONA_HORARIA_DEFECTO, todoElDia = false, finDelDia = false } = {}
) => {
    if (!fecha) return null;
    if (fecha instanceof Date) return Number.isNaN(fecha.getTime()) ? null : fecha;

    const texto = String(fecha).trim();
    if (!texto) return null;

    // Las fechas que ya incluyen Z u offset representan un instante absoluto.
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(texto)) {
        const date = new Date(texto);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const coincidencia = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2}))?(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/
    );

    if (!coincidencia) {
        const date = new Date(texto);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const partes = {
        year: Number(coincidencia[1]),
        month: Number(coincidencia[2]),
        day: Number(coincidencia[3]),
        hour: todoElDia ? (finDelDia ? 23 : 0) : Number(coincidencia[4] || 0),
        minute: todoElDia ? (finDelDia ? 59 : 0) : Number(coincidencia[5] || 0),
        second: todoElDia ? (finDelDia ? 59 : 0) : Number(coincidencia[6] || 0),
        millisecond: todoElDia && finDelDia
            ? 999
            : Number(String(coincidencia[7] || '0').padEnd(3, '0'))
    };

    if (
        partes.month < 1 || partes.month > 12 ||
        partes.day < 1 || partes.day > 31 ||
        partes.hour < 0 || partes.hour > 23 ||
        partes.minute < 0 || partes.minute > 59 ||
        partes.second < 0 || partes.second > 59
    ) {
        return null;
    }

    return convertirPartesLocalesAUTC(partes, zonaHoraria);
};

const obtenerFinDiaEvento = (evento) => {
    if (!evento?.fechaInicio) return null;

    const zona = normalizarZonaHoraria(evento.zonaHoraria);
    const partesInicio = obtenerPartesEnZona(evento.fechaInicio, zona);
    if (!partesInicio) return null;

    return convertirPartesLocalesAUTC({
        year: partesInicio.year,
        month: partesInicio.month,
        day: partesInicio.day,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999
    }, zona);
};

const obtenerFechaReferenciaEvento = (evento) => {
    if (!evento) return null;
    if (evento.fechaFin) return new Date(evento.fechaFin);
    if (evento.todoElDia) return obtenerFinDiaEvento(evento);
    return evento.fechaInicio ? new Date(evento.fechaInicio) : null;
};

const eventoEsPasado = (evento, ahora = new Date()) => {
    if (!evento) return true;
    if (evento.estado === 'Cancelado') return true;

    const referencia = obtenerFechaReferenciaEvento(evento);
    if (!referencia || Number.isNaN(referencia.getTime())) return true;
    return referencia.getTime() < ahora.getTime();
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

const consultaEventoPoblado = (consulta) => consulta
    .populate({
        path: 'creadoPor',
        select: 'nombreUsuario nickname email imagenPerfil',
        populate: { path: 'imagenPerfil' }
    })
    .populate('nodosRelacionados', 'nombre iniciales fotoPerfil fechaNacimiento fechaFallecimiento estaFallecido origen usuario')
    .populate({
        path: 'invitados.usuario',
        select: 'nombreUsuario nickname email imagenPerfil',
        populate: { path: 'imagenPerfil' }
    });

const poblarEvento = async (eventoId) => consultaEventoPoblado(EventoFamiliar.findById(eventoId));

const obtenerResumenesPublicaciones = async (eventos = []) => {
    const ids = eventos
        .map(evento => evento?._id || evento?.id)
        .filter(Boolean);

    if (ids.length === 0) return new Map();

    const resumenes = await Publicacion.aggregate([
        {
            $match: {
                'eventoRelacionado.evento': { $in: ids },
                tipo: 'familiar'
            }
        },
        {
            $project: {
                eventoId: '$eventoRelacionado.evento',
                totalMultimedia: { $size: { $ifNull: ['$multimedia', []] } }
            }
        },
        {
            $group: {
                _id: '$eventoId',
                totalPublicaciones: { $sum: 1 },
                totalMultimedia: { $sum: '$totalMultimedia' }
            }
        }
    ]);

    return new Map(resumenes.map(resumen => [String(resumen._id), resumen]));
};

const anexarMetadatosEventos = async (eventos, arbol, usuarioId) => {
    const lista = Array.isArray(eventos) ? eventos : [];
    const resumenes = await obtenerResumenesPublicaciones(lista);
    const ahora = new Date();

    return lista.map(evento => {
        const objeto = typeof evento.toObject === 'function' ? evento.toObject() : { ...evento };
        const resumen = resumenes.get(String(objeto._id)) || {};
        const fechaReferencia = obtenerFechaReferenciaEvento(objeto);

        return {
            ...objeto,
            fechaReferencia: fechaReferencia || objeto.fechaInicio || null,
            esPasado: eventoEsPasado(objeto, ahora),
            puedeGestionar: usuarioPuedeGestionarEvento(arbol, objeto, usuarioId),
            totalPublicaciones: Number(resumen.totalPublicaciones || 0),
            totalMultimedia: Number(resumen.totalMultimedia || 0)
        };
    });
};

const codificarCursor = (evento) => {
    const referencia = obtenerFechaReferenciaEvento(evento);
    if (!referencia || Number.isNaN(referencia.getTime())) return null;

    return Buffer.from(JSON.stringify({
        fecha: referencia.toISOString(),
        id: String(evento._id || evento.id)
    })).toString('base64url');
};

const decodificarCursor = (cursor) => {
    if (!cursor) return null;

    try {
        const data = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
        const fecha = new Date(data.fecha);
        if (!data.id || Number.isNaN(fecha.getTime())) return null;
        return { fecha, id: String(data.id) };
    } catch (error) {
        return null;
    }
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
            zonaHoraria = ZONA_HORARIA_DEFECTO,
            ubicacion = {},
            nodosRelacionados = [],
            invitados = [],
            recordatorio = {},
            privacidad = 'Arbol'
        } = req.body;

        if (!arbolId) {
            return res.status(400).json({ mensaje: 'El arbolId es obligatorio.' });
        }

        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ mensaje: 'El título del evento es obligatorio.' });
        }

        const zonaSegura = normalizarZonaHoraria(zonaHoraria);
        const esTodoElDia = Boolean(todoElDia);
        const fechaInicioDate = obtenerFechaValida(fechaInicio, {
            zonaHoraria: zonaSegura,
            todoElDia: esTodoElDia,
            finDelDia: false
        });

        if (!fechaInicioDate) {
            return res.status(400).json({ mensaje: 'La fecha de inicio del evento no es válida.' });
        }

        const fechaFinDate = fechaFin
            ? obtenerFechaValida(fechaFin, {
                zonaHoraria: zonaSegura,
                todoElDia: esTodoElDia,
                finDelDia: esTodoElDia
            })
            : null;

        if (fechaFin && !fechaFinDate) {
            return res.status(400).json({ mensaje: 'La fecha de fin del evento no es válida.' });
        }

        if (fechaFinDate && fechaFinDate.getTime() < fechaInicioDate.getTime()) {
            return res.status(400).json({ mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
        }

        const arbol = await Arbol.findOne({ _id: arbolId, activo: true });

        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeCrearEvento(arbol, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para crear eventos en este árbol.' });
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
                .map(usuarioId => ({ usuario: usuarioId, estado: 'Pendiente' }))
            : [];

        const nuevoEvento = await EventoFamiliar.create({
            arbol: arbolId,
            creadoPor: req.usuario.id,
            titulo: titulo.trim(),
            descripcion,
            tipoEvento,
            fechaInicio: fechaInicioDate,
            fechaFin: fechaFinDate,
            todoElDia: esTodoElDia,
            zonaHoraria: zonaSegura,
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
        const [eventoConMetadatos] = await anexarMetadatosEventos(
            [eventoPoblado || nuevoEvento],
            arbol,
            req.usuario.id
        );

        return res.status(201).json({
            mensaje: 'Evento familiar creado correctamente.',
            evento: eventoConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al crear evento familiar:', error);

        if (error.name === 'ValidationError' || error.message?.toLowerCase().includes('fecha')) {
            return res.status(400).json({
                mensaje: error.message || 'Los datos del evento no son válidos.'
            });
        }

        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const obtenerEventosPorArbol = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const { desde, hasta, estado = 'Activo', tipoEvento, limite = 50, q = '' } = req.query;
        const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 100);
        const terminoBusqueda = normalizarBusquedaEvento(q);

        const arbol = await Arbol.findOne({ _id: arbolId, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver los eventos de este árbol.' });
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
        if (Object.keys(fechaFiltro).length > 0) filtro.fechaInicio = fechaFiltro;
        if (tipoEvento && tipoEvento !== 'Todos') filtro.tipoEvento = tipoEvento;

        let eventos = await consultaEventoPoblado(
            EventoFamiliar.find(filtro)
                .sort({ fechaInicio: 1, _id: 1 })
                .limit(terminoBusqueda ? MAX_EVENTOS_CONSULTA : limiteSeguro)
        );

        if (terminoBusqueda) {
            eventos = eventos
                .filter(evento => normalizarBusquedaEvento(evento?.titulo).includes(terminoBusqueda))
                .slice(0, limiteSeguro);
        }

        const eventosConMetadatos = await anexarMetadatosEventos(eventos, arbol, req.usuario.id);

        return res.status(200).json({
            mensaje: 'Eventos recuperados correctamente.',
            total: eventosConMetadatos.length,
            consulta: terminoBusqueda || '',
            eventos: eventosConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al obtener eventos:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const obtenerProximosEventos = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const limiteSeguro = Math.min(Math.max(Number(req.query.limite) || 10, 1), 30);

        const arbol = await Arbol.findOne({ _id: arbolId, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver los eventos de este árbol.' });
        }

        const candidatos = await consultaEventoPoblado(
            EventoFamiliar.find({
                arbol: arbolId,
                estado: 'Activo'
            })
                .sort({ fechaInicio: 1, _id: 1 })
                .limit(MAX_EVENTOS_CONSULTA)
        );

        const ahora = new Date();
        const proximos = candidatos
            .filter(evento => !eventoEsPasado(evento, ahora))
            .sort((a, b) => {
                const fechaA = obtenerFechaReferenciaEvento(a)?.getTime() || 0;
                const fechaB = obtenerFechaReferenciaEvento(b)?.getTime() || 0;
                return fechaA - fechaB;
            })
            .slice(0, limiteSeguro);

        const eventosConMetadatos = await anexarMetadatosEventos(proximos, arbol, req.usuario.id);

        return res.status(200).json({
            mensaje: 'Próximos eventos recuperados correctamente.',
            total: eventosConMetadatos.length,
            eventos: eventosConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al obtener próximos eventos:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const obtenerEventosPasados = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const limiteSeguro = Math.min(Math.max(Number(req.query.limite) || 20, 1), 50);
        const cursor = decodificarCursor(req.query.cursor);

        const arbol = await Arbol.findOne({ _id: arbolId, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver los eventos de este árbol.' });
        }

        const candidatos = await consultaEventoPoblado(
            EventoFamiliar.find({
                arbol: arbolId,
                estado: { $ne: 'Eliminado' }
            })
                .sort({ fechaInicio: -1, _id: -1 })
                .limit(MAX_EVENTOS_CONSULTA)
        );

        const ahora = new Date();
        let pasados = candidatos
            .filter(evento => eventoEsPasado(evento, ahora))
            .sort((a, b) => {
                const fechaA = obtenerFechaReferenciaEvento(a)?.getTime() || 0;
                const fechaB = obtenerFechaReferenciaEvento(b)?.getTime() || 0;
                if (fechaA !== fechaB) return fechaB - fechaA;
                return String(b._id).localeCompare(String(a._id));
            });

        if (cursor) {
            pasados = pasados.filter(evento => {
                const referencia = obtenerFechaReferenciaEvento(evento);
                if (!referencia) return false;
                if (referencia.getTime() < cursor.fecha.getTime()) return true;
                if (referencia.getTime() > cursor.fecha.getTime()) return false;
                return String(evento._id) < cursor.id;
            });
        }

        const pagina = pasados.slice(0, limiteSeguro + 1);
        const hayMas = pagina.length > limiteSeguro;
        const eventosPagina = hayMas ? pagina.slice(0, limiteSeguro) : pagina;
        const eventosConMetadatos = await anexarMetadatosEventos(eventosPagina, arbol, req.usuario.id);
        const siguienteCursor = hayMas && eventosPagina.length > 0
            ? codificarCursor(eventosPagina[eventosPagina.length - 1])
            : null;

        return res.status(200).json({
            mensaje: 'Eventos pasados recuperados correctamente.',
            total: eventosConMetadatos.length,
            eventos: eventosConMetadatos,
            siguienteCursor
        });
    } catch (error) {
        console.error('❌ Error al obtener eventos pasados:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const obtenerEventoPorId = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const evento = await consultaEventoPoblado(
            EventoFamiliar.findOne({ _id: eventoId, estado: { $ne: 'Eliminado' } })
        );

        if (!evento) return res.status(404).json({ mensaje: 'Evento no encontrado.' });

        const arbol = await Arbol.findOne({ _id: evento.arbol, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeVerArbol(arbol, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver este evento.' });
        }

        const [eventoConMetadatos] = await anexarMetadatosEventos([evento], arbol, req.usuario.id);

        return res.status(200).json({
            mensaje: 'Evento recuperado correctamente.',
            evento: eventoConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al obtener evento:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const actualizarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) return res.status(404).json({ mensaje: 'Evento no encontrado.' });

        const arbol = await Arbol.findOne({ _id: evento.arbol, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para editar este evento.' });
        }

        const zonaFinal = normalizarZonaHoraria(req.body.zonaHoraria ?? evento.zonaHoraria);
        const todoElDiaFinal = req.body.todoElDia !== undefined
            ? Boolean(req.body.todoElDia)
            : Boolean(evento.todoElDia);

        if (req.body.titulo !== undefined) {
            if (!req.body.titulo || !req.body.titulo.trim()) {
                return res.status(400).json({ mensaje: 'El título del evento no puede estar vacío.' });
            }
            evento.titulo = req.body.titulo.trim();
        }

        if (req.body.descripcion !== undefined) evento.descripcion = req.body.descripcion;
        if (req.body.tipoEvento !== undefined) evento.tipoEvento = req.body.tipoEvento;
        if (req.body.todoElDia !== undefined) evento.todoElDia = todoElDiaFinal;
        if (req.body.zonaHoraria !== undefined) evento.zonaHoraria = zonaFinal;
        if (req.body.privacidad !== undefined) evento.privacidad = req.body.privacidad;
        if (req.body.estado !== undefined) evento.estado = req.body.estado;

        if (req.body.fechaInicio !== undefined) {
            const fechaInicioDate = obtenerFechaValida(req.body.fechaInicio, {
                zonaHoraria: zonaFinal,
                todoElDia: todoElDiaFinal,
                finDelDia: false
            });
            if (!fechaInicioDate) {
                return res.status(400).json({ mensaje: 'La fecha de inicio no es válida.' });
            }
            evento.fechaInicio = fechaInicioDate;
        }

        if (req.body.fechaFin !== undefined) {
            evento.fechaFin = req.body.fechaFin
                ? obtenerFechaValida(req.body.fechaFin, {
                    zonaHoraria: zonaFinal,
                    todoElDia: todoElDiaFinal,
                    finDelDia: todoElDiaFinal
                })
                : null;

            if (req.body.fechaFin && !evento.fechaFin) {
                return res.status(400).json({ mensaje: 'La fecha de fin no es válida.' });
            }
        }

        if (req.body.ubicacion !== undefined) {
            evento.ubicacion = normalizarUbicacion(req.body.ubicacion);
        }

        if (req.body.nodosRelacionados !== undefined) {
            const nodosRelacionados = Array.isArray(req.body.nodosRelacionados)
                ? req.body.nodosRelacionados
                : [];
            const nodos = await Nodo.find({
                _id: { $in: nodosRelacionados },
                arbol: evento.arbol,
                visible: true
            }).select('_id');
            evento.nodosRelacionados = nodos.map(nodo => nodo._id);
        }

        if (req.body.recordatorio !== undefined) {
            evento.recordatorio = {
                activo: req.body.recordatorio?.activo !== undefined
                    ? Boolean(req.body.recordatorio.activo)
                    : evento.recordatorio?.activo,
                minutosAntes: req.body.recordatorio?.minutosAntes !== undefined
                    ? Number(req.body.recordatorio.minutosAntes)
                    : evento.recordatorio?.minutosAntes
            };
        }

        if (evento.fechaInicio && evento.fechaFin && evento.fechaFin.getTime() < evento.fechaInicio.getTime()) {
            return res.status(400).json({ mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
        }

        await evento.save();

        const eventoActualizado = await poblarEvento(evento._id);
        const [eventoConMetadatos] = await anexarMetadatosEventos(
            [eventoActualizado || evento],
            arbol,
            req.usuario.id
        );

        return res.status(200).json({
            mensaje: 'Evento familiar actualizado correctamente.',
            evento: eventoConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al actualizar evento:', error);

        if (error.name === 'ValidationError' || error.message?.toLowerCase().includes('fecha')) {
            return res.status(400).json({
                mensaje: error.message || 'Los datos del evento no son válidos.'
            });
        }

        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const cancelarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) return res.status(404).json({ mensaje: 'Evento no encontrado.' });

        const arbol = await Arbol.findOne({ _id: evento.arbol, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para cancelar este evento.' });
        }

        evento.estado = 'Cancelado';
        await evento.save();

        const eventoActualizado = await poblarEvento(evento._id);
        const [eventoConMetadatos] = await anexarMetadatosEventos(
            [eventoActualizado || evento],
            arbol,
            req.usuario.id
        );

        return res.status(200).json({
            mensaje: 'Evento cancelado correctamente.',
            evento: eventoConMetadatos
        });
    } catch (error) {
        console.error('❌ Error al cancelar evento:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

const eliminarEventoFamiliar = async (req, res) => {
    try {
        const { eventoId } = req.params;
        const evento = await EventoFamiliar.findOne({
            _id: eventoId,
            estado: { $ne: 'Eliminado' }
        });

        if (!evento) return res.status(404).json({ mensaje: 'Evento no encontrado.' });

        const arbol = await Arbol.findOne({ _id: evento.arbol, activo: true });
        if (!arbol) return res.status(404).json({ mensaje: 'Árbol no encontrado.' });
        if (!usuarioPuedeGestionarEvento(arbol, evento, req.usuario.id)) {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar este evento.' });
        }

        evento.estado = 'Eliminado';
        await evento.save();

        return res.status(200).json({ mensaje: 'Evento eliminado correctamente.' });
    } catch (error) {
        console.error('❌ Error al eliminar evento:', error);
        return res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

module.exports = {
    crearEventoFamiliar,
    obtenerEventosPorArbol,
    obtenerProximosEventos,
    obtenerEventosPasados,
    obtenerEventoPorId,
    actualizarEventoFamiliar,
    cancelarEventoFamiliar,
    eliminarEventoFamiliar
};
