// Island Air Rally — sound, synthesized with WebAudio. No audio files.
// One job: engine hum, ring chime, touchdown thump and crash noise.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch (e) {
      ctx = null;
    }
  }

  function engine(throttle, speed, flying) {
    if (!ctx || muted) return;
    const target = flying || speed > 5 ? 0.05 + throttle * 0.06 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.25, ctx.currentTime, 0.1);
  }

  function blip(freq, delay, dur, vol) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function ring() {
    blip(880, 0, 0.35, 0.16);
    blip(1318, 0.09, 0.4, 0.14);
  }

  function landed() {
    blip(220, 0, 0.18, 0.2);
    blip(330, 0.08, 0.25, 0.15);
  }

  function crash() {
    if (!ctx || muted) return;
    const dur = 0.6;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
    blip(90, 0, 0.5, 0.3);
  }

  function toggleMute() {
    muted = !muted;
    if (engineGain) engineGain.gain.value = 0;
    return muted;
  }

  return { ensure, engine, ring, landed, crash, toggleMute };
}
