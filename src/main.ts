import '@fontsource/pixelify-sans/400.css';
import '@fontsource/silkscreen/400.css';
import './styles.css';
import './ui/ui.css';
import { setupStage } from './ui/stage';
import { preloadAll } from './ui/assets';
import { audio } from './engine/audio';
import { Game } from './engine/story';

const refs = setupStage();
window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
window.addEventListener('keydown', () => audio.unlock());

const game = new Game(refs);
(window as any).__game = game; // for browser tests

// Fonts first so the dialogue box measures text correctly; art loads (or falls back) in parallel.
Promise.all([document.fonts?.ready ?? Promise.resolve(), preloadAll()]).then(() => game.title());
