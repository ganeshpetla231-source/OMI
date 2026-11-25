export function createApiError(message, status, errors = [], code = 'API_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.errors = errors;
  error.code = code;
  return error;
}
