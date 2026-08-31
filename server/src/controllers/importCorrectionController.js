import {
  getImportCorrectionSuggestions,
  saveImportCorrectionsForUser
} from '../services/importCorrectionService.js';
import { createHttpError } from '../lib/httpError.js';
import {
  EXTERNAL_AI_ACTIONS,
  normalizeExternalAiRequestSignal
} from '../lib/externalAiPrivacy.js';

const REQUEST_FIELDS = new Set(['items', 'externalAi']);

function normalizeRequestBody(body, expectedAction) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'Import correction request must be an object.');
  }
  if (Object.keys(body).some((field) => !REQUEST_FIELDS.has(field))) {
    throw createHttpError(400, 'Import correction request contains unsupported fields.');
  }

  return {
    items: body.items,
    externalAi: normalizeExternalAiRequestSignal(body.externalAi, expectedAction)
  };
}

export async function getImportCorrectionSuggestionsHandler(request, response, next) {
  try {
    const { items, externalAi } = normalizeRequestBody(
      request.body,
      EXTERNAL_AI_ACTIONS.importCorrectionSuggestions
    );
    const suggestions = await getImportCorrectionSuggestions(request.auth.userId, items, {
      externalAi
    });
    response.json({ suggestions });
  } catch (error) {
    next(error);
  }
}

export async function saveImportCorrectionsHandler(request, response, next) {
  try {
    const { items, externalAi } = normalizeRequestBody(
      request.body,
      EXTERNAL_AI_ACTIONS.importCorrectionEmbedding
    );
    const result = await saveImportCorrectionsForUser(request.auth.userId, items, {
      externalAi
    });
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
