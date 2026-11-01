const assert = require('node:assert/strict');
const f = require('../fixtures/volume');
const field = (input, form = 'household') => `field.${f.PROJECT_ID}.${form}.${input}`;
const rootIndexes = Array.from({ length: f.ROOTS }, (_, i) => i + 1);
const filter = (input, operator, value) => JSON.stringify([{ field: field(input), operator, value }]);

const cases = [
    { name: 'primera-pagina', params: {}, total: f.ROOTS },
    { name: 'ultima-pagina', params: { page: 10, page_size: 1000 }, total: f.ROOTS },
    { name: 'numero-ascendente', params: { sort_by: field('amount'), sort_order: 'asc' }, total: f.ROOTS, numeric: 'asc' },
    { name: 'numero-descendente', params: { sort_by: field('amount'), sort_order: 'desc' }, total: f.ROOTS, numeric: 'desc' },
    { name: 'texto-contiene', params: { filters: filter('name', 'contains', '001') },
        total: rootIndexes.filter((i) => f.rootValues(i).name?.includes('001')).length },
    { name: 'opcion-exacta', params: { filters: filter('zone', 'eq', 'aa') },
        total: rootIndexes.filter((i) => f.rootValues(i).zone === 'aa').length },
    { name: 'seleccion-multiple', params: { filters: filter('tags', 'eq', 'a') }, total: f.ROOTS / 2 },
    { name: 'valores-nulos', params: { filters: filter('name', 'is_null') }, total: f.ROOTS / 10 },
    { name: 'busqueda-global', params: { search: 'Persona ficticia 00001' }, total: 1 },
    { name: 'filtros-combinados', params: { filters: JSON.stringify([
        { field: field('zone'), operator: 'eq', value: 'a' },
        { field: field('tags'), operator: 'eq', value: 'a' },
    ]), sort_by: field('amount'), sort_order: 'asc' }, total: Math.floor(f.ROOTS / 6) },
    { name: 'sin-coincidencias', params: { filters: filter('name', 'eq', 'No existe') }, total: 0 },
    { name: 'rama-y-padre', params: { form_ref: 'visits' }, total: f.ROOTS * 2 },
    { name: 'formulario-hijo', params: { form_ref: 'members' }, total: f.ROOTS },
];

function route(params = {}) {
    return '/api/staging/entries?' + new URLSearchParams({ project_slug: f.SLUG, source_base_url: f.BASE,
        form_ref: 'household', page_size: '100', ...params });
}

function validateCase(scenario, body) {
    assert.equal(body.status, 'ok');
    assert.equal(body.data.pagination.total, scenario.total, scenario.name);
    const size = Number(scenario.params.page_size || 100);
    const page = Number(scenario.params.page || 1);
    assert.equal(body.data.rows.length, Math.max(0, Math.min(size, scenario.total - (page - 1) * size)), scenario.name);
    for (const row of body.data.rows) {
        assert.equal(row.project_id, f.PROJECT_ID, scenario.name);
        assert.equal(row.form_ref, scenario.params.form_ref || 'household', scenario.name);
        assert.equal(row.parent_found, true, scenario.name);
    }
    if (scenario.numeric) {
        const sign = scenario.numeric === 'asc' ? 1 : -1;
        const sorted = rootIndexes.map((i) => ({ id: f.uuid('form', i), value: f.rootValues(i).amount }))
            .sort((a, b) => a.value === null ? b.value === null ? a.id.localeCompare(b.id) : 1
                : b.value === null ? -1 : sign * (a.value - b.value) || a.id.localeCompare(b.id));
        assert.deepEqual(body.data.rows.map((row) => row.entry_uuid), sorted.slice(0, size).map((row) => row.id));
    }
}

module.exports = { field, cases, route, validateCase };
