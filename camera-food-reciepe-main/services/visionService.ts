const VISION_ENDPOINT = process.env.VISION_API_URL as string | undefined;
const VISION_API_KEY = process.env.VISION_API_KEY as string | undefined;

interface VisionResponse {
  ingredients?: string[];
}

export async function analyzeIngredientsFromImage(image: Blob): Promise<string[]> {
  if (!VISION_ENDPOINT) {
    throw new Error('error_vision_api_url');
  }

  const formData = new FormData();
  formData.append('file', image, 'fridge.jpg');

  const headers: Record<string, string> = {};
  if (VISION_API_KEY) {
    headers.Authorization = `Bearer ${VISION_API_KEY}`;
  }

  const response = await fetch(VISION_ENDPOINT, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    throw new Error('error_vision_fetch');
  }

  const data = (await response.json()) as VisionResponse;
  const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];

  return ingredients.map(ingredient => ingredient.trim()).filter(Boolean);
}
