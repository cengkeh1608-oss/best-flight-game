// Island Air Rally — the world: terrain, runway, rings, collisions.
// One job: answer "how high is the ground here?" and "where is the course?"
import { CONFIG, RING_COURSE } from './config.js';
import { fbm } from './random.js';

const SEED = CONFIG.seed;

// Island centres: a main island and three smaller ones in the sea.
const ISLANDS = [
  { x: 0, z: 0, r: 880, h: 150 },
  { x: -820, z: -620, r: 300, h: 70 },
  { x: 830, z: 560, r: 340, h: 85 },
  { x: 760, z: -760, r: 240, h: 55 },
];

function islandFalloff(x, z) {
  let height = 0;
  for (const isle of ISLANDS) {
    const dx = x - isle.x;
    const dz = z - isle.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isle.r;
    if (d >= 1) continue;
    const dome = Math.pow(Math.cos((d * Math.PI) / 2), 1.4);
    const rough = 1 + 0.45 * fbm(x + isle.x, z + isle.z, SEED);
    height = Math.max(height, dome * isle.h * rough);
  }
  return height;
}

// The runway is flat ground: blend terrain down to runway height near it.
function runwayBlend(x, z) {
  const r = CONFIG.runway;
  const dx = x - r.x;
  const dz = z - r.z;
  const along = Math.abs(dz);
  const across = Math.abs(dx);
  const halfLen = r.length / 2 + 60;
  const halfWid = r.width / 2 + 46;
  if (along > halfLen || across > halfWid) return 0;
  const tAlong = Math.max(0, 1 - along / halfLen);
  const tAcross = Math.max(0, 1 - across / halfWid);
  return Math.min(tAlong, tAcross);
}

// Ground height in metres at world (x, z). Sea floor is below zero.
export function terrainHeight(x, z) {
  const land = islandFalloff(x, z);
  let ground = land - 4;
  // Flat airfield around the runway: takeoffs and landings need level
  // ground, so blend the island down to runway height near the strip.
  const adx = x - CONFIG.runway.x;
  const adz = z - CONFIG.runway.z;
  const ad = Math.sqrt(adx * adx + adz * adz);
  const flat = ad < 120 ? 1 : ad > 500 ? 0 : 1 - (ad - 120) / 380;
  if (flat > 0) ground = ground + (CONFIG.runway.y - ground) * flat;
  const blend = runwayBlend(x, z);
  if (blend <= 0) return ground;
  return ground + (CONFIG.runway.y - ground) * blend;
}

export function isWater(x, z) {
  return terrainHeight(x, z) < 0.5;
}

// Is (x, z) on the runway strip (for landing checks)?
export function onRunway(x, z) {
  const r = CONFIG.runway;
  return Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.length / 2;
}

// Ring list for a fresh rally: centres, radius, heading of approach.
export function buildRings() {
  return RING_COURSE.map((c, i) => {
    const next = RING_COURSE[(i + 1) % RING_COURSE.length];
    const dx = next.x - c.x;
    const dz = next.z - c.z;
    return {
      index: i,
      x: c.x,
      y: c.y,
      z: c.z,
      radius: CONFIG.ringRadius,
      // Forward is (sin h, 0, -cos h), so h = atan2(dx, -dz).
      heading: Math.atan2(dx, -dz),
      passed: false,
    };
  });
}

// Colour of terrain at height h with slope s (0 flat, 1 cliff), for the renderer.
export function terrainColor(h, slope) {
  if (h < 2.5) return CONFIG.sand;
  if (h > 132) return CONFIG.snow;
  if (slope > 0.55) return CONFIG.rock;
  if (h > 62) return CONFIG.forest;
  return CONFIG.grass;
}

// Distance from point (x, y, z) to a ring centre, and how far off its plane.
export function ringGap(ring, x, y, z) {
  const dx = x - ring.x;
  const dy = y - ring.y;
  const dz = z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Along the ring's facing direction (approach axis).
  const nx = Math.sin(ring.heading);
  const nz = Math.cos(ring.heading);
  const along = dx * nx + dz * nz;
  return { dist, along };
}
