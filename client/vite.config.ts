import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_TARGET = process.env.SERVER_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy the JSON API + public renders + template static assets to the
    // Express server. Lets the React dev server stay on a separate port without
    // CORS hassle.
    proxy: {
      '/api': SERVER_TARGET,
      '/c': SERVER_TARGET,
      '/generic': SERVER_TARGET,
      '/templates': SERVER_TARGET,
      '/healthz': SERVER_TARGET,
    },
  },
});
