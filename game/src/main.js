// Port Meridian: Neon Tide — boot, screen state machine and the frame loop.
// ?shot=cover|car|chase|result poses the real game for deterministic screenshots;
// ?seed=<n> reseeds the city (default 1337); ?storm=1 force-opens a Storm Surge on the
// harbor at boot (handy for previewing the surge mechanic and for screenshots).
import { WORLD, STEP, STORM } from './config.js';
import { createState, update, enterOrExitCar, punch, nearestCar } from './entities.js';
import { createCityLayer } from './city.js';
import { createMinimap, drawFrame } from './render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { loadBest, saveBest } from './save.js';
import { checkTriggers, MISSIONS } from './missions.js';
import { stageShot, SHOTS } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const SEED = Number.parseInt(params.get('seed') ?? '1337', 10) || 1337;
const shotName = params.get('shot');

function resize() {
  canvas.width = Math.max(960, window.innerWidth);
  canvas.height = Math.max(540, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

let best = loadBest();
let state = createState(SEED);
const assets = { cityLayer: createCityLayer(state.city), minimap: null, glow: null };
assets.minimap = createMinimap(assets.cityLayer);
const input = new Input(canvas);
const audio = new AudioSys();
const shotMode = shotName !== null;
const FORCE_STORM = params.get('storm') === '1';

function forceStorm(s) {
  // pin a fat, slow storm cell right over the harbor approach for previews
  s.storm.active = true;
  s.storm.x = s.player.x + 180;
  s.storm.y = s.player.y - 120;
  s.storm.vx = 12; s.storm.vy = -6;
  s.storm.t = STORM.duration * 10;
  s.storm.nextIn = STORM.interval;
}

if (shotMode) {
  stageShot(state, SHOTS.includes(shotName) ? shotName : 'cover');
  if (FORCE_STORM) forceStorm(state);
  if (shotName === 'result') best = { cash: 2900, missions: MISSIONS.length, complete: true };
} else if (FORCE_STORM) forceStorm(state);

function freshRun(screen) {
  state = createState(SEED);
  state.screen = screen;
  if (FORCE_STORM) forceStorm(state);
  return state;
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - (loop.last ?? now)) / 1000) || STEP;
  loop.last = now;

  if (shotMode) {
    state.time += dt; // shimmer, neon flicker and light bars stay alive; the scene is posed
  } else if (state.screen === 'title') {
    state.time += dt;
    state.camera.x = 1380 + Math.cos(state.time * 0.055) * 560;
    state.camera.y = 920 + Math.sin(state.time * 0.055) * 360;
    if (input.takePressed('Enter') || input.takePressed('MouseClick')) {
      audio.ensure(); audio.uiConfirm();
      freshRun('play');
    }
  } else if (state.screen === 'play') {
    update(state, dt, input, audio);
    if (input.takePressed('KeyE')) enterOrExitCar(state, audio);
    if (input.takePressed('KeyF') || input.takePressed('MouseClick')) punch(state, audio);
    if (input.takePressed('Escape') || input.takePressed('KeyP')) { state.screen = 'paused'; audio.blip(); }
    checkTriggers(state, audio);
    // contextual prompt
    state.prompt = '';
    if (state.player.onFoot) {
      const near = nearestCar(state, state.player.x, state.player.y, 52);
      if (near) state.prompt = 'E — STEAL THE RIDE';
    } else state.prompt = 'E — STEP OUT';
    if (state.wanted > 0) audio.siren(state.wanted);
    if (state.screen === 'gameover') {
      saveBest({ cash: state.stats.earned, missions: state.missions.index, complete: false });
      best = loadBest();
      audio.engineStop(); audio.crash();
    }
  } else if (state.screen === 'paused') {
    state.time += dt;
    if (input.takePressed('Escape') || input.takePressed('KeyP')) state.screen = 'play';
    if (input.takePressed('KeyR')) { audio.engineStop(); freshRun('play'); }
  } else if (state.screen === 'gameover') {
    state.time += dt;
    if (input.takePressed('Enter') || input.takePressed('MouseClick')) { audio.engineStop(); freshRun('play'); }
  } else if (state.screen === 'complete') {
    state.time += dt;
    if (input.takePressed('Enter') || input.takePressed('MouseClick')) { freshRun('title'); best = loadBest(); }
  }

  drawFrame(ctx, state, assets, canvas.width, canvas.height, best);
  // a fresh surge slaps the hull — nudge the camera so the moment reads on screen
  const stormNow = !!(state.storm && state.storm.active);
  if (stormNow !== loop.wasStorm) {
    loop.wasStorm = stormNow;
    if (stormNow) state.shake = Math.max(state.shake, 2.5);
  }
  input.endFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
