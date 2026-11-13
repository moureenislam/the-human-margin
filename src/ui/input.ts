// Keyboard routing: the most recently opened screen gets keys first.
// A handler returns true when it used the key. Unused Esc opens the pause menu.
type Handler = (e: KeyboardEvent) => boolean | void;

const stack: Handler[] = [];
let escFallback: (() => void) | null = null;

export function pushKeys(h: Handler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Drops every handler above the first `keep` (used when a load or rewind tears the screen down). */
export function resetKeys(keep: number) {
  stack.length = Math.min(stack.length, keep);
}

export function keyDepth() {
  return stack.length;
}

export function onUnhandledEscape(fn: () => void) {
  escFallback = fn;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat && (e.key === 'Escape' || e.key === 'Enter')) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i](e)) {
      e.preventDefault();
      return;
    }
  }
  if (e.key === 'Escape' && escFallback) {
    e.preventDefault();
    escFallback();
  }
});
