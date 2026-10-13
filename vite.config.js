import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// One Vite project, many entry pages: the hub at / and each game under /games/<name>/.
// Add a new game by creating games/<name>/index.html and listing it here.
const page = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        hub: page('index.html'),
        notFound: page('404.html'),
        'gate-rush': page('games/gate-rush/index.html'),
        'treble-maker': page('games/treble-maker/index.html'),
      },
    },
  },
  server: {
    host: true,
  },
});
