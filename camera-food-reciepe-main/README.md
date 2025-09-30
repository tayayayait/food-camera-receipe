diff --git a/camera-food-reciepe-main/README.md b/camera-food-reciepe-main/README.md
index a4812bcc3d031391576f28ff39962d87816fa3b5..34646da0c8082de1c89b719a08de0b4d642d0793 100644
--- a/camera-food-reciepe-main/README.md
+++ b/camera-food-reciepe-main/README.md
@@ -1,20 +1,23 @@
 <div align="center">
 <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
 </div>
 
 # Run and deploy your AI Studio app
 
 This contains everything you need to run your app locally.
 
 View your app in AI Studio: https://ai.studio/apps/drive/1iNDCanOspkZrC13tqzikF_uY2Ridlbou
 
 ## Run Locally
 
 **Prerequisites:**  Node.js
 
 
1. Install dependencies:
   `npm install`
2. Set the following environment variables in [.env.local](.env.local):
   - `GEMINI_API_KEY` for your Gemini access token. This key powers both text recipes and the built-in vision fallback.
   - `GEMINI_IMAGE_MODEL` (optional) to override the Gemini image model used for AI thumbnails. Defaults to `imagen-3.0-generate-002`; set to `gemini-2.5-flash-image-preview` if your project has access to the preview-only model.
   - `YOUTUBE_API_KEY` for fetching complementary cooking videos via the YouTube Data API.
   - `VISION_API_URL` (optional) pointing to the HTTPS endpoint of your custom image analysis service.
   - `VISION_API_KEY` (optional) if your service requires bearer-token authentication.
   - `VITE_SPOONACULAR_API_KEY` (optional) for direct recipe matches from the Spoonacular API. Without this key the app will fall back to other providers.
   - If you do not provide a `VISION_API_URL`, the app will automatically analyze photos with Gemini 1.5 Flash using the `GEMINI_API_KEY`.
3. Run the app:
   `npm run dev`

### Recipe link providers

- **에디터 추천**: Uses a curated mapping of popular Korean recipes to provide fast, high-confidence links.
- **TheMealDB**: Fetches free recipe metadata via the public [TheMealDB](https://www.themealdb.com/api.php) API. No key is required.
- **Spoonacular** *(optional)*: When `VITE_SPOONACULAR_API_KEY` is supplied, the modal validates a direct source URL using Spoonacular's `complexSearch` endpoint. Set this key in `.env.local` if you want richer, English-language results.

### Gemini image previews

- Gemini-powered moodboards, recipe hero shots, and journal thumbnails require a Gemini API key that can generate images. If Gemini returns a 403/404 or another model-access error, the app automatically retries with the alternate model (`imagen-3.0-generate-002` or `gemini-2.5-flash-image-preview`) once before showing a static placeholder and marking the preview as unsupported.
- Deployers who want to continue using the legacy preview model should explicitly set `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview`. Otherwise, the app defaults to the broadly available `imagen-3.0-generate-002` model.
