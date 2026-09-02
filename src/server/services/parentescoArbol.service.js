const TIPOS_PARENTESCO_ALTA = new Set(['progenitor', 'hijo', 'pareja']);

const normalizarTipoParentescoAlta = (valor = '') => {
    const tipo = String(valor || '').trim().toLowerCase();
    if (['padre', 'madre', 'progenitor'].includes(tipo)) return 'progenitor';
    if (['hijo', 'hija', 'descendiente'].includes(tipo)) return 'hijo';
    if (['pareja', 'conyuge', 'cónyuge'].includes(tipo)) return 'pareja';
    return '';
};

const resolverAltaParentesco = ({ tipoParentesco, generacionReferencia }) => {
    const tipoNormalizado = normalizarTipoParentescoAlta(tipoParentesco);
    const generacion = Number(generacionReferencia);

    if (!TIPOS_PARENTESCO_ALTA.has(tipoNormalizado) || !Number.isFinite(generacion)) {
        return null;
    }

    if (tipoNormalizado === 'progenitor') {
        return {
            tipoNormalizado,
            generacionSolicitada: generacion - 1,
            tipoRelacion: 'padre_hijo',
            nuevoNodoEsOrigen: true
        };
    }

    if (tipoNormalizado === 'hijo') {
        return {
            tipoNormalizado,
            generacionSolicitada: generacion + 1,
            tipoRelacion: 'padre_hijo',
            nuevoNodoEsOrigen: false
        };
    }

    return {
        tipoNormalizado,
        generacionSolicitada: generacion,
        tipoRelacion: 'pareja',
        nuevoNodoEsOrigen: false
    };
};

module.exports = {
    TIPOS_PARENTESCO_ALTA,
    normalizarTipoParentescoAlta,
    resolverAltaParentesco
};
