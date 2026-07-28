const {
    Arbol,
    Nodo,
    Hilo,
    Usuario,
    Seguidor,
    InvitacionFamiliar
} = require('../../models/index.model');
const {
    crearNotificacion,
    crearClaveEvento,
    eliminarNotificacionPorClave
} = require('../../services/notificacion.service');
const {
    ejecutarOperacionLayout,
    normalizarGeneracionesPersistidas,
    prepararGeneracionObjetivo
} = require('../../services/layoutArbol.service');

const retirarNotificacionInvitacion = async (invitacionId) => {
    if (!invitacionId) return;
    await eliminarNotificacionPorClave(
        crearClaveEvento('invitacion_arbol', invitacionId)
    );
};

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

const verificarAmistadMutua = async (usuarioA, usuarioB) => {
    const yoSigo = await Seguidor.findOne({
        seguidor: usuarioA,
        seguido: usuarioB
    });

    const meSigue = await Seguidor.findOne({
        seguidor: usuarioB,
        seguido: usuarioA
    });

    return Boolean(yoSigo && meSigue);
};

const cancelarInvitacionesSinArbol = async (invitaciones = []) => {
    const idsInvalidas = invitaciones
        .filter(invitacion => !invitacion.arbol)
        .map(invitacion => invitacion._id);

    if (idsInvalidas.length > 0) {
        await InvitacionFamiliar.updateMany(
            {
                _id: { $in: idsInvalidas },
                estado: 'Pendiente'
            },
            {
                $set: {
                    estado: 'Cancelada',
                    respondidaEn: new Date()
                }
            }
        );
    }
};

const obtenerAmigosDisponiblesParaInvitar = async (req, res) => {
    try {
        const { arbolId } = req.params;
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
                mensaje: 'Solo el creador o un admin pueden ver amigos disponibles para invitar a este árbol.'
            });
        }

        const siguiendo = await Seguidor.find({ seguidor: usuarioId }).select('seguido');
        const idsQueSigo = siguiendo.map(s => s.seguido);

        if (idsQueSigo.length === 0) {
            return res.status(200).json({
                mensaje: 'No tienes amigos disponibles todavía.',
                total: 0,
                amigos: []
            });
        }

        const amistades = await Seguidor.find({
            seguidor: { $in: idsQueSigo },
            seguido: usuarioId
        }).populate({
            path: 'seguidor',
            select: 'nombreUsuario imagenPerfil',
            populate: {
                path: 'imagenPerfil',
                select: 'urlArchivo'
            }
        });

        const idsAmigos = amistades
            .map(a => a.seguidor?._id)
            .filter(Boolean);

        const nodosExistentes = await Nodo.find({
            arbol: arbolId,
            usuario: { $in: idsAmigos },
            visible: true
        }).select('usuario');

        const idsYaEnArbol = new Set(
            nodosExistentes.map(n => String(n.usuario))
        );

        const invitacionesPendientes = await InvitacionFamiliar.find({
            arbol: arbolId,
            invitado: { $in: idsAmigos },
            estado: 'Pendiente'
        }).select('invitado');

        const idsConInvitacionPendiente = new Set(
            invitacionesPendientes.map(i => String(i.invitado))
        );

        const amigos = amistades
            .map(a => a.seguidor)
            .filter(usuario => {
                if (!usuario) return false;

                const id = String(usuario._id);

                return !idsYaEnArbol.has(id) &&
                    !idsConInvitacionPendiente.has(id) &&
                    id !== String(usuarioId);
            })
            .map(usuario => ({
                id: usuario._id,
                idConexion: usuario._id,
                nombre: usuario.nombreUsuario,
                iniciales: obtenerIniciales(usuario.nombreUsuario),
                relacion: 'Amigo',
                img: usuario.imagenPerfil?.urlArchivo || null
            }));

        res.status(200).json({
            mensaje: 'Amigos disponibles recuperados correctamente',
            total: amigos.length,
            amigos
        });
    } catch (error) {
        console.error('❌ Error al obtener amigos disponibles:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const enviarInvitacionFamiliar = async (req, res) => {
    try {
        const {
            arbolId,
            invitadoId,
            datosNodoPropuesto,
            relacionPropuesta = {},
            mensaje = ''
        } = req.body;

        if (!arbolId || !invitadoId || !datosNodoPropuesto) {
            return res.status(400).json({
                mensaje: 'Faltan datos obligatorios: arbolId, invitadoId y datosNodoPropuesto.'
            });
        }

        if (sonMismoId(invitadoId, req.usuario.id)) {
            return res.status(400).json({
                mensaje: 'No puedes enviarte una invitación a ti mismo.'
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
                mensaje: 'No tienes permiso para enviar invitaciones desde este árbol.'
            });
        }

        const invitado = await Usuario.findById(invitadoId).select('nombreUsuario');

        if (!invitado) {
            return res.status(404).json({ mensaje: 'Usuario invitado no encontrado' });
        }

        const esAmigo = await verificarAmistadMutua(req.usuario.id, invitadoId);

        if (!esAmigo) {
            return res.status(403).json({
                mensaje: 'Solo puedes invitar al árbol a usuarios que sean tus amigos.'
            });
        }

        const nodoExistente = await Nodo.findOne({
            arbol: arbolId,
            usuario: invitadoId,
            visible: true
        });

        if (nodoExistente) {
            return res.status(400).json({
                mensaje: 'Este usuario ya pertenece a este árbol.'
            });
        }

        const invitacionExistente = await InvitacionFamiliar.findOne({
            arbol: arbolId,
            invitado: invitadoId,
            estado: 'Pendiente'
        });

        if (invitacionExistente) {
            return res.status(400).json({
                mensaje: 'Este usuario ya tiene una invitación pendiente para este árbol.'
            });
        }

        const nombrePropuesto = datosNodoPropuesto.nombre || invitado.nombreUsuario;
        const filaPropuesta = Number(datosNodoPropuesto.fila);

        if (!Number.isInteger(filaPropuesta) || filaPropuesta < 0) {
            return res.status(400).json({
                mensaje: 'La fila propuesta debe ser un número entero mayor o igual a cero.'
            });
        }

        const { nuevaInvitacion, arbolDesplazado } = await ejecutarOperacionLayout(async (session) => {
            await normalizarGeneracionesPersistidas({ arbolId, session });

            const resultadoGeneracion = await prepararGeneracionObjetivo({
                arbolId,
                generacion: datosNodoPropuesto.generacion,
                session
            });

            const documentos = await InvitacionFamiliar.create([{
                arbol: arbolId,
                invitado: invitadoId,
                invitadoPor: req.usuario.id,
                estado: 'Pendiente',
                datosNodoPropuesto: {
                    nombre: nombrePropuesto,
                    iniciales: datosNodoPropuesto.iniciales || obtenerIniciales(nombrePropuesto),
                    colorFondo: datosNodoPropuesto.colorFondo || '#e2e8f0',
                    colorTexto: datosNodoPropuesto.colorTexto || '#0f172a',
                    generacion: resultadoGeneracion.generacion,
                    fila: filaPropuesta,
                    tipo: datosNodoPropuesto.tipo || 'normal'
                },
                relacionPropuesta: {
                    nodoRelacionado: relacionPropuesta.nodoRelacionado || null,
                    tipoRelacion: relacionPropuesta.tipoRelacion || 'ninguna',
                    rolDelInvitado: relacionPropuesta.rolDelInvitado || 'ninguno'
                },
                mensaje
            }], session ? { session } : {});

            return {
                nuevaInvitacion: documentos[0],
                arbolDesplazado: resultadoGeneracion.desplazamiento > 0
            };
        });

        await crearNotificacion({
            destinatarioId: invitadoId,
            actorId: req.usuario.id,
            tipo: 'invitacion_arbol',
            arbolId,
            solicitudId: nuevaInvitacion._id,
            nombreFamilia: arbol.nombreFamilia || 'Mi Familia',
            enlaceReferencia: '/arbol-genealogico?seccion=invitaciones',
            claveEvento: crearClaveEvento('invitacion_arbol', nuevaInvitacion._id)
        });

        res.status(201).json({
            mensaje: arbolDesplazado
                ? 'Invitación enviada y generaciones anteriores recorridas correctamente.'
                : 'Invitación familiar enviada correctamente',
            invitacion: nuevaInvitacion
        });
    } catch (error) {
        console.error('❌ Error al enviar invitación familiar:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'Ya existe una invitación pendiente para este usuario en este árbol.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerInvitacionesPendientes = async (req, res) => {
    try {
        const invitaciones = await InvitacionFamiliar.find({
            invitado: req.usuario.id,
            estado: 'Pendiente'
        })
            .populate({
                path: 'arbol',
                match: { activo: true },
                select: 'nombreFamilia descripcion privacidad creador activo'
            })
            .populate({
                path: 'invitadoPor',
                select: 'nombreUsuario imagenPerfil',
                populate: {
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                }
            })
            .sort({ createdAt: -1 });

        await cancelarInvitacionesSinArbol(invitaciones);

        const invitacionesValidas = invitaciones.filter(invitacion => invitacion.arbol);

        res.status(200).json({
            mensaje: 'Invitaciones pendientes recuperadas correctamente',
            total: invitacionesValidas.length,
            invitaciones: invitacionesValidas
        });
    } catch (error) {
        console.error('❌ Error al obtener invitaciones pendientes:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const aceptarInvitacionFamiliar = async (req, res) => {
    try {
        const { invitacionId } = req.params;
        const usuarioId = req.usuario.id;

        const invitacion = await InvitacionFamiliar.findOne({
            _id: invitacionId,
            invitado: usuarioId,
            estado: 'Pendiente'
        });

        if (!invitacion) {
            return res.status(404).json({
                mensaje: 'Invitación pendiente no encontrada.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: invitacion.arbol,
            activo: true
        });

        if (!arbol) {
            invitacion.estado = 'Cancelada';
            invitacion.respondidaEn = new Date();
            await invitacion.save();
            await retirarNotificacionInvitacion(invitacion._id);

            return res.status(404).json({
                mensaje: 'El árbol de esta invitación ya no existe o fue eliminado. La invitación se canceló automáticamente.'
            });
        }

        const nodoExistente = await Nodo.findOne({
            arbol: invitacion.arbol,
            usuario: usuarioId,
            visible: true
        });

        if (nodoExistente) {
            const yaEsMiembro = arbol.miembros.some(miembro =>
                sonMismoId(miembro.usuario, usuarioId)
            );

            if (!yaEsMiembro) {
                arbol.miembros.push({
                    usuario: usuarioId,
                    rol: 'Miembro',
                    estado: 'Activo'
                });

                await arbol.save();
            }

            invitacion.estado = 'Aceptada';
            invitacion.respondidaEn = new Date();
            await invitacion.save();
            await retirarNotificacionInvitacion(invitacion._id);

            return res.status(200).json({
                mensaje: 'Ya pertenecías a este árbol. Invitación marcada como aceptada.',
                nodo: nodoExistente,
                hilo: null
            });
        }

        const nuevoNodo = await Nodo.create({
            arbol: invitacion.arbol,
            usuario: usuarioId,
            creadoPor: invitacion.invitadoPor,
            nombre: invitacion.datosNodoPropuesto.nombre,
            iniciales: invitacion.datosNodoPropuesto.iniciales,
            colorFondo: invitacion.datosNodoPropuesto.colorFondo,
            colorTexto: invitacion.datosNodoPropuesto.colorTexto,
            fechaCorta: 'Pendiente',
            estaFallecido: false,
            tipo: invitacion.datosNodoPropuesto.tipo,
            estado: 'Verificado',
            origen: 'usuario_real',
            generacion: invitacion.datosNodoPropuesto.generacion,
            fila: invitacion.datosNodoPropuesto.fila,
            fotos: [],
            biografia: '',
            visible: true
        });

        const yaEsMiembro = arbol.miembros.some(miembro =>
            sonMismoId(miembro.usuario, usuarioId)
        );

        if (!yaEsMiembro) {
            arbol.miembros.push({
                usuario: usuarioId,
                rol: 'Miembro',
                estado: 'Activo'
            });
        } else {
            arbol.miembros = arbol.miembros.map(miembro => {
                if (sonMismoId(miembro.usuario, usuarioId)) {
                    miembro.estado = 'Activo';
                }

                return miembro;
            });
        }

        await arbol.save();

        let hiloCreado = null;

        const tipoRelacion = invitacion.relacionPropuesta?.tipoRelacion;
        const nodoRelacionadoId = invitacion.relacionPropuesta?.nodoRelacionado;
        const rolDelInvitado = invitacion.relacionPropuesta?.rolDelInvitado;

        if (tipoRelacion && tipoRelacion !== 'ninguna' && nodoRelacionadoId) {
            const nodoRelacionado = await Nodo.findOne({
                _id: nodoRelacionadoId,
                arbol: invitacion.arbol,
                visible: true
            });

            if (nodoRelacionado) {
                let nodoOrigen = nodoRelacionado._id;
                let nodoDestino = nuevoNodo._id;

                if (tipoRelacion === 'padre_hijo') {
                    if (rolDelInvitado === 'hijo') {
                        nodoOrigen = nodoRelacionado._id;
                        nodoDestino = nuevoNodo._id;
                    }

                    if (rolDelInvitado === 'padre') {
                        nodoOrigen = nuevoNodo._id;
                        nodoDestino = nodoRelacionado._id;
                    }
                }

                if (
                    tipoRelacion === 'matrimonio' ||
                    tipoRelacion === 'pareja' ||
                    tipoRelacion === 'divorcio'
                ) {
                    nodoOrigen = nodoRelacionado._id;
                    nodoDestino = nuevoNodo._id;
                }

                try {
                    hiloCreado = await Hilo.create({
                        arbol: invitacion.arbol,
                        nodoOrigen,
                        nodoDestino,
                        tipoRelacion,
                        estado: 'Activa',
                        creadoPor: invitacion.invitadoPor
                    });
                } catch (errorHilo) {
                    if (errorHilo.code !== 11000) {
                        console.error('❌ Error al crear hilo al aceptar invitación:', errorHilo);
                    }
                }
            }
        }

        invitacion.estado = 'Aceptada';
        invitacion.respondidaEn = new Date();
        await invitacion.save();
        await retirarNotificacionInvitacion(invitacion._id);

        res.status(200).json({
            mensaje: 'Invitación aceptada. Ya formas parte del árbol.',
            nodo: nuevoNodo,
            hilo: hiloCreado
        });
    } catch (error) {
        console.error('❌ Error al aceptar invitación familiar:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                mensaje: 'Ya existe un nodo para este usuario en este árbol.'
            });
        }

        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const rechazarInvitacionFamiliar = async (req, res) => {
    try {
        const { invitacionId } = req.params;

        const invitacion = await InvitacionFamiliar.findOne({
            _id: invitacionId,
            invitado: req.usuario.id,
            estado: 'Pendiente'
        });

        if (!invitacion) {
            return res.status(404).json({
                mensaje: 'Invitación pendiente no encontrada.'
            });
        }

        invitacion.estado = 'Rechazada';
        invitacion.respondidaEn = new Date();
        await invitacion.save();
        await retirarNotificacionInvitacion(invitacion._id);

        res.status(200).json({
            mensaje: 'Invitación rechazada correctamente'
        });
    } catch (error) {
        console.error('❌ Error al rechazar invitación familiar:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const cancelarInvitacionFamiliar = async (req, res) => {
    try {
        const { invitacionId } = req.params;

        const invitacion = await InvitacionFamiliar.findOne({
            _id: invitacionId,
            estado: 'Pendiente'
        });

        if (!invitacion) {
            return res.status(404).json({
                mensaje: 'Invitación pendiente no encontrada.'
            });
        }

        const arbol = await Arbol.findOne({
            _id: invitacion.arbol,
            activo: true
        });

        if (!arbol) {
            invitacion.estado = 'Cancelada';
            invitacion.respondidaEn = new Date();
            await invitacion.save();
            await retirarNotificacionInvitacion(invitacion._id);

            return res.status(404).json({
                mensaje: 'El árbol de esta invitación ya no existe. La invitación fue cancelada.'
            });
        }

        const puedeCancelar =
            sonMismoId(invitacion.invitadoPor, req.usuario.id) ||
            usuarioPuedeEditarArbol(arbol, req.usuario.id);

        if (!puedeCancelar) {
            return res.status(403).json({
                mensaje: 'No tienes permiso para cancelar esta invitación.'
            });
        }

        invitacion.estado = 'Cancelada';
        invitacion.respondidaEn = new Date();
        await invitacion.save();
        await retirarNotificacionInvitacion(invitacion._id);

        res.status(200).json({
            mensaje: 'Invitación cancelada correctamente'
        });
    } catch (error) {
        console.error('❌ Error al cancelar invitación familiar:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerAmigosDisponiblesParaInvitar,
    enviarInvitacionFamiliar,
    obtenerInvitacionesPendientes,
    aceptarInvitacionFamiliar,
    rechazarInvitacionFamiliar,
    cancelarInvitacionFamiliar
};