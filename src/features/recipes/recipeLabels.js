export const RECIPE_CATEGORY_LABELS = Object.freeze({
  stir_fry: '\uBCF6\uC74C',
  jjigae: '\uCC0C\uAC1C',
  soup_tang: '\uAD6D/\uD0D5',
  jorim: '\uC870\uB9BC',
  muchim_namul: '\uBB34\uCE68/\uB098\uBB3C',
  rice: '\uBC25 \uC694\uB9AC',
  jeon: '\uC804',
  grill: '\uAD6C\uC774',
  steam_braise: '\uCC1C',
  noodle: '\uBA74 \uC694\uB9AC'
});

export const RECIPE_DIFFICULTY_LABELS = Object.freeze({
  1: '\uC26C\uC6C0',
  2: '\uBCF4\uD1B5',
  3: '\uC5B4\uB824\uC6C0'
});

export function getRecipeCategoryLabel(categoryCode) {
  return RECIPE_CATEGORY_LABELS[categoryCode] || categoryCode || '\uAE30\uD0C0';
}

export function getRecipeDifficultyLabel(level) {
  return RECIPE_DIFFICULTY_LABELS[level] || '\uBCF4\uD1B5';
}

export function formatCookTimeLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '\uC2DC\uAC04 \uBBF8\uC815';
  }

  return `${minutes}\uBD84`;
}
