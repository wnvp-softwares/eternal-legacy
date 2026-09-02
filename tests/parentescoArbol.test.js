const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizarTipoParentescoAlta,
    resolverAltaParentesco
} = require('../src/server/services/parentescoArbol.service');

test('normaliza padre/madre como progenitor', () => {
    assert.equal(normalizarTipoParentescoAlta('Padre'), 'progenitor');
    assert.equal(normalizarTipoParentescoAlta('madre'), 'progenitor');
});

test('un progenitor se ubica una generación antes y apunta al familiar de referencia', () => {
    assert.deepEqual(resolverAltaParentesco({ tipoParentesco: 'madre', generacionReferencia: 3 }), {
        tipoNormalizado: 'progenitor',
        generacionSolicitada: 2,
        tipoRelacion: 'padre_hijo',
        nuevoNodoEsOrigen: true
    });
});

test('un hijo se ubica una generación después', () => {
    assert.deepEqual(resolverAltaParentesco({ tipoParentesco: 'hija', generacionReferencia: 3 }), {
        tipoNormalizado: 'hijo',
        generacionSolicitada: 4,
        tipoRelacion: 'padre_hijo',
        nuevoNodoEsOrigen: false
    });
});

test('una pareja comparte generación con la persona de referencia', () => {
    assert.deepEqual(resolverAltaParentesco({ tipoParentesco: 'cónyuge', generacionReferencia: 3 }), {
        tipoNormalizado: 'pareja',
        generacionSolicitada: 3,
        tipoRelacion: 'pareja',
        nuevoNodoEsOrigen: false
    });
});

test('rechaza parentescos no soportados', () => {
    assert.equal(resolverAltaParentesco({ tipoParentesco: 'primo', generacionReferencia: 3 }), null);
});
