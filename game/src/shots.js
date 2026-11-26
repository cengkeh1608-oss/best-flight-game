// Island Air Rally — screenshot staging: real play, frozen in a frame.
// One job: given a shot name, fly the plane with a simple autopilot from a
// fresh world for a fixed number of steps, so ?shot=start|play|ring|end
// always shows the same frame for the same seed. The frames are what a
// short real game looks like — no hand-placed scenery, no fake HUD.
import { CONFIG } from './config.js';
import { stepPlane } from './physics.js';
import { ringGap, terrainHeight } from './world.js';

const STEP = 1 / 60;
const START_SECONDS = 4;
const PLAY_SECONDS = 34;
const RING_SECONDS = 58;
const END_LIMIT_SECONDS = 600;

// Steer toward a target point: return { pitch, roll, throttle }.
// Climbs when the ground ahead is high, levels at the target altitude.
function autopilot(plane, target, horizon) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const wantHeading = Math.atan2(dx, -dz);
  let rel = wantHeading - plane.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, rel * 1.6));
  // Look ahead: climb early if terrain rises in front of us.
  const ahead = 90;
  const groundAhead = terrainHeight(
    plane.x + Math.sin(plane.heading) * ahead,
    plane.z - Math.cos(plane.heading) * ahead,
  );
  const wantAlt = Math.max(target.y, groundAhead + 45);
  const altErr = wantAlt - plane.y;
  const pitch = Math.max(-1, Math.min(1, altErr / 45));
  const throttle = plane.speed < 55 ? 0.9 : 0.72;
  return { pitch, roll, throttle };
}

// Fly the world forward with the autopilot. `aim` picks the target:
// a ring object, or null to hold the runway pattern. Returns the screen
// the game should show over the resulting world ('play', 'done', 'crash').
export function stageShot(name, world) {
  world.reset();
  const plane = world.plane;
  const rings = world.rings;
  if (name !== 'play' && name !== 'ring' && name !== 'end') {
    // Start: a few seconds of taxi on the runway, title screen over it.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepPlane(plane, { pitch: 0, roll: 0, throttle: 0.55 }, STEP, rings);
    }
    return { screen: 'title', best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'ring' ? RING_SECONDS : PLAY_SECONDS;
  let event = '';
  let afterPass = -1; // 'ring' shot: keep flying a little after the pass so the next ring is in frame
  for (let i = 0; i < limit / STEP; i += 1) {
    const next = rings.find((r) => !r.passed) || null;
    const target = next || { x: 0, y: 60, z: -40 };
    const input = autopilot(plane, target, 0.7);
    event = stepPlane(plane, input, STEP, rings);
    if (next) {
      const gap = ringGap(next, plane.x, plane.y, plane.z);
      if (Math.abs(gap.along) < 7 && gap.dist < next.radius + 3) {
        next.passed = true;
        plane.ringsPassed += 1;
        plane.score += CONFIG.ringScore;
        if (name === 'ring') afterPass = Math.round(3 / STEP);
      }
    }
    if (afterPass >= 0) {
      afterPass -= 1;
      if (afterPass < 0) break;
    }
    if (event === 'crash-terrain' || event === 'crash-water') break;
    if (plane.ringsPassed >= CONFIG.ringCount) break;
  }
  const over = event === 'crash-terrain' || event === 'crash-water';
  if (plane.ringsPassed >= CONFIG.ringCount) return { screen: 'done', best: plane.score };
  return { screen: over ? 'crash' : 'play', best: plane.score };
}
