const {
    Usuario,
    Seguidor,
    Familia,
    InvitacionFamiliar
} = require('../../models/index.model');

const SECCIONES_RED_VALIDAS = new Set(['seguidores', 'amigos']);

const obtenerFechaValida = (valor) => {
    if (!valor) return null;

    const fecha = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const guardarRelacionMasAntigua = (mapa, usuarioId, relacion) => {
    if (!usuarioId || !relacion) return;

    const clave = String(usuarioId);
    const actual = mapa.get(clave);
    const fechaRelacion = obtenerFechaValida(relacion.createdAt);
    const fechaActual = obtenerFechaValida(actual?.createdAt);

    if (!actual || (fechaRelacion && (!fechaActual || fechaRelacion < fechaActual))) {
        mapa.set(clave, relacion);
    }
};

const asegurarLineaBaseIndicadores = async (usuario) => {
    const ahora = new Date();
    let actualizado = false;

    if (!obtenerFechaValida(usuario?.indicadoresVistos?.seguidores)) {
        usuario.set('indicadoresVistos.seguidores', ahora);
        actualizado = true;
    }

    if (!obtenerFechaValida(usuario?.indicadoresVistos?.amigos)) {
        usuario.set('indicadoresVistos.amigos', ahora);
        actualizado = true;
    }

    if (actualizado) {
        await usuario.save();
    }

    return {
        seguidores: obtenerFechaValida(usuario.indicadoresVistos?.seguidores) || ahora,
        amigos: obtenerFechaValida(usuario.indicadoresVistos?.amigos) || ahora,
        inicializadaAhora: actualizado
    };
};

const contarNovedadesRed = async ({ usuarioId, vistos }) => {
    const [relacionesRecibidas, relacionesEnviadas] = await Promise.all([
        Seguidor.find({ seguido: usuarioId })
            .select('seguidor createdAt')
            .lean(),
        Seguidor.find({ seguidor: usuarioId })
            .select('seguido createdAt')
            .lean()
    ]);

    const recibidasPorUsuario = new Map();
    const enviadasPorUsuario = new Map();

    relacionesRecibidas.forEach((relacion) => {
        guardarRelacionMasAntigua(recibidasPorUsuario, relacion.seguidor, relacion);
    });

    relacionesEnviadas.forEach((relacion) => {
        guardarRelacionMasAntigua(enviadasPorUsuario, relacion.seguido, relacion);
    });

    let seguidoresNuevos = 0;
    let amigosNuevos = 0;

    recibidasPorUsuario.forEach((relacionRecibida, otroUsuarioId) => {
        const relacionEnviada = enviadasPorUsuario.get(otroUsuarioId);
        const fechaRecibida = obtenerFechaValida(relacionRecibida.createdAt);

        if (!relacionEnviada) {
            if (fechaRecibida && fechaRecibida > vistos.seguidores) {
                seguidoresNuevos += 1;
            }
            return;
        }

        const fechaEnviada = obtenerFechaValida(relacionEnviada.createdAt);
        const fechaAmistad = [fechaRecibida, fechaEnviada]
            .filter(Boolean)
            .sort((a, b) => b.getTime() - a.getTime())[0];

        if (fechaAmistad && fechaAmistad > vistos.amigos) {
            amigosNuevos += 1;
        }
    });

    return { seguidoresNuevos, amigosNuevos };
};

const obtenerResumenIndicadores = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const usuario = await Usuario.findById(usuarioId)
            .select('indicadoresVistos');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const vistos = await asegurarLineaBaseIndicadores(usuario);

        const [invitacionesArbol, invitacionesFamiliares, novedadesRed] = await Promise.all([
            InvitacionFamiliar.countDocuments({
                invitado: usuarioId,
                estado: 'Pendiente'
            }),
            Familia.countDocuments({
                familiar: usuarioId,
                estado: 'Pendiente'
            }),
            contarNovedadesRed({ usuarioId, vistos })
        ]);

        const totalRed =
            invitacionesFamiliares +
            novedadesRed.seguidoresNuevos +
            novedadesRed.amigosNuevos;

        return res.status(200).json({
            arbol: {
                invitacionesPendientes: invitacionesArbol
            },
            red: {
                total: totalRed,
                invitacionesFamiliares,
                seguidoresNuevos: novedadesRed.seguidoresNuevos,
                amigosNuevos: novedadesRed.amigosNuevos
            },
            lineaBaseInicializada: vistos.inicializadaAhora
        });
    } catch (error) {
        console.error('❌ Error al obtener indicadores de navegación:', error);
        return res.status(500).json({
            mensaje: 'No se pudieron obtener los indicadores de navegación.'
        });
    }
};

const marcarIndicadoresRedVistos = async (req, res) => {
    try {
        const seccionesSolicitadas = Array.isArray(req.body?.secciones)
            ? req.body.secciones
            : [req.body?.seccion];

        const secciones = Array.from(new Set(
            seccionesSolicitadas
                .map(seccion => String(seccion || '').trim().toLowerCase())
                .filter(seccion => SECCIONES_RED_VALIDAS.has(seccion))
        ));

        if (secciones.length === 0) {
            return res.status(400).json({
                mensaje: 'Debes indicar seguidores, amigos o ambas secciones.'
            });
        }

        const fechaVista = new Date();
        const actualizacion = {};

        secciones.forEach((seccion) => {
            actualizacion[`indicadoresVistos.${seccion}`] = fechaVista;
        });

        const usuario = await Usuario.findByIdAndUpdate(
            req.usuario.id,
            { $set: actualizacion },
            { new: true, runValidators: true }
        ).select('indicadoresVistos');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        return res.status(200).json({
            mensaje: 'Indicadores actualizados correctamente.',
            secciones,
            vistosEn: fechaVista,
            indicadoresVistos: usuario.indicadoresVistos
        });
    } catch (error) {
        console.error('❌ Error al marcar indicadores como vistos:', error);
        return res.status(500).json({
            mensaje: 'No se pudieron actualizar los indicadores.'
        });
    }
};

module.exports = {
    obtenerResumenIndicadores,
    marcarIndicadoresRedVistos
};
