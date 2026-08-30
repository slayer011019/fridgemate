import { ApiClientError, requestJson } from './apiClient';

export class AuthApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'AuthApiError';
  }
}

export function signup(credentials) {
  return requestJson(
    '/auth/signup',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    },
    {
      authMode: 'never',
      errorClass: AuthApiError
    }
  );
}

export function login(credentials) {
  return requestJson(
    '/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    },
    {
      authMode: 'never',
      errorClass: AuthApiError
    }
  );
}

export function getCurrentUser() {
  return requestJson('/auth/me', {}, { authMode: 'required', errorClass: AuthApiError });
}

export function refreshSession() {
  return requestJson(
    '/auth/refresh',
    {
      method: 'POST'
    },
    {
      authMode: 'never',
      errorClass: AuthApiError
    }
  );
}

export function logout() {
  return requestJson(
    '/auth/logout',
    {
      method: 'POST'
    },
    {
      authMode: 'never',
      allowNoContent: true,
      errorClass: AuthApiError
    }
  );
}
