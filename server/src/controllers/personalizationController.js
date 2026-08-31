import {
  getUserPreference,
  listPantryOwnership,
  savePantryOwnership,
  saveUserPreference
} from '../services/personalizationService.js';

export async function listPantryOwnershipHandler(request, response, next) {
  try { response.json(await listPantryOwnership(request.auth.userId)); } catch (error) { next(error); }
}

export async function savePantryOwnershipHandler(request, response, next) {
  try { response.json(await savePantryOwnership(request.auth.userId, request.body)); } catch (error) { next(error); }
}

export async function getUserPreferenceHandler(request, response, next) {
  try { response.json(await getUserPreference(request.auth.userId)); } catch (error) { next(error); }
}

export async function saveUserPreferenceHandler(request, response, next) {
  try { response.json(await saveUserPreference(request.auth.userId, request.body)); } catch (error) { next(error); }
}
