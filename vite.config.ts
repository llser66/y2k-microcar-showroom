import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    watch: { ignored: ['**/round2-preview.png', '**/.codex-browser-profile/**'] },
  },
});
