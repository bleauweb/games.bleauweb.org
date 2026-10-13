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
        'note-by-note': page('games/note-by-note/index.html'),
        'flute-fingers': page('games/flute-fingers/index.html'),
        'market-day': page('games/market-day/index.html'),
        'bakery-rush': page('games/bakery-rush/index.html'),
        'shipping-lanes': page('games/shipping-lanes/index.html'),
        workshop: page('games/workshop/index.html'),
        capitals: page('games/capitals/index.html'),
        'morse-ear': page('games/morse-ear/index.html'),
        tuner: page('tools/tuner/index.html'),
      },
    },
  },
  server: {
    host: true,
  },
});
