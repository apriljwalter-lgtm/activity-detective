// Original 80s-style synth music and sound effects, generated live with the Web Audio API.
// No audio files: every sound is built from oscillators and noise. Off until the visitor turns it on.
(function () {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  const state = { sfx: false, music: false };

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    return true;
  }

  // ---------- building blocks ----------
  function tone(bus, type, freq, t, dur, vol = 0.3, { cutoff = 0, glideTo = 0, attack = 0.005 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; f.Q.value = 6; o.connect(f); node = f; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(bus, t, dur, vol, type, freq) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // ---------- drum machine ----------
  const kick = (t) => tone(musicBus, "sine", 150, t, 0.32, 0.9, { glideTo: 42 });
  const snare = (t) => { noise(musicBus, t, 0.22, 0.45, "bandpass", 1800); tone(musicBus, "triangle", 190, t, 0.1, 0.25); };
  const hat = (t, open) => noise(musicBus, t, open ? 0.18 : 0.04, 0.16, "highpass", 8000);
  const clap = (t) => { for (let i = 0; i < 3; i++) noise(musicBus, t + i * 0.012, 0.12, 0.25, "bandpass", 1200); };

  // ---------- music: original 4-bar synthwave loop (A minor: Am – F – C – G) ----------
  const BPM = 118, STEP = 60 / BPM / 4; // 16th notes
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const BASS = [45, 41, 36, 43];
  const LEAD = [76, null, 72, null, 74, 76, null, 79, 77, null, 76, null, 72, null, 74, null];
  let nextTime = 0, step16 = 0, timer = null;

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    if (s % 4 === 0) kick(t);
    if (s === 4 || s === 12) { snare(t); clap(t); }
    hat(t, s % 4 === 2);
    // pulsing octave bass on every 8th note
    if (s % 2 === 0) tone(musicBus, "sawtooth", hz(BASS[bar] + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.8, 0.22, { cutoff: 900 });
    // chord stabs
    if (s === 0 || s === 6 || s === 10) CHORDS[bar].forEach((n) => tone(musicBus, "square", hz(n), t, STEP * 2.5, 0.05, { cutoff: 2600 }));
    // little lead melody on bars 2 and 4
    if (bar % 2 === 1 && LEAD[s]) tone(musicBus, "triangle", hz(LEAD[s] - (bar === 3 ? 2 : 0)), t, STEP * 1.6, 0.1);
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(step16, nextTime);
      nextTime += STEP; step16++;
    }
  }
  function startMusic() { nextTime = ctx.currentTime + 0.05; step16 = 0; timer = setInterval(scheduler, 25); }
  function stopMusic() { clearInterval(timer); timer = null; }

  // ---------- sound effects ----------
  // Footsteps you can "hear the shape" of:
  //   mystery (before guessing): the same plain tap every step, so only the rhythm is a clue
  //   walking: the same note every step (flat ground)
  //   stairs up: a rising scale, one note higher per step
  //   stairs down: a falling scale, one note lower per step
  const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
  function woodblock(midi, t, vol) {
    tone(sfxBus, "sine", hz(midi), t, 0.16, vol, { attack: 0.002 });
    tone(sfxBus, "triangle", hz(midi + 12), t, 0.05, vol * 0.35, { attack: 0.002 });
    tone(sfxBus, "sine", 110, t, 0.08, vol * 0.6, { glideTo: 60, attack: 0.002 }); // little thud
  }
  function footstep(activity, n) {
    if (!state.sfx || !ctx) return;
    const t = ctx.currentTime, i = n % SCALE.length;
    if (activity === "walking") return woodblock(72, t, 0.55);
    if (activity === "upstairs") return woodblock(64 + SCALE[i], t, 0.55);
    if (activity === "downstairs") return woodblock(76 - SCALE[i], t, 0.55);
  }
  function duck() { if (musicBus) musicBus.gain.setTargetAtTime(state.sfx ? 0.14 : 0.32, ctx.currentTime, 0.2); }
  function win() {
    if (!state.sfx || !ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => tone(sfxBus, "square", hz(n), t + i * 0.09, 0.22, 0.14, { cutoff: 4000 }));
    tone(sfxBus, "triangle", hz(96), t + 0.36, 0.5, 0.12);
  }
  function lose() {
    if (!state.sfx || !ctx) return;
    const t = ctx.currentTime;
    [0, 0.28].forEach((d, i) => tone(sfxBus, "sawtooth", hz(62 - i * 3), t + d, 0.32, 0.14, { cutoff: 1200, glideTo: hz(60 - i * 3) }));
  }
  function click() {
    if (!state.sfx || !ctx) return;
    tone(sfxBus, "square", hz(84), ctx.currentTime, 0.05, 0.08, { cutoff: 5000 });
  }
  function coach(text) {
    if (!state.sfx || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.12; u.pitch = 1.35; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function setSfx(on) { if (on && !ensure()) return false; state.sfx = on; duck(); if (on) click(); return true; }
  function setMusic(on) {
    if (on && !ensure()) return false;
    state.music = on;
    if (on && !timer) startMusic();
    if (!on) stopMusic();
    return true;
  }

  window.Sound = { setSfx, setMusic, footstep, win, lose, click, coach, state };
})();
