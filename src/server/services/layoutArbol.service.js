const mongoose = require('mongoose');
const { Nodo, Hilo, InvitacionFamiliar } = require('../models/index.model');

const TIPOS_RELACION_PAREJA = ['pareja', 'matrimonio', 'divorcio'];

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

const convertirEntero = (valor) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : null;
};

const opcionesSesion = (session) => (session ? { session } : {});

const esErrorTransaccionNoSoportada = (error) => {
    const mensaje = String(error?.message || '').toLowerCase();
    return (
        mensaje.includes('transaction numbers are only allowed') ||
        mensaje.includes('replica set member or mongos') ||
        mensaje.includes('transactions are not supported')
    );
};

const ejecutarOperacionLayout = async (operacion) => {
    const session = await mongoose.startSession();

    try {
        let resultado;
        await session.withTransaction(async () => {
            resultado = await operacion(session);
        });
        return resultado;
    } catch (error) {
        if (!esErrorTransaccionNoSoportada(error)) throw error;

        // Compatibilidad con entornos locales sin replica set. En Atlas/Render se usa transacción real.
        return operacion(null);
    } finally {
        await session.endSession();
    }
};

const desplazarGeneracionesArbol = async ({ arbolId, desplazamiento, session = null }) => {
    const cantidad = convertirEntero(desplazamiento);
    if (cantidad === null || cantidad <= 0) return 0;

    // Las operaciones dentro de una transacción se ejecutan de forma secuencial;
    // el driver de MongoDB no admite operaciones paralelas sobre la misma sesión.
    await Nodo.updateMany(
        { arbol: arbolId },
        { $inc: { generacion: cantidad } },
        opcionesSesion(session)
    );

    await InvitacionFamiliar.updateMany(
        { arbol: arbolId, estado: 'Pendiente' },
        { $inc: { 'datosNodoPropuesto.generacion': cantidad } },
        opcionesSesion(session)
    );

    return cantidad;
};

const normalizarGeneracionesPersistidas = async ({ arbolId, session = null }) => {
    const consulta = Nodo.findOne({ arbol: arbolId })
        .sort({ generacion: 1 })
        .select('generacion')
        .lean();

    if (session) consulta.session(session);
    const primerNodo = await consulta;
    const menorGeneracion = Number(primerNodo?.generacion);

    if (!Number.isFinite(menorGeneracion) || menorGeneracion >= 0) return 0;

    return desplazarGeneracionesArbol({
        arbolId,
        desplazamiento: Math.abs(Math.trunc(menorGeneracion)),
        session
    });
};

const prepararGeneracionObjetivo = async ({ arbolId, generacion, session = null }) => {
    const generacionNormalizada = convertirEntero(generacion);

    if (generacionNormalizada === null) {
        const error = new Error('La generación debe ser un número entero.');
        error.status = 400;
        throw error;
    }

    if (generacionNormalizada >= 0) {
        return {
            generacion: generacionNormalizada,
            desplazamiento: 0
        };
    }

    const desplazamiento = Math.abs(generacionNormalizada);
    await desplazarGeneracionesArbol({ arbolId, desplazamiento, session });

    return {
        generacion: 0,
        desplazamiento
    };
};

const obtenerSiguienteFila = async ({ arbolId, generacion, excluirNodoId = null, session = null }) => {
    const filtro = {
        arbol: arbolId,
        generacion,
        visible: true
    };

    if (excluirNodoId) filtro._id = { $ne: excluirNodoId };

    const consulta = Nodo.findOne(filtro)
        .sort({ fila: -1 })
        .select('fila')
        .lean();

    if (session) consulta.session(session);
    const ultimo = await consulta;
    const fila = Number(ultimo?.fila);
    return Number.isFinite(fila) ? fila + 1 : 0;
};

const buscarUnionActivaNodo = async ({ arbolId, nodoId, session = null }) => {
    const consulta = Hilo.findOne({
        arbol: arbolId,
        estado: { $ne: 'Eliminada' },
        tipoRelacion: { $in: TIPOS_RELACION_PAREJA },
        $or: [
            { nodoOrigen: nodoId },
            { nodoDestino: nodoId }
        ]
    });

    if (session) consulta.session(session);
    return consulta;
};

const eliminarRelacionesPadreHijoInvalidas = async ({ arbolId, session = null }) => {
    const consultaHilos = Hilo.find({
        arbol: arbolId,
        estado: { $ne: 'Eliminada' },
        tipoRelacion: 'padre_hijo'
    }).select('_id nodoOrigen nodoDestino');

    if (session) consultaHilos.session(session);
    const hilos = await consultaHilos.lean();
    if (hilos.length === 0) return [];

    const idsNodos = [...new Set(hilos.flatMap((hilo) => [
        String(hilo.nodoOrigen),
        String(hilo.nodoDestino)
    ]))];

    const consultaNodos = Nodo.find({ _id: { $in: idsNodos } })
        .select('_id generacion')
        .lean();
    if (session) consultaNodos.session(session);
    const nodos = await consultaNodos;
    const generaciones = new Map(nodos.map((nodo) => [String(nodo._id), Number(nodo.generacion)]));

    const idsInvalidos = hilos
        .filter((hilo) => {
            const generacionOrigen = generaciones.get(String(hilo.nodoOrigen));
            const generacionDestino = generaciones.get(String(hilo.nodoDestino));
            return (
                Number.isFinite(generacionOrigen) &&
                Number.isFinite(generacionDestino) &&
                generacionOrigen >= generacionDestino
            );
        })
        .map((hilo) => hilo._id);

    if (idsInvalidos.length > 0) {
        await Hilo.updateMany(
            { _id: { $in: idsInvalidos } },
            { $set: { estado: 'Eliminada' } },
            opcionesSesion(session)
        );
    }

    return idsInvalidos;
};

const moverNodoAtomico = async ({
    arbolId,
    nodoId,
    generacionDestino,
    filaDestino = null,
    parejaDestinoId = null,
    creadoPor
}) => ejecutarOperacionLayout(async (session) => {
    await normalizarGeneracionesPersistidas({ arbolId, session });

    const consultaNodo = Nodo.findOne({
        _id: nodoId,
        arbol: arbolId,
        visible: true
    });
    if (session) consultaNodo.session(session);
    const nodo = await consultaNodo;

    if (!nodo) {
        const error = new Error('Nodo no encontrado.');
        error.status = 404;
        throw error;
    }

    let parejaDestino = null;
    let generacionFinal;
    let filaFinal;
    let unionFinal = null;

    if (parejaDestinoId) {
        if (sonMismoId(nodoId, parejaDestinoId)) {
            const error = new Error('No puedes unir una persona consigo misma.');
            error.status = 400;
            throw error;
        }

        const consultaPareja = Nodo.findOne({
            _id: parejaDestinoId,
            arbol: arbolId,
            visible: true
        });
        if (session) consultaPareja.session(session);
        parejaDestino = await consultaPareja;

        if (!parejaDestino) {
            const error = new Error('La persona seleccionada como pareja ya no está disponible.');
            error.status = 404;
            throw error;
        }

        const unionDestino = await buscarUnionActivaNodo({
            arbolId,
            nodoId: parejaDestinoId,
            session
        });

        if (
            unionDestino &&
            !sonMismoId(unionDestino.nodoOrigen, nodoId) &&
            !sonMismoId(unionDestino.nodoDestino, nodoId)
        ) {
            const error = new Error('La persona seleccionada ya tiene una relación de pareja activa.');
            error.status = 409;
            throw error;
        }

        generacionFinal = Number(parejaDestino.generacion);
        filaFinal = Number(parejaDestino.fila);
    } else {
        const destino = await prepararGeneracionObjetivo({
            arbolId,
            generacion: generacionDestino,
            session
        });
        generacionFinal = destino.generacion;

        const filaSolicitada = convertirEntero(filaDestino);
        filaFinal = filaSolicitada !== null && filaSolicitada >= 0
            ? filaSolicitada
            : await obtenerSiguienteFila({
                arbolId,
                generacion: generacionFinal,
                excluirNodoId: nodoId,
                session
            });
    }

    const unionActual = await buscarUnionActivaNodo({ arbolId, nodoId, session });
    const yaEsParejaDestino = Boolean(
        parejaDestinoId &&
        unionActual &&
        (
            sonMismoId(unionActual.nodoOrigen, parejaDestinoId) ||
            sonMismoId(unionActual.nodoDestino, parejaDestinoId)
        )
    );

    if (unionActual && !yaEsParejaDestino) {
        unionActual.estado = 'Eliminada';
        await unionActual.save(opcionesSesion(session));
    }

    nodo.generacion = generacionFinal;
    nodo.fila = filaFinal;
    await nodo.save(opcionesSesion(session));

    if (parejaDestinoId) {
        if (yaEsParejaDestino) {
            unionActual.estado = 'Activa';
            unionFinal = await unionActual.save(opcionesSesion(session));
        } else {
            const filtroUnion = {
                arbol: arbolId,
                tipoRelacion: { $in: TIPOS_RELACION_PAREJA },
                $or: [
                    { nodoOrigen: nodoId, nodoDestino: parejaDestinoId },
                    { nodoOrigen: parejaDestinoId, nodoDestino: nodoId }
                ]
            };

            const consultaExistente = Hilo.findOne(filtroUnion);
            if (session) consultaExistente.session(session);
            const existente = await consultaExistente;

            if (existente) {
                existente.tipoRelacion = 'pareja';
                existente.estado = 'Activa';
                existente.creadoPor = existente.creadoPor || creadoPor;
                unionFinal = await existente.save(opcionesSesion(session));
            } else {
                const documentos = await Hilo.create([{
                    arbol: arbolId,
                    nodoOrigen: parejaDestinoId,
                    nodoDestino: nodoId,
                    tipoRelacion: 'pareja',
                    estado: 'Activa',
                    creadoPor
                }], opcionesSesion(session));
                unionFinal = documentos[0];
            }
        }
    }

    const relacionesEliminadas = await eliminarRelacionesPadreHijoInvalidas({
        arbolId,
        session
    });

    return {
        nodo,
        union: unionFinal,
        relacionesEliminadas,
        movidoComoPareja: Boolean(parejaDestinoId)
    };
});

module.exports = {
    ejecutarOperacionLayout,
    desplazarGeneracionesArbol,
    normalizarGeneracionesPersistidas,
    prepararGeneracionObjetivo,
    obtenerSiguienteFila,
    moverNodoAtomico
};
