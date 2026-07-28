const mongoose = require('mongoose');
const {
    Mensajeria,
    MensajeGrupoFamiliar,
    Usuario,
    Amigo,
    Familia,
    Seguidor,
    Arbol
} = require('../../models/index.model');
const {
    crearNotificacion,
    crearNotificacionesMultiples,
    crearClaveEvento,
    marcarNotificacionesConversacionLeidas
} = require('../../services/notificacion.service');

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

const normalizarFecha = (valor, respaldo = new Date(0)) => {
    const fecha = valor ? new Date(valor) : null;
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha : respaldo;
};

// Función auxiliar para verificar si dos usuarios están conectados
// (Amigos, Familia o Seguimiento Mutuo).
const sonContactosPermitidos = async (usuarioA, usuarioB) => {
    if (sonMismoId(usuarioA, usuarioB)) return false;

    const esAmigo = await Amigo.findOne({
        $or: [
            { usuarioSolicitante: usuarioA, usuarioReceptor: usuarioB },
            { usuarioSolicitante: usuarioB, usuarioReceptor: usuarioA }
        ],
        estado: 'Aceptado'
    });
    if (esAmigo) return true;

    const esFamilia = await Familia.findOne({
        $or: [
            { usuarioPrincipal: usuarioA, familiar: usuarioB },
            { usuarioPrincipal: usuarioB, familiar: usuarioA }
        ],
        estado: 'Aceptado'
    });
    if (esFamilia) return true;

    const sigueA = await Seguidor.findOne({ seguidor: usuarioA, seguido: usuarioB });
    const sigueB = await Seguidor.findOne({ seguidor: usuarioB, seguido: usuarioA });
    return Boolean(sigueA && sigueB);
};

const construirContactosPermitidos = async (miId) => {
    const relacionesAmigos = await Amigo.find({
        $or: [{ usuarioSolicitante: miId }, { usuarioReceptor: miId }],
        estado: 'Aceptado'
    });
    const idsAmigos = relacionesAmigos.map((relacion) => (
        sonMismoId(relacion.usuarioSolicitante, miId)
            ? obtenerIdSeguro(relacion.usuarioReceptor)
            : obtenerIdSeguro(relacion.usuarioSolicitante)
    )).filter(Boolean);

    const relacionesFamilia = await Familia.find({
        $or: [{ usuarioPrincipal: miId }, { familiar: miId }],
        estado: 'Aceptado'
    });
    const idsFamilia = relacionesFamilia.map((relacion) => (
        sonMismoId(relacion.usuarioPrincipal, miId)
            ? obtenerIdSeguro(relacion.familiar)
            : obtenerIdSeguro(relacion.usuarioPrincipal)
    )).filter(Boolean);

    const siguiendo = await Seguidor.find({ seguidor: miId }).select('seguido');
    const idsQueSigo = siguiendo.map((seguimiento) => seguimiento.seguido);
    const seguidoresMutuos = idsQueSigo.length > 0
        ? await Seguidor.find({ seguidor: { $in: idsQueSigo }, seguido: miId })
        : [];
    const idsMutuos = seguidoresMutuos.map((seguimiento) => obtenerIdSeguro(seguimiento.seguidor)).filter(Boolean);

    const idsPermitidos = Array.from(new Set([...idsAmigos, ...idsFamilia, ...idsMutuos]));

    const contactos = await Usuario.find({ _id: { $in: idsPermitidos } })
        .select('nombreUsuario email publicKey imagenPerfil')
        .populate({ path: 'imagenPerfil', select: 'urlArchivo' });

    const miObjectId = new mongoose.Types.ObjectId(String(miId));
    const idsPermitidosObjectId = idsPermitidos
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)));

    const resumenConversaciones = idsPermitidosObjectId.length > 0
        ? await Mensajeria.aggregate([
            {
                $match: {
                    $or: [
                        { creador: miObjectId, receptor: { $in: idsPermitidosObjectId } },
                        { creador: { $in: idsPermitidosObjectId }, receptor: miObjectId }
                    ]
                }
            },
            {
                $addFields: {
                    contactoId: {
                        $cond: [
                            { $eq: ['$creador', miObjectId] },
                            '$receptor',
                            '$creador'
                        ]
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$contactoId',
                    ultimoMensaje: { $first: '$$ROOT' },
                    mensajesNoLeidos: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$receptor', miObjectId] },
                                        { $eq: ['$fechaVisto', null] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ])
        : [];

    const resumenPorContacto = new Map(
        resumenConversaciones.map((item) => [String(item._id), item])
    );

    const contactosConEstado = contactos.map((contacto) => {
        const contactoObj = contacto.toObject();
        const resumen = resumenPorContacto.get(String(contacto._id));
        const ultimo = resumen?.ultimoMensaje || null;

        contactoObj.tipoChat = 'directo';
        contactoObj.mensajesNoLeidos = resumen?.mensajesNoLeidos || 0;
        contactoObj.ultimoMensaje = ultimo
            ? {
                _id: ultimo._id,
                creador: ultimo.creador,
                receptor: ultimo.receptor,
                contenidoCifrado: ultimo.contenidoCifrado,
                iv: ultimo.iv,
                claveCifradaReceptor: ultimo.claveCifradaReceptor,
                claveCifradaCreador: ultimo.claveCifradaCreador,
                fechaVisto: ultimo.fechaVisto,
                createdAt: ultimo.createdAt
            }
            : null;

        return contactoObj;
    });

    contactosConEstado.sort((a, b) => {
        const fechaA = a.ultimoMensaje?.createdAt ? new Date(a.ultimoMensaje.createdAt).getTime() : 0;
        const fechaB = b.ultimoMensaje?.createdAt ? new Date(b.ultimoMensaje.createdAt).getTime() : 0;
        if (fechaA !== fechaB) return fechaB - fechaA;
        return String(a.nombreUsuario || '').localeCompare(String(b.nombreUsuario || ''), 'es');
    });

    return contactosConEstado;
};

const construirMetadatosMiembrosActivos = (arbol) => {
    const creadorId = obtenerIdSeguro(arbol?.creador);
    const porUsuario = new Map();

    if (creadorId) {
        porUsuario.set(creadorId, {
            usuarioId: creadorId,
            rol: 'Creador',
            agregadoEn: normalizarFecha(arbol.createdAt)
        });
    }

    (Array.isArray(arbol?.miembros) ? arbol.miembros : []).forEach((miembro) => {
        const usuarioId = obtenerIdSeguro(miembro?.usuario);
        if (!usuarioId || miembro?.estado !== 'Activo') return;

        if (usuarioId === creadorId) {
            porUsuario.set(usuarioId, {
                usuarioId,
                rol: 'Creador',
                agregadoEn: normalizarFecha(arbol.createdAt)
            });
            return;
        }

        porUsuario.set(usuarioId, {
            usuarioId,
            rol: miembro?.rol || 'Miembro',
            agregadoEn: normalizarFecha(miembro?.agregadoEn, normalizarFecha(arbol.createdAt))
        });
    });

    return Array.from(porUsuario.values());
};

const obtenerContextoGrupo = async (arbolId, usuarioId) => {
    if (!mongoose.Types.ObjectId.isValid(String(arbolId))) {
        return { error: { status: 400, mensaje: 'El identificador del grupo familiar no es válido.' } };
    }

    const arbol = await Arbol.findOne({ _id: arbolId, activo: true }).lean();
    if (!arbol) {
        return { error: { status: 404, mensaje: 'El grupo familiar ya no está disponible.' } };
    }

    const metadatos = construirMetadatosMiembrosActivos(arbol);
    const miMembresia = metadatos.find((miembro) => sonMismoId(miembro.usuarioId, usuarioId));

    if (!miMembresia) {
        return { error: { status: 403, mensaje: 'Ya no perteneces activamente a este grupo familiar.' } };
    }

    const idsMiembros = metadatos.map((miembro) => miembro.usuarioId);
    const usuarios = await Usuario.find({ _id: { $in: idsMiembros } })
        .select('nombreUsuario publicKey imagenPerfil')
        .populate({ path: 'imagenPerfil', select: 'urlArchivo' })
        .lean();

    const usuariosPorId = new Map(usuarios.map((usuario) => [String(usuario._id), usuario]));
    const miembros = metadatos
        .map((metadata) => {
            const usuario = usuariosPorId.get(String(metadata.usuarioId));
            if (!usuario) return null;

            return {
                _id: usuario._id,
                id: usuario._id,
                nombreUsuario: usuario.nombreUsuario,
                imagenPerfil: usuario.imagenPerfil || null,
                publicKey: usuario.publicKey || null,
                rol: metadata.rol,
                agregadoEn: metadata.agregadoEn
            };
        })
        .filter(Boolean);

    return {
        arbol,
        miembros,
        miMembresia,
        fechaIngreso: normalizarFecha(miMembresia.agregadoEn, normalizarFecha(arbol.createdAt))
    };
};

const obtenerClaveCifradaParaUsuario = (mensaje, usuarioId) => {
    const claves = Array.isArray(mensaje?.clavesCifradas) ? mensaje.clavesCifradas : [];
    const entrada = claves.find((item) => sonMismoId(item?.usuario, usuarioId));
    return entrada?.claveCifrada || null;
};

const serializarMensajeGrupoParaUsuario = (mensaje, usuarioId) => {
    if (!mensaje) return null;

    const mensajeObj = typeof mensaje.toObject === 'function' ? mensaje.toObject() : mensaje;
    const claveCifradaUsuario = obtenerClaveCifradaParaUsuario(mensajeObj, usuarioId);
    if (!claveCifradaUsuario) return null;

    return {
        _id: mensajeObj._id,
        id: mensajeObj._id,
        arbol: mensajeObj.arbol,
        emisor: mensajeObj.emisor,
        contenidoCifrado: mensajeObj.contenidoCifrado,
        iv: mensajeObj.iv,
        claveCifradaUsuario,
        leidoPor: Array.isArray(mensajeObj.leidoPor) ? mensajeObj.leidoPor : [],
        createdAt: mensajeObj.createdAt,
        updatedAt: mensajeObj.updatedAt
    };
};

const construirResumenGrupo = async (arbol, usuarioId) => {
    const contexto = await obtenerContextoGrupo(arbol._id, usuarioId);
    if (contexto.error) return null;

    const { miembros, fechaIngreso } = contexto;
    const filtroVisible = {
        arbol: arbol._id,
        createdAt: { $gte: fechaIngreso },
        'clavesCifradas.usuario': usuarioId
    };

    const [ultimoMensaje, mensajesNoLeidos] = await Promise.all([
        MensajeGrupoFamiliar.findOne(filtroVisible)
            .sort({ createdAt: -1 })
            .populate({
                path: 'emisor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            })
            .lean(),
        MensajeGrupoFamiliar.countDocuments({
            ...filtroVisible,
            emisor: { $ne: usuarioId },
            'leidoPor.usuario': { $ne: usuarioId }
        })
    ]);

    const miembrosSinCifrado = miembros
        .filter((miembro) => !miembro.publicKey)
        .map((miembro) => ({
            id: miembro.id,
            nombreUsuario: miembro.nombreUsuario
        }));

    let motivoBloqueo = null;
    if (miembros.length < 2) motivoBloqueo = 'sin_otro_miembro';
    else if (miembrosSinCifrado.length > 0) motivoBloqueo = 'miembros_sin_cifrado';

    return {
        _id: arbol._id,
        id: arbol._id,
        arbolId: arbol._id,
        tipoChat: 'grupo-familiar',
        nombreFamilia: arbol.nombreFamilia || 'Mi Familia',
        descripcion: arbol.descripcion || '',
        privacidad: 'Familia',
        totalMiembros: miembros.length,
        miembros,
        miembrosSinCifrado,
        puedeEnviar: motivoBloqueo === null,
        motivoBloqueo,
        mensajesNoLeidos,
        ultimoMensaje: serializarMensajeGrupoParaUsuario(ultimoMensaje, usuarioId)
    };
};

// 1. Obtener todos los contactos permitidos (respuesta antigua conservada).
const obtenerContactosPermitidos = async (req, res) => {
    try {
        const contactos = await construirContactosPermitidos(req.usuario.id);
        res.status(200).json(contactos);
    } catch (error) {
        console.error('❌ Error al obtener contactos permitidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener contactos' });
    }
};

// Bandeja unificada de conversaciones directas y grupos familiares.
const obtenerBandejaMensajes = async (req, res) => {
    try {
        const miId = req.usuario.id;
        const [contactos, arboles] = await Promise.all([
            construirContactosPermitidos(miId),
            Arbol.find({
                activo: true,
                $or: [
                    { creador: miId },
                    {
                        miembros: {
                            $elemMatch: {
                                usuario: miId,
                                estado: 'Activo'
                            }
                        }
                    }
                ]
            }).sort({ updatedAt: -1 }).lean()
        ]);

        const grupos = (await Promise.all(
            arboles.map((arbol) => construirResumenGrupo(arbol, miId))
        )).filter(Boolean);

        const totalNoLeidosDirectos = contactos.reduce(
            (total, contacto) => total + (Number(contacto.mensajesNoLeidos) || 0),
            0
        );
        const totalNoLeidosGrupos = grupos.reduce(
            (total, grupo) => total + (Number(grupo.mensajesNoLeidos) || 0),
            0
        );

        res.status(200).json({
            contactos,
            grupos,
            totalNoLeidos: totalNoLeidosDirectos + totalNoLeidosGrupos
        });
    } catch (error) {
        console.error('❌ Error al obtener la bandeja de mensajes:', error);
        res.status(500).json({ mensaje: 'Error al obtener la bandeja de mensajes' });
    }
};

// 2. Obtener conversación directa cifrada.
const obtenerConversacionConContacto = async (req, res) => {
    try {
        const { contactoId } = req.params;
        const miId = req.usuario.id;

        const esPermitido = await sonContactosPermitidos(miId, contactoId);
        if (!esPermitido) {
            return res.status(403).json({ mensaje: 'No tienes permiso para ver esta conversación.' });
        }

        const mensajes = await Mensajeria.find({
            $or: [
                { creador: miId, receptor: contactoId },
                { creador: contactoId, receptor: miId }
            ]
        }).sort({ createdAt: 1 });

        return res.status(200).json(mensajes);
    } catch (error) {
        console.error('❌ Error al obtener conversación:', error);
        return res.status(500).json({ mensaje: 'Error al obtener la conversación' });
    }
};

// 3. Enviar mensaje directo cifrado.
const enviarMensaje = async (req, res) => {
    try {
        const { receptorId, contenidoCifrado, iv, claveCifradaReceptor, claveCifradaCreador } = req.body;
        const miId = req.usuario.id;

        const esPermitido = await sonContactosPermitidos(miId, receptorId);
        if (!esPermitido) {
            return res.status(403).json({
                mensaje: 'Solo puedes enviar mensajes a tus amigos, familiares o seguidores mutuos.'
            });
        }

        const nuevoMensaje = new Mensajeria({
            creador: miId,
            receptor: receptorId,
            contenidoCifrado,
            iv,
            claveCifradaReceptor,
            claveCifradaCreador
        });

        await nuevoMensaje.save();

        await crearNotificacion({
            destinatarioId: receptorId,
            actorId: miId,
            tipo: 'mensaje_directo',
            conversacionId: miId,
            tipoConversacion: 'directo',
            enlaceReferencia: `/mensajes?tipo=directo&id=${miId}`,
            claveEvento: crearClaveEvento('mensaje_directo', nuevoMensaje._id)
        });

        return res.status(201).json({ mensaje: 'Mensaje enviado con éxito', data: nuevoMensaje });
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        return res.status(500).json({ mensaje: 'Error al enviar mensaje cifrado' });
    }
};

const marcarComoLeido = async (req, res) => {
    try {
        const { contactoId } = req.params;
        const miId = req.usuario.id;

        await Mensajeria.updateMany(
            { creador: contactoId, receptor: miId, fechaVisto: null },
            { $set: { fechaVisto: new Date() } }
        );

        await marcarNotificacionesConversacionLeidas({
            usuarioId: miId,
            conversacionId: contactoId,
            tipo: 'mensaje_directo'
        });

        return res.status(200).json({ mensaje: 'Mensajes marcados como leídos con éxito.' });
    } catch (error) {
        console.error('❌ Error al marcar mensajes como leídos:', error);
        return res.status(500).json({ mensaje: 'Error al actualizar el estado de lectura' });
    }
};

const obtenerConversacionGrupoFamiliar = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const miId = req.usuario.id;
        const contexto = await obtenerContextoGrupo(arbolId, miId);

        if (contexto.error) {
            return res.status(contexto.error.status).json({ mensaje: contexto.error.mensaje });
        }

        const mensajes = await MensajeGrupoFamiliar.find({
            arbol: arbolId,
            createdAt: { $gte: contexto.fechaIngreso },
            'clavesCifradas.usuario': miId
        })
            .sort({ createdAt: 1 })
            .populate({
                path: 'emisor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            })
            .lean();

        const mensajesVisibles = mensajes
            .map((mensaje) => serializarMensajeGrupoParaUsuario(mensaje, miId))
            .filter(Boolean);

        return res.status(200).json({
            arbolId,
            nombreFamilia: contexto.arbol.nombreFamilia || 'Mi Familia',
            miembros: contexto.miembros,
            mensajes: mensajesVisibles
        });
    } catch (error) {
        console.error('❌ Error al obtener conversación familiar:', error);
        return res.status(500).json({ mensaje: 'Error al obtener la conversación familiar' });
    }
};

const enviarMensajeGrupoFamiliar = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const miId = req.usuario.id;
        const { contenidoCifrado, iv, clavesCifradas } = req.body || {};
        const contexto = await obtenerContextoGrupo(arbolId, miId);

        if (contexto.error) {
            return res.status(contexto.error.status).json({ mensaje: contexto.error.mensaje });
        }

        if (!contenidoCifrado || !iv || !Array.isArray(clavesCifradas)) {
            return res.status(400).json({ mensaje: 'El paquete cifrado del mensaje está incompleto.' });
        }

        if (contexto.miembros.length < 2) {
            return res.status(400).json({
                mensaje: 'Añade a otro miembro con cuenta al Árbol Genealógico para iniciar el grupo familiar.'
            });
        }

        const miembrosSinCifrado = contexto.miembros.filter((miembro) => !miembro.publicKey);
        if (miembrosSinCifrado.length > 0) {
            return res.status(409).json({
                mensaje: 'La conversación cambió o hay integrantes que todavía no configuraron su cifrado.',
                codigo: 'MIEMBROS_SIN_CIFRADO',
                miembrosSinCifrado: miembrosSinCifrado.map((miembro) => ({
                    id: miembro.id,
                    nombreUsuario: miembro.nombreUsuario
                }))
            });
        }

        const idsEsperados = contexto.miembros.map((miembro) => String(miembro.id)).sort();
        const idsRecibidos = clavesCifradas
            .map((entrada) => obtenerIdSeguro(entrada?.usuario))
            .filter(Boolean);
        const idsRecibidosUnicos = Array.from(new Set(idsRecibidos)).sort();

        const coberturaExacta = idsEsperados.length === idsRecibidosUnicos.length &&
            idsEsperados.every((id, indice) => id === idsRecibidosUnicos[indice]);

        const todasLasClavesSonValidas = clavesCifradas.length === idsRecibidos.length &&
            clavesCifradas.every((entrada) => (
                obtenerIdSeguro(entrada?.usuario) &&
                typeof entrada?.claveCifrada === 'string' &&
                entrada.claveCifrada.trim().length > 0
            ));

        if (!coberturaExacta || !todasLasClavesSonValidas) {
            return res.status(409).json({
                mensaje: 'La membresía del grupo cambió. Actualiza la conversación y vuelve a enviar el mensaje.',
                codigo: 'MEMBRESIA_DESACTUALIZADA',
                miembros: contexto.miembros
            });
        }

        const nuevoMensaje = await MensajeGrupoFamiliar.create({
            arbol: arbolId,
            emisor: miId,
            contenidoCifrado,
            iv,
            clavesCifradas: clavesCifradas.map((entrada) => ({
                usuario: entrada.usuario,
                claveCifrada: entrada.claveCifrada
            })),
            leidoPor: [{ usuario: miId, fecha: new Date() }]
        });

        await nuevoMensaje.populate({
            path: 'emisor',
            select: 'nombreUsuario imagenPerfil',
            populate: { path: 'imagenPerfil', select: 'urlArchivo' }
        });

        await crearNotificacionesMultiples(
            contexto.miembros
                .filter((miembro) => !sonMismoId(miembro.id, miId))
                .map((miembro) => ({
                    destinatarioId: miembro.id,
                    actorId: miId,
                    tipo: 'mensaje_grupo',
                    arbolId,
                    conversacionId: arbolId,
                    tipoConversacion: 'grupo-familiar',
                    enlaceReferencia: `/mensajes?tipo=grupo-familiar&id=${arbolId}`,
                    claveEvento: crearClaveEvento('mensaje_grupo', nuevoMensaje._id, miembro.id)
                }))
        );

        return res.status(201).json({
            mensaje: 'Mensaje familiar enviado con éxito.',
            data: serializarMensajeGrupoParaUsuario(nuevoMensaje, miId)
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje familiar:', error);
        return res.status(500).json({ mensaje: 'Error al enviar el mensaje familiar cifrado' });
    }
};

const marcarGrupoFamiliarComoLeido = async (req, res) => {
    try {
        const { arbolId } = req.params;
        const miId = req.usuario.id;
        const contexto = await obtenerContextoGrupo(arbolId, miId);

        if (contexto.error) {
            return res.status(contexto.error.status).json({ mensaje: contexto.error.mensaje });
        }

        const resultado = await MensajeGrupoFamiliar.updateMany(
            {
                arbol: arbolId,
                createdAt: { $gte: contexto.fechaIngreso },
                emisor: { $ne: miId },
                'clavesCifradas.usuario': miId,
                'leidoPor.usuario': { $ne: miId }
            },
            {
                $push: {
                    leidoPor: {
                        usuario: miId,
                        fecha: new Date()
                    }
                }
            }
        );

        await marcarNotificacionesConversacionLeidas({
            usuarioId: miId,
            conversacionId: arbolId,
            tipo: 'mensaje_grupo'
        });

        return res.status(200).json({
            mensaje: 'Mensajes familiares marcados como leídos.',
            actualizados: resultado.modifiedCount || 0
        });
    } catch (error) {
        console.error('❌ Error al marcar el grupo familiar como leído:', error);
        return res.status(500).json({ mensaje: 'Error al actualizar la lectura del grupo familiar' });
    }
};

module.exports = {
    obtenerContactosPermitidos,
    obtenerBandejaMensajes,
    obtenerConversacionConContacto,
    enviarMensaje,
    marcarComoLeido,
    obtenerConversacionGrupoFamiliar,
    enviarMensajeGrupoFamiliar,
    marcarGrupoFamiliarComoLeido
};
