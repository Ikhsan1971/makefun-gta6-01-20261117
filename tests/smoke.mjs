// Headless smoke test of the simulation (no rendering, no browser).
// Run: node tests/smoke.mjs
// Stubs just enough globals for the game modules to import and run in Node.
import assert from 'node:assert/strict';

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { createState, update, enterOrExitCar, punch, nearestCar, damagePlayer } = await import('../game/src/entities.js');
const { checkTriggers, currentMission, MISSIONS, CRATES, GATES } = await import('../game/src/missions.js');

const audio = new Proxy({}, { get: () => () => {} });
const input = { down: () => false };
const STEP = 1 / 60;
const run = (state, seconds, fn) => {
  for (let i = 0; i < seconds * 60; i += 1) { update(state, STEP, input, audio); if (fn) fn(state); }
};

// 1. world builds, city is populated, traffic exists
const s = createState(1337);
assert.ok(s.city.buildings.length > 40, 'city has buildings');
assert.ok(s.cars.length >= 12, 'cars spawned');
assert.equal(s.peds.length, 26, 'peds spawned');
assert.equal(s.screen, 'title');

// 2. player walks and collides with buildings/water without escaping the world
run(s, 3);
assert.ok(s.player.x >= 0 && s.player.x <= 2800 && s.player.y >= 0 && s.player.y <= 2000, 'player inside world');

// 3. steal a car: force one next to the player, press E
const near = nearestCar(s, s.player.x, s.player.y, 9999);
near.x = s.player.x + 20; near.y = s.player.y;
assert.equal(enterOrExitCar(s, audio), true, 'entered car');
assert.equal(s.player.onFoot, false);
assert.ok(s.wanted >= 1, 'theft raised heat');

// 4. exit car again
assert.equal(enterOrExitCar(s, audio), true, 'exited car');
assert.equal(s.player.onFoot, true);

// 5. punch connects and raises heat
punch(s, audio); s.punchCd = 0;
assert.ok(s.player.punchCd > 0, 'punch cooldown set');

// 6. full mission chain: teleport to each marker and trigger
const teleport = (state, x, y) => { state.player.x = x; state.player.y = y; };
// mission 1 stage 0 — pier
teleport(s, 535, 1880); checkTriggers(s, audio);
assert.equal(s.missions.stage, 1, 'm1 stage advanced');
// mission 1 stage 1 — Neon Row
teleport(s, 1300, 470); checkTriggers(s, audio);
assert.equal(s.missions.index, 1, 'm1 complete, m2 active');
assert.equal(s.player.cash, 600, 'm1 reward paid');
// mission 2 — four crates
for (const c of CRATES) { teleport(s, c.x, c.y); checkTriggers(s, audio); }
assert.equal(s.missions.index, 2, 'm2 complete, m3 active');
assert.equal(s.player.cash, 1500, 'm2 reward paid');
// mission 3 — three gates
for (const g of GATES) { teleport(s, g.x, g.y); checkTriggers(s, audio); }
assert.equal(s.missions.index, 3, 'all missions complete');
assert.equal(s.player.cash, 2900, 'm3 reward paid');
assert.equal(s.complete, true, 'campaign flag set');
assert.equal(s.screen, 'complete');
assert.equal(currentMission(s), null, 'no current mission after completion');

// 7. wanted rises and police spawn while heat is up
const s2 = createState(42);
s2.wanted = 3; s2.player.x = 1400; s2.player.y = 800;
run(s2, 12);
assert.ok(s2.cars.some((c) => c.police), 'police responded to wanted level');

// 8. damage to zero triggers game over
const s3 = createState(77);
damagePlayer(s3, 9999, audio);
assert.equal(s3.screen, 'gameover');

// 9. best is persisted to storage
const saved = JSON.parse(localStorage.getItem('port-meridian-neon-tide-best'));
assert.ok(saved.complete === true, 'completion persisted');
assert.ok(saved.cash >= 2900, 'best cash persisted');

console.log('smoke: all checks passed');
