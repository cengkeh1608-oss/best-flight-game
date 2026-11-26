// Island Air Rally — the renderer: a small software 3D engine on 2D canvas.
// One job: turn the plane + world into a picture (sky, sea, terrain,
// runway, rings, aircraft). No WebGL, no libraries — plain canvas,
// so it runs identically in any desktop browser, online or off.
import { CONFIG } from './config.js';
import { terrainColor, terrainHeight } from './world.js';

const SUN_DIR = norm([0.45, 0.62, -0.55]); // afternoon sun, north-west high

function norm(v) {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// Mix two #rrggbb colours by t (0 = a, 1 = b).
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function shade(hex, f) {
  const p = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((p >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((p >> 8) & 255) * f));
  const b = Math.min(255, Math.round((p & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// The plane's body axes from heading / pitch / roll.
export function planeBasis(p) {
  const ch = Math.cos(p.heading);
  const sh = Math.sin(p.heading);
  const cp = Math.cos(p.pitch);
  const sp = Math.sin(p.pitch);
  const fwd = [sh * cp, sp, -ch * cp];
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  const cr = Math.cos(p.roll);
  const sr = Math.sin(p.roll);
  const right2 = [
    right[0] * cr + up[0] * sr,
    right[1] * cr + up[1] * sr,
    right[2] * cr + up[2] * sr,
  ];
  const up2 = [
    up[0] * cr - right[0] * sr,
    up[1] * cr - right[1] * sr,
    up[2] * cr - right[2] * sr,
  ];
  return { fwd, right: right2, up: up2 };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.focal = 1;
    this.camPos = [0, 0, 0];
    this.camFwd = [0, 0, -1];
    this.camRight = [1, 0, 0];
    this.camUp = [0, 1, 0];
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.focal = (h / 2) / Math.tan(((CONFIG.cameraFov / 2) * Math.PI) / 180);
  }

  // Chase camera behind the plane, or cockpit when mode is 'cockpit'.
  placeCamera(p, mode) {
    const { fwd, up } = planeBasis(p);
    if (mode === 'cockpit') {
      this.camPos = [
        p.x + fwd[0] * 1.4 + up[0] * 1.15,
        p.y + fwd[1] * 1.4 + up[1] * 1.15,
        p.z + fwd[2] * 1.4 + up[2] * 1.15,
      ];
      const target = [p.x + fwd[0] * 40, p.y + fwd[1] * 40, p.z + fwd[2] * 40];
      this.lookAt(this.camPos, target);
      return;
    }
    this.camPos = [
      p.x - fwd[0] * CONFIG.cameraDistance + 0,
      p.y - fwd[1] * CONFIG.cameraDistance + CONFIG.cameraHeight,
      p.z - fwd[2] * CONFIG.cameraDistance,
    ];
    // Never let the camera sink under the terrain.
    const ground = terrainHeight(this.camPos[0], this.camPos[2]);
    if (this.camPos[1] < ground + 2.5) this.camPos[1] = ground + 2.5;
    const target = [p.x + fwd[0] * 26, p.y + fwd[1] * 26 + 1, p.z + fwd[2] * 26];
    this.lookAt(this.camPos, target);
  }

  lookAt(eye, target) {
    const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    this.camFwd = f;
    this.camRight = r;
    this.camUp = u;
  }

  // Project a world point to screen {x, y, d} (d = depth), or null if behind.
  project(px, py, pz) {
    const dx = px - this.camPos[0];
    const dy = py - this.camPos[1];
    const dz = pz - this.camPos[2];
    const cz = dx * this.camFwd[0] + dy * this.camFwd[1] + dz * this.camFwd[2];
    if (cz < 0.6) return null;
    const cx = dx * this.camRight[0] + dy * this.camRight[1] + dz * this.camRight[2];
    const cy = dx * this.camUp[0] + dy * this.camUp[1] + dz * this.camUp[2];
    return {
      x: this.w / 2 + (cx / cz) * this.focal,
      y: this.h / 2 - (cy / cz) * this.focal,
      d: cz,
    };
  }

  fogFactor(d) {
    const t = (d - CONFIG.fogNear) / (CONFIG.fogFar - CONFIG.fogNear);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  drawSky(time) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, CONFIG.skyTop);
    g.addColorStop(0.45, CONFIG.skyMid);
    g.addColorStop(0.75, CONFIG.skyLow);
    g.addColorStop(1, '#e8f2f8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    // Sun: a soft disc high in the sky, placed by direction.
    const sun = this.project(
      this.camPos[0] + SUN_DIR[0] * 900,
      this.camPos[1] + SUN_DIR[1] * 900,
      this.camPos[2] + SUN_DIR[2] * 900,
    );
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
      glow.addColorStop(0, 'rgba(255,246,200,0.95)');
      glow.addColorStop(0.25, 'rgba(255,236,160,0.55)');
      glow.addColorStop(1, 'rgba(255,236,160,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 95, sun.y - 95, 190, 190);
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSea() {
    // A big quad at sea level, drawn before the terrain covers the land.
    const ctx = this.ctx;
    const S = 3200;
    const c = this.camPos;
    const corners = [
      this.project(c[0] - S, 0.4, c[2] - S),
      this.project(c[0] + S, 0.4, c[2] - S),
      this.project(c[0] + S, 0.4, c[2] + S),
      this.project(c[0] - S, 0.4, c[2] + S),
    ];
    if (corners.some((p) => p === null)) {
      // Camera is low: fall back to a horizon band fill.
      const horizonY = this.h * 0.62;
      const g = ctx.createLinearGradient(0, horizonY, 0, this.h);
      g.addColorStop(0, CONFIG.seaShallow);
      g.addColorStop(1, CONFIG.seaDeep);
      ctx.fillStyle = g;
      ctx.fillRect(0, horizonY, this.w, this.h - horizonY);
      return;
    }
    const g = ctx.createLinearGradient(0, Math.min(...corners.map((p) => p.y)), 0, this.h);
    g.addColorStop(0, CONFIG.seaShallow);
    g.addColorStop(1, CONFIG.seaDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // Terrain: a grid of quads around the camera, painter-sorted.
  drawTerrain() {
    const ctx = this.ctx;
    const cell = CONFIG.meshCell;
    const radius = CONFIG.meshRadius;
    const cx = Math.round(this.camPos[0] / cell) * cell;
    const cz = Math.round(this.camPos[2] / cell) * cell;
    const n = Math.round((radius * 2) / cell);
    const tris = [];
    for (let ix = 0; ix < n; ix += 1) {
      for (let iz = 0; iz < n; iz += 1) {
        const x0 = cx - radius + ix * cell;
        const z0 = cz - radius + iz * cell;
        const x1 = x0 + cell;
        const z1 = z0 + cell;
        const h00 = terrainHeight(x0, z0);
        const h10 = terrainHeight(x1, z0);
        const h01 = terrainHeight(x0, z1);
        const h11 = terrainHeight(x1, z1);
        // Skip open sea far from any shore: the sea quad already covers it.
        if (h00 < -2 && h10 < -2 && h01 < -2 && h11 < -2) continue;
        const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
        const hAvg = (h00 + h10 + h01 + h11) / 4;
        const base = terrainColor(hAvg, slope / cell);
        tris.push({ pts: [[x0, h00, z0], [x1, h10, z0], [x0, h01, z1]], base, hAvg });
        tris.push({ pts: [[x1, h10, z0], [x1, h11, z1], [x0, h01, z1]], base, hAvg });
      }
    }
    // Project, shade, sort far to near.
    const drawn = [];
    for (const t of tris) {
      const p0 = this.project(t.pts[0][0], t.pts[0][1], t.pts[0][2]);
      const p1 = this.project(t.pts[1][0], t.pts[1][1], t.pts[1][2]);
      const p2 = this.project(t.pts[2][0], t.pts[2][1], t.pts[2][2]);
      if (!p0 || !p1 || !p2) continue;
      // No backface cull: a heightfield's winding flips with the camera,
      // and the painter sort already hides what is behind.
      const d = (p0.d + p1.d + p2.d) / 3;
      drawn.push({ p0, p1, p2, d, base: t.base, hAvg: t.hAvg });
    }
    drawn.sort((a, b) => b.d - a.d);
    for (const t of drawn) {
      const fog = this.fogFactor(t.d);
      let fill = t.base;
      if (fog > 0) fill = mixHex(t.base, CONFIG.skyLow, fog * 0.85);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(t.p0.x, t.p0.y);
      ctx.lineTo(t.p1.x, t.p1.y);
      ctx.lineTo(t.p2.x, t.p2.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ---- runway, rings, aircraft, clouds, particles (appended to Renderer) ----

Renderer.prototype.drawRunway = function drawRunway() {
  const ctx = this.ctx;
  const r = CONFIG.runway;
  const y = r.y + 0.4;
  const hw = r.width / 2;
  const hl = r.length / 2;
  const corners = [
    this.project(r.x - hw, y, r.z - hl),
    this.project(r.x + hw, y, r.z - hl),
    this.project(r.x + hw, y, r.z + hl),
    this.project(r.x - hw, y, r.z + hl),
  ];
  if (corners.some((p) => p === null)) return;
  ctx.fillStyle = '#3a3f46';
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = '#f5f0dc';
  for (let d = -hl + 18; d < hl - 10; d += 32) {
    const a = this.project(r.x - 1.1, y + 0.05, r.z + d);
    const b = this.project(r.x + 1.1, y + 0.05, r.z + d);
    const c = this.project(r.x + 1.1, y + 0.05, r.z + d + 16);
    const e = this.project(r.x - 1.1, y + 0.05, r.z + d + 16);
    if (!a || !b || !c || !e) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars at both ends.
  ctx.fillStyle = '#f5f0dc';
  for (const end of [-hl + 6, hl - 6]) {
    for (const off of [-9, -3, 3, 9]) {
      const a = this.project(r.x + off - 2, y + 0.05, r.z + end - 4);
      const b = this.project(r.x + off + 2, y + 0.05, r.z + end - 4);
      const c = this.project(r.x + off + 2, y + 0.05, r.z + end + 4);
      const e = this.project(r.x + off - 2, y + 0.05, r.z + end + 4);
      if (!a || !b || !c || !e) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
  }
};

// A glowing ring: a circle in the plane facing the course direction.
Renderer.prototype.drawRing = function drawRing(ring, time, isNext) {
  const ctx = this.ctx;
  const right = [Math.cos(ring.heading), 0, Math.sin(ring.heading)];
  const pts = [];
  const SEG = 28;
  for (let i = 0; i <= SEG; i += 1) {
    const t = (i / SEG) * Math.PI * 2;
    const px = ring.x + right[0] * Math.cos(t) * ring.radius;
    const py = ring.y + Math.sin(t) * ring.radius;
    const pz = ring.z + right[2] * Math.cos(t) * ring.radius;
    const p = this.project(px, py, pz);
    if (!p) return; // ring behind the camera: skip the whole ring
    pts.push(p);
  }
  const pulse = 0.75 + 0.25 * Math.sin(time * 3);
  const glow = isNext ? `rgba(255,190,40,${0.35 * pulse})` : 'rgba(120,200,255,0.25)';
  const core = isNext ? `rgba(255,205,60,${0.95 * pulse})` : 'rgba(140,210,255,0.6)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = glow;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  // The next ring gets a light column so the pilot can find it from afar.
  if (isNext) {
    const top = this.project(ring.x, ring.y + 260, ring.z);
    const bot = this.project(ring.x, ring.y, ring.z);
    if (top && bot) {
      const g = ctx.createLinearGradient(bot.x, bot.y, top.x, top.y);
      g.addColorStop(0, 'rgba(255,200,60,0.5)');
      g.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bot.x, bot.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
  }
};

// The aircraft, built from flat polygons in plane-local space:
// +x right wing, +y up, +z toward the tail, nose at -z.
Renderer.prototype.drawPlane = function drawPlane(p, time) {
  const ctx = this.ctx;
  const { fwd, right, up } = planeBasis(p);
  const toWorld = (lx, ly, lz) => [
    p.x + right[0] * lx + up[0] * ly + fwd[0] * lz,
    p.y + right[1] * lx + up[1] * ly + fwd[1] * lz,
    p.z + right[2] * lx + up[2] * ly + fwd[2] * lz,
  ];
  // Quads: [corners in local space, colour]. Nose is -z.
  const RED = '#d23b2e';
  const RED_DARK = '#a82a20';
  const WHITE = '#f4f1e8';
  const DARK = '#22262b';
  const quads = [
    // Fuselage top (tapered).
    { pts: [[-0.42, 0.42, -2.4], [0.42, 0.42, -2.4], [0.3, 0.3, 2.3], [-0.3, 0.3, 2.3]], c: RED },
    // Fuselage bottom.
    { pts: [[-0.36, -0.4, -2.2], [0.36, -0.4, -2.2], [0.26, -0.28, 2.3], [-0.26, -0.28, 2.3]], c: RED_DARK },
    // Fuselage left.
    { pts: [[-0.42, 0.42, -2.4], [-0.3, 0.3, 2.3], [-0.26, -0.28, 2.3], [-0.36, -0.4, -2.2]], c: RED_DARK },
    // Fuselage right.
    { pts: [[0.42, 0.42, -2.4], [0.36, -0.4, -2.2], [0.26, -0.28, 2.3], [0.3, 0.3, 2.3]], c: RED },
    // Main wing (white, red tips).
    { pts: [[-4.3, 0.05, -0.5], [-1.2, 0.08, -0.9], [-1.2, 0.08, 0.5], [-4.3, 0.05, 0.1]], c: WHITE },
    { pts: [[1.2, 0.08, -0.9], [4.3, 0.05, -0.5], [4.3, 0.05, 0.1], [1.2, 0.08, 0.5]], c: WHITE },
    { pts: [[-4.3, 0.05, -0.5], [-3.9, 0.05, -0.5], [-3.9, 0.05, 0.1], [-4.3, 0.05, 0.1]], c: RED },
    { pts: [[3.9, 0.05, -0.5], [4.3, 0.05, -0.5], [4.3, 0.05, 0.1], [3.9, 0.05, 0.1]], c: RED },
    // Tailplane.
    { pts: [[-1.7, 0.1, 1.8], [-0.3, 0.12, 1.6], [-0.3, 0.12, 2.3], [-1.7, 0.1, 2.2]], c: WHITE },
    { pts: [[0.3, 0.12, 1.6], [1.7, 0.1, 1.8], [1.7, 0.1, 2.2], [0.3, 0.12, 2.3]], c: WHITE },
    // Fin.
    { pts: [[0, 0.3, 1.7], [0, 1.25, 2.05], [0, 1.25, 2.3], [0, 0.3, 2.3]], c: RED },
    // Cockpit windows.
    { pts: [[-0.34, 0.44, -1.7], [0.34, 0.44, -1.7], [0.3, 0.32, -0.9], [-0.3, 0.32, -0.9]], c: DARK },
  ];
  const drawn = [];
  for (const q of quads) {
    const sp = [];
    let ok = true;
    let dSum = 0;
    for (const corner of q.pts) {
      const w = toWorld(corner[0], corner[1], corner[2]);
      const s = this.project(w[0], w[1], w[2]);
      if (!s) { ok = false; break; }
      sp.push(s);
      dSum += s.d;
    }
    if (!ok) continue;
    drawn.push({ sp, c: q.c, d: dSum / sp.length });
  }
  drawn.sort((a, b) => b.d - a.d);
  for (const q of drawn) {
    ctx.fillStyle = q.c;
    ctx.beginPath();
    ctx.moveTo(q.sp[0].x, q.sp[0].y);
    for (let i = 1; i < q.sp.length; i += 1) ctx.lineTo(q.sp[i].x, q.sp[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,25,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Propeller: a spinning translucent disc at the nose.
  const nose = toWorld(0, 0, -2.55);
  const pn = this.project(nose[0], nose[1], nose[2]);
  if (pn) {
    const blade = time * 22 * (0.4 + 0.6 * p.throttle);
    const rPx = (1.25 / pn.d) * this.focal;
    ctx.save();
    ctx.translate(pn.x, pn.y);
    ctx.rotate(blade);
    ctx.fillStyle = 'rgba(40,40,46,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, rPx, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,40,46,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rPx, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2c2f34';
    ctx.beginPath();
    ctx.arc(pn.x, pn.y, Math.max(2, rPx * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
};

// Soft clouds: fixed billboards placed by seed, drifting slowly.
const CLOUDS = (() => {
  const list = [];
  let s = 987654321;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 16; i += 1) {
    list.push({
      x: (rnd() - 0.5) * 2600,
      y: 190 + rnd() * 110,
      z: (rnd() - 0.5) * 2600,
      s: 60 + rnd() * 90,
    });
  }
  return list;
})();

Renderer.prototype.drawClouds = function drawClouds(time) {
  const ctx = this.ctx;
  for (const c of CLOUDS) {
    // Drift east, wrap around the world.
    const x = ((c.x + time * 2.2 + 1300) % 2600) - 1300;
    const p = this.project(x, c.y, c.z);
    if (!p) continue;
    const scale = (c.s / p.d) * this.focal;
    if (scale < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (const [ox, oy, r] of [[-0.5, 0, 0.55], [0, -0.18, 0.7], [0.5, 0.05, 0.5], [0.1, 0.12, 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * scale, p.y + oy * scale, r * scale, r * scale * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

Renderer.prototype.drawParticles = function drawParticles(particles) {
  const ctx = this.ctx;
  for (const pt of particles) {
    const p = this.project(pt.x, pt.y, pt.z);
    if (!p) continue;
    const r = Math.max(1.5, (3.5 / p.d) * this.focal * 0.02);
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// Full frame: sky, sea, terrain, runway, rings, plane, clouds, particles.
Renderer.prototype.draw = function draw(state, time) {
  const { plane, rings, particles, cameraMode } = state;
  this.placeCamera(plane, cameraMode);
  this.drawSky(time);
  this.drawSea();
  this.drawTerrain();
  this.drawRunway();
  const nextIndex = rings.findIndex((r) => !r.passed);
  for (let i = 0; i < rings.length; i += 1) {
    if (rings[i].passed) continue;
    this.drawRing(rings[i], time, i === nextIndex);
  }
  if (cameraMode !== 'cockpit') this.drawPlane(plane, time);
  this.drawClouds(time);
  this.drawParticles(particles);
  // Cockpit frame: a simple nose + struts so the view reads as a cockpit.
  if (cameraMode === 'cockpit') {
    const ctx = this.ctx;
    ctx.fillStyle = '#1d2126';
    ctx.beginPath();
    ctx.moveTo(this.w / 2 - 26, this.h);
    ctx.lineTo(this.w / 2 - 8, this.h * 0.78);
    ctx.lineTo(this.w / 2 + 8, this.h * 0.78);
    ctx.lineTo(this.w / 2 + 26, this.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d2126';
    ctx.fillRect(0, this.h - 14, this.w, 14);
  }
};
