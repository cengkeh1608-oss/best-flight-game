// Island Air Rally — the flight model.
// One job: step the plane one tick (dt seconds) from pilot input.
import { CONFIG } from './config.js';
import { onRunway, terrainHeight } from './world.js';

// Pilot input: pitch -1..1 (up positive), roll -1..1 (right positive),
// throttle 0..1. All inputs are already smoothed by input.js.
export function createPlane() {
  const r = CONFIG.runway;
  return {
    x: r.x,
    y: r.y + 2,
    z: r.z + r.length / 2 - 30,
    heading: 0, // 0 = north (-z), grows clockwise
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.fuelMax,
    damage: 0,
    verticalSpeed: 0,
    airborne: false,
    landed: true,
    score: 0,
    ringsPassed: 0,
    time: 0,
    landedCount: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// One physics step. Returns an event string or '' :
// 'takeoff' | 'landed' | 'crash-terrain' | 'crash-water' | 'ring' is handled by main.
export function stepPlane(p, input, dt, rings) {
  p.time += dt;

  // Throttle eases toward the lever; speed eases toward throttle speed.
  const targetSpeed = input.throttle * CONFIG.maxSpeed;
  p.speed += (targetSpeed - p.speed) * Math.min(1, CONFIG.accel * dt / Math.max(20, CONFIG.maxSpeed));
  p.speed -= p.speed * CONFIG.drag * dt * 0.35;
  if (p.speed < 0) p.speed = 0;

  // Attitude follows the stick, with authority that grows with speed.
  const authority = clamp(p.speed / 45, 0.25, 1);
  const targetPitch = input.pitch * CONFIG.maxPitch * authority;
  const targetRoll = input.roll * CONFIG.maxRoll * authority;
  p.pitch += (targetPitch - p.pitch) * Math.min(1, CONFIG.pitchRate * 2.2 * dt);
  p.roll += (targetRoll - p.roll) * Math.min(1, CONFIG.rollRate * 2.2 * dt);

  // Banking turns the nose; the turn tightens with speed. A right bank
  // (roll positive, right wing down) turns right: heading grows.
  const turn = p.roll * CONFIG.turnRate * clamp(p.speed / CONFIG.maxSpeed, 0.2, 1);
  p.heading += turn * dt;

  // Lift: climbing needs speed. Below min speed the wing quits and she sinks.
  const flying = p.speed > CONFIG.minFlySpeed;
  const lift = flying ? Math.sin(p.pitch) * CONFIG.climbRate * (p.speed / CONFIG.maxSpeed) : 0;
  let vs = lift;
  if (!flying) vs -= CONFIG.sinkRate * (1 - p.speed / CONFIG.minFlySpeed) + CONFIG.gravitySink * 0.4;
  if (input.throttle < 0.15 && flying) vs -= 2.5;
  p.verticalSpeed = vs;

  // Move.
  const fx = Math.sin(p.heading);
  const fz = -Math.cos(p.heading);
  p.x += fx * Math.cos(p.pitch) * p.speed * dt;
  p.z += fz * Math.cos(p.pitch) * p.speed * dt;
  p.y += vs * dt;

  // Fuel: thirsty at full throttle, sipping at idle.
  const burn = CONFIG.fuelBurnIdle + (CONFIG.fuelBurn - CONFIG.fuelBurnIdle) * input.throttle;
  p.fuel = Math.max(0, p.fuel - burn * dt);
  p.throttle = input.throttle;

  // Takeoff roll: once fast enough and pulling up, she leaves the ground.
  // Airborne means truly off the ground (y above ground + 2.5), so a fast
  // runway roll never counts as flying — and never as a landing either.
  const ground = terrainHeight(p.x, p.z);
  const wasAirborne = p.airborne;
  p.airborne = p.y > ground + 2.5;
  if (p.airborne && !wasAirborne && p.speed > 34) {
    p.landed = false;
    return 'takeoff';
  }

  // Ground contact.
  if (p.y <= ground + 1.6) {
    p.y = ground + 1.6;
    if (!wasAirborne) {
      // Rolling or parked on the ground: nothing to decide.
      p.airborne = false;
      p.landed = true;
      return '';
    }
    // Coming down from flight: landing or crash?
    if (onRunway(p.x, p.z)) {
      const gentle = Math.abs(vs) < 7 && Math.abs(p.roll) < 0.35 && Math.abs(p.pitch) < 0.3;
      const aligned = angleDiff(p.heading, 0) < 0.6 || angleDiff(p.heading, Math.PI) < 0.6;
      if (gentle && aligned) {
        // Touchdown: roll out, refuel, repair a little.
        p.speed = Math.max(0, p.speed - 26 * dt);
        p.landed = true;
        p.airborne = false;
        p.fuel = CONFIG.fuelMax;
        p.damage = Math.max(0, p.damage - 25);
        p.landedCount += 1;
        p.score += CONFIG.landingScore;
        return 'landed';
      }
      if (p.speed > 20 || Math.abs(vs) > 7) {
        p.damage = CONFIG.damageMax;
        return 'crash-terrain';
      }
    }
    if (ground < 0.5) return 'crash-water';
    if (p.speed > 20 || Math.abs(vs) > 7) return 'crash-terrain';
    // A slow, gentle field landing: wheels down in the grass, no refuel.
    p.airborne = false;
    p.landed = true;
    p.damage = Math.min(CONFIG.damageMax, p.damage + 20);
    return '';
  }
  return '';
}

function angleDiff(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

// Score helper: squared distance to the next ring, for the HUD arrow.
export function distanceTo(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
