# Vision Service Fallback Verification

## Environment
- Development server started with `npm run dev -- --host 0.0.0.0 --port 4173`
- `.env.local` populated with:
  - `GEMINI_API_KEY`
  - `VISION_API_URL`
  - `VISION_API_KEY`

## Procedure
1. Launched the Vite dev server.
2. Used Playwright to open the local app and intercept network calls.
3. Forced the external vision endpoint (`VISION_API_URL`) to return an HTTP 500 response.
4. Verified that `analyzeIngredientsFromImage` retried with Gemini by observing the subsequent request to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`.
5. Confirmed the fallback response still produced ingredient tags, allowing the video modal to populate relevant recommendations.

## Result
- External service failure correctly triggers a warning and falls back to Gemini.
- The Gemini response continues to power video suggestions without surfacing `error_vision_fetch` in the UI.
