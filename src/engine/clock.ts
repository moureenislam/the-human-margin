// One pausable game clock. Esc pauses it, which freezes every minigame timer.
import type { Clock } from '../minigames/types';

class GameClock implements Clock {
  private pausedAt: number | null = null;
  private pausedTotal = 0;

  now(): number {
    const t = this.pausedAt ?? performance.now();
    return t - this.pausedTotal;
  }
  get paused() {
    return this.pausedAt !== null;
  }
  pause() {
    if (this.pausedAt === null) this.pausedAt = performance.now();
    document.body.classList.add('paused');
  }
  resume() {
    if (this.pausedAt !== null) {
      this.pausedTotal += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
    document.body.classList.remove('paused');
  }
}

export const clock = new GameClock();

/** rAF loop that reports unpaused elapsed ms. Returns a stop function. */
export function frameLoop(cb: (dt: number) => void): () => void {
  let last = clock.now();
  let running = true;
  const tick = () => {
    if (!running) return;
    const now = clock.now();
    const dt = now - last;
    last = now;
    if (!clock.paused && dt > 0) cb(Math.min(dt, 100));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    running = false;
  };
}
