import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCellValue, formatCellValue } from '../src/utils/stagingCells.js';

test('una respuesta se muestra solo en el proyecto y formulario correspondientes', () => {
    const column = { source: 'field_values', project_id: 'project', form_ref: 'main', input_ref: 'name' };
    const row = { project_id: 'project', form_ref: 'main', field_values: { name: 'Ana' } };
    assert.equal(getCellValue(row, column), 'Ana');
    assert.equal(getCellValue({ ...row, form_ref: 'child' }, column), null);
    assert.equal(getCellValue({ ...row, project_id: 'another' }, column), null);
});

test('muestra etiquetas de selección, conserva opciones desconocidas y distingue vacíos de cero', () => {
    const options = [{ value: 'one', label: 'Primera' }, { value: 'two', label: 'Segunda' }];
    assert.equal(formatCellValue('one', { type: 'choice', options }), 'Primera');
    assert.equal(formatCellValue(['one', 'two'], { type: 'choices', options }), 'Primera, Segunda');
    assert.equal(formatCellValue('old', { type: 'choice', options }), 'old');
    assert.equal(formatCellValue(0, { type: 'number' }), '0');
    assert.equal(formatCellValue(null, { type: 'text' }), '-');
    assert.equal(formatCellValue(false, { type: 'boolean' }), 'No');
});

test('representa ubicación y fechas de captura sin alterar su formato declarado', () => {
    assert.equal(formatCellValue({ latitude: 19.4, longitude: -99.1, accuracy: 5 }, { type: 'location' }), '19.4, -99.1 (±5 m)');
    assert.equal(formatCellValue('21/10/2026', { type: 'date' }), '21/10/2026');
    assert.equal(formatCellValue('foto.jpg', { type: 'media' }), 'foto.jpg');
});

test('el formato de fechas de sistema conserva la fecha, hora y zona locales y los valores inválidos', () => {
    for (const value of ['2026-10-01T00:00:00Z', '2026-10-01T23:59:59Z', '2026-04-05T12:30:01+03:00']) {
        assert.equal(formatCellValue(value, { type: 'datetime' }), new Date(value).toLocaleString());
    }
    assert.equal(formatCellValue('sin fecha', { type: 'datetime' }), 'sin fecha');
    assert.equal(formatCellValue(null, { type: 'datetime' }), '-');
});
