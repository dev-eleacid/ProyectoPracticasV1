import { isRecord } from './responseValidation.js';
import { requestError } from './requestError.js';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

export async function apiRequest(endpoint, options = {}, validate = () => true) {
    const { headers, ...requestOptions } = options;

    const isRead = !options.method || ['GET', 'HEAD'].includes(options.method.toUpperCase());
    let response;
    try { response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...requestOptions,
        headers: {
            'Content-Type': 'application/json',
            ...(headers || {}),
        },
    }); } catch (error) {
        if (isRead && error.name === 'AbortError') throw error;
        throw requestError(isRead ? 'API_UNAVAILABLE' : 'API_RESULT_UNCONFIRMED');
    }

    let payload;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        throw requestError('API_HTTP_ERROR', response.status, payload);
    }
    if (!isRecord(payload) || payload.status !== 'ok' || !validate(payload.data)) {
        throw requestError(isRead ? 'API_RESPONSE_INVALID' : 'API_RESULT_UNCONFIRMED', response.status);
    }
    return payload;
}

