// TODO: CLOVA OCR API 연동 예정
// 참고: https://api.ncloud-docs.com/docs/ai-application-service-ocr
// 인터페이스: { recognize(file, options): Promise<{ text, lineItems }> }
// 현재는 미구현. 연동 시 이 파일을 구현하고 ocrService에 주입한다.

export const clovaOcrProvider = {
  async recognize(_file, _options) {
    throw new Error('CLOVA OCR provider is not yet implemented.');
  }
};
