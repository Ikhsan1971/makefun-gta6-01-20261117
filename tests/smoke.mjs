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

// 10. storm surge activates on schedule and registers at its core
const { stormFactor, inStorm, radarSweepDelta } = await import('../game/src/entities.js');
const s4 = createState(99);
assert.equal(s4.storm.active, false, 'storm starts dormant');
s4.storm.nextIn = 0.05;
run(s4, 1);
assert.equal(s4.storm.active, true, 'storm surge activated after its timer');
assert.ok(stormFactor(s4, s4.storm.x, s4.storm.y) > 0.9, 'storm core registers full strength');
assert.equal(inStorm(s4, s4.storm.x + 9999, s4.storm.y), false, 'far away is dry');

// 11. full contract chain ridden inside the surge pays the Storm Tide bonus per marker
const s5 = createState(11);
s5.storm.active = true; s5.storm.t = 999; s5.storm.nextIn = 999;
const surgeTeleport = (state, x, y) => {
  state.player.x = x; state.player.y = y;
  state.storm.x = x; state.storm.y = y; // player rides inside the cell
};
surgeTeleport(s5, 535, 1880); checkTriggers(s5, audio);
surgeTeleport(s5, 1300, 470); checkTriggers(s5, audio);
assert.equal(s5.missions.index, 1, 'm1 complete inside the surge');
assert.equal(s5.player.cash, 600 + 2 * 250, 'm1 rewards + 2 surge bonuses');
for (const c of CRATES) { surgeTeleport(s5, c.x, c.y); checkTriggers(s5, audio); }
assert.equal(s5.missions.index, 2, 'm2 complete inside the surge');
for (const g of GATES) { surgeTeleport(s5, g.x, g.y); checkTriggers(s5, audio); }
assert.equal(s5.missions.index, 3, 'm3 complete inside the surge');
assert.equal(s5.player.cash, 2900 + 9 * 250, 'every marker paid the surge bonus');
assert.equal(s5.stats.surge, 9, 'surge bonuses counted');

// 12. a surge parked far away pays nothing — the cell pays, not the calendar
const s6 = createState(12);
s6.storm.active = true; s6.storm.t = 999; s6.storm.x = 100; s6.storm.y = 100; // far from markers
const teleportFar = (state, x, y) => { state.player.x = x; state.player.y = y; };
teleportFar(s6, 535, 1880); checkTriggers(s6, audio);
teleportFar(s6, 1300, 470); checkTriggers(s6, audio);
assert.equal(s6.player.cash, 600, 'no surge bonus outside the cell');
assert.equal(s6.stats.surge, 0, 'surge counter stays zero');

// 13. harbor radar ping: a hot player inside the beam loses evasion progress
const s7 = createState(5);
s7.wanted = 2;
const tower = s7.city.radarTower;
assert.ok(tower, 'radar tower exists in the city');
s7.player.x = tower.x; s7.player.y = tower.y - 120; // inside RADAR.range
s7.radarAngle = Math.atan2(s7.player.y - tower.y, s7.player.x - tower.x); // beam dead on
s7.evadeT = 2.5; s7.pingCd = 0;
assert.ok(radarSweepDelta(s7, s7.player.x, s7.player.y) < 0.01, 'beam aligned with player');
run(s7, 0.2);
assert.ok(s7.pingCd > 0, 'radar ping registered and put on cooldown');
assert.ok(s7.evadeT < 0.5, 'radar ping wiped evasion progress');

// 14. the surge swallows the search: heat fades faster inside the cell
const s8 = createState(21);
s8.wanted = 2;
s8.storm.active = true; s8.storm.t = 999;
s8.player.x = 1400; s8.player.y = 800;
s8.storm.x = s8.player.x; s8.storm.y = s8.player.y;
// no police anywhere near; evade timer should outrun the dry case
run(s8, 1.0);
assert.ok(s8.evadeT > 1.5, 'evasion accrues at boosted rate inside the surge');

console.log('smoke: all checks passed');
