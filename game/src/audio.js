// Web Audio synthesized SFX and engine hum — no external assets.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engine = null; // {osc1, osc2, gain, filter}
    this.lastSiren = 0;
    this.muted = false;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  setMuted(m) { this.muted = m; if (m) this.engineStop(); }
  tone(freq, dur, type = 'sine', vol = 0.18, slide = null, when = 0) {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  noise(dur = 0.3, vol = 0.25, lowpass = 900, when = 0) {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = lowpass;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }
  engineStart() {
    const ctx = this.ensure(); if (!ctx || this.engine) return;
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
    const osc2 = ctx.createOscillator(); osc2.type = 'square';
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 7;
    const gain = ctx.createGain(); gain.gain.value = 0.045;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain).connect(ctx.destination);
    osc1.start(); osc2.start();
    this.engine = { osc1, osc2, gain, filter };
  }
  engineFrame(speed, maxSpeed) {
    if (!this.engine || this.muted) return;
    const ratio = Math.abs(speed) / maxSpeed;
    const base = 46 + ratio * 108;
    this.engine.osc1.frequency.value = base;
    this.engine.osc2.frequency.value = base * 0.5 + 3;
    this.engine.filter.frequency.value = 260 + ratio * 900;
  }
  engineStop() {
    if (!this.engine) return;
    const { osc1, osc2, gain } = this.engine;
    try { gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08); osc1.stop(this.ctx.currentTime + 0.3); osc2.stop(this.ctx.currentTime + 0.3); } catch { /* already stopped */ }
    this.engine = null;
  }
  siren(wanted) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now - this.lastSiren < 1.05 || wanted <= 0) return;
    this.lastSiren = now;
    this.tone(660, 0.32, 'triangle', 0.09, null, 0);
    this.tone(495, 0.32, 'triangle', 0.09, null, 0.36);
  }
  punch(hit) { if (hit) { this.noise(0.12, 0.3, 500); this.tone(140, 0.16, 'square', 0.16, 70); } else this.noise(0.05, 0.1, 1200); }
  crash() { this.noise(0.4, 0.35, 420); this.tone(82, 0.4, 'sawtooth', 0.2, 38); }
  thud() { this.noise(0.18, 0.28, 380); }
  hurt() { this.tone(220, 0.2, 'sawtooth', 0.15, 110); }
  cash() { this.tone(880, 0.14, 'sine', 0.16); this.tone(1320, 0.22, 'sine', 0.16, null, 0.1); }
  missionStage() { this.tone(520, 0.12, 'triangle', 0.15); this.tone(780, 0.16, 'triangle', 0.15, null, 0.09); }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.17, null, i * 0.13));
  }
  blip() { this.tone(740, 0.09, 'sine', 0.12); }
  stormWarning() {
    this.noise(1.4, 0.22, 240);
    this.tone(58, 1.3, 'sawtooth', 0.2, 44);
    this.tone(392, 0.3, 'triangle', 0.1, null, 0.2);
    this.tone(392, 0.3, 'triangle', 0.1, null, 0.65);
  }
  radarPing() { this.tone(1180, 0.08, 'square', 0.14); this.tone(1180, 0.08, 'square', 0.14, null, 0.14); }
  uiConfirm() { this.tone(392, 0.1, 'square', 0.12); this.tone(523, 0.16, 'square', 0.12, null, 0.08); }
}
