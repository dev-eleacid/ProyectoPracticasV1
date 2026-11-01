const { createHash } = require('node:crypto');

const VERSION = 'local-volume-v1';
const ROOTS = 10_000;
const SLUG = 'volumen-local';
const BASE = 'https://volumen.example.org/api';
const OTHER_BASE = 'https://otro-volumen.example.org/api';
const PROJECT_ID = uuid('project', 1);
const OTHER_PROJECT_ID = uuid('project', 2);
const answers = ['a', 'aa', 'b'].map((answer_ref) => ({ answer_ref, answer: `Opción ${answer_ref}` }));
const definition = { data: { project: { slug: SLUG, forms: [
    { ref: 'household', name: 'Hogar ficticio', inputs: [
        { ref: 'name', type: 'text', question: 'Nombre ficticio' },
        { ref: 'amount', type: 'decimal', question: 'Importe' },
        { ref: 'zone', type: 'radio', question: 'Zona', possible_answers: answers },
        { ref: 'tags', type: 'checkbox', question: 'Etiquetas', possible_answers: answers },
        { ref: 'notes', type: 'textarea', question: 'Observaciones' },
        { ref: 'day', type: 'date', question: 'Fecha' },
        { ref: 'time', type: 'time', question: 'Hora' },
        { ref: 'location', type: 'location', question: 'Ubicación' },
        ...['photo', 'audio', 'video'].map((type) => ({ ref: type, type, question: type })),
        { ref: 'visits', type: 'branch', question: 'Visitas', branch: [
            { ref: 'result', type: 'text', question: 'Resultado' },
        ] },
    ] },
    { ref: 'members', name: 'Integrante ficticio', inputs: [
        { ref: 'age', type: 'integer', question: 'Edad' },
    ] },
] } } };

function uuid(kind, index) {
    const hex = createHash('sha256').update(`${VERSION}:${kind}:${index}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function rootValues(index) {
    return {
        name: index % 10 === 0 ? null : `Persona ficticia ${String(index).padStart(5, '0')} — ñ & < > '`,
        amount: index % 20 === 0 ? null : (index % 100) - 40,
        zone: answers[index % 3].answer_ref,
        tags: index % 2 === 0 ? ['a', 'b'] : ['aa'],
        notes: index % 7 === 0 ? '' : `Texto sintético con acentos: México, pingüino. ${'Dato ficticio. '.repeat(24)}`,
        day: '2026-10-01', time: '12:30:00',
        location: { latitude: 19.43, longitude: -99.13, accuracy: 5 },
        // Sólo referencias: el ensayo no descarga ni mide archivos multimedia.
        photo: `ficticia-${index}.jpg`, audio: `ficticio-${index}.mp3`, video: `ficticio-${index}.mp4`,
    };
}

function record(kind, index, parent = null) {
    const form_ref = { form: 'household', child: 'members', branch: 'visits' }[kind];
    const field_values = kind === 'form' ? rootValues(index)
        : kind === 'child' ? { age: index % 101 } : { result: index % 2 === 0 ? 'Completada' : 'Revisita' };
    const entry_uuid = uuid(kind, index);
    const parent_uuid = parent === null ? null : uuid('form', parent);
    const uploaded_at = new Date(Date.UTC(2026, 9, 1) + index * 1000).toISOString();
    const payload = { ...field_values, uploaded_at, created_at: uploaded_at,
        ...(kind === 'branch' ? { ec5_branch_uuid: entry_uuid, ec5_branch_owner_uuid: parent_uuid }
            : { ec5_uuid: entry_uuid, ...(parent_uuid ? { ec5_parent_uuid: parent_uuid } : {}) }) };
    return { form_ref, record_type: kind, entry_uuid, ec5_uuid: kind === 'branch' ? null : entry_uuid,
        parent_form_ref: parent_uuid ? 'household' : null, parent_uuid,
        branch_ref: kind === 'branch' ? 'visits' : null, field_values, payload, uploaded_at };
}

function* records(roots = ROOTS) {
    for (let index = 1; index <= roots; index++) {
        yield record('form', index);
        yield record('child', index, index);
        yield record('branch', index * 2 - 1, index);
        yield record('branch', index * 2, index);
    }
}

module.exports = { VERSION, ROOTS, SLUG, BASE, OTHER_BASE, PROJECT_ID, OTHER_PROJECT_ID,
    definition, uuid, rootValues, record, records };
