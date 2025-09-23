diff --git a/camera-food-reciepe-main/vite.config.ts b/camera-food-reciepe-main/vite.config.ts
index dbb013cab2daa90aad4ec07e57275e53f2dcab94..0eb8cebc4c9a44cc938438637ac08cc44d636553 100644
--- a/camera-food-reciepe-main/vite.config.ts
+++ b/camera-food-reciepe-main/vite.config.ts
@@ -1,19 +1,21 @@
 import path from 'path';
 import { defineConfig, loadEnv } from 'vite';
 import react from '@vitejs/plugin-react';
 
 export default defineConfig(({ mode }) => {
     const env = loadEnv(mode, '.', '');
     return {
       plugins: [react()],
       define: {
         'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
-        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
+        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
+        'process.env.VISION_API_URL': JSON.stringify(env.VISION_API_URL),
+        'process.env.VISION_API_KEY': JSON.stringify(env.VISION_API_KEY),
       },
       resolve: {
         alias: {
           '@': path.resolve(__dirname, '.'),
         }
       }
     };
 });
