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
-2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
+2. Set the following environment variables in [.env.local](.env.local):
+   - `GEMINI_API_KEY` for your Gemini access token.
+   - `VISION_API_URL` pointing to the HTTPS endpoint of your image analysis service.
+   - `VISION_API_KEY` (optional) if your service requires bearer-token authentication.
 3. Run the app:
    `npm run dev`
