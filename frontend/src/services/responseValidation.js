// Valida el contrato que usan las pantallas; no sustituye las reglas de negocio.
export const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string';
const nonempty = (value) => text(value) && value.trim().length > 0;
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const optionalText = (value) => value === undefined || value === null || text(value);
const date = (value) => text(value) && Number.isFinite(Date.parse(value));
const optionalDate = (value) => value === undefined || value === null || date(value);
const fields = (value, names, check) => isRecord(value) && names.every((name) => check(value[name]));
const arrayOf = (value, check) => Array.isArray(value) && value.every(check);

export function validConnection(value) {
    return fields(value, ['id', 'name', 'project_slug', 'base_url', 'provider', 'auth_type'], nonempty)
        && typeof value.is_active === 'boolean'
        && ['form_ref', 'last_test_status', 'last_sync_status', 'sync_cursor', 'oauth_status'].every((name) => optionalText(value[name]))
        && ['last_sync_at', 'oauth_token_expires_at', 'oauth_retry_after', 'sync_next_run_at'].every((name) => optionalDate(value[name]))
        && ['sync_per_page', 'sync_max_pages', 'sync_delay_ms', 'sync_overlap_minutes', 'sync_interval_minutes'].every((name) => count(value[name]))
        && typeof value.sync_schedule_enabled === 'boolean';
}

export const validConnections = (value) => arrayOf(value, validConnection);

function validLog(value) {
    return fields(value, ['id', 'project_slug', 'status'], nonempty)
        && date(value.started_at) && optionalDate(value.finished_at)
        && ['form_ref', 'mode', 'error_message'].every((name) => optionalText(value[name]))
        && (value.duration_ms === null || count(value.duration_ms))
        && ['total_entries_fetched', 'processed_count', 'skipped_count'].every((name) => count(value[name]));
}

export const validLogs = (value) => arrayOf(value, validLog);
export const validScheduler = (value) => isRecord(value) && typeof value.enabled === 'boolean'
    && count(value.pollMs) && count(value.requestIntervalMs);

export function validDashboard(value) {
    return isRecord(value) && date(value.generatedAt)
        && fields(value.period, ['from', 'through'], date)
        && fields(value.connections, ['total', 'active'], count)
        && fields(value.staging, ['total', 'unvalidated', 'forms', 'children', 'branches', 'pendingParents'], count)
        && fields(value.sync, ['runs', 'successful', 'failed', 'partial', 'running', 'fetched', 'processed', 'skipped', 'durationMs'], count)
        && (value.sync.recordsPerSecond === null || (typeof value.sync.recordsPerSecond === 'number' && Number.isFinite(value.sync.recordsPerSecond) && value.sync.recordsPerSecond >= 0))
        && arrayOf(value.validation, (item) => fields(item, ['status'], nonempty) && count(item.total))
        && arrayOf(value.daily, (item) => isRecord(item) && date(item.day)
            && fields(item, ['runs', 'successful', 'failed', 'partial', 'running', 'processed'], count))
        && arrayOf(value.recent, (run) => fields(run, ['id', 'connection_name', 'project_slug', 'status', 'started_at'], nonempty)
            && ['mode', 'finished_at', 'cursor_before', 'cursor_after', 'error_code', 'error_message'].every((name) => optionalText(run[name]))
            && count(run.processed_count) && count(run.skipped_count)
            && (run.duration_ms === null || count(run.duration_ms)));
}

function validColumn(column) {
    return fields(column, ['key', 'label', 'type', 'source'], nonempty)
        && ['system', 'payload', 'field_values'].includes(column.source)
        && (column.hidden === undefined || typeof column.hidden === 'boolean')
        && (column.source !== 'payload' || nonempty(column.path))
        && (column.source !== 'field_values' || fields(column, ['project_id', 'form_ref', 'input_ref'], nonempty))
        && ((column.options === undefined && !['choice', 'choices'].includes(column.type))
            || arrayOf(column.options, (option) => fields(option, ['value', 'label'], text)));
}

const validColumns = (columns) => arrayOf(columns, validColumn)
    && new Set(columns.map((column) => column.key)).size === columns.length;

function validRow(row) {
    return fields(row, ['entry_uuid', 'project_id', 'form_ref', 'row_key', 'validation_status'], nonempty)
        && ['form', 'child', 'branch'].includes(row.record_type)
        && isRecord(row.payload) && isRecord(row.field_values)
        && ['created_at_epicollect', 'updated_at_epicollect', 'uploaded_at_epicollect', 'received_at'].every((name) => optionalDate(row[name]));
}

function validPagination(value) {
    return fields(value, ['page', 'page_size', 'total', 'total_pages'], count) && value.page > 0 && value.page_size > 0;
}

export const validStaging = (value) => isRecord(value) && validColumns(value.columns)
    && arrayOf(value.rows, validRow) && validPagination(value.pagination)
    && typeof value.pagination.has_previous === 'boolean' && typeof value.pagination.has_next === 'boolean';

export function validAudit(value) {
    return isRecord(value) && validColumns(value.columns) && validPagination(value.pagination)
        && fields(value.summary, ['total', 'identified', 'anonymous', 'pending', 'stale', 'surveyors'], count)
        && value.summary.total === value.summary.identified + value.summary.anonymous + value.summary.pending + value.summary.stale
        && arrayOf(value.validation_statuses, nonempty) && count(value.surveyor_limit)
        && arrayOf(value.rows, (row) => validRow(row)
            && ['identified', 'anonymous', 'pending', 'stale'].includes(row.audit_status)
            && optionalText(row.surveyor_id) && optionalText(row.surveyor_name) && optionalDate(row.audit_checked_at))
        && arrayOf(value.surveyors, (person) => fields(person, ['surveyor_id'], nonempty)
            && optionalText(person.surveyor_name)
            && fields(person, ['records', 'main_records', 'child_records', 'branch_records'], count));
}

export const validRefresh = (value) => fields(value, ['received', 'matched', 'unmatched'], count)
    && value.received === value.matched + value.unmatched;
export const validTest = (value) => isRecord(value) && validConnection(value.connection)
    && isRecord(value.test) && count(value.test.entriesCount) && count(value.test.statusCode);
export const validSync = (value) => isRecord(value) && validConnection(value.connection)
    && isRecord(value.sync) && fields(value.sync.database, ['processed', 'skipped', 'pendingParents'], count)
    && fields(value.sync.fetch, ['totalEntriesFetched'], count);
