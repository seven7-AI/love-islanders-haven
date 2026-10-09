import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      // Placeholders so modules that create the Supabase client can be imported; tests never reach the network.
      env: {
        VITE_SUPABASE_URL: 'http://supabase.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_API_URL: 'http://api.test',
      },
    },
  }),
);
