export interface RecipeProviderLinkSuccess {
  provider: string;
  status: 'success';
  title: string;
  url: string;
}

export interface RecipeProviderLinkError {
  provider: string;
  status: 'error';
  message?: string;
}

export type RecipeProviderLinkResult = RecipeProviderLinkSuccess | RecipeProviderLinkError;

type ProviderFetcher = (
  recipeName: string,
  ingredients: string[],
  signal?: AbortSignal
) => Promise<RecipeProviderLinkResult>;

interface RecipeProviderDefinition {
  name: string;
  fetchLink: ProviderFetcher;
}

const curatedRecipes: Array<{
  matches: string[];
  title: string;
  url: string;
}> = [
  {
    matches: ['김치찌개', 'kimchi'],
    title: '백종원 김치찌개 레시피',
    url: 'https://www.10000recipe.com/recipe/6893793',
  },
  {
    matches: ['된장찌개', 'soybean paste stew', 'doenjang'],
    title: '전통 된장찌개 황금레시피',
    url: 'https://www.10000recipe.com/recipe/6864809',
  },
  {
    matches: ['bulgogi', '불고기'],
    title: '소불고기 양념 비법',
    url: 'https://www.10000recipe.com/recipe/6901913',
  },
];

const curatedProvider: RecipeProviderDefinition = {
  name: '에디터 추천',
  fetchLink: async (recipeName, ingredients) => {
    const normalizedName = recipeName.trim().toLowerCase();
    const normalizedIngredients = ingredients.map(ingredient => ingredient.trim().toLowerCase());

    const match = curatedRecipes.find(entry => {
      return entry.matches.some(keyword => {
        const normalizedKeyword = keyword.toLowerCase();
        return (
          normalizedName.includes(normalizedKeyword) ||
          normalizedIngredients.some(ingredient => ingredient.includes(normalizedKeyword))
        );
      });
    });

    if (!match) {
      return {
        provider: curatedProvider.name,
        status: 'error',
        message: '등록된 링크가 아직 없어요.',
      };
    }

    return {
      provider: curatedProvider.name,
      status: 'success',
      title: match.title,
      url: match.url,
    };
  },
};

const themealDbProvider: RecipeProviderDefinition = {
  name: 'TheMealDB',
  fetchLink: async (recipeName, ingredients, signal) => {
    const query = recipeName.trim() || ingredients[0] || '';
    if (!query) {
      return {
        provider: themealDbProvider.name,
        status: 'error',
        message: '검색할 키워드가 부족해요.',
      };
    }

    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error('TheMealDB 응답이 올바르지 않아요.');
    }

    const data = (await response.json()) as {
      meals?: Array<{
        strMeal: string;
        strSource?: string | null;
        strYoutube?: string | null;
      }>;
    };

    if (!data.meals || data.meals.length === 0) {
      return {
        provider: themealDbProvider.name,
        status: 'error',
        message: '일치하는 레시피를 찾지 못했어요.',
      };
    }

    const [meal] = data.meals;
    const candidateUrl = meal.strSource?.trim() || meal.strYoutube?.trim();

    if (!candidateUrl) {
      return {
        provider: themealDbProvider.name,
        status: 'error',
        message: '응답에 링크 정보가 없어요.',
      };
    }

    return {
      provider: themealDbProvider.name,
      status: 'success',
      title: meal.strMeal,
      url: candidateUrl,
    };
  },
};

const spoonacularProvider: RecipeProviderDefinition = {
  name: 'Spoonacular',
  fetchLink: async (recipeName, ingredients, signal) => {
    const apiKey = import.meta.env.VITE_SPOONACULAR_API_KEY;

    if (!apiKey) {
      return {
        provider: spoonacularProvider.name,
        status: 'error',
        message: 'VITE_SPOONACULAR_API_KEY를 설정해주세요.',
      };
    }

    const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
    url.searchParams.set('query', recipeName);
    url.searchParams.set('number', '1');
    url.searchParams.set('addRecipeInformation', 'true');

    if (ingredients.length > 0) {
      url.searchParams.set(
        'includeIngredients',
        ingredients
          .map(ingredient => ingredient.trim())
          .filter(Boolean)
          .slice(0, 5)
          .join(',')
      );
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error('Spoonacular API 호출에 실패했어요.');
    }

    const data = (await response.json()) as {
      results?: Array<{
        title: string;
        sourceUrl?: string;
        spoonacularSourceUrl?: string;
      }>;
    };

    const recipe = data.results?.[0];

    if (!recipe) {
      return {
        provider: spoonacularProvider.name,
        status: 'error',
        message: '일치하는 레시피가 없어요.',
      };
    }

    const link = recipe.sourceUrl || recipe.spoonacularSourceUrl;

    if (!link) {
      return {
        provider: spoonacularProvider.name,
        status: 'error',
        message: '제공된 링크가 없어요.',
      };
    }

    return {
      provider: spoonacularProvider.name,
      status: 'success',
      title: recipe.title,
      url: link,
    };
  },
};

const recipeProviders: RecipeProviderDefinition[] = [curatedProvider, themealDbProvider, spoonacularProvider];

export const recipeProviderNames = recipeProviders.map(provider => provider.name);

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (
    // DOMException in browsers
    ('name' in error && (error as { name?: string }).name === 'AbortError') ||
    // DOMException polyfill
    Object.prototype.toString.call(error) === '[object DOMException]' &&
      'code' in error &&
      (error as { code?: number }).code === 20
  );
};

export const fetchRecipeLinks = async (
  recipeName: string,
  ingredients: string[],
  signal?: AbortSignal
): Promise<RecipeProviderLinkResult[]> => {
  const lookups = recipeProviders.map(async provider => {
    try {
      return await provider.fetchLink(recipeName, ingredients, signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      return {
        provider: provider.name,
        status: 'error',
        message:
          error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.',
      } satisfies RecipeProviderLinkError;
    }
  });

  return Promise.all(lookups);
};
