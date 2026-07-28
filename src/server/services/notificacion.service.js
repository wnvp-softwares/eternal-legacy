const { Notificacion, Usuario } = require('../models/index.model');
const { enviarCorreoNotificacion } = require('../middlewares/mailer');

const CATEGORIA_POR_TIPO = {
    nuevo_seguidor: 'red',
    nuevo_amigo: 'red',
    solicitud_familiar_recibida: 'familia',
    solicitud_familiar_aceptada: 'familia',
    mencion_publicacion: 'publicaciones',
    comentario_publicacion: 'publicaciones',
    reaccion_publicacion: 'publicaciones',
    guardado_publicacion: 'publicaciones',
    compartido_publicacion: 'publicaciones',
    invitacion_arbol: 'arbol',
    mensaje_directo: 'mensajes',
    mensaje_grupo: 'mensajes'
};

const DESCRIPCION_POR_TIPO = {
    nuevo_seguidor: 'comenzó a seguirte.',
    nuevo_amigo: 'ahora es tu amistad en Legacy.',
    solicitud_familiar_recibida: 'te envió una solicitud familiar.',
    solicitud_familiar_aceptada: 'aceptó tu solicitud familiar.',
    mencion_publicacion: 'te mencionó en una publicación.',
    comentario_publicacion: 'comentó tu publicación.',
    reaccion_publicacion: 'reaccionó a tu publicación.',
    guardado_publicacion: 'guardó tu publicación.',
    compartido_publicacion: 'compartió tu publicación.',
    invitacion_arbol: 'te invitó a un Árbol Genealógico.',
    mensaje_directo: 'te envió un nuevo mensaje.',
    mensaje_grupo: 'envió un nuevo mensaje al grupo familiar.'
};

const TIPOS_CON_CORREO = new Set([
    'solicitud_familiar_recibida',
    'invitacion_arbol',
    'mencion_publicacion'
]);

const obtenerIdSeguro = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    if (valor._id) return String(valor._id);
    if (valor.id) return String(valor.id);
    return String(valor);
};

const sonMismoId = (a, b) => {
    const idA = obtenerIdSeguro(a);
    const idB = obtenerIdSeguro(b);
    return Boolean(idA && idB && idA === idB);
};

const crearClaveEvento = (tipo, ...partes) => [tipo, ...partes]
    .map((parte) => obtenerIdSeguro(parte) || String(parte || '').trim())
    .filter(Boolean)
    .join(':');

const construirEnlaceFrontend = (enlaceReferencia = '') => {
    const base = String(process.env.FRONTEND_BASE_URL || process.env.CLIENT_BASE_URL || 'http://localhost:5173')
        .replace(/\/+$/, '');
    const ruta = String(enlaceReferencia || '').trim();
    if (!ruta) return '';
    if (/^https?:\/\//i.test(ruta)) return ruta;
    return `${base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
};

const enviarCorreoSeguro = async ({ destinatarioId, actorId, tipo, nombreFamilia, enlaceReferencia }) => {
    if (!TIPOS_CON_CORREO.has(tipo)) return false;

    try {
        const [destinatario, actor] = await Promise.all([
            Usuario.findById(destinatarioId).select('email nombreUsuario').lean(),
            actorId ? Usuario.findById(actorId).select('nombreUsuario').lean() : null
        ]);

        if (!destinatario?.email) return false;

        return enviarCorreoNotificacion({
            email: destinatario.email,
            tipo,
            actorNombre: actor?.nombreUsuario || 'Alguien de tu familia',
            nombreFamilia: String(nombreFamilia || '').trim(),
            enlace: construirEnlaceFrontend(enlaceReferencia)
        });
    } catch (error) {
        console.error('⚠️ No se pudo preparar el correo de notificación:', error);
        return false;
    }
};

const crearNotificacion = async ({
    destinatarioId,
    actorId = null,
    tipo,
    descripcion = '',
    enlaceReferencia = '',
    publicacionId = null,
    comentarioId = null,
    arbolId = null,
    solicitudId = null,
    conversacionId = '',
    tipoConversacion = '',
    claveEvento,
    nombreFamilia = '',
    enviarCorreo = true
} = {}) => {
    if (!destinatarioId || !tipo || !claveEvento) return null;
    if (actorId && sonMismoId(destinatarioId, actorId)) return null;

    const categoria = CATEGORIA_POR_TIPO[tipo];
    if (!categoria) throw new Error(`Tipo de notificación no soportado: ${tipo}`);

    const actualizacion = {
        usuarioDestino: destinatarioId,
        usuarioOrigen: actorId || null,
        tipoAccion: tipo,
        categoria,
        descripcion: String(descripcion || DESCRIPCION_POR_TIPO[tipo] || '').trim(),
        enlaceReferencia: String(enlaceReferencia || '').trim(),
        publicacion: publicacionId || null,
        comentario: comentarioId || null,
        arbol: arbolId || null,
        solicitud: solicitudId || null,
        conversacionId: String(conversacionId || '').trim(),
        tipoConversacion: String(tipoConversacion || '').trim(),
        claveEvento: String(claveEvento).trim()
    };

    let notificacion;
    try {
        notificacion = await Notificacion.findOneAndUpdate(
            { claveEvento: actualizacion.claveEvento },
            {
                $setOnInsert: {
                    ...actualizacion,
                    fueLeida: false,
                    leidaEn: null
                }
            },
            { new: true, upsert: true, runValidators: true }
        );
    } catch (error) {
        if (error?.code === 11000) {
            notificacion = await Notificacion.findOne({ claveEvento: actualizacion.claveEvento });
        } else {
            console.error('⚠️ El evento principal se completó, pero no pudo guardarse su notificación:', error);
            return null;
        }
    }

    if (enviarCorreo && TIPOS_CON_CORREO.has(tipo)) {
        Promise.resolve(enviarCorreoSeguro({
            destinatarioId,
            actorId,
            tipo,
            nombreFamilia,
            enlaceReferencia
        })).catch((error) => {
            console.error('⚠️ El evento se completó, pero falló su correo de notificación:', error);
        });
    }

    return notificacion;
};

const crearNotificacionesMultiples = async (notificaciones = []) => {
    const resultados = await Promise.allSettled(
        notificaciones.filter(Boolean).map((notificacion) => crearNotificacion(notificacion))
    );

    resultados.forEach((resultado) => {
        if (resultado.status === 'rejected') {
            console.error('⚠️ No se pudo crear una notificación secundaria:', resultado.reason);
        }
    });

    return resultados;
};

const eliminarNotificacionPorClave = async (claveEvento) => {
    if (!claveEvento) return { deletedCount: 0 };

    try {
        return await Notificacion.deleteOne({ claveEvento: String(claveEvento) });
    } catch (error) {
        console.error('⚠️ No se pudo retirar una notificación secundaria:', error);
        return { deletedCount: 0 };
    }
};

const eliminarNotificaciones = async (filtro = {}) => {
    try {
        return await Notificacion.deleteMany(filtro);
    } catch (error) {
        console.error('⚠️ No se pudieron retirar notificaciones secundarias:', error);
        return { deletedCount: 0 };
    }
};

const marcarNotificacionesConversacionLeidas = async ({ usuarioId, conversacionId, tipo }) => {
    if (!usuarioId || !conversacionId) return { modifiedCount: 0 };

    const filtro = {
        usuarioDestino: usuarioId,
        conversacionId: String(conversacionId),
        fueLeida: false
    };
    if (tipo) filtro.tipoAccion = tipo;

    try {
        return await Notificacion.updateMany(filtro, {
            $set: {
                fueLeida: true,
                leidaEn: new Date()
            }
        });
    } catch (error) {
        console.error('⚠️ Los mensajes se leyeron, pero no se sincronizaron sus notificaciones:', error);
        return { modifiedCount: 0 };
    }
};

const obtenerIdsMenciones = (menciones = []) => Array.from(new Set(
    (Array.isArray(menciones) ? menciones : [])
        .map((mencion) => obtenerIdSeguro(mencion?.usuario || mencion))
        .filter(Boolean)
));

const sincronizarMencionesPublicacion = async ({
    publicacion,
    actorId,
    mencionesAnteriores = []
} = {}) => {
    if (!publicacion?._id || !actorId) return;

    const anteriores = new Set(obtenerIdsMenciones(mencionesAnteriores));
    const actuales = new Set(obtenerIdsMenciones(publicacion.menciones));
    const publicacionId = obtenerIdSeguro(publicacion);
    const autorId = obtenerIdSeguro(publicacion.autor) || obtenerIdSeguro(actorId);
    const enlace = `/perfil/${autorId}?publicacion=${publicacionId}`;

    const nuevas = Array.from(actuales).filter((usuarioId) => !anteriores.has(usuarioId));
    const retiradas = Array.from(anteriores).filter((usuarioId) => !actuales.has(usuarioId));

    await crearNotificacionesMultiples(nuevas.map((destinatarioId) => ({
        destinatarioId,
        actorId,
        tipo: 'mencion_publicacion',
        publicacionId,
        enlaceReferencia: enlace,
        claveEvento: crearClaveEvento('mencion_publicacion', publicacionId, destinatarioId)
    })));

    if (retiradas.length > 0) {
        await Notificacion.deleteMany({
            claveEvento: {
                $in: retiradas.map((destinatarioId) => crearClaveEvento(
                    'mencion_publicacion',
                    publicacionId,
                    destinatarioId
                ))
            }
        });
    }
};

module.exports = {
    CATEGORIA_POR_TIPO,
    DESCRIPCION_POR_TIPO,
    crearClaveEvento,
    crearNotificacion,
    crearNotificacionesMultiples,
    eliminarNotificacionPorClave,
    eliminarNotificaciones,
    marcarNotificacionesConversacionLeidas,
    sincronizarMencionesPublicacion,
    obtenerIdsMenciones
};
