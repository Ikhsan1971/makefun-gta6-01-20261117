// Keyboard + mouse. Keys are by e.code; clicks land on the canvas.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.clicks = [];
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.clicks.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      this.pressed.add('MouseClick');
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code); }
  takePressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  endFrame() { this.pressed.clear(); this.clicks.length = 0; }
}
