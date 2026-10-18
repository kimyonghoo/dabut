// Tiny global store for the top progress bar. Anything (link clicks, form
// submits, programmatic navigation) can start/finish it.
type Listener = (active: boolean) => void;

let pending = 0;
const listeners = new Set<Listener>();

function emit() {
  const active = pending > 0;
  listeners.forEach((l) => l(active));
}

export function startProgress() {
  pending += 1;
  emit();
}

export function doneProgress() {
  pending = Math.max(0, pending - 1);
  emit();
}

/** Force-finish everything (e.g. once a navigation has landed). */
export function resetProgress() {
  pending = 0;
  emit();
}

export function subscribeProgress(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
