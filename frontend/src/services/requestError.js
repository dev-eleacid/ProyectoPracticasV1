import { isRecord } from './responseValidation.js';

const publicText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const UNCERTAIN = 'No fue posible confirmar el resultado de la operación. Actualiza los datos y comprueba su estado antes de repetirla.';
const SERVICE_MESSAGES = {
    AUDIT_SOURCE_UNAVAILABLE: 'El acceso a la identidad del capturista aún no está configurado para este proyecto.',
    AUDIT_CONFIG_INVALID: 'Revisa la configuración de acceso a auditoría en el servidor.',
    AUDIT_PROJECT_NOT_READY: 'Sincroniza primero los registros del proyecto para consultar su auditoría.',
    AUDIT_MIGRATION_REQUIRED: 'Es necesario preparar el almacenamiento de auditoría.',
    AUDIT_ALREADY_RUNNING: 'La auditoría del proyecto ya se está actualizando. Espera a que termine.',
    AUDIT_PAGE_LIMIT: 'La auditoría superó el máximo de páginas. Revisa el límite de la conexión.',
    SYNC_ALREADY_RUNNING: 'La conexión ya tiene una sincronización en ejecución. Espera a que termine.',
    SYNC_CAPACITY_BUSY: 'El servidor está atendiendo otras sincronizaciones. Intenta nuevamente más tarde.',
    SYNC_INTERRUPTED: 'La sincronización se interrumpió. Consulta su historial antes de repetirla.',
    SYNC_PAGE_LIMIT: 'Quedan páginas por descargar. Revisa el máximo de páginas de la conexión.',
    CONNECTION_CHANGED: 'La conexión cambió durante la operación. Actualiza su estado antes de repetirla.',
    EPICOLLECT_BASE_DENIED: 'El servidor de Epicollect5 no está autorizado en la configuración del backend.',
    OAUTH_CREDENTIALS_REJECTED: 'Epicollect rechazó las credenciales. Revisa el acceso y los permisos del proyecto.',
    OAUTH_RATE_LIMITED: 'La autenticación alcanzó su límite de peticiones. Espera antes de repetir la consulta.',
    OAUTH_RETRY_LATER: 'La autenticación está en espera tras un fallo. Consulta nuevamente más tarde.',
};

export function requestError(code, status = null, payload = null) {
    const messages = {
        API_RESPONSE_INVALID: 'El servidor devolvió una respuesta incompleta o no válida. Intenta actualizar la consulta.',
        API_UNAVAILABLE: 'No fue posible comunicarse con el servidor. Revisa la conexión e intenta actualizar la consulta.',
        API_RESULT_UNCONFIRMED: UNCERTAIN,
        API_HTTP_ERROR: status >= 500 ? 'El servidor no pudo completar la solicitud. Intenta consultar su estado más tarde.' : 'No fue posible completar la solicitud.',
    };
    const errors = status >= 400 && status < 500 && isRecord(payload) && Array.isArray(payload.errors)
        ? payload.errors.map((item) => typeof item === 'string' ? item : item?.message).filter(publicText) : [];
    const serviceCode = isRecord(payload) && typeof payload.code === 'string' && Object.hasOwn(SERVICE_MESSAGES, payload.code) ? payload.code : null;
    const message = code === 'API_HTTP_ERROR' && serviceCode ? SERVICE_MESSAGES[serviceCode]
        : code === 'API_HTTP_ERROR' && status < 500 && isRecord(payload) && publicText(payload.message) ? payload.message : messages[code];
    const error = new Error(message);
    error.code = code;
    error.status = status;
    error.uncertain = code === 'API_RESULT_UNCONFIRMED';
    // No adjuntar el cuerpo remoto: puede contener trazas, credenciales o valores no renderizables.
    error.payload = { message, errors };
    return error;
}

export function getRequestErrorMessage(error) {
    const errors = error?.payload?.errors;
    if (Array.isArray(errors) && errors.length) return errors.join(' ');
    return typeof error?.message === 'string' ? error.message : 'No fue posible completar la solicitud.';
}

export function retryRead(failures, error) {
    return failures < 2 && error?.code === 'API_UNAVAILABLE';
}
