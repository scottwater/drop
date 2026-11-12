import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The OAuth provider imports WorkerEntrypoint only for an instanceof check.
      'cloudflare:workers': fileURLToPath(new URL('./tests/stubs/cloudflare-workers.js', import.meta.url)),
    },
  },
  test: {
    // Run the provider through Vite so the alias above applies to it.
    server: { deps: { inline: ['@cloudflare/workers-oauth-provider'] } },
  },
});
