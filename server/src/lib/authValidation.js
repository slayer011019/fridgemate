import { createHttpError } from './httpError.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const COMMON_PASSWORD_PATTERNS = ['password', '123456', 'qwerty', 'letmein', 'admin'];
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const WHITESPACE_PATTERN = /\s/u;

function isValidEmailAddress(email) {
  const atIndex = email.indexOf('@');

  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') || atIndex === email.length - 1) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;

  const domainLabels = domain.split('.');
  if (domainLabels.length < 2 || domainLabels.some((label) => !label)) return false;

  for (const character of email) {
    if (WHITESPACE_PATTERN.test(character)) return false;
  }

  return true;
}

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
  if (!email) {
    throw createHttpError(400, 'A valid email address is required.');
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw createHttpError(400, 'Email address is too long.');
  }

  if (!isValidEmailAddress(email)) {
    throw createHttpError(400, 'A valid email address is required.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createHttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw createHttpError(400, `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`);
  }

  if (!SPECIAL_CHARACTER_PATTERN.test(password)) {
    throw createHttpError(400, 'Password must include at least one special character.');
  }

  const normalizedPassword = password.toLowerCase();
  const emailLocalPart = email.split('@')[0];

  if (emailLocalPart && normalizedPassword.includes(emailLocalPart)) {
    throw createHttpError(400, 'Password must not contain your email name.');
  }

  if (COMMON_PASSWORD_PATTERNS.some((pattern) => normalizedPassword.includes(pattern))) {
    throw createHttpError(400, 'Password is too easy to guess. Choose a stronger password.');
  }
}

export function assertValidLoginInput({ email, password }) {
  if (!email || !password) {
    throw createHttpError(400, 'Email and password are required.');
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw createHttpError(400, 'Email address is too long.');
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw createHttpError(400, 'Password is too long.');
  }
}
