
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Ensure our build output is optimized for mobile
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // Don't inline assets as base64
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
    rollupOptions: {
      output: {
        // Long-lived vendor chunks so app releases do not invalidate the framework/UI code in browser caches.
        manualChunks(id: string) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor';
          if (id.includes('node_modules/@radix-ui/')) return 'ui';
          return undefined;
        },
      },
    },
  },
}));
