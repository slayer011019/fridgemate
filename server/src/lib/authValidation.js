import { createHttpError } from './httpError.js';

const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeAuthInput(input = {}) {
  return {
    email: normalizeEmail(input.email),
    password: String(input.password || '')
  };
}

export function assertValidSignupInput({ email, password }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError(400, 'A valid email address is required.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createHttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
}

export function assertValidLoginInput({ email, password }) {
  if (!email || !password) {
    throw createHttpError(400, 'Email and password are required.');
  }
}
