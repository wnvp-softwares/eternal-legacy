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

const PREFERENCIAS_GENERO_LAYOUT = ['masculino_arriba', 'femenino_arriba'];

const normalizarGeneroLayout = (valor = '') => {
    const genero = String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    if (genero === 'masculino' || genero === 'hombre') return 'masculino';
    if (genero === 'femenino' || genero === 'mujer') return 'femenino';
    return 'otro';
};

const obtenerGeneroNodoLayout = (nodo = {}) => normalizarGeneroLayout(
    nodo.usuario?.informacionPerfil?.genero || nodo.genero || ''
);

const obtenerPrioridadGeneroLayout = (nodo, preferenciaGenero) => {
    const genero = obtenerGeneroNodoLayout(nodo);
    const generoPreferido = preferenciaGenero === 'femenino_arriba'
        ? 'femenino'
        : 'masculino';

    if (genero === generoPreferido) return 0;
    if (genero === 'masculino' || genero === 'femenino') return 1;
    return 2;
};

const promedioNumeros = (valores = []) => {
    const numeros = valores.filter(Number.isFinite);
    if (numeros.length === 0) return null;
    return numeros.reduce((total, valor) => total + valor, 0) / numeros.length;
};

const reorganizarArbolCompleto = async ({
    arbolId,
    preferenciaGenero = 'masculino_arriba',
    conservarPosicionesManuales = true
}) => ejecutarOperacionLayout(async (session) => {
    if (!PREFERENCIAS_GENERO_LAYOUT.includes(preferenciaGenero)) {
        const error = new Error('Selecciona una preferencia de acomodo válida.');
        error.status = 400;
        throw error;
    }

    if (typeof conservarPosicionesManuales !== 'boolean') {
        const error = new Error('conservarPosicionesManuales debe ser un valor booleano.');
        error.status = 400;
        throw error;
    }

    await normalizarGeneracionesPersistidas({ arbolId, session });

    const consultaNodos = Nodo.find({
        arbol: arbolId,
        visible: true
    })
        .sort({ generacion: 1, fila: 1, createdAt: 1, _id: 1 })
        .populate({
            path: 'usuario',
            select: 'informacionPerfil',
            populate: {
                path: 'informacionPerfil',
                select: 'genero'
            }
        });
    if (session) consultaNodos.session(session);
    const nodos = await consultaNodos.lean();

    const consultaHilos = Hilo.find({
        arbol: arbolId,
        estado: { $ne: 'Eliminada' }
    }).sort({ createdAt: 1, _id: 1 });
    if (session) consultaHilos.session(session);
    const hilos = await consultaHilos.lean();

    if (nodos.length === 0) {
        return {
            nodosActualizados: 0,
            parejasOrientadas: 0,
            preferenciaGenero,
            conservarPosicionesManuales
        };
    }

    const nodosPorId = new Map(nodos.map(nodo => [String(nodo._id), nodo]));
    const relacionesPareja = hilos.filter(hilo => TIPOS_RELACION_PAREJA.includes(hilo.tipoRelacion));
    const relacionesDescendencia = hilos.filter(hilo => hilo.tipoRelacion === 'padre_hijo');
    const padresPorNodo = new Map();

    relacionesDescendencia.forEach((hilo) => {
        const hijoId = String(hilo.nodoDestino);
        const padreId = String(hilo.nodoOrigen);
        if (!nodosPorId.has(hijoId) || !nodosPorId.has(padreId)) return;
        if (!padresPorNodo.has(hijoId)) padresPorNodo.set(hijoId, new Set());
        padresPorNodo.get(hijoId).add(padreId);
    });

    const operacionesHilos = [];
    let parejasOrientadas = 0;

    relacionesPareja.forEach((hilo) => {
        const origen = nodosPorId.get(String(hilo.nodoOrigen));
        const destino = nodosPorId.get(String(hilo.nodoDestino));
        if (!origen || !destino) return;

        const idsPareja = [String(origen._id), String(destino._id)];
        const superiorActual = hilo.nodoSuperior ? String(hilo.nodoSuperior) : null;
        const superiorActualValido = idsPareja.includes(superiorActual);
        const conservarOrdenManual = Boolean(
            conservarPosicionesManuales &&
            hilo.ordenVisualManual &&
            superiorActualValido
        );

        let superiorId = superiorActualValido ? superiorActual : String(origen._id);

        if (!conservarOrdenManual) {
            const generoOrigen = obtenerGeneroNodoLayout(origen);
            const generoDestino = obtenerGeneroNodoLayout(destino);
            const generosBinariosDistintos = new Set([generoOrigen, generoDestino]);

            if (
                generosBinariosDistintos.has('masculino') &&
                generosBinariosDistintos.has('femenino')
            ) {
                const generoSuperior = preferenciaGenero === 'femenino_arriba'
                    ? 'femenino'
                    : 'masculino';
                superiorId = generoOrigen === generoSuperior
                    ? String(origen._id)
                    : String(destino._id);
            }
        }

        const ordenManualFinal = conservarOrdenManual;
        if (
            superiorId !== superiorActual ||
            Boolean(hilo.ordenVisualManual) !== ordenManualFinal
        ) {
            operacionesHilos.push({
                updateOne: {
                    filter: { _id: hilo._id },
                    update: {
                        $set: {
                            nodoSuperior: superiorId,
                            ordenVisualManual: ordenManualFinal
                        }
                    }
                }
            });
            parejasOrientadas += 1;
        }
    });

    const nodosAgrupados = new Set();
    const bloques = [];
    const bloquePorNodoId = new Map();

    relacionesPareja.forEach((hilo) => {
        const origen = nodosPorId.get(String(hilo.nodoOrigen));
        const destino = nodosPorId.get(String(hilo.nodoDestino));
        if (!origen || !destino) return;
        if (Number(origen.generacion) !== Number(destino.generacion)) return;

        const origenId = String(origen._id);
        const destinoId = String(destino._id);
        if (nodosAgrupados.has(origenId) || nodosAgrupados.has(destinoId)) return;

        const bloque = {
            id: `pareja-${hilo._id}`,
            nodos: [origen, destino],
            generacion: Number(origen.generacion),
            filaActual: Math.min(Number(origen.fila), Number(destino.fila)),
            posicionManual: Boolean(origen.posicionManual || destino.posicionManual),
            creadoEn: Math.min(
                new Date(origen.createdAt || 0).getTime(),
                new Date(destino.createdAt || 0).getTime()
            )
        };

        bloques.push(bloque);
        nodosAgrupados.add(origenId);
        nodosAgrupados.add(destinoId);
        bloquePorNodoId.set(origenId, bloque);
        bloquePorNodoId.set(destinoId, bloque);
    });

    nodos.forEach((nodo) => {
        const nodoId = String(nodo._id);
        if (nodosAgrupados.has(nodoId)) return;

        const bloque = {
            id: `nodo-${nodoId}`,
            nodos: [nodo],
            generacion: Number(nodo.generacion),
            filaActual: Number(nodo.fila),
            posicionManual: Boolean(nodo.posicionManual),
            creadoEn: new Date(nodo.createdAt || 0).getTime()
        };

        bloques.push(bloque);
        bloquePorNodoId.set(nodoId, bloque);
    });

    bloques.forEach((bloque) => {
        const miembrosFamilia = bloque.nodos.map((nodo) => {
            const padres = Array.from(padresPorNodo.get(String(nodo._id)) || [])
                .sort((a, b) => a.localeCompare(b));
            return {
                nodo,
                clave: padres.length > 0 ? padres.join('|') : null,
                padres
            };
        });
        const clavesFamilia = [...new Set(miembrosFamilia.map(item => item.clave).filter(Boolean))];

        bloque.miembrosFamilia = miembrosFamilia;
        bloque.clavesFamilia = clavesFamilia;
        bloque.esPuente = bloque.nodos.length > 1 && clavesFamilia.length > 1;
    });

    const bloquesPorGeneracion = new Map();
    bloques.forEach((bloque) => {
        if (!bloquesPorGeneracion.has(bloque.generacion)) {
            bloquesPorGeneracion.set(bloque.generacion, []);
        }
        bloquesPorGeneracion.get(bloque.generacion).push(bloque);
    });

    const indicePorBloque = new Map();
    const ordenFinalPorGeneracion = new Map();
    const generaciones = Array.from(bloquesPorGeneracion.keys()).sort((a, b) => a - b);
    const compararOrdenActual = (a, b) => {
        const diferenciaFila = Number(a.filaActual) - Number(b.filaActual);
        if (diferenciaFila !== 0) return diferenciaFila;
        const diferenciaCreacion = Number(a.creadoEn) - Number(b.creadoEn);
        if (diferenciaCreacion !== 0) return diferenciaCreacion;
        return String(a.id).localeCompare(String(b.id));
    };

    generaciones.forEach((generacion) => {
        const lista = [...(bloquesPorGeneracion.get(generacion) || [])];
        const ordenActual = [...lista].sort(compararOrdenActual);
        const familias = new Map();
        const elementosIndependientes = [];

        const obtenerPosicionPadres = (idsPadres = []) => promedioNumeros(
            [...new Set(idsPadres.map((padreId) => bloquePorNodoId.get(String(padreId))?.id))]
                .filter(Boolean)
                .map(bloqueId => indicePorBloque.get(String(bloqueId)))
        );

        lista.forEach((bloque) => {
            if (bloque.clavesFamilia.length === 1) {
                const clave = bloque.clavesFamilia[0];
                if (!familias.has(clave)) familias.set(clave, []);
                familias.get(clave).push(bloque);
                return;
            }

            const posicionesFamilia = bloque.miembrosFamilia
                .map(item => obtenerPosicionPadres(item.padres))
                .filter(Number.isFinite);
            elementosIndependientes.push({
                id: `independiente-${bloque.id}`,
                bloques: [bloque],
                posicionIdeal: promedioNumeros(posicionesFamilia) ?? Number(bloque.filaActual),
                filaReferencia: Number(bloque.filaActual)
            });
        });

        const segmentosFamilia = Array.from(familias.entries()).map(([clave, bloquesFamilia]) => {
            const idsPadres = clave.split('|').filter(Boolean);
            const posicionFamilia = obtenerPosicionPadres(idsPadres);
            const bloquesOrdenados = [...bloquesFamilia].sort((a, b) => {
                const obtenerNodoLinea = (bloque) => (
                    bloque.miembrosFamilia.find(item => item.clave === clave)?.nodo || bloque.nodos[0]
                );
                const prioridadA = obtenerPrioridadGeneroLayout(obtenerNodoLinea(a), preferenciaGenero);
                const prioridadB = obtenerPrioridadGeneroLayout(obtenerNodoLinea(b), preferenciaGenero);
                if (prioridadA !== prioridadB) return prioridadA - prioridadB;
                return compararOrdenActual(a, b);
            });

            return {
                id: `familia-${clave}`,
                bloques: bloquesOrdenados,
                posicionIdeal: posicionFamilia ?? Math.min(...bloquesFamilia.map(bloque => Number(bloque.filaActual))),
                filaReferencia: Math.min(...bloquesFamilia.map(bloque => Number(bloque.filaActual)))
            };
        });

        const segmentos = [...segmentosFamilia, ...elementosIndependientes]
            .sort((a, b) => {
                const diferenciaIdeal = Number(a.posicionIdeal) - Number(b.posicionIdeal);
                if (diferenciaIdeal !== 0) return diferenciaIdeal;
                const diferenciaFila = Number(a.filaReferencia) - Number(b.filaReferencia);
                if (diferenciaFila !== 0) return diferenciaFila;
                return String(a.id).localeCompare(String(b.id));
            });

        const ordenAutomatico = segmentos.flatMap(segmento => segmento.bloques);
        let ordenFinal = ordenAutomatico;

        if (conservarPosicionesManuales && ordenActual.some(bloque => bloque.posicionManual)) {
            const resultado = new Array(ordenActual.length).fill(null);
            ordenActual.forEach((bloque, indice) => {
                if (bloque.posicionManual) resultado[indice] = bloque;
            });

            const movibles = ordenAutomatico.filter(bloque => !bloque.posicionManual);
            let indiceMovible = 0;
            ordenFinal = resultado.map((bloque) => bloque || movibles[indiceMovible++]);
        }

        ordenFinal.forEach((bloque, indice) => indicePorBloque.set(String(bloque.id), indice));
        ordenFinalPorGeneracion.set(generacion, ordenFinal);
    });

    const operacionesNodos = [];
    ordenFinalPorGeneracion.forEach((ordenFinal) => {
        ordenFinal.forEach((bloque, fila) => {
            bloque.nodos.forEach((nodo) => {
                const cambios = {};
                if (Number(nodo.fila) !== fila) cambios.fila = fila;
                if (!conservarPosicionesManuales && nodo.posicionManual) {
                    cambios.posicionManual = false;
                }
                if (Object.keys(cambios).length === 0) return;

                operacionesNodos.push({
                    updateOne: {
                        filter: { _id: nodo._id, arbol: arbolId },
                        update: { $set: cambios }
                    }
                });
            });
        });
    });

    if (operacionesNodos.length > 0) {
        await Nodo.bulkWrite(
            operacionesNodos,
            session ? { ordered: true, session } : { ordered: true }
        );
    }

    if (operacionesHilos.length > 0) {
        await Hilo.bulkWrite(
            operacionesHilos,
            session ? { ordered: true, session } : { ordered: true }
        );
    }

    return {
        nodosActualizados: operacionesNodos.length,
        parejasOrientadas,
        preferenciaGenero,
        conservarPosicionesManuales
    };
});

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
        const nodoSuperiorInicialId = Number(nodo.fila) <= Number(parejaDestino.fila)
            ? nodo._id
            : parejaDestino._id;

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
            if (!unionActual.nodoSuperior) {
                unionActual.nodoSuperior = nodoSuperiorInicialId;
            }
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
                if (!existente.nodoSuperior) {
                    existente.nodoSuperior = nodoSuperiorInicialId;
                }
                unionFinal = await existente.save(opcionesSesion(session));
            } else {
                const documentos = await Hilo.create([{
                    arbol: arbolId,
                    nodoOrigen: parejaDestinoId,
                    nodoDestino: nodoId,
                    nodoSuperior: nodoSuperiorInicialId,
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
    reorganizarArbolCompleto,
    moverNodoAtomico
};
