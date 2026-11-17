// Canvas rendering: neon-night world, camera, entities, HUD (health/cash/stars/minimap/objective),
// and the title / pause / game-over / contract-complete screens. All art is generated in code.
import { WORLD, WATER_Y, COLORS, WANTED_MAX, HEALTH_MAX, STORM, RADAR } from './config.js';
import { activeMarkers, objectiveText, currentMission, MISSIONS } from './missions.js';
import { stormFactor } from './entities.js';

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = '#ffd34d'; ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; }
  else { ctx.strokeStyle = 'rgba(255,211,77,0.4)'; ctx.lineWidth = 1.6; ctx.stroke(); }
}

function panel(ctx, x, y, w, h, glow) {
  ctx.fillStyle = 'rgba(8,12,28,0.72)';
  ctx.strokeStyle = glow || 'rgba(90,240,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
}

export function createMinimap(cityLayer) {
  const mm = document.createElement('canvas');
  mm.width = 200; mm.height = 146;
  const g = mm.getContext('2d');
  g.fillStyle = '#050a1a'; g.fillRect(0, 0, mm.width, mm.height);
  g.drawImage(cityLayer, 0, 0, WORLD.w, WORLD.h, 0, 0, mm.width, mm.height);
  g.fillStyle = 'rgba(5,10,26,0.18)'; g.fillRect(0, 0, mm.width, mm.height);
  return mm;
}

export function drawFrame(ctx, state, assets, viewW, viewH, best) {
  const cam = state.camera;
  const shake = state.shake > 0 ? state.shake : 0;
  const ox = shake ? (Math.sin(state.time * 71) * shake) : 0;
  const oy = shake ? (Math.cos(state.time * 57) * shake) : 0;

  ctx.save();
  ctx.translate(viewW / 2 - cam.x + ox, viewH / 2 - cam.y + oy);
  ctx.drawImage(assets.cityLayer, 0, 0);
  drawWaterShimmer(ctx, state);
  drawLighthouseBeam(ctx, state, assets);
  drawMarkers(ctx, state);
  for (const ped of state.peds) drawPed(ctx, ped);
  for (const car of state.cars) drawCar(ctx, car, state);
  if (state.player.onFoot) drawPlayerOnFoot(ctx, state.player, state);
  drawLampGlows(ctx, state, assets);
  drawRadarSweep(ctx, state);
  drawStorm(ctx, state);
  ctx.restore();

  drawVignette(ctx, viewW, viewH, state);
  if (state.screen === 'play' || state.screen === 'paused') drawHUD(ctx, state, assets, viewW, viewH);
  if (state.screen === 'title') drawTitle(ctx, state, viewW, viewH, best);
  else if (state.screen === 'paused') drawPaused(ctx, viewW, viewH);
  else if (state.screen === 'gameover') drawGameOver(ctx, state, viewW, viewH, best);
  else if (state.screen === 'complete') drawComplete(ctx, state, viewW, viewH, best);
}

function drawWaterShimmer(ctx, state) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i += 1) {
    const y = WATER_Y + 18 + i * 40 + Math.sin(state.time * 0.9 + i * 1.7) * 4;
    ctx.strokeStyle = i % 2 ? 'rgba(60,220,255,0.25)' : 'rgba(255,62,165,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.w; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.008 + state.time * 1.3 + i) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLighthouseBeam(ctx, state, assets) {
  const lh = assets.cityLayer && state.city.lighthouse; if (!lh) return;
  const a = state.time * 0.55;
  ctx.save();
  ctx.translate(lh.x, lh.y - 80);
  const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * 340, Math.sin(a) * 340);
  grad.addColorStop(0, 'rgba(255,240,170,0.55)');
  grad.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a - 0.22) * 340, Math.sin(a - 0.22) * 340);
  ctx.lineTo(Math.cos(a + 0.22) * 340, Math.sin(a + 0.22) * 340);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawMarkers(ctx, state) {
  const markers = state.screen === 'play' ? activeMarkers(state) : [];
  for (const m of markers) {
    const pulse = 1 + Math.sin(state.time * 3.4) * 0.18;
    const beam = ctx.createLinearGradient(0, m.y - 170, 0, m.y);
    beam.addColorStop(0, 'rgba(34,230,255,0)'); beam.addColorStop(1, m.color);
    ctx.globalAlpha = 0.5; ctx.fillStyle = beam;
    ctx.fillRect(m.x - 7, m.y - 170, 14, 170); ctx.globalAlpha = 1;
    ctx.strokeStyle = m.color; ctx.shadowColor = m.color; ctx.shadowBlur = 16;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(m.x, m.y - 46 - Math.sin(state.time * 2.2) * 6); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = m.color; ctx.fillRect(-9, -9, 18, 18); ctx.restore();
    ctx.shadowBlur = 0;
  }
}

function drawRadarSweep(ctx, state) {
  const tower = state.city.radarTower; if (!tower) return;
  const a = state.radarAngle;
  // range ring
  ctx.save();
  ctx.strokeStyle = 'rgba(34,230,255,0.16)'; ctx.setLineDash([8, 14]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tower.x, tower.y, RADAR.range, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // rotating beam wedge
  const grad = ctx.createRadialGradient(tower.x, tower.y, 20, tower.x, tower.y, RADAR.range);
  grad.addColorStop(0, 'rgba(34,230,255,0.34)');
  grad.addColorStop(1, 'rgba(34,230,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(tower.x, tower.y);
  ctx.arc(tower.x, tower.y, RADAR.range, a - RADAR.sweep / 2, a + RADAR.sweep / 2);
  ctx.closePath(); ctx.fill();
  // leading edge line
  ctx.strokeStyle = 'rgba(120,245,255,0.75)'; ctx.lineWidth = 2.4;
  ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(tower.x, tower.y);
  ctx.lineTo(tower.x + Math.cos(a) * RADAR.range, tower.y + Math.sin(a) * RADAR.range);
  ctx.stroke();
  ctx.restore();
}

function drawStorm(ctx, state) {
  const s = state.storm; if (!s || !s.active) return;
  ctx.save();
  // cell body: dark wall with a bruised teal-magenta heart
  const grad = ctx.createRadialGradient(s.x, s.y, STORM.radius * 0.15, s.x, s.y, STORM.radius);
  grad.addColorStop(0, 'rgba(10,14,34,0.88)');
  grad.addColorStop(0.55, 'rgba(16,22,48,0.66)');
  grad.addColorStop(1, 'rgba(16,22,48,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(s.x, s.y, STORM.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,62,165,0.35)'; ctx.lineWidth = 3;
  ctx.setLineDash([20, 26]); ctx.lineDashOffset = -state.time * 40;
  ctx.beginPath(); ctx.arc(s.x, s.y, STORM.radius * 0.97, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // rain streaks, slanted by the drift
  const rng = (i) => Math.sin(i * 127.1 + Math.floor(state.time * 3) * 311.7) * 43758.5453 % 1;
  ctx.strokeStyle = 'rgba(150,225,255,0.5)'; ctx.lineWidth = 1.6;
  const slant = 0.35 + s.vx * 0.002;
  for (let i = 0; i < 64; i += 1) {
    const rx = s.x + (Math.abs(rng(i)) * 2 - 1) * STORM.radius * 0.92;
    const phase = (state.time * 620 + i * 97) % (STORM.radius * 2);
    const ry = s.y - STORM.radius + phase;
    if (Math.hypot(rx - s.x, ry - s.y) > STORM.radius * 0.95) continue;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 10 * slant, ry + 34); ctx.stroke();
  }
  // lightning flicker every few seconds
  const flash = Math.max(0, Math.sin(state.time * 1.7 + 1.3) - 0.965) / 0.035;
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.5;
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, STORM.radius * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  if (ped.down > 0) {
    ctx.fillStyle = ped.hue; ctx.save(); ctx.translate(ped.x, ped.y); ctx.rotate(ped.angle);
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    return;
  }
  ctx.fillStyle = ped.hue; ctx.beginPath(); ctx.arc(ped.x, ped.y, 6.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(ped.x, ped.y, 3.1, 0, Math.PI * 2); ctx.fill();
}

function drawCar(ctx, car, state) {
  const stats = { sedan: 46, coupe: 44, sports: 47, truck: 56 };
  const len = stats[car.kind] ?? 46, wid = car.kind === 'truck' ? 21 : 18;
  ctx.save();
  ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  if (car.wreck >= 100) ctx.globalAlpha = 0.75;
  // headlight cone
  if (car.driver === 'player' || car.driver === 'police') {
    const cone = ctx.createLinearGradient(len / 2, 0, len / 2 + 150, 0);
    cone.addColorStop(0, 'rgba(255,250,210,0.35)'); cone.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(len / 2, -wid / 2); ctx.lineTo(len / 2 + 150, -wid * 1.7); ctx.lineTo(len / 2 + 150, wid * 1.7); ctx.lineTo(len / 2, wid / 2); ctx.closePath(); ctx.fill();
  }
  // body
  ctx.fillStyle = car.color;
  ctx.shadowColor = car.police ? '#22e6ff' : car.color; ctx.shadowBlur = car.police ? 16 : 7;
  ctx.beginPath(); ctx.roundRect(-len / 2, -wid / 2, len, wid, 6); ctx.fill();
  ctx.shadowBlur = 0;
  // roof / glass
  ctx.fillStyle = 'rgba(10,14,30,0.85)';
  ctx.beginPath(); ctx.roundRect(-len * 0.16, -wid / 2 + 2.5, len * 0.34, wid - 5, 3); ctx.fill();
  ctx.fillStyle = 'rgba(150,220,255,0.35)';
  ctx.beginPath(); ctx.roundRect(len * 0.18, -wid / 2 + 3.5, 5, wid - 7, 2); ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#101a33'; ctx.fillRect(-len / 2 + 3, -2.4, len - 6, 4.8); // door stripe
    const flash = Math.floor(state.time * 4.5) % 2 === 0; // light bar
    ctx.fillStyle = flash ? '#ff3b3b' : '#3b6bff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, -wid / 2 + 3.5, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#3b6bff' : '#ff3b3b'; ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath(); ctx.arc(0, wid / 2 - 3.5, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // taillights
  ctx.fillStyle = '#ff5040'; ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 4); ctx.fillRect(-len / 2 - 1, wid / 2 - 6, 3, 4);
  ctx.restore();
  if (car.wreck >= 100) { // smoke
    ctx.fillStyle = 'rgba(120,120,130,0.5)';
    for (let i = 0; i < 3; i += 1) {
      const t = (state.time * 0.9 + i * 0.33) % 1;
      ctx.beginPath(); ctx.arc(car.x - Math.cos(car.angle) * 10 + Math.sin(i * 7) * 5, car.y - Math.sin(car.angle) * 10 - t * 46, 5 + t * 9, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPlayerOnFoot(ctx, p, state) {
  const bob = Math.sin(state.time * 9) * 0.8;
  ctx.save(); ctx.translate(p.x, p.y + bob);
  ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#f2f6ff'; ctx.beginPath(); ctx.arc(0, 0, 7.6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 2; ctx.stroke();
  ctx.rotate(p.angle);
  ctx.strokeStyle = '#22e6ff'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(11, 0); ctx.stroke();
  ctx.restore();
}

function drawLampGlows(ctx, state, assets) {
  if (!assets.glow) {
    const g = document.createElement('canvas'); g.width = g.height = 64;
    const gc = g.getContext('2d');
    const grad = gc.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,225,150,0.5)'); grad.addColorStop(1, 'rgba(255,225,150,0)');
    gc.fillStyle = grad; gc.fillRect(0, 0, 64, 64);
    assets.glow = g;
  }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const lamp of state.city.lamps) {
    ctx.drawImage(assets.glow, lamp.x - 60, lamp.y - 60, 120, 120);
    ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, w, h, state) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(2,4,14,0.55)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  const soak = stormFactor(state, state.player.x, state.player.y);
  if (soak > 0) {
    ctx.fillStyle = `rgba(6,10,26,${0.38 * soak})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,60,${state.player.hurtFlash * 0.32})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawHUD(ctx, state, assets, w, h) {
  const p = state.player;
  // vitals panel
  panel(ctx, 16, 14, 258, 96);
  ctx.fillStyle = COLORS.hudDim; ctx.font = '700 10px Arial'; ctx.fillText('P O R T   M E R I D I A N', 30, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(30, 44, 210, 12);
  const hp = p.health / HEALTH_MAX;
  ctx.fillStyle = `hsl(${hp * 115}, 85%, 55%)`;
  ctx.fillRect(30, 44, 210 * hp, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(30, 44, 210, 12);
  ctx.fillStyle = COLORS.cash; ctx.font = '800 21px "Arial Black", Arial';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 30, 94);
  ctx.fillStyle = COLORS.hudDim; ctx.font = '10px Arial'; ctx.fillText('CASH', 132, 93);
  // wanted panel
  panel(ctx, w - 196, 14, 180, 52, state.wanted > 0 ? 'rgba(255,80,80,0.5)' : undefined);
  ctx.fillStyle = state.wanted > 0 ? '#ff7a6a' : COLORS.hudDim; ctx.font = '700 10px Arial';
  ctx.fillText(state.wanted > 0 ? 'H E A T' : 'C O O L', w - 180, 33);
  for (let i = 0; i < WANTED_MAX; i += 1) star(ctx, w - 172 + i * 34, 51, 10.5, i < state.wanted);
  // storm status pill under the heat panel
  if (state.storm && state.storm.active) {
    panel(ctx, w - 196, 74, 180, 42, 'rgba(34,230,255,0.5)');
    ctx.fillStyle = '#8ef2ff'; ctx.font = '800 11px Arial';
    ctx.fillText('S T O R M   S U R G E', w - 180, 91);
    ctx.fillStyle = COLORS.hudDim; ctx.font = '10px Arial';
    ctx.fillText(`whiteout ${Math.ceil(state.storm.t)}s — markers pay +$${STORM.bonus} inside`, w - 180, 107);
  } else if (state.storm && state.storm.nextIn < 8) {
    ctx.fillStyle = 'rgba(142,242,255,0.55)'; ctx.font = '700 10px Arial'; ctx.textAlign = 'right';
    ctx.fillText('STATIC ON THE WIRE…', w - 20, 84);
    ctx.textAlign = 'left';
  }
  if ((state.stats.surge | 0) > 0) {
    ctx.fillStyle = '#ffd34d'; ctx.font = '700 10px Arial';
    ctx.fillText(`SURGE BONUS ×${state.stats.surge}`, 30, 106);
  }
  // harbor radar dial — watch the sweep when the heat is on
  const dialR = 30, dialX = w - 48, dialY = h - 118;
  const pingHot = state.pingCd > 0;
  panel(ctx, dialX - dialR - 8, dialY - dialR - 8, (dialR + 8) * 2, (dialR + 8) * 2 + 14, pingHot ? 'rgba(255,80,80,0.6)' : 'rgba(34,230,255,0.35)');
  ctx.strokeStyle = 'rgba(34,230,255,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(dialX, dialY, dialR * 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(dialX, dialY); ctx.arc(dialX, dialY, dialR, state.radarAngle - RADAR.sweep / 2, state.radarAngle + RADAR.sweep / 2); ctx.closePath();
  ctx.fillStyle = 'rgba(34,230,255,0.3)'; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = pingHot ? '#ff6a5e' : '#8ef2ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(dialX, dialY);
  ctx.lineTo(dialX + Math.cos(state.radarAngle) * dialR, dialY + Math.sin(state.radarAngle) * dialR);
  ctx.stroke();
  ctx.fillStyle = COLORS.hudDim; ctx.font = '700 8px Arial'; ctx.textAlign = 'center';
  ctx.fillText(pingHot ? 'PINGED' : 'HBR RADAR', dialX, dialY + dialR + 11);
  ctx.textAlign = 'left';
  // objective banner
  const mission = currentMission(state);
  if (mission && state.screen === 'play') {
    const text = objectiveText(state);
    ctx.font = '600 15px Arial';
    const tw = ctx.measureText(text).width;
    panel(ctx, w / 2 - tw / 2 - 26, 14, tw + 52, 58, 'rgba(34,230,255,0.4)');
    ctx.fillStyle = COLORS.accent; ctx.font = '800 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`C O N T R A C T  ${state.missions.index + 1} / ${MISSIONS.length}  —  ${mission.name}`, w / 2, 32);
    ctx.fillStyle = COLORS.hud; ctx.font = '600 14px Arial';
    ctx.fillText(text, w / 2, 55);
    ctx.textAlign = 'left';
  }
  // minimap
  const mmX = 16, mmY = h - 166, mmW = 200, mmH = 146;
  panel(ctx, mmX - 4, mmY - 4, mmW + 8, mmH + 26, 'rgba(34,230,255,0.4)');
  ctx.drawImage(assets.minimap, mmX, mmY, mmW, mmH);
  const mx = (x) => mmX + (x / WORLD.w) * mmW, my = (y) => mmY + (y / WORLD.h) * mmH;
  for (const c of state.cars) {
    ctx.fillStyle = c.police ? (Math.floor(state.time * 4) % 2 ? '#ff4040' : '#4a7bff') : 'rgba(255,255,255,0.55)';
    ctx.fillRect(mx(c.x) - 1.6, my(c.y) - 1.6, 3.2, 3.2);
  }
  for (const m of (state.screen === 'play' ? activeMarkers(state) : [])) {
    ctx.fillStyle = '#22e6ff'; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(mx(m.x), my(m.y), 3.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 9;
  ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 4.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.hudDim; ctx.font = '700 9px Arial';
  ctx.fillText('P O R T   M E R I D I A N', mmX + 2, mmY + mmH + 13);
  // steal prompt / message line
  ctx.textAlign = 'center';
  if (state.prompt) {
    ctx.font = '700 15px Arial';
    const pw = ctx.measureText(state.prompt).width + 44;
    panel(ctx, w / 2 - pw / 2, h - 116, pw, 36, 'rgba(255,176,46,0.5)');
    ctx.fillStyle = '#ffcf6a'; ctx.fillText(state.prompt, w / 2, h - 92);
  } else if (state.msgT > 0 && state.message) {
    ctx.fillStyle = 'rgba(232,236,248,0.85)'; ctx.font = '600 14px Arial';
    ctx.fillText(state.message, w / 2, h - 88);
  }
  // controls hint
  ctx.fillStyle = 'rgba(143,160,200,0.75)'; ctx.font = '11px Arial'; ctx.textAlign = 'right';
  ctx.fillText('WASD drive · E steal · F punch · Esc pause', w - 16, h - 16);
  ctx.textAlign = 'left';
  // banner (mission complete / contract)
  if (state.banner) {
    ctx.globalAlpha = Math.min(1, state.banner.timer);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d'; ctx.shadowColor = '#ff9a1e'; ctx.shadowBlur = 26;
    ctx.font = '900 44px "Arial Black", Arial';
    ctx.fillText(state.banner.text, w / 2, h / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.hud; ctx.font = '600 17px Arial';
    ctx.fillText(state.banner.sub, w / 2, h / 2 - 10);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
}

function drawTitle(ctx, state, w, h, best) {
  ctx.fillStyle = 'rgba(4,7,20,0.45)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#22e6ff'; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 34;
  ctx.font = `900 ${Math.min(92, w / 12)}px "Arial Black", Arial`;
  ctx.fillText('PORT MERIDIAN', w / 2, h * 0.30);
  ctx.fillStyle = '#ff3ea5'; ctx.shadowColor = '#ff3ea5'; ctx.shadowBlur = 30;
  ctx.font = `900 ${Math.min(64, w / 17)}px "Arial Black", Arial`;
  ctx.fillText('N E O N   T I D E', w / 2, h * 0.30 + Math.min(88, w / 10.5));
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(232,236,248,0.9)'; ctx.font = 'italic 16px Georgia, serif';
  ctx.fillText('Three contracts. One harbor. No names.', w / 2, h * 0.30 + Math.min(132, w / 7));
  // start button
  const bw = 280, bh = 54, bx = w / 2 - bw / 2, by = h * 0.60;
  const pulse = 0.75 + Math.sin(state.time * 2.4) * 0.25;
  ctx.fillStyle = `rgba(34,230,255,${0.16 + pulse * 0.12})`;
  ctx.strokeStyle = '#22e6ff'; ctx.lineWidth = 2.4; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 18 * pulse + 8;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#dff8ff'; ctx.font = '800 21px "Arial Black", Arial';
  ctx.fillText('ENTER THE TIDE', w / 2, by + 35);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(5,8,20,0.62)';
  ctx.beginPath(); ctx.roundRect(w / 2 - 400, by + 74, 800, 50, 10); ctx.fill();
  ctx.fillStyle = 'rgba(232,236,248,0.9)'; ctx.font = '13px Arial';
  ctx.fillText('WASD / arrows — move & drive      E — steal or ride a car      F / click — punch', w / 2, by + 94);
  ctx.fillText('Esc / P — pause      Close contracts around the harbor to clear the tide', w / 2, by + 114);
  ctx.fillText('Storm surges pay +$250 at every marker — the radar beam does not forgive heat', w / 2, by + 132);
  const done = best.complete ? 'CITY CLEAR' : `${best.missions}/3 contracts`;
  ctx.fillStyle = '#ffd34d'; ctx.font = '700 15px Arial';
  ctx.fillText(`BEST RUN — $${best.cash.toLocaleString('en-US')}  ·  ${done}`, w / 2, by + 148);
  ctx.fillStyle = 'rgba(143,160,200,0.55)'; ctx.font = '10px Arial';
  ctx.fillText('A fictional port city. All names, streets and neon are its own.', w / 2, h - 18);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(4,7,20,0.62)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#22e6ff'; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 22;
  ctx.font = '900 54px "Arial Black", Arial';
  ctx.fillText('H O L D I N G', w / 2, h / 2 - 30);
  ctx.shadowBlur = 0; ctx.fillStyle = COLORS.hud; ctx.font = '16px Arial';
  ctx.fillText('Esc / P — back to the tide        R — restart the night', w / 2, h / 2 + 14);
  ctx.textAlign = 'left';
}

function drawGameOver(ctx, state, w, h, best) {
  ctx.fillStyle = 'rgba(20,2,8,0.72)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4b4b'; ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 30;
  ctx.font = '900 60px "Arial Black", Arial';
  ctx.fillText('THE TIDE TAKES YOU', w / 2, h * 0.36);
  ctx.shadowBlur = 0; ctx.fillStyle = COLORS.hud; ctx.font = '17px Arial';
  ctx.fillText('The cruisers boxed you in between the cranes.', w / 2, h * 0.36 + 40);
  ctx.fillStyle = COLORS.cash; ctx.font = '700 20px Arial';
  ctx.fillText(`Night's take: $${state.stats.earned.toLocaleString('en-US')}  ·  Contracts closed: ${Math.min(state.missions.index, MISSIONS.length)}/${MISSIONS.length}`, w / 2, h * 0.36 + 78);
  ctx.fillStyle = 'rgba(232,236,248,0.85)'; ctx.font = '600 17px Arial';
  ctx.fillText('ENTER — run it back from the Salmarket crossing', w / 2, h * 0.36 + 128);
  ctx.textAlign = 'left';
}

function drawComplete(ctx, state, w, h, best) {
  ctx.fillStyle = 'rgba(6,10,26,0.78)'; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d'; ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 32;
  ctx.font = '900 58px "Arial Black", Arial';
  ctx.fillText('N E O N   T I D E', w / 2, h * 0.24);
  ctx.fillStyle = '#22e6ff'; ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 24;
  ctx.font = '900 34px "Arial Black", Arial';
  ctx.fillText('C I T Y   C L E A R', w / 2, h * 0.24 + 52);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(232,236,248,0.92)'; ctx.font = '15px Arial';
  ctx.fillText('Every contract closed. The harbor keeps your name — or none at all.', w / 2, h * 0.24 + 84);
  const rows = [
    ['CONTRACTS CLOSED', `${MISSIONS.length} / ${MISSIONS.length}`],
    ['CASH EARNED', `$${state.stats.earned.toLocaleString('en-US')}`],
    ['CARS TAKEN', `${state.stats.takenCars}`],
    ['STRIKES ON RECORD', `${state.stats.crimes}`],
    ['SURGE BONUSES', `${state.stats.surge | 0}`],
    ['BEST NIGHT', `$${best.cash.toLocaleString('en-US')}${best.complete ? '  ·  CITY CLEAR' : ''}`],
  ];
  let y = h * 0.46;
  for (const [k, v] of rows) {
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.hudDim; ctx.font = '700 14px Arial';
    ctx.fillText(k, w / 2 - 14, y);
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.hud; ctx.font = '800 15px Arial';
    ctx.fillText(v, w / 2 + 14, y);
    y += 30;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(232,236,248,0.85)'; ctx.font = '600 15px Arial';
  ctx.fillText('ENTER — back to the docks', w / 2, y + 26);
  ctx.textAlign = 'left';
}
