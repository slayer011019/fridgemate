// src/utils/importGuesser.js

const CATEGORY_RULES = [
  { keywords: ["두부", "계란", "달걀", "우유", "치즈", "요거트", "버터"], category: "dairy/eggs" },
  { keywords: ["부추", "감자", "백오이", "오이", "양파", "당근", "대파", "버섯", "느타리", "새송이"], category: "vegetables" },
  { keywords: ["크래미", "어묵", "햄", "베이컨", "닭", "돼지", "소고기"], category: "meat" },
  { keywords: ["주스", "콜라", "사이다", "탄산수", "생수"], category: "drinks" },
  { keywords: ["케찹", "케첩", "마요네즈", "간장", "고추장", "된장", "소스"], category: "sauces" },
  { keywords: ["만두", "볶음밥", "핫도그", "피자", "냉동"], category: "frozen food" },
  { keywords: ["라면", "컵라면", "햇반", "즉석밥", "스프"], category: "instant food" },
];

const STORAGE_RULES = [
  { keywords: ["두부", "우유", "계란", "달걀", "치즈", "요거트", "부추", "오이", "버섯", "어묵", "크래미"], storageType: "fridge" },
  { keywords: ["만두", "볶음밥", "냉동", "아이스크림"], storageType: "freezer" },
  { keywords: ["라면", "참치캔", "통조림", "과자", "소스", "즉석밥"], storageType: "pantry" },
];

function guessByRules(name, rules, key) {
  const target = name.toLowerCase();

  for (const rule of rules) {
    const matched = rule.keywords.some((keyword) =>
      target.includes(keyword.toLowerCase())
    );
    if (matched) return rule[key];
  }

  return "";
}

export function guessCategory(name) {
  return guessByRules(name, CATEGORY_RULES, "category") || "other";
}

export function guessStorageType(name) {
  return guessByRules(name, STORAGE_RULES, "storageType") || "fridge";
}

export function enrichParsedItems(items) {
  const today = new Date().toISOString().slice(0, 10);

  return items.map((item) => ({
    ...item,
    category: guessCategory(item.name),
    storageType: guessStorageType(item.name),
    purchaseDate: today,
    expiryDate: "",
    memo: `OCR 추출 문장: ${item.rawLine}`,
    consumed: false,
  }));
}