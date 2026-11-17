// localStorage persistence: best run (cash, missions cleared, full completion).
import { SAVE_KEY } from './config.js';

export function loadBest() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, missions: 0, complete: false };
    const b = JSON.parse(raw);
    return { cash: b.cash | 0, missions: b.missions | 0, complete: !!b.complete };
  } catch {
    return { cash: 0, missions: 0, complete: false };
  }
}

export function saveBest(run) {
  try {
    const best = loadBest();
    const merged = {
      cash: Math.max(best.cash, run.cash | 0),
      missions: Math.max(best.missions, run.missions | 0),
      complete: best.complete || !!run.complete,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return run;
  }
}
