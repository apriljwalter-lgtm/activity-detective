// "Peek inside the neural network": runs the real trained network (exported from the notebook) in the browser
// and draws every neuron and connection for the trace on screen.
(function () {
  const FRIENDLY = {
    fwd_std: "Forward sway", fwd_range: "Forward range", side_std: "Side sway", side_range: "Side range",
    up_std: "Bounce size", up_range: "Bounce range", mag_mean: "Average shake", mag_std: "Shake variety",
    mag_max: "Biggest jolt", up_kurtosis: "Spikiness", up_skew: "Lopsidedness", step_freq: "Step rhythm",
    energy_low: "Slow energy", energy_mid: "Medium energy", energy_high: "Fast energy", up_zero_cross: "Bounce crossings",
  };
  const NAME = { walking: "Walking", upstairs: "Stairs up", downstairs: "Stairs down" };
  const COLOR = { walking: "#00e5ff", upstairs: "#ff3ea5", downstairs: "#ffe14d" };

  // ---------- the math (same as scikit-learn's MLPClassifier) ----------
  function forward(net, raw) {
    const x = raw.map((v, i) => (v - net.scaler_mean[i]) / net.scaler_scale[i]);
    const acts = [x];
    let a = x;
    net.weights.forEach((W, L) => {
      const out = net.biases[L].slice();
      for (let i = 0; i < a.length; i++) for (let j = 0; j < out.length; j++) out[j] += a[i] * W[i][j];
      const last = L === net.weights.length - 1;
      if (!last) a = out.map((v) => Math.max(0, v));                       // ReLU
      else { const m = Math.max(...out), e = out.map((v) => Math.exp(v - m)), s = e.reduce((p, q) => p + q); a = e.map((v) => v / s); } // softmax
      acts.push(a);
    });
    return acts;   // [standardized inputs, hidden1, hidden2, probabilities]
  }
  const probsOf = (net, raw) => { const p = forward(net, raw).at(-1); return Object.fromEntries(net.classes.map((c, i) => [c, p[i]])); };

  // which clues mattered: set one input to "average" (its training mean) and see how much the answer's probability drops
  function clues(net, raw, cls) {
    const base = probsOf(net, raw)[cls];
    return net.features.map((f, i) => {
      const r = raw.slice(); r[i] = net.scaler_mean[i];
      const z = (raw[i] - net.scaler_mean[i]) / net.scaler_scale[i];
      return { f, i, z, effect: base - probsOf(net, r)[cls] };
    }).sort((a, b) => b.effect - a.effect);
  }

  // ---------- drawing ----------
  function render(el, net, w, revealed) {
    const acts = forward(net, w.feats);
    const W = 940, H = 560, top = 34, bot = 24;
    const xs = [150, 400, 630, 800];
    const layers = acts.map((a, L) => a.map((v, i) => {
      const n = a.length, gap = (H - top - bot) / n;
      return { x: xs[L], y: top + gap * (i + 0.5), v };
    }));
    const maxAct = acts.map((a, L) => (L === 0 ? 2.5 : Math.max(1e-6, ...a.map(Math.abs))));
    let s = "";
    // connections: colour/opacity by how strongly this neuron is pushing the next one for THIS trace (activation × weight)
    net.weights.forEach((Wm, L) => {
      const from = layers[L], to = layers[L + 1];
      let mx = 1e-6; const contrib = [];
      for (let i = 0; i < from.length; i++) for (let j = 0; j < to.length; j++) {
        const c = (L === 0 ? Math.max(-3, Math.min(3, from[i].v)) : from[i].v) * Wm[i][j];
        contrib.push([i, j, c]); mx = Math.max(mx, Math.abs(c));
      }
      const hideOut = L === net.weights.length - 1 && !revealed;
      for (const [i, j, c] of contrib) {
        const o = Math.min(0.85, Math.abs(c) / mx) ** 1.4;
        if (o < 0.03) continue;
        s += `<line x1="${from[i].x}" y1="${from[i].y}" x2="${to[j].x}" y2="${to[j].y}" stroke="${c > 0 ? "#00e5ff" : "#ff3ea5"}" stroke-width="${0.6 + 2.2 * o}" opacity="${hideOut ? o * 0.25 : o}" class="edge l${L}"/>`;
      }
    });
    // column titles
    const titles = ["16 clues (inputs)", "32 neurons", "16 neurons", "3 answers"];
    xs.forEach((x, L) => (s += `<text x="${x}" y="18" text-anchor="middle" class="nt">${titles[L]}</text>`));
    // input nodes with labels (cyan = above average, pink = below average)
    layers[0].forEach((n, i) => {
      const z = n.v, o = Math.min(1, Math.abs(z) / maxAct[0]);
      const col = z >= 0 ? "#00e5ff" : "#ff3ea5";
      s += `<g class="node l0"><title>${FRIENDLY[net.features[i]]}: ${w.feats[i].toFixed(3)} (${z >= 0 ? "above" : "below"} average by ${Math.abs(z).toFixed(1)} std)</title>
        <circle cx="${n.x}" cy="${n.y}" r="8" fill="${col}" fill-opacity="${0.15 + 0.85 * o}" stroke="${col}" stroke-width="1.5"/>
        <text x="${n.x - 14}" y="${n.y + 4}" text-anchor="end" class="nl">${FRIENDLY[net.features[i]]}</text></g>`;
    });
    // hidden neurons: brightness = activation
    [1, 2].forEach((L) => layers[L].forEach((n, i) => {
      const o = n.v / maxAct[L];
      s += `<circle cx="${n.x}" cy="${n.y}" r="${L === 1 ? 6 : 7.5}" fill="#ffe14d" fill-opacity="${0.06 + 0.94 * o}" stroke="#ffe14d" stroke-opacity="${0.35 + 0.65 * o}" stroke-width="1.2" class="node l${L}"><title>Neuron ${i + 1}: activity ${n.v.toFixed(2)}${n.v === 0 ? " (switched off)" : ""}</title></circle>`;
      if (o > 0.6) s += `<circle cx="${n.x}" cy="${n.y}" r="${L === 1 ? 10 : 12}" fill="#ffe14d" opacity=".18" class="node l${L}"/>`;
    }));
    // outputs
    layers[3].forEach((n, i) => {
      const cls = net.classes[i], p = n.v, col = COLOR[cls];
      const yy = H / 2 + (i - 1) * 110;
      n.y = yy;
      s += `<g class="node l3">`;
      if (revealed) {
        s += `<circle cx="${n.x}" cy="${yy}" r="${14 + 16 * p}" fill="${col}" fill-opacity="${0.15 + 0.85 * p}" stroke="${col}" stroke-width="2"/>
          <text x="${n.x + 40}" y="${yy - 2}" class="ol" fill="${col}">${NAME[cls]}</text>
          <text x="${n.x + 40}" y="${yy + 18}" class="op">${Math.round(p * 100)}%</text>`;
      } else {
        s += `<circle cx="${n.x}" cy="${yy}" r="20" fill="#2a1650" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>
          <text x="${n.x}" y="${yy + 6}" text-anchor="middle" class="oq">?</text>
          <text x="${n.x + 40}" y="${yy + 5}" class="ol" fill="${col}">${NAME[cls]}</text>`;
      }
      s += `</g>`;
    });
    // re-draw the last layer's connections to the moved output positions
    s = s.replace(/<line [^>]*class="edge l2"\/>/g, "");
    const L = 2, Wm = net.weights[L];
    let mx = 1e-6; const cc = [];
    layers[2].forEach((a, i) => layers[3].forEach((b, j) => { const c = a.v * Wm[i][j]; cc.push([i, j, c]); mx = Math.max(mx, Math.abs(c)); }));
    let edges = "";
    for (const [i, j, c] of cc) {
      const o = Math.min(0.85, Math.abs(c) / mx) ** 1.4;
      if (o < 0.03) continue;
      edges += `<line x1="${layers[2][i].x}" y1="${layers[2][i].y}" x2="${layers[3][j].x}" y2="${layers[3][j].y}" stroke="${c > 0 ? "#00e5ff" : "#ff3ea5"}" stroke-width="${0.6 + 2.6 * o}" opacity="${revealed ? o : o * 0.25}" class="edge l2"/>`;
    }
    s = s.replace('<text x="150" y="18"', edges + '<text x="150" y="18"');

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="net-svg" role="img" aria-label="Diagram of the neural network's neurons lighting up for this trace">${s}</svg>`;
    el.classList.remove("flow"); void el.offsetWidth; el.classList.add("flow");   // replay the left-to-right "signal flow" animation
  }

  function explain(el, net, w, revealed) {
    if (!revealed) { el.innerHTML = `<p class="small-note">Make your guess to see the network's answer and the clues that drove it.</p>`; return; }
    const top = clues(net, w.feats, w.pred).filter((c) => c.effect > 0.005).slice(0, 3);
    const p = probsOf(net, w.feats);
    let html = `<p><b>Why it said "${NAME[w.pred]}" (${Math.round(p[w.pred] * 100)}%):</b> these clues mattered most. If we reset each one to an average value, the network becomes less sure of its answer:</p><ul>`;
    const level = (z) => { const a = Math.abs(z), dir = z > 0 ? "above" : "below";
      return a < 0.3 ? "about average" : a < 1 ? `a little ${dir} average` : a < 2 ? `${dir} average` : `far ${dir} average`; };
    for (const c of top) {
      const pts = Math.max(1, Math.round(c.effect * 100));
      html += `<li><b>${FRIENDLY[c.f]}</b> was ${level(c.z)}. Resetting it lowers "${NAME[w.pred]}" by ${pts} point${pts === 1 ? "" : "s"}.</li>`;
    }
    if (!top.length) html += `<li>No single clue stands out. The decision comes from many small clues together.</li>`;
    html += `</ul>`;
    if (top.length && top[0].effect < 0.05) html += `<p class="small-note">The network was so sure that resetting any one clue barely changes its mind. Its answer comes from many clues pointing the same way.</p>`;
    if (w.pred !== w.true) html += `<p class="small-note">The truth was <b>${NAME[w.true]}</b>, so these clues misled the network this time.</p>`;
    el.innerHTML = html;
  }

  window.NetView = { forward, probsOf, clues, render, explain, FRIENDLY };
})();
