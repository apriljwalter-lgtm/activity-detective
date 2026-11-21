// Animated stick-figure scenes (walking / stairs up / stairs down) and trace playheads.
// One shared animation clock drives every scene and playhead on the page.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const SCENES = new Map();     // container element -> scene
  const PLAYHEADS = new Map();  // trace element -> updater
  window.ANIM = { speed: 1 };

  // 80s aerobics palette: dark purple night sky fading to a neon horizon
  const COLORS = {
    walking:    { sky1: "#170733", sky2: "#0aa7c4", ground: "#12052a", edge: "#00e5ff", tag: "#00e5ff", suit: "#ff3ea5", warm: "#ffe14d" },
    upstairs:   { sky1: "#170733", sky2: "#e8338f", ground: "#12052a", edge: "#ff3ea5", tag: "#ff3ea5", suit: "#00e5ff", warm: "#ffe14d" },
    downstairs: { sky1: "#170733", sky2: "#f29a1d", ground: "#12052a", edge: "#ffe14d", tag: "#ffe14d", suit: "#ff3ea5", warm: "#00e5ff" },
    mystery:    { sky1: "#170733", sky2: "#55407a", ground: "#12052a", edge: "#b9a6d6", tag: "#ff3ea5", suit: "#ff3ea5", warm: "#ffe14d" },
  };
  const NAMES = { walking: "Walking", upstairs: "Stairs up", downstairs: "Stairs down" };
  const CALLS = { walking: "WALK IT OUT!", upstairs: "STEP UP!", downstairs: "STEP DOWN!" };

  // geometry (scene units, viewBox 300 x 170)
  const VW = 300, VH = 170, TW = 30, RISE = 15, L1 = 21, L2 = 21, HIP_H = 38, TORSO = 28, HEAD = 8;

  const smooth = (p) => p * p * (3 - 2 * p);
  const lerp = (a, b, p) => a + (b - a) * p;

  function knee(h, f, forward) {
    const dx = f[0] - h[0], dy = f[1] - h[1];
    let d = Math.hypot(dx, dy);
    d = Math.min(d, L1 + L2 - 0.01);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const ang = forward ? a - b : a + b;
    return [h[0] + L1 * Math.cos(ang), h[1] + L1 * Math.sin(ang)];
  }

  function createScene(container, opts) {
    // opts: { activity, f (steps/s), t0 (s, time of first foot plant), mystery, label, compact }
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.setAttribute("class", "scene-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts.mystery ? "mystery activity animation" : NAMES[opts.activity] + " animation");
    container.innerHTML = "";
    container.appendChild(svg);
    const scene = { svg, opts };
    SCENES.set(container, scene);
    return scene;
  }

  function surfaceY(dir, n) { return -dir * n * RISE; }

  function renderScene(scene, t) {
    const o = scene.opts;
    const act = o.mystery ? "walking" : o.activity;
    const dir = act === "upstairs" ? 1 : act === "downstairs" ? -1 : 0;
    const pal = COLORS[o.mystery ? "mystery" : act];
    const f = o.f || 1.8;
    const c = Math.max(0, (t - (o.t0 || 0)) * f) + 1000; // steps taken (offset keeps indices positive)
    const k = Math.floor(c), p = c - k;
    if (o.onStep && scene.lastK !== undefined && k !== scene.lastK) o.onStep((scene.stepN = (scene.stepN || 0) + 1));
    scene.lastK = k;
    const tw = TW;
    const footX = (n) => n * tw + tw / 2;

    // hip in world coordinates
    const hipW = [c * tw, surfaceY(dir, c - 0.5) - HIP_H - 2.5 * Math.sin(Math.PI * p) + (dir === 0 ? 0 : 1)];
    // camera: put hip at (cx, cy)
    const cx = VW * 0.45, cy = dir === 1 ? 92 : dir === -1 ? 70 : 82;
    const S = (pt) => [pt[0] - hipW[0] + cx, pt[1] - hipW[1] + cy];

    let g = "";
    const id = "g" + Math.random().toString(36).slice(2, 7);
    g += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky1}"/><stop offset="1" stop-color="${pal.sky2}"/></linearGradient></defs>`;
    g += `<rect width="${VW}" height="${VH}" fill="url(#${id})"/>`;
    // twinkling stars
    for (let i = 0; i < 14; i++) {
      const sx = (i * 73 + 17) % VW, sy = (i * 37 + 9) % 70, tw2 = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i));
      g += `<circle cx="${sx}" cy="${sy}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff" opacity="${tw2 * 0.8}"/>`;
    }
    // striped retro sunset sun
    const sunX = VW * 0.74, sunY = 96, sunR = 36;
    g += `<defs><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset="1" stop-color="#ff3ea5"/></linearGradient>
          <clipPath id="c${id}"><rect x="0" y="0" width="${VW}" height="${sunY + 2}"/></clipPath></defs>`;
    g += `<g clip-path="url(#c${id})"><circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="url(#s${id})"/>`;
    for (let i = 0; i < 5; i++) g += `<rect x="${sunX - sunR}" y="${sunY - 22 + i * 7}" width="${sunR * 2}" height="${1 + i * 0.9}" fill="${pal.sky2}" opacity=".85"/>`;
    g += `</g>`;

    // ground or stairs
    const n0 = k - 9, n1 = k + 9;
    if (dir === 0) {
      const [, gy] = S([0, 0]);
      g += `<rect x="0" y="${gy}" width="${VW}" height="${VH - gy}" fill="${pal.ground}"/>`;
      for (let n = n0; n <= n1; n++) {
        const [x] = S([n * tw, 0]);
        g += `<line x1="${x}" y1="${gy}" x2="${x + (x - cx) * 1.4}" y2="${VH}" stroke="#ff3ea5" stroke-width="1" opacity=".55"/>`;
      }
      for (let j = 1; j < 5; j++) {
        const yy = gy + (VH - gy) * (j * j) / 16;
        g += `<line x1="0" x2="${VW}" y1="${yy}" y2="${yy}" stroke="#ff3ea5" stroke-width="1" opacity=".45"/>`;
      }
      g += `<line x1="0" x2="${VW}" y1="${gy}" y2="${gy}" stroke="${pal.edge}" stroke-width="6" opacity=".25"/>`;
      g += `<line x1="0" x2="${VW}" y1="${gy}" y2="${gy}" stroke="${pal.edge}" stroke-width="2.5"/>`;
    } else {
      let d = "";
      for (let n = n0; n <= n1; n++) {
        const a = S([n * tw, surfaceY(dir, n)]), b = S([(n + 1) * tw, surfaceY(dir, n)]), cc = S([(n + 1) * tw, surfaceY(dir, n + 1)]);
        d += (n === n0 ? `M${a[0]} ${a[1]}` : "") + ` L${b[0]} ${b[1]} L${cc[0]} ${cc[1]}`;
      }
      const last = S([(n1 + 1) * tw, surfaceY(dir, n1 + 1)]), first = S([n0 * tw, surfaceY(dir, n0)]);
      g += `<path d="${d} L${last[0]} ${VH + 40} L${first[0]} ${VH + 40} Z" fill="${pal.ground}"/>`;
      g += `<path d="${d}" fill="none" stroke="${pal.edge}" stroke-width="7" opacity=".22" stroke-linejoin="round"/>`;
      g += `<path d="${d}" fill="none" stroke="${pal.edge}" stroke-width="2.5" stroke-linejoin="round"/>`;
      // handrail
      const r0 = S([n0 * tw, surfaceY(dir, n0) - 34]), r1 = S([(n1 + 1) * tw, surfaceY(dir, n1 + 1) - 34]);
      g += `<line x1="${r0[0]}" y1="${r0[1]}" x2="${r1[0]}" y2="${r1[1]}" stroke="${pal.edge}" stroke-width="2" opacity=".5"/>`;
      for (let n = n0; n <= n1; n += 2) {
        const a = S([n * tw + tw * 0.5, surfaceY(dir, n)]), b = S([n * tw + tw * 0.5, surfaceY(dir, n) - 34 - dir * RISE * 0.5]);
        g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${pal.edge}" stroke-width="1.2" opacity=".35"/>`;
      }
    }

    // feet: stance foot on tread k, swing foot moving from k-1 to k+1
    const lift = dir === 1 ? 22 : dir === -1 ? 11 : 7;
    const stance = [footX(k), surfaceY(dir, k)];
    const ps = smooth(p);
    const swing = [lerp(footX(k - 1), footX(k + 1), ps), lerp(surfaceY(dir, k - 1), surfaceY(dir, k + 1), ps) - lift * Math.sin(Math.PI * p)];
    const feet = k % 2 === 0 ? [stance, swing] : [swing, stance];

    // landing puff
    if (p < 0.22 && !o.mystery) {
      const sp = S(stance), r = 3 + p * 30, op = 0.55 * (1 - p / 0.22);
      g += `<circle cx="${sp[0] - 6}" cy="${sp[1] - 2}" r="${r * 0.5}" fill="${pal.edge}" opacity="${op}"/><circle cx="${sp[0] + 7}" cy="${sp[1] - 3}" r="${r * 0.4}" fill="${pal.edge}" opacity="${op}"/>`;
    }

    // body
    const lean = dir === 1 ? 0.22 : dir === -1 ? -0.06 : 0.06;
    const hip = hipW;
    const shoulder = [hip[0] + TORSO * Math.sin(lean), hip[1] - TORSO * Math.cos(lean)];
    const head = [shoulder[0] + (HEAD + 3) * Math.sin(lean), shoulder[1] - (HEAD + 3) * Math.cos(lean)];
    const limbs = [];
    feet.forEach((ft, i) => {
      const kn = knee(hip, ft, true);
      limbs.push({ pts: [hip, kn, ft, [ft[0] + 6, ft[1]]], back: i === 1 });
    });
    [0, 1].forEach((i) => {
      const sw = 0.55 * Math.sin(Math.PI * c + (i ? Math.PI : 0)) * (dir === 1 ? 0.7 : 1);
      const a1 = Math.PI / 2 - sw - lean, el = [shoulder[0] + 15 * Math.cos(a1), shoulder[1] + 15 * Math.sin(a1)];
      const a2 = a1 - 0.5 - Math.max(0, sw) * 0.6, hand = [el[0] + 13 * Math.cos(a2), el[1] + 13 * Math.sin(a2)];
      limbs.push({ pts: [shoulder, el, hand], back: i === 1, arm: true });
    });
    const skin = "#fff3fb", back = "#b39bd6";
    const poly = (pts, col, w, extra = "") => `<polyline points="${pts.map((q) => S(q).join(",")).join(" ")}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
    const legWarmer = (l, faded) => {
      // striped leg warmer on the lower shin (from 35% below the knee to the ankle)
      const kn = l.pts[1], ft = l.pts[2], a = [lerp(kn[0], ft[0], 0.35), lerp(kn[1], ft[1], 0.35)];
      return poly([a, ft], faded ? "#a88f2c" : pal.warm, 7.5) + poly([a, ft], faded ? "#6b4f9a" : pal.suit, 7.5, 'stroke-dasharray="2 3" stroke-linecap="butt"');
    };
    const drawLimb = (l, col, faded) => {
      let out = poly(l.pts, col, l.arm ? 3.4 : 4.4);
      if (!l.arm) out += legWarmer(l, faded) + poly([l.pts[2], l.pts[3]], faded ? "#8d7bb0" : "#fff", 4.5); // sneaker
      else { const w = l.pts[2], e = l.pts[1]; out += poly([[lerp(e[0], w[0], 0.7), lerp(e[1], w[1], 0.7)], w], faded ? "#a88f2c" : pal.warm, 5); } // wristband
      return out;
    };
    limbs.filter((l) => l.back).forEach((l) => (g += drawLimb(l, back, true)));
    // leotard torso + belt
    g += poly([hip, shoulder], pal.suit, 9);
    g += poly([hip, [lerp(hip[0], shoulder[0], 0.2), lerp(hip[1], shoulder[1], 0.2)]], "#170733", 9);
    const hd = S(head);
    const HAIR = "#5c2a14", HAIR_HI = "#9a5428";
    // ponytail (drawn behind the head): swings and bounces with every step
    const sway = 0.55 * Math.sin(Math.PI * c) - lean * 1.5, bounce = 3 * Math.abs(Math.sin(Math.PI * c));
    const ax = hd[0] - HEAD * 0.75, ay = hd[1] - HEAD * 0.75;                     // scrunchie position
    const rot = (dx, dy) => [ax + dx * Math.cos(sway) - dy * Math.sin(sway), ay + dx * Math.sin(sway) + dy * Math.cos(sway)];
    const mid = rot(-14, 0 - bounce), tip = rot(-19, 19 - bounce), tip2 = rot(-10, 17 - bounce);
    g += `<path d="M${ax} ${ay - 2} Q${mid[0]} ${mid[1] - 4} ${tip[0]} ${tip[1]} Q${tip2[0]} ${tip2[1]} ${ax + 1} ${ay + 3} Z" fill="${HAIR}" stroke="#170733" stroke-width="1"/>`;
    g += `<path d="M${ax - 2} ${ay} Q${mid[0] + 1} ${mid[1] - 1} ${(tip[0] + tip2[0]) / 2} ${(tip[1] + tip2[1]) / 2 - 2}" fill="none" stroke="${HAIR_HI}" stroke-width="1.2" stroke-linecap="round"/>`;
    g += `<circle cx="${ax}" cy="${ay}" r="2.8" fill="${pal.warm}" stroke="#170733" stroke-width="1"/>`;          // scrunchie
    // face
    g += `<circle cx="${hd[0]}" cy="${hd[1]}" r="${HEAD}" fill="${skin}" stroke="#170733" stroke-width=".8"/>`;
    // hair cap with fringe
    g += `<path d="M${hd[0] - HEAD - 0.5} ${hd[1] + 2} Q${hd[0] - HEAD - 2} ${hd[1] - HEAD - 3} ${hd[0] + 1} ${hd[1] - HEAD - 1.5} Q${hd[0] + HEAD + 2} ${hd[1] - HEAD} ${hd[0] + HEAD + 0.5} ${hd[1] - 2.5} Q${hd[0] + 3} ${hd[1] - 5} ${hd[0] - 1} ${hd[1] - 3.5} Q${hd[0] - 4} ${hd[1] - 1} ${hd[0] - HEAD - 0.5} ${hd[1] + 2} Z" fill="${HAIR}" stroke="#170733" stroke-width=".8"/>`;
    // headband: matches the leotard, with a dark outline so it shows on every background
    const hb1 = [hd[0] - HEAD + 0.5, hd[1] - 3.5], hb2 = [hd[0] + HEAD - 0.3, hd[1] - 5.2];
    g += `<line x1="${hb1[0]}" y1="${hb1[1]}" x2="${hb2[0]}" y2="${hb2[1]}" stroke="#170733" stroke-width="5.4" stroke-linecap="round"/>`;
    g += `<line x1="${hb1[0]}" y1="${hb1[1]}" x2="${hb2[0]}" y2="${hb2[1]}" stroke="${pal.suit}" stroke-width="3.6" stroke-linecap="round"/>`;
    g += `<line x1="${hb1[0] + 1}" y1="${hb1[1] - 0.9}" x2="${hb2[0] - 1}" y2="${hb2[1] - 0.9}" stroke="#fff" stroke-width=".9" opacity=".7" stroke-linecap="round"/>`;
    // eye with lashes, blush, lips
    g += `<circle cx="${hd[0] + 3.6}" cy="${hd[1] + 0.3}" r="1.3" fill="#170733"/>`;
    g += `<path d="M${hd[0] + 2.4} ${hd[1] - 0.9} l-0.9 -1.4 M${hd[0] + 3.6} ${hd[1] - 1.1} l0 -1.6 M${hd[0] + 4.8} ${hd[1] - 0.9} l0.9 -1.4" stroke="#170733" stroke-width=".7" stroke-linecap="round"/>`;
    g += `<circle cx="${hd[0] + 1.8}" cy="${hd[1] + 3.2}" r="1.8" fill="#ff6fb5" opacity=".55"/>`;
    g += `<path d="M${hd[0] + 4.2} ${hd[1] + 4.2} q1.6 1.3 3.2 -0.2" stroke="#e8337f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    limbs.filter((l) => !l.back).forEach((l) => (g += drawLimb(l, skin, false)));
    // phone on the hip — the sensor!
    const ph = S([hip[0] + 2, hip[1] + 4]);
    g += `<rect x="${ph[0] - 3}" y="${ph[1] - 5}" width="6" height="10" rx="1.5" fill="#170733" stroke="#fff" stroke-width="1"/>`;

    if (o.mystery) {
      const [, hy] = S(hip);
      g += `<rect x="0" y="${hy - 2}" width="${VW}" height="${VH - hy + 2}" fill="#2a1650"/>`;
      for (let i = 0; i < 7; i++) g += `<ellipse cx="${i * 50 + ((t * 18) % 50)}" cy="${hy + 2}" rx="34" ry="12" fill="#2a1650"/>`;
      g += `<text x="${VW / 2}" y="${VH - 18}" text-anchor="middle" font-size="28" font-family="Bungee, Impact, sans-serif" fill="#ff3ea5" opacity="${0.6 + 0.4 * Math.abs(Math.sin(t * 2))}">? ? ?</text>`;
    }

    if (o.label) {
      const lw = scene.labelW || o.label.length * 9;
      g += `<rect x="8" y="8" width="${lw + 22}" height="22" rx="4" fill="#170733" stroke="${pal.tag}" stroke-width="1.5" transform="skewX(-10)"/>`;
      g += `<text class="lbl" x="20" y="23.5" font-size="12" font-family="Bungee, Impact, sans-serif" letter-spacing=".5" fill="${pal.tag}">${o.label}</text>`;
    }
    scene.svg.innerHTML = g;
    if (o.label && !scene.labelW && document.fonts && document.fonts.status === "loaded") {
      const el = scene.svg.querySelector("text.lbl");
      try { const w = el.getComputedTextLength(); if (w > 0) scene.labelW = w; } catch (e) {}
    }
  }

  // ---- playhead on a trace chart ----
  function registerPlayhead(el, info) {
    // info: { sx(i), sy(v), n, z[], fs, top, bottom, t0 }
    const svg = el.querySelector("svg");
    const line = document.createElementNS(NS, "line");
    line.setAttribute("y1", info.top); line.setAttribute("y2", info.bottom);
    line.setAttribute("stroke", "#ffe14d"); line.setAttribute("stroke-width", "2"); line.setAttribute("opacity", ".75");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", "5"); dot.setAttribute("fill", "#ffe14d"); dot.setAttribute("stroke", "#170733"); dot.setAttribute("stroke-width", "2");
    svg.appendChild(line); svg.appendChild(dot);
    PLAYHEADS.set(el, (t) => {
      const T = info.n / info.fs;
      const tt = ((t % T) + T) % T;
      const i = Math.min(info.n - 1, Math.floor(tt * info.fs));
      const x = info.sx(tt * info.fs);
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      dot.setAttribute("cx", x); dot.setAttribute("cy", info.sy(info.z[i]));
    });
  }

  // first clear up-down peak in the trace: used so footfalls land on the bounce peaks
  function firstPeakTime(z, fs, f) {
    const n = z.length, win = Math.max(3, Math.round(fs / (f || 1.8) / 3));
    let best = 0;
    const lim = Math.min(n - win, Math.round(fs / (f || 1.8)) + win);
    for (let i = win; i < lim; i++) if (z[i] > z[best] || best < win) best = i;
    return best / fs;
  }

  // ---- shared clock ----
  let sim = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    sim += dt * window.ANIM.speed;
    for (const [el, sc] of SCENES) {
      if (!el.isConnected) { SCENES.delete(el); continue; }
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue; // offscreen
      const T = sc.opts.loop || Infinity;
      renderScene(sc, sc.opts.loop ? sim % T : sim);
    }
    for (const [el, up] of PLAYHEADS) {
      if (!el.isConnected) { PLAYHEADS.delete(el); continue; }
      up(sim);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // change a scene's pace without making the figure jump: keep the number of steps taken so far the same
  function setPace(sc, f) {
    const o = sc.opts, fOld = o.f || 1.8, cOld = (sim - (o.t0 || 0)) * fOld;
    o.f = Math.max(0.5, f);
    o.t0 = sim - cOld / o.f;
  }

  window.Scenes = { createScene, setPace, registerPlayhead, firstPeakTime, NAMES, CALLS, COLORS, render: renderScene };
})();
