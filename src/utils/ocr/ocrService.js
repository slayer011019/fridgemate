import { extractTextFromImage } from '../ocr.js';
import { validateOcrImageFile } from './imageValidation.js';

const tesseractProvider = {
  recognize: extractTextFromImage
};

export async function runOcrWithProvider(file, options = {}, provider = tesseractProvider) {
  await validateOcrImageFile(file);
  return provider.recognize(file, options);
}
