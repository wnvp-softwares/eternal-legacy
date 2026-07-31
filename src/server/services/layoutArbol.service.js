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

const obtenerBloquesGeneracion = async ({ arbolId, generacion, session = null }) => {
    const consultaNodos = Nodo.find({
        arbol: arbolId,
        generacion,
        visible: true
    })
        .sort({ fila: 1, createdAt: 1, _id: 1 })
        .select('_id fila createdAt')
        .lean();

    if (session) consultaNodos.session(session);
    const nodos = await consultaNodos;

    if (nodos.length === 0) return [];

    const nodosPorId = new Map(nodos.map((nodo) => [String(nodo._id), nodo]));
    const idsNodos = nodos.map(nodo => nodo._id);

    const consultaUniones = Hilo.find({
        arbol: arbolId,
        estado: { $ne: 'Eliminada' },
        tipoRelacion: { $in: TIPOS_RELACION_PAREJA },
        nodoOrigen: { $in: idsNodos },
        nodoDestino: { $in: idsNodos }
    })
        .sort({ createdAt: 1, _id: 1 })
        .select('_id nodoOrigen nodoDestino createdAt')
        .lean();

    if (session) consultaUniones.session(session);
    const uniones = await consultaUniones;

    const idsAgrupados = new Set();
    const bloques = [];

    uniones.forEach((union) => {
        const origenId = String(union.nodoOrigen);
        const destinoId = String(union.nodoDestino);
        const origen = nodosPorId.get(origenId);
        const destino = nodosPorId.get(destinoId);

        if (!origen || !destino) return;
        if (idsAgrupados.has(origenId) || idsAgrupados.has(destinoId)) return;

        idsAgrupados.add(origenId);
        idsAgrupados.add(destinoId);

        const creadoOrigen = new Date(origen.createdAt || 0).getTime();
        const creadoDestino = new Date(destino.createdAt || 0).getTime();

        bloques.push({
            id: `union-${union._id}`,
            nodos: [origen, destino],
            fila: Math.min(Number(origen.fila), Number(destino.fila)),
            creadoEn: Math.min(
                Number.isFinite(creadoOrigen) ? creadoOrigen : 0,
                Number.isFinite(creadoDestino) ? creadoDestino : 0
            )
        });
    });

    nodos.forEach((nodo) => {
        const nodoId = String(nodo._id);
        if (idsAgrupados.has(nodoId)) return;

        bloques.push({
            id: `nodo-${nodoId}`,
            nodos: [nodo],
            fila: Number(nodo.fila),
            creadoEn: new Date(nodo.createdAt || 0).getTime()
        });
    });

    return bloques.sort((a, b) => {
        const diferenciaFila = Number(a.fila) - Number(b.fila);
        if (diferenciaFila !== 0) return diferenciaFila;

        const diferenciaCreacion = Number(a.creadoEn) - Number(b.creadoEn);
        if (diferenciaCreacion !== 0) return diferenciaCreacion;

        return String(a.id).localeCompare(String(b.id));
    });
};

const normalizarFilasGeneracion = async ({
    arbolId,
    generacion,
    nodoPrioritarioId = null,
    indiceDestino = null,
    session = null
}) => {
    const bloques = await obtenerBloquesGeneracion({
        arbolId,
        generacion,
        session
    });

    if (bloques.length === 0) return [];

    const indiceNormalizado = convertirEntero(indiceDestino);

    if (nodoPrioritarioId && indiceNormalizado !== null && indiceNormalizado >= 0) {
        const indiceBloque = bloques.findIndex((bloque) =>
            bloque.nodos.some(nodo => sonMismoId(nodo._id, nodoPrioritarioId))
        );

        if (indiceBloque >= 0) {
            const [bloquePrioritario] = bloques.splice(indiceBloque, 1);
            const posicion = Math.min(indiceNormalizado, bloques.length);
            bloques.splice(posicion, 0, bloquePrioritario);
        }
    }

    const operaciones = [];

    bloques.forEach((bloque, fila) => {
        bloque.nodos.forEach((nodo) => {
            if (Number(nodo.fila) === fila) return;

            operaciones.push({
                updateOne: {
                    filter: { _id: nodo._id },
                    update: { $set: { fila } }
                }
            });
        });
    });

    if (operaciones.length > 0) {
        await Nodo.bulkWrite(
            operaciones,
            session
                ? { ordered: true, session }
                : { ordered: true }
        );
    }

    return bloques;
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
    moverParejaCompleta = false,
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

    let generacionOrigen = Number(nodo.generacion);
    let parejaDestino = null;
    let generacionFinal;
    let unionFinal = null;

    const unionActual = await buscarUnionActivaNodo({
        arbolId,
        nodoId,
        session
    });

    if (moverParejaCompleta) {
        if (!unionActual) {
            const error = new Error('La persona seleccionada ya no forma parte de una pareja activa.');
            error.status = 409;
            throw error;
        }

        const parejaId = sonMismoId(unionActual.nodoOrigen, nodoId)
            ? unionActual.nodoDestino
            : unionActual.nodoOrigen;
        const consultaParejaActual = Nodo.findOne({
            _id: parejaId,
            arbol: arbolId,
            visible: true
        });
        if (session) consultaParejaActual.session(session);
        parejaDestino = await consultaParejaActual;

        if (!parejaDestino) {
            const error = new Error('No se encontró al otro integrante de la pareja.');
            error.status = 409;
            throw error;
        }

        const destino = await prepararGeneracionObjetivo({
            arbolId,
            generacion: generacionDestino,
            session
        });

        if (destino.desplazamiento > 0) {
            generacionOrigen += destino.desplazamiento;
        }

        generacionFinal = destino.generacion;
        const indiceDestino = convertirEntero(filaDestino);

        if (indiceDestino !== null && indiceDestino < 0) {
            const error = new Error('La posición de destino debe ser un número entero mayor o igual a cero.');
            error.status = 400;
            throw error;
        }

        nodo.generacion = generacionFinal;
        nodo.fila = Number.MAX_SAFE_INTEGER;
        nodo.posicionManual = true;
        parejaDestino.generacion = generacionFinal;
        parejaDestino.fila = Number.MAX_SAFE_INTEGER;
        parejaDestino.posicionManual = true;
        await nodo.save(opcionesSesion(session));
        await parejaDestino.save(opcionesSesion(session));

        if (generacionOrigen !== generacionFinal) {
            await normalizarFilasGeneracion({
                arbolId,
                generacion: generacionOrigen,
                session
            });
        }

        await normalizarFilasGeneracion({
            arbolId,
            generacion: generacionFinal,
            nodoPrioritarioId: nodoId,
            indiceDestino,
            session
        });

        unionFinal = unionActual;
    } else if (parejaDestinoId) {
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

        const yaEsParejaDestino = Boolean(
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

        generacionFinal = Number(parejaDestino.generacion);
        nodo.generacion = generacionFinal;
        nodo.fila = Number(parejaDestino.fila);
        nodo.posicionManual = true;
        parejaDestino.posicionManual = true;
        await nodo.save(opcionesSesion(session));
        await parejaDestino.save(opcionesSesion(session));

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

        const generacionesAfectadas = [...new Set([
            generacionOrigen,
            generacionFinal
        ])];

        for (const generacion of generacionesAfectadas) {
            await normalizarFilasGeneracion({
                arbolId,
                generacion,
                session
            });
        }
    } else {
        const destino = await prepararGeneracionObjetivo({
            arbolId,
            generacion: generacionDestino,
            session
        });

        if (destino.desplazamiento > 0) {
            generacionOrigen += destino.desplazamiento;
        }

        generacionFinal = destino.generacion;
        const indiceDestino = convertirEntero(filaDestino);

        if (indiceDestino !== null && indiceDestino < 0) {
            const error = new Error('La posición de destino debe ser un número entero mayor o igual a cero.');
            error.status = 400;
            throw error;
        }

        if (unionActual) {
            unionActual.estado = 'Eliminada';
            await unionActual.save(opcionesSesion(session));
        }

        nodo.generacion = generacionFinal;
        nodo.posicionManual = true;
        // Se coloca temporalmente al final. La normalización posterior abre la posición solicitada
        // y reenumera todos los bloques de la generación sin dejar huecos.
        nodo.fila = Number.MAX_SAFE_INTEGER;
        await nodo.save(opcionesSesion(session));

        if (generacionOrigen !== generacionFinal) {
            await normalizarFilasGeneracion({
                arbolId,
                generacion: generacionOrigen,
                session
            });
        }

        await normalizarFilasGeneracion({
            arbolId,
            generacion: generacionFinal,
            nodoPrioritarioId: nodoId,
            indiceDestino,
            session
        });
    }

    const consultaNodoActualizado = Nodo.findById(nodoId);
    if (session) consultaNodoActualizado.session(session);
    const nodoActualizado = await consultaNodoActualizado;

    const relacionesEliminadas = await eliminarRelacionesPadreHijoInvalidas({
        arbolId,
        session
    });

    return {
        nodo: nodoActualizado,
        union: unionFinal,
        relacionesEliminadas,
        movidoComoPareja: Boolean(parejaDestinoId),
        parejaMovidaCompleta: Boolean(moverParejaCompleta)
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
