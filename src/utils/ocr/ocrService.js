import { extractTextFromImage } from '../ocr.js';

const tesseractProvider = {
  recognize: extractTextFromImage
};

export async function runOcrWithProvider(file, options = {}, provider = tesseractProvider) {
  return provider.recognize(file, options);
}
