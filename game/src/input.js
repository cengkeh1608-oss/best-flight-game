// Island Air Rally — input: keyboard + mouse, smoothed into pilot input.
// One job: read keys and pointer drags and hand main.js a clean
// { pitch, roll, throttle } each frame. No input, no surprises.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1..1, up positive
    roll: 0, // -1..1, right positive
    throttle: 0, // 0..1
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    pressed: new Set(), // keys pressed since last poll (edge-triggered)
  };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) state.pressed.add(e.key.toLowerCase());
    keys.add(e.key.toLowerCase());
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('pointerdown', (e) => {
    state.mouseDown = true;
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.mouseDown) return;
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  });
  const release = () => { state.mouseDown = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // Poll once per frame: smooth the stick toward the held keys / mouse.
  function poll(dt) {
    let pitchTarget = 0;
    let rollTarget = 0;
    if (keys.has('arrowup') || keys.has('w')) pitchTarget += 1;
    if (keys.has('arrowdown') || keys.has('s')) pitchTarget -= 1;
    if (keys.has('arrowleft') || keys.has('a')) rollTarget -= 1;
    if (keys.has('arrowright') || keys.has('d')) rollTarget += 1;
    // Mouse drag: drag up to climb, drag sideways to bank.
    if (state.mouseDown) {
      const dx = (state.mouseX - window.innerWidth / 2) / (window.innerWidth / 2);
      const dy = (state.mouseY - window.innerHeight / 2) / (window.innerHeight / 2);
      rollTarget += Math.max(-1, Math.min(1, dx * 1.4));
      pitchTarget += Math.max(-1, Math.min(1, -dy * 1.4));
    }
    const k = Math.min(1, dt * 7);
    state.pitch += (Math.max(-1, Math.min(1, pitchTarget)) - state.pitch) * k;
    state.roll += (Math.max(-1, Math.min(1, rollTarget)) - state.roll) * k;
    // Throttle lever: Shift/W up, Control/S down, or 0-9 keys jump to a notch.
    if (keys.has('shift')) state.throttle = Math.min(1, state.throttle + dt * 0.7);
    if (keys.has('control')) state.throttle = Math.max(0, state.throttle - dt * 0.7);
    for (let n = 0; n <= 9; n += 1) {
      if (keys.has(String(n))) state.throttle = n / 9;
    }
    return { pitch: state.pitch, roll: state.roll, throttle: state.throttle };
  }

  // Edge-triggered keys, consumed by main.js (Enter, R, P, V, M).
  function wasPressed(key) {
    const hit = state.pressed.has(key.toLowerCase());
    if (hit) state.pressed.delete(key.toLowerCase());
    return hit;
  }

  function reset() {
    state.pitch = 0;
    state.roll = 0;
    state.throttle = 0;
    state.mouseDown = false;
  }

  return { poll, wasPressed, reset, state };
}
