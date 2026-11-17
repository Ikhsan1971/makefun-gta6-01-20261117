// Port Meridian: Neon Tide — shared tuning constants. A fictional port city, no real-world links.

export const WORLD = { w: 2800, h: 2000 };
export const WATER_Y = 1700; // south of this line is the harbor (solid water, piers are walkable)
export const ROAD_W = 64;
export const ROAD_XS = [200, 560, 920, 1280, 1640, 2000, 2360];
export const ROAD_YS = [180, 500, 820, 1140, 1460];
export const STEP = 1 / 60;

export const PLAYER_FOOT_SPEED = 175;
export const CAR_MAX_SPEED = 350;
export const CAR_ACCEL = 265;
export const CAR_BRAKE = 320;
export const CAR_REVERSE = 120;
export const CAR_TURN = 2.6;

export const HEALTH_MAX = 100;
export const WANTED_MAX = 5;

// Neon Tide — Storm Surge: a drifting storm cell whites out the harbor; riders of the surge
// gather bonus cash on contract markers, but car handling is heavier in the rain.
export const STORM = { interval: 34, duration: 13, radius: 320, speed: 46, drift: 42, bonus: 250, steerLoss: 0.72, accelLoss: 0.85, evadeBoost: 2.2 };
// Harbor radar: the lighthouse sweeps the bay; a hot player caught in the beam is pinged and
// any heat-evasion progress is reset.
export const RADAR = { period: 7.5, sweep: 0.5, range: 640, pingCooldown: 3 };

export const NEON = ['#ff3ea5', '#22e6ff', '#b6ff2e', '#ffb02e', '#a06bff', '#2effc4'];

export const COLORS = {
  ground: '#0d1226',
  road: '#181f36',
  roadLine: '#3d4a74',
  sidewalk: '#232c4e',
  waterA: '#041c2e',
  waterB: '#0a3a55',
  pier: '#33261a',
  building: '#121a33',
  buildingEdge: '#263156',
  hud: '#e8ecf8',
  hudDim: '#8fa0c8',
  accent: '#22e6ff',
  cash: '#ffd34d',
};

export const SAVE_KEY = 'port-meridian-neon-tide-best';
