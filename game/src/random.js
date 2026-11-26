// Island Air Rally — deterministic randomness.
// One job: a seeded RNG and smooth 2D value noise, so the same seed
// always builds the same island (screenshots, replays, grading).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth interpolation between 0 and 1.
function smooth(t) {
  return t * t * (3 - 2 * t);
}

// A hash of integer lattice points, stable for any (x, y).
function latticeHash(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise in [-1, 1], bilinear-smoothed over a grid of `cell` metres.
export function valueNoise(x, y, cell, seed) {
  const gx = x / cell;
  const gy = y / cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smooth(gx - ix);
  const fy = smooth(gy - iy);
  const a = latticeHash(ix, iy, seed);
  const b = latticeHash(ix + 1, iy, seed);
  const c = latticeHash(ix, iy + 1, seed);
  const d = latticeHash(ix + 1, iy + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fy) * 2 - 1;
}

// Fractal noise: several octaves of value noise added together.
export function fbm(x, y, seed) {
  let total = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < 4; o += 1) {
    total += valueNoise(x * freq, y * freq, 260, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return total / norm;
}
