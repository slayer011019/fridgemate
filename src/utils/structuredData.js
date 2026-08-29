import { SITE_ORIGIN } from './routeMetadata.js';
import { getRecipeIngredientLines } from '../features/recipes/publicRecipeCatalog.js';

const SITE_NAME = '오늘뭐먹지';
const SITE_ALTERNATE_NAMES = Object.freeze(['오늘 뭐 먹지', 'FridgeMate']);
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

function websiteReference() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${SITE_ORIGIN}/`
  };
}

function webPageSchema(pathname, metadata, type = 'WebPage') {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: metadata.title,
    description: metadata.description,
    url: metadata.canonical,
    inLanguage: 'ko-KR',
    isPartOf: websiteReference(),
    ...(pathname === '/privacy' ? { dateModified: '2026-08-22' } : {})
  };
}

export function getRouteStructuredData(pathname, metadata) {
  if (!metadata?.indexable) {
    return [];
  }

  if (pathname === '/') {
    return [
      {
        '@context': 'https://schema.org',
        ...websiteReference(),
        inLanguage: 'ko-KR',
        description: metadata.description
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        url: metadata.canonical,
        inLanguage: 'ko-KR',
        description: metadata.description
      }
    ];
  }

  if (metadata.recipe) {
    const recipe = metadata.recipe;
    const images = [recipe.imageLargeUrl, recipe.imageSmallUrl].filter(Boolean);
    const nutrition = {
      '@type': 'NutritionInformation',
      ...(recipe.nutrition.calories == null ? {} : { calories: `${recipe.nutrition.calories} kcal` }),
      ...(recipe.nutrition.carbohydrate == null
        ? {}
        : { carbohydrateContent: `${recipe.nutrition.carbohydrate} g` }),
      ...(recipe.nutrition.protein == null ? {} : { proteinContent: `${recipe.nutrition.protein} g` }),
      ...(recipe.nutrition.fat == null ? {} : { fatContent: `${recipe.nutrition.fat} g` }),
      ...(recipe.nutrition.sodium == null ? {} : { sodiumContent: `${recipe.nutrition.sodium} mg` })
    };

    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.name,
        description: metadata.description,
        url: metadata.canonical,
        mainEntityOfPage: metadata.canonical,
        isPartOf: websiteReference(),
        inLanguage: 'ko-KR',
        image: images,
        recipeCategory: recipe.dishType || undefined,
        cookingMethod: recipe.cookingMethod || undefined,
        keywords: recipe.hashTags?.join(', ') || undefined,
        recipeIngredient: getRecipeIngredientLines(recipe),
        recipeInstructions: recipe.steps.map((step) => ({
          '@type': 'HowToStep',
          position: step.order,
          name: `${step.order}단계`,
          text: step.text,
          ...(step.imageUrl ? { image: step.imageUrl } : {})
        })),
        nutrition,
        ...(recipe.servingWeight ? { recipeYield: recipe.servingWeight } : {}),
        author: {
          '@type': 'Organization',
          name: '식품의약품안전처',
          url: 'https://www.mfds.go.kr/'
        },
        isBasedOn: recipe.sourceUrl
      }
    ];
  }

  const schemaTypes = {
    '/recipes': 'CollectionPage',
    '/about': 'AboutPage',
    '/contact': 'ContactPage',
    '/privacy': 'WebPage'
  };

  return [webPageSchema(pathname, metadata, schemaTypes[pathname] || 'WebPage')];
}
