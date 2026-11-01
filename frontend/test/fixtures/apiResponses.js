export function connection() {
    return { id: '00000000-0000-4000-8000-000000000001', name: 'Conexión ficticia de recuperación',
        project_slug: 'recuperacion-local', base_url: 'https://five.epicollect.net/api', provider: 'epicollect5',
        auth_type: 'none', is_active: true, form_ref: null, has_auth_token: false,
        sync_per_page: 50, sync_max_pages: 5, sync_delay_ms: 500, sync_overlap_minutes: 5,
        sync_interval_minutes: 60, sync_schedule_enabled: false, sync_next_run_at: null,
        last_test_status: 'untested', last_sync_status: 'never', last_sync_at: null, sync_cursor: null };
}

export function staging() {
    return {
        columns: [
            { key: 'entry_uuid', label: 'Identificador', type: 'uuid', source: 'system' },
            { key: 'field.example.main.answer', label: 'Respuesta de prueba', type: 'text', source: 'field_values',
                project_id: '00000000-0000-4000-8000-000000000002', form_ref: 'main', input_ref: 'answer', options: [] },
        ],
        rows: [{ project_id: '00000000-0000-4000-8000-000000000002', entry_uuid: '00000000-0000-4000-8000-000000000003',
            form_ref: 'main', row_key: 'ficticio-1', record_type: 'form', validation_status: 'unvalidated',
            payload: { answer: 'Respuesta ficticia' }, field_values: { answer: 'Respuesta ficticia' },
            created_at_epicollect: '2026-11-01T10:00:00Z', uploaded_at_epicollect: '2026-11-01T11:00:00Z' }],
        pagination: { page: 1, page_size: 50, total: 1, total_pages: 1, has_next: false, has_previous: false },
    };
}

export function audit() {
    const data = staging();
    return { ...data, columns: data.columns.filter((column) => column.source === 'field_values'),
        summary: { total: 1, surveyors: 1, identified: 1, anonymous: 0, pending: 0, stale: 0 },
        surveyor_limit: 100, validation_statuses: ['unvalidated'],
        rows: data.rows.map((row) => ({ ...row, surveyor_id: '42', surveyor_name: 'Persona ficticia',
            audit_status: 'identified', audit_checked_at: '2026-11-01T11:05:00Z' })),
        surveyors: [{ surveyor_id: '42', surveyor_name: 'Persona ficticia', records: 1,
            main_records: 1, child_records: 0, branch_records: 0 }],
    };
}

export function dashboard() {
    return { generatedAt: new Date().toISOString(), period: { from: '2026-10-26', through: '2026-11-01' },
        connections: { total: 1, active: 1 }, staging: { total: 1, unvalidated: 1, forms: 1, children: 0, branches: 0, pendingParents: 0 },
        validation: [{ status: 'unvalidated', total: 1 }],
        sync: { runs: 0, successful: 0, failed: 0, partial: 0, running: 0, fetched: 0, processed: 0, skipped: 0, durationMs: 0, recordsPerSecond: null },
        daily: [{ day: '2026-11-01', runs: 0, successful: 0, failed: 0, partial: 0, running: 0, processed: 0 }],
        recent: [], consolidated: null };
}
