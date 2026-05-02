import { ApiClientError, requestJson } from './apiClient';

export class ImportCorrectionsApiError extends ApiClientError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ImportCorrectionsApiError';
  }
}

function toCorrectionPayloadItem(item) {
  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    normalizedName: item.normalizedName,
    sourceLine: item.sourceLine,
    rawLine: item.rawLine,
    originalText: item.originalText,
    specText: item.specText,
    quantity: item.quantity,
    category: item.category,
    storageType: item.storageType
  };
}

export function getImportCorrectionSuggestions(items = [], options = {}) {
  return requestJson(
    '/import/corrections/suggestions',
    {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: items.map(toCorrectionPayloadItem)
      })
    },
    { authMode: 'required', errorClass: ImportCorrectionsApiError }
  );
}

export function saveImportCorrectionsRemote(items = []) {
  return requestJson(
    '/import/corrections',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: items.map(toCorrectionPayloadItem)
      })
    },
    { authMode: 'required', errorClass: ImportCorrectionsApiError }
  );
}
