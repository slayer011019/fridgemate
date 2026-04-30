export const recipeSeasoningPresets = Object.freeze({
  gochujang_base: [
    '\uACE0\uCD94\uC7A5',
    '\uACE0\uCD94\uAC00\uB8E8',
    '\uC9C4\uAC04\uC7A5',
    '\uB2E4\uC9C4 \uB9C8\uB298',
    '\uC124\uD0D5'
  ],
  soy_base: ['\uC9C4\uAC04\uC7A5', '\uB2E4\uC9C4 \uB9C8\uB298', '\uC124\uD0D5', '\uCC38\uAE30\uB984'],
  spicy_soup_base: ['\uACE0\uCD94\uAC00\uB8E8', '\uB2E4\uC9C4 \uB9C8\uB298', '\uAD6D\uAC04\uC7A5'],
  doenjang_base: ['\uB41C\uC7A5', '\uB2E4\uC9C4 \uB9C8\uB298'],
  seasoned_veggie_base: ['\uC18C\uAE08', '\uCC38\uAE30\uB984', '\uCC38\uAE68'],
  vinegar_sweet_spicy_base: ['\uC2DD\uCD08', '\uC124\uD0D5', '\uACE0\uCD94\uAC00\uB8E8']
});

export function resolveSeasoningPreset(presetId) {
  if (!presetId) {
    return [];
  }

  return recipeSeasoningPresets[presetId] || [];
}
