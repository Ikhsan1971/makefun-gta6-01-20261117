// Deterministic screenshot stages behind ?shot=cover|car|chase|result — the real game,
// posed by the same code that plays it, so the frames are honest renders of Port Meridian.
// ?storm=1 (handled in main.js) pins a Storm Surge over the scene for surge shots.
import { MISSIONS } from './missions.js';
import { spawnCar, spawnPoliceAt } from './entities.js';
import { HEALTH_MAX, STORM } from './config.js';

export const SHOTS = ['cover', 'car', 'chase', 'result'];

export function stageShot(state, name) {
  state.shot = name;
  const p = state.player;
  if (name === 'cover') {
    // on foot at the Salmarket crossing, morning shift of the neon
    p.x = 920; p.y = 1120; p.angle = -0.7; p.health = HEALTH_MAX; p.cash = 250;
    state.wanted = 0;
    state.missions = { index: 0, stage: 0, taken: [] };
    state.camera.x = p.x; state.camera.y = p.y;
    state.screen = 'play';
    return;
  }
  if (name === 'car') {
    // behind the wheel on Neon Row, heat already on you
    const car = spawnCar(state, 'sports', 1280, 520, Math.PI / 2, 'player');
    car.stolen = true; car.speed = 210; car.color = '#5b2f4f';
    p.onFoot = false; p.carId = car.id; p.x = car.x; p.y = car.y; p.angle = car.angle; p.cash = 1250;
    state.wanted = 2; state.stats.takenCars = 1;
    spawnPoliceAt(state, 1280, 320, Math.PI / 2); spawnPoliceAt(state, 1000, 500, Math.PI);
    state.camera.x = car.x; state.camera.y = car.y;
    state.radarAngle = -Math.PI / 2 - 0.35; // the sweep just swept past the car
    state.pingCd = 1.6;
    state.message = 'HARBOR RADAR PING — the beam found you'; state.msgT = 99;
    state.screen = 'play';
    return;
  }
  if (name === 'chase') {
    // mid-contract, three cruisers closing in on the Salmarket crossing, surge rolling in
    const car = spawnCar(state, 'coupe', 905, 1115, Math.PI / 2 + 0.35, 'player');
    car.stolen = true; car.speed = 260; car.color = '#274d3d';
    p.onFoot = false; p.carId = car.id; p.x = car.x; p.y = car.y; p.angle = car.angle; p.cash = 800; p.health = 74;
    state.wanted = 3; state.stats.takenCars = 2; state.stats.crimes = 3;
    state.missions = { index: 0, stage: 1, taken: [] }; // delivering the ledger
    spawnPoliceAt(state, 920, 950, Math.PI / 2); spawnPoliceAt(state, 920, 1290, -Math.PI / 2); spawnPoliceAt(state, 560, 1140, 0);
    state.camera.x = car.x; state.camera.y = car.y - 170; // player sits below the banner
    state.banner = { text: 'TIDE TABLES', sub: 'Ledger delivery — Neon Row', timer: 99 };
    // pose the surge half-on the crossing so the frame shows the mechanic
    state.storm.active = true;
    state.storm.x = car.x + 60; state.storm.y = car.y - 430;
    state.storm.vx = 8; state.storm.vy = -STORM.speed * 0.4;
    state.storm.t = 99; state.storm.nextIn = 999;
    state.radarAngle = -Math.PI / 2 - 0.6;
    state.stats.surge = 2;
    state.screen = 'play';
    return;
  }
  // result: all three contracts closed, progression tallied
  p.x = 920; p.y = 1140; p.health = 88; p.cash = 2900;
  state.wanted = 0; state.complete = true;
  state.stats = { earned: 2900, crimes: 4, takenCars: 2, surge: 3 };
  state.missions = { index: MISSIONS.length, stage: 0, taken: [] };
  state.camera.x = p.x; state.camera.y = p.y;
  state.screen = 'complete';
}
