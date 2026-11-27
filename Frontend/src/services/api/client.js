import axios from 'axios';
import { clearAuth, TOKEN_KEY } from '../../utils/authStorage';

let unauthorizedHandler = null;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function normalizeApiError(error) {
  const status = error.response?.status || 0;
  const body = error.response?.data;
  const networkError = !error.response;
  const message = networkError
    ? 'Unable to reach the server. Check your connection and try again.'
    : body?.message || 'Something went wrong. Please try again.';
  const normalized = new Error(message);
  normalized.status = status;
  normalized.code = networkError ? 'NETWORK_ERROR' : body?.code || 'API_ERROR';
  normalized.errors = Array.isArray(body?.errors) ? body.errors : [];
  return normalized;
}

function shouldSkipSessionRedirect(config) {
  return /\/auth\/(?:login|register|logout|change-password)(?:[/?#]|$)/.test(config?.url || '');
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && typeof body.success === 'boolean') {
      if (!body.success) {
        const apiError = new Error(body.message || 'The request could not be completed.');
        apiError.status = response.status;
        apiError.code = body.code || 'API_ERROR';
        apiError.errors = Array.isArray(body.errors) ? body.errors : [];
        return Promise.reject(apiError);
      }
      return {
        data: body.data,
        headers: response.headers,
        status: response.status,
        ...(body.pagination ? { pagination: body.pagination } : {}),
        ...(body.message ? { message: body.message } : {}),
      };
    }
    return { data: body, headers: response.headers, status: response.status };
  },
  (error) => {
    const normalized = normalizeApiError(error);
    if (normalized.status === 401 && !shouldSkipSessionRedirect(error.config)) {
      clearAuth();
      unauthorizedHandler?.(normalized);
      window.dispatchEvent(new CustomEvent('talkready:unauthorized', { detail: { message: 'Your session expired. Please sign in again.' } }));
    }
    return Promise.reject(normalized);
  },
);
