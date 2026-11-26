// Island Air Rally — the game itself: state, loop, screens, scoring.
// One job: own the loop and the rules (title → fly → rings → land / crash /
// done). Rendering lives in render.js, physics in physics.js, HUD in hud.js.
import { CONFIG } from './config.js';
import { createPlane, stepPlane, distanceTo } from './physics.js';
import { buildRings, ringGap, terrainHeight } from './world.js';
import { Renderer } from './render.js';
import { buildHud, updateHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const hud = buildHud();
const input = createInput(canvas);
const audio = createAudio();

const state = {
  screen: 'title', // title | play | pause | done | crash
  plane: createPlane(),
  rings: buildRings(),
  particles: [],
  cameraMode: 'chase',
  message: '',
  messageUntil: 0,
  best: 0,
  muted: false,
  shotMode: false,
  time: 0,
};

function showMessage(text, seconds = 2.5) {
  state.message = text;
  state.messageUntil = performance.now() / 1000 + seconds;
}

function resetGame() {
  state.plane = createPlane();
  state.rings = buildRings();
  state.particles = [];
  state.screen = 'title';
  state.message = '';
  input.reset();
  document.getElementById('screen-title').classList.remove('hidden');
  document.getElementById('screen-done').classList.add('hidden');
  document.getElementById('screen-crash').classList.add('hidden');
}

function startGame() {
  state.screen = 'play';
  state.plane.throttle = 0;
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('screen-done').classList.add('hidden');
  document.getElementById('screen-crash').classList.add('hidden');
  audio.ensure();
  showMessage('Full throttle — pull up at 70 kt!', 3.5);
}

function endGame(kind) {
  const p = state.plane;
  if (kind === 'done') {
    const timeBonus = Math.max(0, Math.round((600 - p.time) * CONFIG.timeBonusPerSecond));
    p.score += timeBonus;
    state.screen = 'done';
    document.getElementById('done-score').textContent = String(p.score);
    document.getElementById('done-time').textContent = `${Math.floor(p.time / 60)}:${String(Math.floor(p.time % 60)).padStart(2, '0')}`;
    document.getElementById('done-landings').textContent = String(p.landedCount);
    document.getElementById('screen-done').classList.remove('hidden');
    if (p.score > state.best) state.best = p.score;
  } else {
    state.screen = 'crash';
    document.getElementById('crash-score').textContent = String(p.score);
    document.getElementById('crash-rings').textContent = `${p.ringsPassed}/${CONFIG.ringCount}`;
    document.getElementById('screen-crash').classList.remove('hidden');
    audio.crash();
  }
}

function burstRing(ring) {
  for (let i = 0; i < 42; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 2;
    state.particles.push({
      x: ring.x,
      y: ring.y,
      z: ring.z,
      vx: Math.cos(a) * 14,
      vy: Math.sin(b) * 10,
      vz: Math.sin(a) * 14,
      life: 1,
      color: i % 3 === 0 ? '#ffd23e' : '#ff9d3c',
    });
  }
}

function updateParticles(dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vy -= 12 * dt;
    pt.life -= dt * 1.4;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

// One fixed step of play: input → physics → rings → events.
function playStep(dt) {
  const p = state.plane;
  const inputState = input.poll(dt);
  const event = stepPlane(p, inputState, dt, state.rings);
  audio.engine(p.throttle, p.speed, p.airborne);

  const next = state.rings.find((r) => !r.passed) || null;
  if (next) {
    const gap = ringGap(next, p.x, p.y, p.z);
    if (Math.abs(gap.along) < 7 && gap.dist < next.radius + 3) {
      next.passed = true;
      p.ringsPassed += 1;
      p.score += CONFIG.ringScore;
      burstRing(next);
      audio.ring();
      if (p.ringsPassed >= CONFIG.ringCount) {
        showMessage('COURSE CLEAR — rally complete!', 4);
        endGame('done');
        return;
      }
      showMessage(`RING ${p.ringsPassed}/${CONFIG.ringCount} — +${CONFIG.ringScore}`, 2);
    }
  }

  if (event === 'takeoff') showMessage('Airborne!', 1.6);
  if (event === 'landed') {
    showMessage(`Landed — refuelled +${CONFIG.landingScore}`, 2.5);
    audio.landed();
  }
  if (event === 'crash-terrain' || event === 'crash-water') {
    const why = event === 'crash-water' ? 'ditched in the sea' : 'hit the ground';
    document.getElementById('crash-why').textContent = `You ${why}.`;
    endGame('crash');
    return;
  }
  if (p.fuel <= 0 && p.airborne && !state.lowFuelWarned) {
    state.lowFuelWarned = true;
    showMessage('FUEL EMPTY — glide to the runway!', 4);
  }
  if (p.fuel > 10) state.lowFuelWarned = false;
  updateParticles(dt);
}

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  state.time = now / 1000;
  if (state.screen === 'play') {
    acc += dtMs / 1000;
    while (acc >= STEP) {
      playStep(STEP);
      acc -= STEP;
      if (state.screen !== 'play') break;
    }
  }
  // Keys that work on any screen.
  if (input.wasPressed('enter') && state.screen === 'title') startGame();
  if (input.wasPressed('r') && (state.screen === 'done' || state.screen === 'crash')) resetGame();
  if (input.wasPressed('enter') && (state.screen === 'done' || state.screen === 'crash')) resetGame();
  if (input.wasPressed('p') && state.screen === 'play') {
    state.screen = 'pause';
    showMessage('Paused — press P to fly on', 999);
  } else if (input.wasPressed('p') && state.screen === 'pause') {
    state.screen = 'play';
    showMessage('', 0);
  }
  if (input.wasPressed('v')) {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (input.wasPressed('m')) {
    state.muted = audio.toggleMute();
    showMessage(state.muted ? 'Sound off' : 'Sound on', 1.2);
  }
  const next = state.rings.find((r) => !r.passed) || null;
  renderer.draw(state, state.time);
  updateHud(hud, state.plane, next, state.message, state.messageUntil, state.time);
  document.getElementById('hud').style.opacity = state.screen === 'title' ? '0.55' : '1';
}

function resize() {
  renderer.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

// Buttons on the title / end screens.
document.getElementById('btn-fly').addEventListener('click', () => { audio.ensure(); startGame(); });
document.getElementById('btn-again').addEventListener('click', () => resetGame());
document.getElementById('btn-retry').addEventListener('click', () => resetGame());

// Deterministic screenshot mode: ?shot=start|play|ring|end&seed=N
// stages the world with the autopilot, draws one frozen frame, and stops.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  state.shotMode = true;
  const world = {
    plane: state.plane,
    rings: state.rings,
    reset() {
      state.plane = createPlane();
      state.rings = buildRings();
      state.particles = [];
      this.plane = state.plane;
      this.rings = state.rings;
    },
  };
  const staged = stageShot(shot, world);
  state.screen = staged.screen;
  state.best = staged.best;
  // Hide every screen first: the title card is visible by default.
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('screen-done').classList.add('hidden');
  document.getElementById('screen-crash').classList.add('hidden');
  if (staged.screen === 'title') {
    document.getElementById('screen-title').classList.remove('hidden');
  } else if (staged.screen === 'done') {
    const p = state.plane;
    document.getElementById('done-score').textContent = String(p.score);
    document.getElementById('done-time').textContent = `${Math.floor(p.time / 60)}:${String(Math.floor(p.time % 60)).padStart(2, '0')}`;
    document.getElementById('done-landings').textContent = String(p.landedCount);
    document.getElementById('screen-done').classList.remove('hidden');
  } else if (staged.screen === 'crash') {
    document.getElementById('crash-score').textContent = String(state.plane.score);
    document.getElementById('crash-rings').textContent = `${state.plane.ringsPassed}/${CONFIG.ringCount}`;
    document.getElementById('crash-why').textContent = 'The autopilot ran out of luck.';
    document.getElementById('screen-crash').classList.remove('hidden');
  }
  state.time = 12;
  renderer.draw(state, 12);
  const next = state.rings.find((r) => !r.passed) || null;
  updateHud(hud, state.plane, next, '', 0, 12);
  document.getElementById('hud').style.opacity = '1';
  document.title = `shot:${shot}`;
} else {
  requestAnimationFrame(frame);
}
