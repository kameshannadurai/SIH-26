import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/instruments': 'http://127.0.0.1:8000',
      '/applications': 'http://127.0.0.1:8000',
      '/assignments': 'http://127.0.0.1:8000',
      '/verifications': 'http://127.0.0.1:8000',
      '/certificates': 'http://127.0.0.1:8000',
      '/notifications': 'http://127.0.0.1:8000',
      '/enforcement': 'http://127.0.0.1:8000',
      '/public': 'http://127.0.0.1:8000',
      '/admin': 'http://127.0.0.1:8000',
      '/gatc-rules': 'http://127.0.0.1:8000',
      '/complaints': 'http://127.0.0.1:8000',
      '/scheduling': 'http://127.0.0.1:8000',
      '/ai': 'http://127.0.0.1:8000',
      '/storage': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
    },
  },
});
