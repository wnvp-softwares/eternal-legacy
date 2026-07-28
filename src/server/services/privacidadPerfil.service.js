const mongoose = require('mongoose');
const {
    Usuario,
    InformacionPerfil,
    Amigo,
    Familia,
    Seguidor,
    Arbol
} = require('../models/index.model');

const PRIVACIDAD_PUBLICA = 'publico';
const PRIVACIDAD_PRIVADA = 'privado';

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

const esObjectIdValido = (valor) => Boolean(valor) && mongoose.Types.ObjectId.isValid(String(valor));

const normalizarPrivacidadPerfil = (valor) => (
    String(valor || '').trim().toLowerCase() === PRIVACIDAD_PRIVADA
        ? PRIVACIDAD_PRIVADA
        : PRIVACIDAD_PUBLICA
);

const obtenerPrivacidadPerfilUsuario = async (usuarioId) => {
    if (!esObjectIdValido(usuarioId)) return PRIVACIDAD_PUBLICA;

    const usuario = await Usuario.findById(usuarioId).select('informacionPerfil').lean();
    if (!usuario?.informacionPerfil) return PRIVACIDAD_PUBLICA;

    const perfil = await InformacionPerfil.findById(usuario.informacionPerfil)
        .select('privacidadPerfil')
        .lean();

    return normalizarPrivacidadPerfil(perfil?.privacidadPerfil);
};

const obtenerIdsConexionesDirectas = async (usuarioId) => {
    if (!esObjectIdValido(usuarioId)) return [];

    const [amistades, familiares, seguimientosSalientes] = await Promise.all([
        Amigo.find({
            estado: 'Aceptado',
            $or: [
                { usuarioSolicitante: usuarioId },
                { usuarioReceptor: usuarioId }
            ]
        }).select('usuarioSolicitante usuarioReceptor').lean(),
        Familia.find({
            estado: 'Aceptado',
            $or: [
                { usuarioPrincipal: usuarioId },
                { familiar: usuarioId }
            ]
        }).select('usuarioPrincipal familiar').lean(),
        Seguidor.find({ seguidor: usuarioId }).select('seguido').lean()
    ]);

    const idsSeguidos = seguimientosSalientes
        .map((seguimiento) => obtenerIdSeguro(seguimiento.seguido))
        .filter(esObjectIdValido);

    const seguimientosReciprocos = idsSeguidos.length > 0
        ? await Seguidor.find({
            seguidor: { $in: idsSeguidos },
            seguido: usuarioId
        }).select('seguidor').lean()
        : [];

    const ids = new Set([String(usuarioId)]);

    amistades.forEach((relacion) => {
        const otroId = sonMismoId(relacion.usuarioSolicitante, usuarioId)
            ? obtenerIdSeguro(relacion.usuarioReceptor)
            : obtenerIdSeguro(relacion.usuarioSolicitante);
        if (otroId) ids.add(otroId);
    });

    familiares.forEach((relacion) => {
        const otroId = sonMismoId(relacion.usuarioPrincipal, usuarioId)
            ? obtenerIdSeguro(relacion.familiar)
            : obtenerIdSeguro(relacion.usuarioPrincipal);
        if (otroId) ids.add(otroId);
    });

    seguimientosReciprocos.forEach((seguimiento) => {
        const otroId = obtenerIdSeguro(seguimiento.seguidor);
        if (otroId) ids.add(otroId);
    });

    return Array.from(ids);
};

const existeConexionDirecta = async (usuarioA, usuarioB) => {
    if (!esObjectIdValido(usuarioA) || !esObjectIdValido(usuarioB)) return false;
    if (sonMismoId(usuarioA, usuarioB)) return true;

    const [amistad, familia, sigueA, sigueB] = await Promise.all([
        Amigo.exists({
            estado: 'Aceptado',
            $or: [
                { usuarioSolicitante: usuarioA, usuarioReceptor: usuarioB },
                { usuarioSolicitante: usuarioB, usuarioReceptor: usuarioA }
            ]
        }),
        Familia.exists({
            estado: 'Aceptado',
            $or: [
                { usuarioPrincipal: usuarioA, familiar: usuarioB },
                { usuarioPrincipal: usuarioB, familiar: usuarioA }
            ]
        }),
        Seguidor.exists({ seguidor: usuarioA, seguido: usuarioB }),
        Seguidor.exists({ seguidor: usuarioB, seguido: usuarioA })
    ]);

    return Boolean(amistad || familia || (sigueA && sigueB));
};

const puedeVerPerfilCompleto = async ({ propietarioId, visitanteId }) => {
    if (!esObjectIdValido(propietarioId)) return false;
    if (sonMismoId(propietarioId, visitanteId)) return true;

    const privacidad = await obtenerPrivacidadPerfilUsuario(propietarioId);
    if (privacidad === PRIVACIDAD_PUBLICA) return true;

    return existeConexionDirecta(propietarioId, visitanteId);
};

const obtenerIdsAutoresPrivadosNoPermitidos = async (visitanteId) => {
    const perfilesPrivados = await InformacionPerfil.find({ privacidadPerfil: PRIVACIDAD_PRIVADA })
        .select('_id')
        .lean();

    if (perfilesPrivados.length === 0) return [];

    const idsPerfiles = perfilesPrivados.map((perfil) => perfil._id);
    const usuariosPrivados = await Usuario.find({ informacionPerfil: { $in: idsPerfiles } })
        .select('_id')
        .lean();

    if (!visitanteId || !esObjectIdValido(visitanteId)) {
        return usuariosPrivados.map((usuario) => usuario._id);
    }

    const permitidos = new Set((await obtenerIdsConexionesDirectas(visitanteId)).map(String));
    permitidos.add(String(visitanteId));

    return usuariosPrivados
        .map((usuario) => usuario._id)
        .filter((usuarioId) => !permitidos.has(String(usuarioId)));
};

const construirFiltroAutoresVisibles = async (visitanteId) => {
    const idsBloqueados = await obtenerIdsAutoresPrivadosNoPermitidos(visitanteId);
    return idsBloqueados.length > 0
        ? { autor: { $nin: idsBloqueados } }
        : {};
};

const obtenerIdsArbolesPermitidos = async (usuarioId) => {
    if (!esObjectIdValido(usuarioId)) return [];

    const arboles = await Arbol.find({
        activo: true,
        $or: [
            { creador: usuarioId },
            { admins: usuarioId },
            {
                miembros: {
                    $elemMatch: {
                        usuario: usuarioId,
                        estado: 'Activo'
                    }
                }
            }
        ]
    }).select('_id').lean();

    return arboles.map((arbol) => arbol._id);
};

const construirFiltroAudienciaPublicaciones = async (usuarioId) => {
    const idsArbolesPermitidos = await obtenerIdsArbolesPermitidos(usuarioId);

    return {
        $or: [
            { tipo: 'historico' },
            { autor: usuarioId },
            {
                tipo: 'familiar',
                privacidad: 'familia',
                arbolAudiencia: { $in: idsArbolesPermitidos }
            },
            {
                tipo: 'familiar',
                privacidad: { $exists: false },
                'eventoRelacionado.arbol': { $in: idsArbolesPermitidos }
            },
            {
                tipo: 'familiar',
                arbolAudiencia: { $exists: false },
                'eventoRelacionado.arbol': { $in: idsArbolesPermitidos }
            }
        ]
    };
};

const construirFiltroVisibilidadPublicaciones = async (usuarioId) => {
    const [filtroAutores, filtroAudiencia] = await Promise.all([
        construirFiltroAutoresVisibles(usuarioId),
        construirFiltroAudienciaPublicaciones(usuarioId)
    ]);

    const condiciones = [filtroAudiencia];
    if (Object.keys(filtroAutores).length > 0) condiciones.push(filtroAutores);

    return condiciones.length === 1 ? condiciones[0] : { $and: condiciones };
};

const usuarioPerteneceAlArbol = (arbol, usuarioId) => {
    if (!arbol || !usuarioId) return false;
    if (sonMismoId(arbol.creador, usuarioId)) return true;
    if (Array.isArray(arbol.admins) && arbol.admins.some((id) => sonMismoId(id, usuarioId))) return true;

    return (Array.isArray(arbol.miembros) ? arbol.miembros : []).some((miembro) => (
        sonMismoId(miembro.usuario, usuarioId) && miembro.estado === 'Activo'
    ));
};

const usuarioPuedeVerPublicacion = async ({ publicacion, usuarioId }) => {
    if (!publicacion || !usuarioId) return false;

    const autorId = obtenerIdSeguro(publicacion.autor);
    if (!autorId) return false;
    if (sonMismoId(autorId, usuarioId)) return true;

    const puedeVerAutor = await puedeVerPerfilCompleto({
        propietarioId: autorId,
        visitanteId: usuarioId
    });
    if (!puedeVerAutor) return false;

    if (publicacion.tipo === 'historico') return true;

    const arbolId = obtenerIdSeguro(publicacion.arbolAudiencia) ||
        obtenerIdSeguro(publicacion.eventoRelacionado?.arbol);
    if (!arbolId || !esObjectIdValido(arbolId)) return false;

    const arbol = await Arbol.findById(arbolId).select('creador admins miembros activo').lean();
    return Boolean(arbol?.activo !== false && usuarioPerteneceAlArbol(arbol, usuarioId));
};

module.exports = {
    PRIVACIDAD_PUBLICA,
    PRIVACIDAD_PRIVADA,
    normalizarPrivacidadPerfil,
    obtenerPrivacidadPerfilUsuario,
    obtenerIdsConexionesDirectas,
    existeConexionDirecta,
    puedeVerPerfilCompleto,
    construirFiltroAutoresVisibles,
    construirFiltroVisibilidadPublicaciones,
    usuarioPuedeVerPublicacion,
    obtenerIdSeguro,
    sonMismoId
};
