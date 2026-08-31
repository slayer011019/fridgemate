import {
  checkRevokedToken,
  resetAuthSecurityStoreForTests,
  revokeAuthToken
} from '../services/authSecurityStore.js';

export async function revokeToken(jti, exp) {
  await revokeAuthToken(jti, exp);
}

export async function isTokenRevoked(jti, exp) {
  return checkRevokedToken(jti, exp);
}

export function clearRevokedTokens() {
  resetAuthSecurityStoreForTests();
}
