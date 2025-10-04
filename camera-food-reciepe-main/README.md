<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This repository powers a lightweight video recommendation experience for your fridge camera prototype. The app scans ingredients, suggests relevant cooking videos, and lets you keep short viewing notes.

View your app in AI Studio: https://ai.studio/apps/drive/1iNDCanOspkZrC13tqzikF_uY2Ridlbou

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create [.env.local](.env.local) and add the keys you plan to use:
   - `YOUTUBE_API_KEY` (**required**) to fetch video metadata from the YouTube Data API.
   - `GEMINI_API_KEY` (optional) to generate thumbnail moodboards and other AI imagery used in the journal.
   - `VISION_API_URL` / `VISION_API_KEY` (optional) if you proxy ingredient detection through your own service. When unset the app falls back to Gemini for vision calls.
3. Start the dev server:
   ```bash
   npm run dev
   ```

### Video metadata pipeline

- The UI reads from the YouTube Data API only. Ensure the key above has access to `youtube.readonly` scopes.
- Ingredient detection continues to determine relevance, but the modal now focuses on listing playable videos rather than step-by-step recipes.

### Gemini image previews

- Gemini-powered moodboards and journal thumbnails require an API key with image generation access. If the call fails the UI gracefully marks the preview as unsupported and falls back to a static gradient.

## Deploy

Any Vite-compatible hosting provider works. Build with `npm run build` and serve the `dist` directory.
