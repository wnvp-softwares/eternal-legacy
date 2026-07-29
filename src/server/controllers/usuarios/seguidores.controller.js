const { Usuario, Seguidor, Amigo } = require('../../models/index.model');
const {
    crearNotificacion,
    crearNotificacionesMultiples,
    crearClaveEvento,
    eliminarNotificacionPorClave,
    eliminarNotificaciones
} = require('../../services/notificacion.service');

const LIMITE_EXPLORAR_PREDETERMINADO = 24;
const LIMITE_EXPLORAR_MAXIMO = 48;

const escaparExpresionRegular = (valor = '') => (
    String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

const normalizarEnteroPositivo = (valor, predeterminado, maximo = Number.MAX_SAFE_INTEGER) => {
    const numero = Number.parseInt(valor, 10);
    if (!Number.isInteger(numero) || numero < 1) return predeterminado;
    return Math.min(numero, maximo);
};

const obtenerEstadoConexion = async ({ usuarioId, otroUsuarioId, siguiendo, meSigue }) => {
    const amistadAceptada = await Amigo.exists({
        estado: 'Aceptado',
        $or: [
            { usuarioSolicitante: usuarioId, usuarioReceptor: otroUsuarioId },
            { usuarioSolicitante: otroUsuarioId, usuarioReceptor: usuarioId }
        ]
    });

    const seguimientoMutuo = Boolean(siguiendo && meSigue);

    return {
        siguiendo: Boolean(siguiendo),
        meSigue: Boolean(meSigue),
        seguimientoMutuo,
        sonAmigos: Boolean(amistadAceptada),
        puedeInvitarFamilia: Boolean(amistadAceptada || seguimientoMutuo)
    };
};

const seguirUsuario = async (req, res) => {
    try {
        const { seguidoId } = req.body;

        if (!seguidoId) {
            return res.status(400).json({ mensaje: 'Falta el ID del usuario a seguir' });
        }

        if (seguidoId === req.usuario.id) {
            return res.status(400).json({ mensaje: 'No puedes seguirte a ti mismo' });
        }

        const yaExiste = await Seguidor.findOne({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        if (yaExiste) {
            const seguimientoReciprocoExistente = await Seguidor.exists({
                seguidor: seguidoId,
                seguido: req.usuario.id
            });
            const estadoConexion = await obtenerEstadoConexion({
                usuarioId: req.usuario.id,
                otroUsuarioId: seguidoId,
                siguiendo: true,
                meSigue: Boolean(seguimientoReciprocoExistente)
            });

            return res.status(200).json({
                mensaje: 'Ya sigues a este usuario',
                ...estadoConexion
            });
        }

        const seguimientoReciproco = await Seguidor.findOne({
            seguidor: seguidoId,
            seguido: req.usuario.id
        });

        const nuevoSeguidor = new Seguidor({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        await nuevoSeguidor.save();

        await crearNotificacion({
            destinatarioId: seguidoId,
            actorId: req.usuario.id,
            tipo: 'nuevo_seguidor',
            enlaceReferencia: `/perfil/${req.usuario.id}`,
            claveEvento: crearClaveEvento('nuevo_seguidor', req.usuario.id, seguidoId)
        });

        if (seguimientoReciproco) {
            const par = [String(req.usuario.id), String(seguidoId)].sort().join('-');
            await crearNotificacionesMultiples([
                {
                    destinatarioId: seguidoId,
                    actorId: req.usuario.id,
                    tipo: 'nuevo_amigo',
                    enlaceReferencia: `/perfil/${req.usuario.id}`,
                    claveEvento: crearClaveEvento('nuevo_amigo', par, seguidoId)
                },
                {
                    destinatarioId: req.usuario.id,
                    actorId: seguidoId,
                    tipo: 'nuevo_amigo',
                    enlaceReferencia: `/perfil/${seguidoId}`,
                    claveEvento: crearClaveEvento('nuevo_amigo', par, req.usuario.id)
                }
            ]);
        }

        const estadoConexion = await obtenerEstadoConexion({
            usuarioId: req.usuario.id,
            otroUsuarioId: seguidoId,
            siguiendo: true,
            meSigue: Boolean(seguimientoReciproco)
        });

        res.status(201).json({
            mensaje: '¡Ahora sigues a este usuario!',
            ...estadoConexion
        });
    } catch (error) {
        console.error('❌ Error al seguir usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

const obtenerSeguidores = async (req, res) => {
    try {
        const lista = await Seguidor.find({ seguido: req.usuario.id })
            .populate({
                path: 'seguidor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        const formateado = lista
            .filter(s => s.seguidor)
            .map(s => ({
                id: s._id,
                idConexion: s.seguidor._id,
                nombre: s.seguidor.nombreUsuario,
                relacion: 'Seguidor',
                info: 'Te sigue',
                img: s.seguidor.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguidor.nombreUsuario)}&background=f1f5f9`
            }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener seguidores:', error);
        res.status(500).json({ mensaje: 'Error al obtener seguidores' });
    }
};

const obtenerSiguiendo = async (req, res) => {
    try {
        const lista = await Seguidor.find({ seguidor: req.usuario.id })
            .populate({
                path: 'seguido',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        const formateado = lista
            .filter(s => s.seguido)
            .map(s => ({
                id: s._id,
                idConexion: s.seguido._id,
                nombre: s.seguido.nombreUsuario,
                relacion: 'Siguiendo',
                info: 'Lo sigues',
                img: s.seguido.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguido.nombreUsuario)}&background=e2e8f0`
            }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener seguidos:', error);
        res.status(500).json({ mensaje: 'Error al obtener seguidos' });
    }
};

const obtenerAmigos = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        // 1. Buscar a quién sigo yo
        const siguiendo = await Seguidor.find({ seguidor: usuarioId }).select('seguido');

        const idsQueSigo = siguiendo.map(s => s.seguido);

        if (idsQueSigo.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Buscar cuáles de esas personas también me siguen a mí
        const amigos = await Seguidor.find({
            seguidor: { $in: idsQueSigo },
            seguido: usuarioId
        })
            .populate({
                path: 'seguidor',
                select: 'nombreUsuario imagenPerfil',
                populate: { path: 'imagenPerfil', select: 'urlArchivo' }
            });

        // 3. Evitar duplicados por si en la BD hay relaciones repetidas
        const amigosUnicos = new Map();

        amigos.forEach(s => {
            if (s.seguidor) {
                amigosUnicos.set(String(s.seguidor._id), s);
            }
        });

        const formateado = Array.from(amigosUnicos.values()).map(s => ({
            id: s._id,
            idConexion: s.seguidor._id,
            nombre: s.seguidor.nombreUsuario,
            relacion: 'Amigo',
            info: 'Se siguen mutuamente',
            img: s.seguidor.imagenPerfil?.urlArchivo || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.seguidor.nombreUsuario)}&background=f1f5f9`
        }));

        res.status(200).json(formateado);
    } catch (error) {
        console.error('❌ Error al obtener amigos:', error);
        res.status(500).json({ mensaje: 'Error al obtener amigos' });
    }
};


const obtenerUsuariosExplorar = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const pagina = normalizarEnteroPositivo(req.query.page, 1);
        const limite = normalizarEnteroPositivo(
            req.query.limit,
            LIMITE_EXPLORAR_PREDETERMINADO,
            LIMITE_EXPLORAR_MAXIMO
        );
        const consulta = String(req.query.q || '').trim().slice(0, 80);
        const salto = (pagina - 1) * limite;

        const filtroUsuarios = {
            _id: { $ne: usuarioId },
            isVerified: true
        };

        if (consulta) {
            const expresionBusqueda = new RegExp(escaparExpresionRegular(consulta), 'i');
            filtroUsuarios.$or = [
                { nombreUsuario: expresionBusqueda },
                { nickname: expresionBusqueda }
            ];
        }

        const [usuarios, total] = await Promise.all([
            Usuario.find(filtroUsuarios)
                .select('nombreUsuario nickname imagenPerfil createdAt')
                .populate({
                    path: 'imagenPerfil',
                    select: 'urlArchivo'
                })
                .sort({ nombreUsuario: 1, _id: 1 })
                .skip(salto)
                .limit(limite)
                .lean(),
            Usuario.countDocuments(filtroUsuarios)
        ]);

        const idsUsuarios = usuarios.map(usuario => usuario._id);

        let seguimientosSalientes = [];
        let seguimientosEntrantes = [];
        let amistadesAceptadas = [];

        if (idsUsuarios.length > 0) {
            [
                seguimientosSalientes,
                seguimientosEntrantes,
                amistadesAceptadas
            ] = await Promise.all([
                Seguidor.find({
                    seguidor: usuarioId,
                    seguido: { $in: idsUsuarios }
                }).select('seguido').lean(),
                Seguidor.find({
                    seguidor: { $in: idsUsuarios },
                    seguido: usuarioId
                }).select('seguidor').lean(),
                Amigo.find({
                    estado: 'Aceptado',
                    $or: [
                        {
                            usuarioSolicitante: usuarioId,
                            usuarioReceptor: { $in: idsUsuarios }
                        },
                        {
                            usuarioReceptor: usuarioId,
                            usuarioSolicitante: { $in: idsUsuarios }
                        }
                    ]
                }).select('usuarioSolicitante usuarioReceptor').lean()
            ]);
        }

        const idsQueSigo = new Set(
            seguimientosSalientes.map(relacion => String(relacion.seguido))
        );
        const idsQueMeSiguen = new Set(
            seguimientosEntrantes.map(relacion => String(relacion.seguidor))
        );
        const idsAmistadesFormales = new Set();

        amistadesAceptadas.forEach((amistad) => {
            const solicitanteId = String(amistad.usuarioSolicitante);
            const receptorId = String(amistad.usuarioReceptor);
            const otroUsuarioId = solicitanteId === String(usuarioId)
                ? receptorId
                : solicitanteId;

            idsAmistadesFormales.add(otroUsuarioId);
        });

        const usuariosFormateados = usuarios.map((usuario) => {
            const idConexion = String(usuario._id);
            const siguiendo = idsQueSigo.has(idConexion);
            const meSigue = idsQueMeSiguen.has(idConexion);
            const seguimientoMutuo = siguiendo && meSigue;
            const amistadFormal = idsAmistadesFormales.has(idConexion);
            const sonAmigos = amistadFormal || seguimientoMutuo;
            const nombre = usuario.nombreUsuario || 'Usuario';
            const img = usuario.imagenPerfil?.urlArchivo
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=f1f5f9`;

            return {
                idConexion: usuario._id,
                nombre,
                nickname: usuario.nickname || '',
                img,
                siguiendo,
                meSigue,
                seguimientoMutuo,
                amistadFormal,
                sonAmigos,
                puedeInvitarFamilia: sonAmigos
            };
        });

        const totalPaginas = total > 0 ? Math.ceil(total / limite) : 0;

        return res.status(200).json({
            usuarios: usuariosFormateados,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas,
                hayMas: pagina < totalPaginas
            }
        });
    } catch (error) {
        console.error('❌ Error al obtener usuarios para Explorar:', error);
        return res.status(500).json({
            mensaje: 'No se pudieron cargar las personas de Legacy.'
        });
    }
};

const dejarDeSeguirUsuario = async (req, res) => {
    try {
        const { seguidoId } = req.params;

        if (!seguidoId) {
            return res.status(400).json({ mensaje: 'Falta el ID del usuario' });
        }

        const relacionEliminada = await Seguidor.findOneAndDelete({
            seguidor: req.usuario.id,
            seguido: seguidoId
        });

        if (!relacionEliminada) {
            return res.status(404).json({ mensaje: 'No sigues a este usuario' });
        }

        const par = [String(req.usuario.id), String(seguidoId)].sort().join('-');
        await Promise.allSettled([
            eliminarNotificacionPorClave(crearClaveEvento('nuevo_seguidor', req.usuario.id, seguidoId)),
            eliminarNotificaciones({
                claveEvento: {
                    $in: [
                        crearClaveEvento('nuevo_amigo', par, seguidoId),
                        crearClaveEvento('nuevo_amigo', par, req.usuario.id)
                    ]
                }
            })
        ]);

        const seguimientoReciproco = await Seguidor.exists({
            seguidor: seguidoId,
            seguido: req.usuario.id
        });
        const estadoConexion = await obtenerEstadoConexion({
            usuarioId: req.usuario.id,
            otroUsuarioId: seguidoId,
            siguiendo: false,
            meSigue: Boolean(seguimientoReciproco)
        });

        res.status(200).json({
            mensaje: 'Has dejado de seguir a este usuario',
            ...estadoConexion
        });
    } catch (error) {
        console.error('❌ Error al dejar de seguir usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = {
    seguirUsuario,
    obtenerSeguidores,
    obtenerSiguiendo,
    obtenerAmigos,
    obtenerUsuariosExplorar,
    dejarDeSeguirUsuario
};