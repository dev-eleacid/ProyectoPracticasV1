import { apiRequest } from './api.service.js';
import { validDashboard } from './responseValidation.js';

export function getDashboard(days = 7) {
    return apiRequest(`/dashboard?${new URLSearchParams({ days: String(days) })}`, {}, validDashboard);
}
