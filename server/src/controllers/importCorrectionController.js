import {
  getImportCorrectionSuggestions,
  saveImportCorrectionsForUser
} from '../services/importCorrectionService.js';

export async function getImportCorrectionSuggestionsHandler(request, response, next) {
  try {
    const items = Array.isArray(request.body?.items) ? request.body.items : [];
    const suggestions = await getImportCorrectionSuggestions(request.auth.userId, items);
    response.json({ suggestions });
  } catch (error) {
    next(error);
  }
}

export async function saveImportCorrectionsHandler(request, response, next) {
  try {
    const items = Array.isArray(request.body?.items) ? request.body.items : [];
    const result = await saveImportCorrectionsForUser(request.auth.userId, items);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
