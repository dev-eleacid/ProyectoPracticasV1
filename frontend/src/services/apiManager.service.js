//import { apiRequest } from "./api.service";

//const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
import { apiRequest } from './api.service.js';
import { validScheduler, validConnections, validConnection, validLogs, validTest, validSync } from './responseValidation.js';

export function getSchedulerStatus() { return apiRequest('/sync-scheduler', {}, validScheduler); }


export function getConnections() {
    return apiRequest('/connections', {}, validConnections);
}

export function createConnection(connectionData) {
    return apiRequest('/connections', {
        method: 'POST',
        body: JSON.stringify(connectionData),
    }, validConnection);
}

export function activateConnection(id) {
    return apiRequest(`/connections/${id}/activate`, {
        method: 'PATCH',
    }, validConnection);
}

export function deactivateConnection(id) {
    return apiRequest(`/connections/${id}/deactivate`, {
        method: 'PATCH',
    }, validConnection);
}

export function testConnection(id) {
    return apiRequest(`/connections/${id}/test`, {
        method: 'PATCH',
    }, validTest);
}

export function syncConnection(id) {
    return apiRequest(`/connections/${id}/sync`, {
        method: 'PATCH',
    }, validSync);
}

export function getSyncLogs(limit = 20) {
    return apiRequest(`/sync-logs?limit=${limit}`, {}, validLogs);
}

export function getConnectionSyncLogs(id, limit = 20) {
    return apiRequest(`/connections/${id}/sync-logs?limit=${limit}`, {}, validLogs);
}

export function updateConnection(id, connectionData) {
    return apiRequest(`/connections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(connectionData),
    }, validConnection);
}

