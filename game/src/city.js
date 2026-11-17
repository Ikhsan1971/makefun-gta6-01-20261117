// Procedural fictional port city "Port Meridian": harbor water in the south, a road grid,
// neon-lit blocks, piers, cranes and a lighthouse. Generated from a seed; all art is drawn in code.
import { WORLD, WATER_Y, ROAD_W, ROAD_XS, ROAD_YS, NEON } from './config.js';
import { createRandom, pick } from './random.js';

export const DISTRICTS = [
  { name: 'OLD HARBOR', x: 420, y: 1560 },
  { name: 'NEON ROW', x: 1280, y: 460 },
  { name: 'THE FOUNDRY', x: 2260, y: 980 },
  { name: 'SALTMARKET', x: 760, y: 1010 },
  { name: 'LANTERN QUARTER', x: 1750, y: 700 },
];

const PIERS = [
  { x: 470, y: WATER_Y, w: 130, h: 240 },
  { x: 1205, y: WATER_Y, w: 140, h: 250 },
  { x: 1900, y: WATER_Y, w: 150, h: 270 },
];

export function buildCity(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const xs = [0, ...ROAD_XS, WORLD.w];
  const ys = [0, ...ROAD_YS, WORLD.h];
  for (let ix = 0; ix < xs.length - 1; ix += 1) {
    for (let iy = 0; iy < ys.length - 1; iy += 1) {
      const bx = xs[ix] + (ix === 0 ? 30 : ROAD_W / 2 + 18);
      const by = ys[iy] + (iy === 0 ? 30 : ROAD_W / 2 + 18);
      const bw = xs[ix + 1] - (ix === xs.length - 2 ? 30 : ROAD_W / 2 + 18) - bx;
      const bh = ys[iy + 1] - (iy === ys.length - 2 ? 30 : ROAD_W / 2 + 18) - by;
      if (bw < 90 || bh < 90 || by + bh > WATER_Y - 30) continue;
      // each block holds 1-2 buildings with an alley between them
      const split = rng() < 0.55 && bw > 240;
      const parts = split ? [0.42 + rng() * 0.16, 1] : [1];
      let cursor = bx;
      for (const frac of parts) {
        const w = split ? bw * frac - 10 : bw;
        if (w > 70) {
          const h = bh * (0.55 + rng() * 0.45);
          buildings.push({
            x: cursor, y: by + (bh - h), w, h,
            neon: pick(rng, NEON),
            sign: rng() < 0.7,
            winSeed: Math.floor(rng() * 1e9),
            tall: rng() < 0.18,
          });
        }
        cursor += split ? bw * frac + 10 : bw;
      }
    }
  }
  // piers, cranes and lamps
  const piers = PIERS;
  const cranes = [
    { x: 430, y: WATER_Y + 26 }, { x: 1370, y: WATER_Y + 40 }, { x: 1870, y: WATER_Y + 30 },
  ];
  const lighthouse = { x: 1975, y: WATER_Y + 235 };
  // harbor radar tower on the middle pier — sweeps the bay for hot targets
  const radarTower = { x: 1275, y: WATER_Y + 165 };
  const lamps = [];
  for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
    lamps.push({ x: rx - ROAD_W / 2 - 8, y: ry - ROAD_W / 2 - 8 });
    lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry + ROAD_W / 2 + 8 });
  }
  return {
    buildings, piers, cranes, lighthouse, radarTower, lamps,
    spawn: { x: 920, y: 1140 },
    neonSignSpot: { x: 1300, y: 470 },
  };
}

/** Push a circle out of building rects and the harbor. Returns corrected {x, y}. */
export function resolveCollision(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { x = b.x - r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r; y = cy + (dy / d) * r;
    }
  }
  // harbor water blocks everything except the piers
  if (y + r > WATER_Y) {
    const onPier = city.piers.some((p) => x > p.x - 4 && x < p.x + p.w + 4 && y - r < p.y + p.h);
    if (!onPier) y = WATER_Y - r;
    if (y > WORLD.h - r) y = WORLD.h - r;
  }
  x = Math.max(r, Math.min(WORLD.w - r, x));
  y = Math.max(r, Math.min(WORLD.h - r, y));
  return { x, y };
}

export function pointInBuilding(city, x, y) {
  return city.buildings.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
}

/** Pre-render the static city once to an offscreen canvas (2800x2000). */
export function createCityLayer(city) {
  const layer = document.createElement('canvas');
  layer.width = WORLD.w; layer.height = WORLD.h;
  const g = layer.getContext('2d');
  // ground base with subtle asphalt noise
  g.fillStyle = '#0d1226'; g.fillRect(0, 0, WORLD.w, WORLD.h);
  const noise = createRandom(99);
  for (let i = 0; i < 2600; i += 1) {
    g.fillStyle = noise() < 0.5 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.25)';
    g.fillRect(noise() * WORLD.w, noise() * WORLD.h, 2 + noise() * 3, 2 + noise() * 3);
  }
  // harbor water
  const wg = g.createLinearGradient(0, WATER_Y, 0, WORLD.h);
  wg.addColorStop(0, '#0a3a55'); wg.addColorStop(1, '#041c2e');
  g.fillStyle = wg; g.fillRect(0, WATER_Y, WORLD.w, WORLD.h - WATER_Y);
  // embankment edge
  g.fillStyle = '#1d2742'; g.fillRect(0, WATER_Y - 10, WORLD.w, 10);
  // piers
  for (const p of city.piers) {
    g.fillStyle = '#33261a'; g.fillRect(p.x, p.y, p.w, p.h);
    g.strokeStyle = '#241a12'; g.lineWidth = 3;
    for (let y = p.y + 14; y < p.y + p.h; y += 22) {
      g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x + p.w, y); g.stroke();
    }
  }
  // roads
  g.fillStyle = '#181f36';
  for (const rx of ROAD_XS) g.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
  for (const ry of ROAD_YS) if (ry < WATER_Y) g.fillRect(0, ry - ROAD_W / 2, WORLD.w, ROAD_W);
  // sidewalk edging + lane dashes
  g.strokeStyle = '#2a3457'; g.lineWidth = 4;
  for (const rx of ROAD_XS) {
    g.beginPath(); g.moveTo(rx - ROAD_W / 2, 0); g.lineTo(rx - ROAD_W / 2, WATER_Y); g.stroke();
    g.beginPath(); g.moveTo(rx + ROAD_W / 2, 0); g.lineTo(rx + ROAD_W / 2, WATER_Y); g.stroke();
  }
  for (const ry of ROAD_YS) {
    if (ry >= WATER_Y) continue;
    g.beginPath(); g.moveTo(0, ry - ROAD_W / 2); g.lineTo(WORLD.w, ry - ROAD_W / 2); g.stroke();
    g.beginPath(); g.moveTo(0, ry + ROAD_W / 2); g.lineTo(WORLD.w, ry + ROAD_W / 2); g.stroke();
  }
  g.strokeStyle = '#3d4a74'; g.lineWidth = 3; g.setLineDash([26, 30]);
  for (const rx of ROAD_XS) { g.beginPath(); g.moveTo(rx, 0); g.lineTo(rx, WATER_Y); g.stroke(); }
  for (const ry of ROAD_YS) { g.beginPath(); g.moveTo(0, ry); g.lineTo(WORLD.w, ry); g.stroke(); }
  g.setLineDash([]);
  // buildings with windows and neon trim
  for (const b of city.buildings) {
    g.fillStyle = '#121a33'; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = '#0a0f22'; g.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    g.strokeStyle = b.neon; g.shadowColor = b.neon; g.shadowBlur = 14; g.lineWidth = 3;
    g.globalAlpha = 0.85; g.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    g.shadowBlur = 0; g.globalAlpha = 1;
    const wrng = createRandom(b.winSeed);
    for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += 17) {
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 15) {
        if (wrng() < 0.34) {
          g.fillStyle = wrng() < 0.75 ? 'rgba(255,214,130,0.85)' : 'rgba(140,240,255,0.8)';
          g.fillRect(wx, wy, 7, 8);
        }
      }
    }
    if (b.sign) { // vertical neon bar sign on the roof face
      g.fillStyle = b.neon; g.shadowColor = b.neon; g.shadowBlur = 18;
      g.fillRect(b.x + b.w / 2 - 4, b.y - 2, 8, 30 + (b.winSeed % 24));
      g.shadowBlur = 0;
    }
  }
  // dock cranes
  for (const c of city.cranes) {
    g.strokeStyle = '#0a0f22'; g.lineWidth = 12;
    g.beginPath(); g.moveTo(c.x, WATER_Y + 80); g.lineTo(c.x, c.y - 90); g.lineTo(c.x + 90, c.y - 90); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(c.x + 78, c.y - 90); g.lineTo(c.x + 78, c.y - 20); g.stroke();
    g.fillStyle = '#ffb02e'; g.fillRect(c.x - 4, c.y - 4, 8, 8);
  }
  // radar tower: lattice mast + dome on the middle pier
  const rt = city.radarTower;
  if (rt) {
    g.strokeStyle = '#1a2340'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(rt.x - 14, rt.y + 34); g.lineTo(rt.x, rt.y - 46); g.lineTo(rt.x + 14, rt.y + 34); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(rt.x - 9, rt.y + 12); g.lineTo(rt.x + 9, rt.y + 12); g.stroke();
    g.beginPath(); g.moveTo(rt.x - 5, rt.y - 14); g.lineTo(rt.x + 5, rt.y - 14); g.stroke();
    g.fillStyle = '#0e1730'; g.beginPath(); g.arc(rt.x, rt.y - 52, 13, Math.PI, 0); g.fill();
    g.strokeStyle = '#22e6ff'; g.shadowColor = '#22e6ff'; g.shadowBlur = 12; g.lineWidth = 2.4;
    g.beginPath(); g.arc(rt.x, rt.y - 52, 13, Math.PI, 0); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#22e6ff'; g.beginPath(); g.arc(rt.x, rt.y - 52, 2.6, 0, Math.PI * 2); g.fill();
  }
  // lighthouse with rotating beacon base
  const lh = city.lighthouse;
  g.fillStyle = '#e8e4d8'; g.beginPath(); g.moveTo(lh.x - 16, lh.y); g.lineTo(lh.x - 9, lh.y - 74); g.lineTo(lh.x + 9, lh.y - 74); g.lineTo(lh.x + 16, lh.y); g.closePath(); g.fill();
  g.fillStyle = '#c2472e'; g.fillRect(lh.x - 12, lh.y - 34, 24, 12); g.fillRect(lh.x - 10, lh.y - 58, 20, 10);
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(lh.x, lh.y - 80, 9, 0, Math.PI * 2); g.fill();
  return layer;
}
