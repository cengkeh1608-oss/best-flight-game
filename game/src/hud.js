// Island Air Rally — the HUD: lit instruments over the 3D view.
// One job: turn plane state into readable dials (DOM, so the text stays
// crisp in screenshots). All numbers update every frame from state.
import { CONFIG } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function compassLabel(headingDeg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(headingDeg / 45) % 8];
}

export function buildHud() {
  return {
    alt: $('hud-alt'),
    spd: $('hud-spd'),
    hdg: $('hud-hdg'),
    compass: $('hud-compass'),
    score: $('hud-score'),
    rings: $('hud-rings'),
    time: $('hud-time'),
    fuel: $('hud-fuel'),
    throttle: $('hud-throttle'),
    damage: $('hud-damage'),
    next: $('hud-next'),
    message: $('hud-message'),
    attitude: $('hud-attitude'),
  };
}

// Draw the artificial horizon: a small canvas, sky above, ground below,
// rolled and pitched with the plane, with a fixed aircraft symbol.
export function drawAttitude(canvas, plane) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = Math.max(-30, Math.min(30, -plane.pitch * 52));
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-40, -40, 80, 40);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-40, 0, 80, 40);
  ctx.strokeStyle = '#f5f0dc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(40, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy - 1);
  ctx.lineTo(cx, cy + 5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(245,240,220,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();
}

export function updateHud(hud, plane, nextRing, message, messageUntil, now) {
  const altM = Math.max(0, Math.round(plane.y));
  const spdKts = Math.round(plane.speed * 1.944);
  const hdgDeg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
  hud.alt.textContent = `${altM} m`;
  hud.spd.textContent = `${spdKts} kt`;
  hud.hdg.textContent = `${String(hdgDeg).padStart(3, '0')}° ${compassLabel(hdgDeg)}`;
  // Compass strip: ticks around the current heading.
  let strip = '';
  for (let d = -40; d <= 40; d += 10) {
    const deg = (hdgDeg + d + 360) % 360;
    const label = d % 30 === 0 ? String(deg).padStart(3, '0') : '|';
    strip += `<span class="${d === 0 ? 'tick-now' : 'tick'}">${label}</span>`;
  }
  hud.compass.innerHTML = strip;
  hud.score.textContent = String(plane.score);
  hud.rings.textContent = `${plane.ringsPassed}/${CONFIG.ringCount}`;
  const t = Math.floor(plane.time);
  hud.time.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  hud.fuel.style.width = `${Math.max(0, plane.fuel)}%`;
  hud.fuel.classList.toggle('low', plane.fuel < 25);
  hud.throttle.style.width = `${Math.round(plane.throttle * 100)}%`;
  hud.damage.style.width = `${Math.max(0, plane.damage)}%`;
  hud.damage.classList.toggle('bad', plane.damage > 50);
  if (nextRing) {
    const dx = nextRing.x - plane.x;
    const dy = nextRing.y - plane.y;
    const dz = nextRing.z - plane.z;
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
    const bearing = Math.atan2(dx, -dz);
    let rel = ((bearing - plane.heading) * 180) / Math.PI;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    const arrow = rel > 45 ? '↱' : rel < -45 ? '↰' : rel > 12 ? '→' : rel < -12 ? '←' : '↑';
    hud.next.textContent = `RING ${nextRing.index + 1} ${arrow} ${dist} m`;
  } else {
    hud.next.textContent = 'COURSE CLEAR';
  }
  if (message && now < messageUntil) {
    hud.message.textContent = message;
    hud.message.classList.add('show');
  } else {
    hud.message.classList.remove('show');
  }
  drawAttitude(hud.attitude, plane);
}
