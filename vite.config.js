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
        forecaster: page('games/forecaster/index.html'),
        'sequence-lab': page('games/sequence-lab/index.html'),
        'tile-logic': page('games/tile-logic/index.html'),
        'symmetry-studio': page('games/symmetry-studio/index.html'),
        'sort-and-stack': page('games/sort-and-stack/index.html'),
        'rhythm-patterns': page('games/rhythm-patterns/index.html'),
        'circuit-paths': page('games/circuit-paths/index.html'),
        'tangram-fit': page('games/tangram-fit/index.html'),
        'pattern-weaver': page('games/pattern-weaver/index.html'),
        'mosaic-numbers': page('games/mosaic-numbers/index.html'),
        'binary-grid': page('games/binary-grid/index.html'),
        'number-chain': page('games/number-chain/index.html'),
        'pairs': page('games/pairs/index.html'),
        'slide-picture': page('games/slide-picture/index.html'),
        'stacks': page('games/stacks/index.html'),
        'light-switch': page('games/light-switch/index.html'),
        'odd-one-out': page('games/odd-one-out/index.html'),
        tuner: page('tools/tuner/index.html'),
      },
    },
  },
  server: {
    host: true,
  },
});
