import * as indexedDb from '../../db/indexedDB';
import {
  buildUserStorageScope,
  getGuestImportDecision,
  GUEST_STORAGE_SCOPE,
  setGuestImportDecision
} from './authStorage';
import { createUnavailableAuthError } from './authSessionService';

export async function inspectGuestImportPrompt({ isAuthenticated, user, setGuestImportPrompt, defaultGuestImportPrompt }) {
  if (!isAuthenticated) {
    setGuestImportPrompt(defaultGuestImportPrompt);
    return;
  }

  const decision = getGuestImportDecision(user.id);

  if (decision) {
    setGuestImportPrompt(defaultGuestImportPrompt);
    return;
  }

  const guestIngredients = await indexedDb.getAllIngredients({ scope: GUEST_STORAGE_SCOPE });
  setGuestImportPrompt({
    available: guestIngredients.length > 0,
    count: guestIngredients.length,
    loading: false
  });
}

export async function importGuestIngredientsForUser({
  backendEnabled,
  user,
  setGuestImportPrompt,
  setError,
  defaultGuestImportPrompt
}) {
  if (!backendEnabled || !user?.id) {
    throw createUnavailableAuthError();
  }

  setGuestImportPrompt((current) => ({
    ...current,
    loading: true
  }));
  setError('');

  try {
    const guestIngredients = await indexedDb.getAllIngredients({ scope: GUEST_STORAGE_SCOPE });

    if (!guestIngredients.length) {
      setGuestImportDecision(user.id, 'imported');
      setGuestImportPrompt(defaultGuestImportPrompt);
      return [];
    }

    const importedIngredients = guestIngredients.map(({ lastSyncedAt, syncState, ...ingredient }) => ingredient);

    await indexedDb.replaceIngredients(importedIngredients, { scope: buildUserStorageScope(user.id) });

    setGuestImportDecision(user.id, 'imported');
    setGuestImportPrompt(defaultGuestImportPrompt);
    return importedIngredients;
  } catch (nextError) {
    setError(nextError.message || 'Guest ingredients could not be imported.');
    throw nextError;
  } finally {
    setGuestImportPrompt((current) => ({
      ...current,
      loading: false
    }));
  }
}

export function dismissGuestImportPrompt({ user, setGuestImportPrompt, defaultGuestImportPrompt }) {
  if (!user?.id) {
    return;
  }

  setGuestImportDecision(user.id, 'dismissed');
  setGuestImportPrompt(defaultGuestImportPrompt);
}
