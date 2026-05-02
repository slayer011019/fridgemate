import { Router } from 'express';
import {
  getImportCorrectionSuggestionsHandler,
  saveImportCorrectionsHandler
} from '../controllers/importCorrectionController.js';

export const importCorrectionRoutes = Router();

importCorrectionRoutes.post('/corrections/suggestions', getImportCorrectionSuggestionsHandler);
importCorrectionRoutes.post('/corrections', saveImportCorrectionsHandler);
