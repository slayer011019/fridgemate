import {
  checkRevokedToken,
  resetAuthSecurityStoreForTests,
  revokeAuthToken
} from '../services/authSecurityStore.js';

export async function revokeToken(jti, exp) {
  await revokeAuthToken(jti, exp);
}

export async function isTokenRevoked(jti) {
  return checkRevokedToken(jti);
}

export function clearRevokedTokens() {
  resetAuthSecurityStoreForTests();
}
