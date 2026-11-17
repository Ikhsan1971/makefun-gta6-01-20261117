// Three-contract story: "TIDE TABLES" → "CRATE COUNT" → "NEON GETAWAY".
// Missions advance by reaching glowing markers; each pays out and the last clears the tide.
// Markers tagged during a Storm Surge pay a Storm Tide bonus on top of the contract money.
import { saveBest } from './save.js';
import { STORM } from './config.js';
import { inStorm } from './entities.js';

export const MISSIONS = [
  {
    name: 'TIDE TABLES', giver: 'A dockhand in the Old Harbor', reward: 600,
    stages: [
      { kind: 'goto', x: 535, y: 1880, label: 'Reach the marked pier in the Old Harbor' },
      { kind: 'goto', x: 1300, y: 470, label: 'Deliver the waterlogged ledger to Neon Row' },
    ],
  },
  {
    name: 'CRATE COUNT', giver: 'The harbormaster owes you a favor', reward: 900,
    stages: [{ kind: 'collect', label: 'Recover the scattered cargo crates' }],
  },
  {
    name: 'NEON GETAWAY', giver: 'One last run through Port Meridian', reward: 1400,
    stages: [{ kind: 'checkpoints', label: 'Punch the timekeeping gates' }],
  },
];

export const CRATES = [
  { x: 1240, y: 1835 }, { x: 2305, y: 1010 }, { x: 640, y: 425 }, { x: 1750, y: 1170 },
];
export const GATES = [
  { x: 2360, y: 180 }, { x: 200, y: 820 }, { x: 1640, y: 1460 },
];

export function currentMission(state) { return MISSIONS[state.missions.index] ?? null; }

/** Markers visible right now for the active stage. */
export function activeMarkers(state) {
  const m = currentMission(state); if (!m) return [];
  const s = state.missions;
  if (m.stages[s.stage].kind === 'goto') {
    const st = m.stages[s.stage];
    return [{ x: st.x, y: st.y, label: st.label, color: '#22e6ff' }];
  }
  if (m.stages[s.stage].kind === 'collect') {
    return CRATES.filter((_, i) => !s.taken.includes(i))
      .map((c) => ({ x: c.x, y: c.y, label: `Recover cargo crate ${s.taken.length + 1} of ${CRATES.length}`, color: '#ffb02e' }));
  }
  return GATES.filter((_, i) => !s.taken.includes(i))
    .map((c, i) => ({ x: c.x, y: c.y, label: `Timekeeping gate ${s.taken.length + 1} of ${GATES.length}`, color: '#b6ff2e' }));
}

export function objectiveText(state) {
  const m = currentMission(state); if (!m) return 'The tide is yours. Port Meridian sleeps.';
  const markers = activeMarkers(state);
  return markers.length ? markers[0].label : '';
}

export function resetMissionState(state) {
  state.missions = { index: 0, stage: 0, taken: [] };
}

/** Storm Tide payout: markers tagged while the player rides inside the surge pay extra. */
export function grantSurgeBonus(state) {
  if (!inStorm(state, state.player.x, state.player.y)) return 0;
  state.player.cash += STORM.bonus;
  state.stats.earned += STORM.bonus;
  state.stats.surge = (state.stats.surge | 0) + 1;
  return STORM.bonus;
}

const surgeTag = (bonus) => (bonus > 0 ? `  ·  SURGE +$${bonus}` : '');

/** Advance missions when the player touches a marker. Returns true if something happened. */
export function checkTriggers(state, audio) {
  const m = currentMission(state); if (!m) return false;
  const s = state.missions;
  const st = m.stages[s.stage];
  const p = state.player;
  const hit = (x, y) => Math.hypot(p.x - x, p.y - y) < 52;

  if (st.kind === 'goto') {
    if (!hit(st.x, st.y)) return false;
    const bonus = grantSurgeBonus(state);
    s.stage += 1;
    if (s.stage >= m.stages.length) return finishMission(state, m, audio, bonus);
    state.banner = { text: 'LEDGER SECURED', sub: `Checkpoint moved — follow the beacon${surgeTag(bonus)}`, timer: 2.4 };
    audio.missionStage();
    return true;
  }
  if (st.kind === 'collect') {
    const idx = CRATES.findIndex((c, i) => !s.taken.includes(i) && hit(c.x, c.y));
    if (idx === -1) return false;
    const bonus = grantSurgeBonus(state);
    s.taken.push(idx);
    audio.missionStage();
    if (s.taken.length >= CRATES.length) return finishMission(state, m, audio, bonus);
    state.banner = { text: `CRATE ${s.taken.length}/${CRATES.length}`, sub: `Cargo secured${surgeTag(bonus)}`, timer: 1.6 };
    return true;
  }
  // checkpoints
  const idx = GATES.findIndex((c, i) => !s.taken.includes(i) && hit(c.x, c.y));
  if (idx === -1) return false;
  const bonus = grantSurgeBonus(state);
  s.taken.push(idx);
  audio.missionStage();
  if (s.taken.length >= GATES.length) return finishMission(state, m, audio, bonus);
  state.banner = { text: `GATE ${s.taken.length}/${GATES.length}`, sub: `Clean time — keep moving${surgeTag(bonus)}`, timer: 1.6 };
  return true;
}

function finishMission(state, mission, audio, bonus = 0) {
  const s = state.missions;
  state.player.cash += mission.reward;
  state.stats.earned += mission.reward;
  s.index += 1; s.stage = 0; s.taken = [];
  audio.cash(); audio.missionDone();
  if (s.index >= MISSIONS.length) {
    state.complete = true;
    state.banner = { text: 'NEON TIDE — CLEAR', sub: `All contracts closed  +$${mission.reward}${surgeTag(bonus)}`, timer: 4 };
    state.screen = 'complete';
    saveBest({ cash: state.stats.earned, missions: MISSIONS.length, complete: true });
  } else {
    state.banner = { text: 'CONTRACT CLOSED', sub: `${mission.name}  +$${mission.reward}${surgeTag(bonus)}`, timer: 3.4 };
    saveBest({ cash: state.stats.earned, missions: s.index, complete: false });
  }
  return true;
}
