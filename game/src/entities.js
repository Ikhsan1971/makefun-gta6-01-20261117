// Simulation: the player (on foot / driving), traffic, pedestrians, police response and crime heat.
import { WORLD, WATER_Y, ROAD_XS, ROAD_YS, STEP, PLAYER_FOOT_SPEED, CAR_MAX_SPEED,
  CAR_ACCEL, CAR_BRAKE, CAR_REVERSE, CAR_TURN, HEALTH_MAX, WANTED_MAX, NEON,
  STORM, RADAR } from './config.js';
import { createRandom, pick } from './random.js';
import { buildCity, resolveCollision, pointInBuilding } from './city.js';

const CAR_COLORS = ['#3b4a6b', '#5b2f4f', '#274d3d', '#5d4a1e', '#2f2f38', '#402a2a', '#1f3a4a'];
const KIND_STATS = {
  sedan: { max: 330, accel: 250, turn: 2.7 },
  coupe: { max: 360, accel: 290, turn: 2.9 },
  sports: { max: 415, accel: 345, turn: 3.2 },
  truck: { max: 285, accel: 200, turn: 2.2 },
};

export function createState(seed = 1337) {
  const rng = createRandom(seed);
  const city = buildCity(seed);
  const state = {
    rng, city, seed,
    time: 0, screen: 'title', shot: null,
    player: { x: city.spawn.x, y: city.spawn.y, angle: 0.6, health: HEALTH_MAX, cash: 0, onFoot: true, carId: -1, punchCd: 0, hurtCd: 0, hurtFlash: 0 },
    cars: [], peds: [],
    wanted: 0, evadeT: 0, spawnT: 0, decayMsg: '',
    storm: { active: false, x: WORLD.w * 0.5, y: WATER_Y + 80, vx: 0, vy: -STORM.speed, t: 0, nextIn: STORM.interval * 0.6 },
    radarAngle: 0, pingCd: 0,
    missions: { index: 0, stage: 0, taken: [] },
    banner: null, // {text, sub, timer}
    stats: { earned: 0, crimes: 0, takenCars: 0, surge: 0 },
    camera: { x: city.spawn.x, y: city.spawn.y },
    shake: 0, message: '', msgT: 0,
    complete: false,
  };
  // parked cars sprinkled along roadsides
  let id = 0;
  for (let i = 0; i < 16; i += 1) {
    const vertical = rng() < 0.5;
    const rx = pick(rng, ROAD_XS), ry = pick(rng, ROAD_YS);
    const off = (rng() - 0.5) * 40;
    const x = vertical ? rx + (rng() < 0.5 ? -1 : 1) * 22 : off + rx * 0 + (rng() * WORLD.w);
    const y = vertical ? off + rng() * WATER_Y : ry + (rng() < 0.5 ? -1 : 1) * 22;
    spawnCar(state, vertical ? 'sedan' : pick(rng, ['sedan', 'coupe', 'sports', 'truck']), x, y, vertical ? Math.PI / 2 : 0, 'parked');
    id += 1;
  }
  // moving traffic
  for (let i = 0; i < 12; i += 1) spawnTrafficCar(state);
  // pedestrians on the sidewalks
  for (let i = 0; i < 26; i += 1) {
    let x = rng() * WORLD.w, y = rng() * (WATER_Y - 60);
    for (let t = 0; t < 30 && pointInBuilding(city, x, y); t += 1) { x = rng() * WORLD.w; y = rng() * (WATER_Y - 60); }
    state.peds.push({ x, y, angle: rng() * Math.PI * 2, speed: 0, down: 0, hue: pick(rng, NEON), wanderT: rng() * 3 });
  }
  return state;
}

export function spawnCar(state, kind, x, y, angle, driver) {
  const car = {
    id: state.cars.length ? Math.max(...state.cars.map((c) => c.id)) + 1 : 0,
    kind, x, y, angle, speed: 0, driver,
    color: pick(state.rng, CAR_COLORS),
    police: false, wreck: 0, decisionT: state.rng() * 2 + 1,
  };
  state.cars.push(car);
  return car;
}

export function spawnTrafficCar(state) {
  const vertical = state.rng() < 0.5;
  const rx = pick(state.rng, ROAD_XS), ry = pick(state.rng, ROAD_YS);
  const dir = state.rng() < 0.5 ? 0 : Math.PI;
  const car = spawnCar(
    state, pick(state.rng, ['sedan', 'coupe', 'truck']),
    vertical ? rx + (state.rng() < 0.5 ? -16 : 16) : state.rng() * WORLD.w,
    vertical ? state.rng() * WATER_Y : ry + (state.rng() < 0.5 ? -16 : 16),
    vertical ? (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : dir,
    'traffic',
  );
  car.speed = 130 + state.rng() * 60;
}

export function spawnPoliceAt(state, x, y, angle) {
  const car = spawnCar(state, 'coupe', x, y, angle, 'police');
  car.police = true; car.color = '#e8ecf8'; car.speed = 200; car.wreck = 0;
  return car;
}

function spawnPolice(state) {
  const edges = [
    { x: 200, y: 60 }, { x: WORLD.w - 200, y: 60 }, { x: 200, y: WATER_Y - 120 },
    { x: WORLD.w - 200, y: WATER_Y - 120 }, { x: 60, y: 820 }, { x: WORLD.w - 60, y: 820 },
  ];
  const edge = pick(state.rng, edges);
  const car = spawnCar(state, 'coupe', edge.x, edge.y, Math.atan2(state.player.y - edge.y, state.player.x - edge.x), 'police');
  car.police = true; car.color = '#e8ecf8'; car.speed = 120; car.wreck = 0;
  state.message = 'Police despatched to your position'; state.msgT = 2.5;
}

export function addWanted(state, n) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED_MAX, state.wanted + n);
  if (state.wanted > before) { state.stats.crimes += 1; state.evadeT = 0; }
}

/** 0 outside the storm cell, ramps to 1 at its core. */
export function stormFactor(state, x, y) {
  if (!state.storm || !state.storm.active) return 0;
  const d = Math.hypot(x - state.storm.x, y - state.storm.y);
  if (d >= STORM.radius) return 0;
  return 1 - d / STORM.radius;
}

export function inStorm(state, x, y) { return stormFactor(state, x, y) > 0; }

/** Angular distance between the radar sweep and the bearing to (x, y) from the tower. */
export function radarSweepDelta(state, x, y) {
  const tower = state.city.radarTower ?? { x: 1275, y: WATER_Y + 165 };
  const bearing = Math.atan2(y - tower.y, x - tower.x);
  let diff = state.radarAngle - bearing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

export function nearestCar(state, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterOrExitCar(state, audio) {
  const p = state.player;
  if (p.onFoot) {
    const car = nearestCar(state, p.x, p.y, 52);
    if (!car) return false;
    p.onFoot = false; p.carId = car.id; car.driver = 'player';
    addWanted(state, car.stolen ? 0 : 1);
    car.stolen = true; state.stats.takenCars += 1;
    state.message = 'Grand theft auto — the port noticed'; state.msgT = 2.2;
    audio.engineStart();
    return true;
  }
  const car = state.cars.find((c) => c.id === p.carId);
  p.onFoot = true; p.carId = -1;
  if (car) {
    car.driver = 'parked'; car.speed *= 0.2;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    const fixed = resolveCollision(state.city, p.x, p.y, 12); p.x = fixed.x; p.y = fixed.y;
    audio.engineStop();
  }
  return true;
}

export function punch(state, audio) {
  const p = state.player;
  if (p.punchCd > 0 || !p.onFoot) return;
  p.punchCd = 0.42;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < 48) { ped.down = 4; ped.speed = 0; hit = true; }
  }
  if (hit) { addWanted(state, 1); state.shake = Math.max(state.shake, 3); }
  audio.punch(hit);
}

function steerToward(car, tx, ty, rate, dt) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = rate * dt;
  car.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
}

export function update(state, dt, input, audio) {
  state.time += dt;
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt); p.hurtCd = Math.max(0, p.hurtCd - dt); p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  if (state.banner) { state.banner.timer -= dt; if (state.banner.timer <= 0) state.banner = null; }
  if (state.msgT > 0) state.msgT -= dt;
  state.shake = Math.max(0, state.shake - dt * 6);

  if (p.onFoot) updateOnFoot(state, dt, input, audio);
  else updateDriving(state, dt, input, audio);

  updateTraffic(state, dt, audio);
  updatePeds(state, dt);
  updatePolice(state, dt, audio);
  updateWanted(state, dt, audio);
  updateStorm(state, dt, audio);
  updateRadar(state, dt, audio);

  // slow health recovery out of danger
  if (p.health > 0 && state.wanted === 0 && p.health < HEALTH_MAX) p.health = Math.min(HEALTH_MAX, p.health + 2.2 * dt);

  // camera follows with a touch of look-ahead
  const look = p.onFoot ? 0 : 60;
  const tx = (p.onFoot ? p.x : carOf(state)?.x ?? p.x) + Math.cos(p.angle) * look;
  const ty = (p.onFoot ? p.y : carOf(state)?.y ?? p.y) + Math.sin(p.angle) * look;
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 4.2);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 4.2);
}

function carOf(state) { return state.cars.find((c) => c.id === state.player.carId); }

function updateOnFoot(state, dt, input, audio) {
  const p = state.player;
  let mx = 0, my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    p.x += mx * PLAYER_FOOT_SPEED * dt;
    p.y += my * PLAYER_FOOT_SPEED * dt;
  }
  const fixed = resolveCollision(state.city, p.x, p.y, 12); p.x = fixed.x; p.y = fixed.y;
}

function updateDriving(state, dt, input, audio) {
  const p = state.player;
  const car = carOf(state); if (!car) { p.onFoot = true; return; }
  const stats = KIND_STATS[car.kind];
  const soaked = inStorm(state, car.x, car.y);
  const grip = soaked ? STORM.steerLoss : 1;
  const push = soaked ? STORM.accelLoss : 1;
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  if (fwd) car.speed += stats.accel * push * dt;
  else if (back) car.speed -= (car.speed > 20 ? CAR_BRAKE : CAR_ACCEL * 0.7) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 90 * dt);
  car.speed = Math.max(-CAR_REVERSE, Math.min(stats.max * (soaked ? 0.92 : 1), car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 12) {
    car.angle += steer * stats.turn * grip * dt * Math.min(1, Math.abs(car.speed) / 130) * Math.sign(car.speed);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCollision(state.city, nx, ny, 17);
  const crashed = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
  if (crashed && Math.abs(car.speed) > 140) { audio.crash(); state.shake = Math.max(state.shake, 5); }
  if (crashed) car.speed *= 0.45;
  car.x = fixed.x; car.y = fixed.y;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  audio.engineFrame(car.speed, stats.max);
  // mow down pedestrians at speed
  if (Math.abs(car.speed) > 90) {
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
        ped.down = 5; addWanted(state, 1); audio.thud(); state.shake = Math.max(state.shake, 4);
      }
    }
  }
}

function updateTraffic(state, dt, audio) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wreck >= 100) continue;
    car.decisionT -= dt;
    if (car.decisionT <= 0) {
      car.decisionT = 1.6 + state.rng() * 2.4;
      // near an intersection? turn onto the crossing road
      const nearX = ROAD_XS.find((rx) => Math.abs(car.x - rx) < 34);
      const nearY = ROAD_YS.find((ry) => Math.abs(car.y - ry) < 34);
      if ((nearX !== undefined || nearY !== undefined) && state.rng() < 0.65) {
        const turns = [Math.PI / 2, -Math.PI / 2, Math.PI / 2, -Math.PI / 2];
        car.angle += pick(state.rng, turns);
      } else if (state.rng() < 0.12) car.angle += Math.PI / 2;
    }
    // simple brake for whatever is ahead
    const aheadX = car.x + Math.cos(car.angle) * 70, aheadY = car.y + Math.sin(car.angle) * 70;
    const blocked = state.cars.some((o) => o !== car && Math.hypot(o.x - aheadX, o.y - aheadY) < 34);
    car.speed += ((blocked ? 40 : 165) - car.speed) * Math.min(1, dt * 2);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveCollision(state.city, nx, ny, 16);
    if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) car.angle += Math.PI / 2;
    car.x = fixed.x; car.y = fixed.y;
  }
}

function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down > 0) { ped.down -= dt; continue; }
    ped.wanderT -= dt;
    const danger = !p.onFoot && Math.abs(carOf(state)?.speed ?? 0) > 60 && Math.hypot(p.x - ped.x, p.y - ped.y) < 130;
    if (danger) { // flee the car
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.speed = 150;
    } else if (ped.wanderT <= 0) {
      ped.wanderT = 1.5 + state.rng() * 3;
      ped.angle += (state.rng() - 0.5) * 1.6;
      ped.speed = state.rng() < 0.25 ? 0 : 55 + state.rng() * 35;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    const fixed = resolveCollision(state.city, nx, ny, 7);
    if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) { ped.angle += Math.PI * (0.6 + state.rng() * 0.8); }
    ped.x = fixed.x; ped.y = fixed.y;
  }
}

function updatePolice(state, dt, audio) {
  const p = state.player;
  const cops = state.cars.filter((c) => c.police);
  for (const cop of cops) {
    if (cop.wreck >= 100) { cop.wreck += dt * 10; continue; }
    steerToward(cop, p.x, p.y, 2.05, dt);
    cop.speed += (305 - cop.speed) * Math.min(1, dt * 1.6);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt, ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const fixed = resolveCollision(state.city, nx, ny, 17);
    const crashed = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
    if (crashed) { cop.speed *= 0.5; cop.wreck += 22; }
    cop.x = fixed.x; cop.y = fixed.y;
    // ram the player
    if (Math.hypot(cop.x - p.x, cop.y - p.y) < 34 && p.hurtCd <= 0) {
      p.hurtCd = 0.85; p.hurtFlash = 0.4;
      damagePlayer(state, p.onFoot ? 9 : 13, audio);
      cop.wreck += 9; cop.speed *= 0.75;
      state.shake = Math.max(state.shake, 6);
    }
  }
  // clear wrecks, keep pressure while wanted
  state.cars = state.cars.filter((c) => !(c.police && c.wreck >= 160));
  if (state.wanted > 0) {
    state.spawnT -= dt;
    const active = state.cars.filter((c) => c.police && c.wreck < 100).length;
    if (state.spawnT <= 0 && active < Math.min(state.wanted + 1, 4)) {
      spawnPolice(state);
      state.spawnT = Math.max(2.2, 5.5 - state.wanted);
    }
  }
}

function updateWanted(state, dt, audio) {
  const p = state.player;
  if (state.wanted === 0) { state.evadeT = 0; return; }
  const cops = state.cars.filter((c) => c.police && c.wreck < 100);
  const near = cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 480);
  if (near) state.evadeT = 0;
  else {
    // the storm cell swallows the search — heat fades faster inside the surge
    state.evadeT += dt * (inStorm(state, p.x, p.y) ? STORM.evadeBoost : 1);
    if (state.evadeT > 4.2) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.evadeT = 0;
      state.message = state.wanted === 0 ? 'You lost the heat' : 'Police scanning the harbor…';
      state.msgT = 2;
      audio.blip();
    }
  }
}

function updateStorm(state, dt, audio) {
  const s = state.storm;
  if (s.active) {
    s.t -= dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.x = Math.max(120, Math.min(WORLD.w - 120, s.x));
    if (s.t <= 0) {
      s.active = false; s.nextIn = STORM.interval;
      state.message = 'The surge breaks — clear skies over Port Meridian'; state.msgT = 2.4;
    }
    return;
  }
  s.nextIn -= dt;
  if (s.nextIn <= 0) {
    const r = state.rng();
    s.active = true;
    s.x = WORLD.w * (0.25 + r * 0.5);
    s.y = WATER_Y + 90;
    s.vx = (state.rng() - 0.5) * STORM.drift * 2;
    s.vy = -STORM.speed;
    s.t = STORM.duration;
    state.message = 'STORM SURGE — the harbor is whiteout. Ride it or run it.';
    state.msgT = 3.2;
    if (audio.stormWarning) audio.stormWarning();
  }
}

function updateRadar(state, dt, audio) {
  state.radarAngle = (state.radarAngle + (dt * Math.PI * 2) / RADAR.period) % (Math.PI * 2);
  state.pingCd = Math.max(0, state.pingCd - dt);
  const p = state.player;
  if (state.wanted <= 0 || state.pingCd > 0) return;
  const tower = state.city.radarTower;
  if (!tower) return;
  const dist = Math.hypot(p.x - tower.x, p.y - tower.y);
  if (dist > RADAR.range) return;
  if (radarSweepDelta(state, p.x, p.y) < RADAR.sweep / 2) {
    state.pingCd = RADAR.pingCooldown;
    state.evadeT = 0;
    state.message = 'HARBOR RADAR PING — the beam found you';
    state.msgT = 2.2;
    state.shake = Math.max(state.shake, 2);
    if (audio.radarPing) audio.radarPing();
  }
}

export function damagePlayer(state, amount, audio) {
  const p = state.player;
  p.health = Math.max(0, p.health - amount);
  p.hurtFlash = 0.35;
  audio.hurt();
  if (p.health <= 0) state.screen = 'gameover';
}
