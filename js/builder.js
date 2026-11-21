// "Build your own walker": sliders for the 5 clues the network relies on most; the real network re-runs live.
(function () {
  const HELP = {
    mag_std: "how much the overall shaking changes from moment to moment",
    energy_high: "share of quick, sharp vibration (crisp heel strikes)",
    step_freq: "steps per second",
    up_range: "gap between the highest and lowest up-down bounce (g)",
    up_skew: "whether the bounce has sharp spikes on one side",
    up_std: "typical size of the up-down bounce (g)", mag_max: "the single strongest jolt (g)",
    up_kurtosis: "how spiky the up-down bounce is", side_range: "side-to-side wobble range (g)",
    fwd_std: "forward-back sway (g)", side_std: "side-to-side sway (g)",
    energy_mid: "share of medium-speed vibration", energy_low: "share of slow, rolling motion",
    mag_mean: "average amount of shaking (g)", up_zero_cross: "how often the bounce crosses its middle",
    fwd_range: "forward-back range (g)",
  };
  const NAME = { walking: "Walking", upstairs: "Stairs up", downstairs: "Stairs down" };
  const COLOR = { walking: "#00e5ff", upstairs: "#ff3ea5", downstairs: "#ffe14d" };
  let net, feats, top, scene, preset = null, solved = false, lastPred = null;

  const $ = (id) => document.getElementById(id);
  const fmt = (f, v) => (f === "step_freq" ? v.toFixed(2) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

  function init(DATA) {
    net = DATA.network;
    if (!net || !net.top_features) return;
    top = net.top_features;
    const spot = DATA.gallery.find((g) => g.id === DATA.spotlight.id);
    const presets = [
      ["walking", "Typical walking", net.typical.walking],
      ["upstairs", "Typical stairs up", net.typical.upstairs],
      ["downstairs", "Typical stairs down", net.typical.downstairs],
      ["mistake", `⭐ Volunteer ${spot.person}'s stair climb (the mistake)`, spot.feats],
    ];
    $("presetRow").innerHTML = presets.map(([k, label]) => `<button class="preset" data-k="${k}">${label}</button>`).join("");
    $("presetRow").querySelectorAll("button").forEach((b, i) => (b.onclick = () => load(presets[i][0], presets[i][2])));
    $("challenge").innerHTML = `🏆 <b>Challenge:</b> load <b>Volunteer ${spot.person}'s stair climb</b> (a real stair climb the network got wrong). Can you move the sliders until the network says <b class="c-pink">Stairs up</b>? <span class="small-note">Hint: compare the sliders' colored ticks for walking and stairs up.</span>`;

    // sliders with ticks showing each activity's typical value
    $("sliders").innerHTML = top.map((f, i) => {
      const fi = net.features.indexOf(f);
      // usual range, widened if needed so every preset (including the real mistake) fits on the slider
      const vals = presets.map((pr) => pr[2][fi]);
      const lo = Math.min(net.ranges[f][0], ...vals), hi = Math.max(net.ranges[f][1], ...vals);
      const ticks = Object.keys(net.typical).map((a) => {
        const pos = ((net.typical[a][fi] - lo) / (hi - lo)) * 100;
        return `<span class="tick" style="left:${Math.max(0, Math.min(100, pos))}%;background:${COLOR[a]}" title="typical ${NAME[a].toLowerCase()}"></span>`;
      }).join("");
      return `<div class="slider">
        <label for="sl${i}"><b>${NetView.FRIENDLY[f]}</b> <span class="val" id="val${i}"></span><small>${HELP[f] || ""}</small></label>
        <div class="track-wrap"><input type="range" id="sl${i}" min="${lo}" max="${hi}" step="${(hi - lo) / 200}">${ticks}</div>
      </div>`;
    }).join("");
    top.forEach((f, i) => ($("sl" + i).oninput = (e) => { feats[net.features.indexOf(f)] = +e.target.value; update(); }));

    scene = Scenes.createScene($("buildScene"), { activity: "walking", f: 1.7, label: "MODEL SAYS: …" });
    $("buildNetPanel").addEventListener("toggle", drawNet);
    load("walking", net.typical.walking, true);
  }

  function load(key, values, quiet) {
    preset = key;
    feats = values.slice();
    top.forEach((f, i) => ($("sl" + i).value = feats[net.features.indexOf(f)]));
    $("presetRow").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === key));
    if (key === "mistake") { solved = false; $("challenge").classList.add("active"); }
    if (!quiet && window.Sound) Sound.click();
    update();
  }

  function update() {
    const p = NetView.probsOf(net, feats);
    const pred = Object.keys(p).sort((a, b) => p[b] - p[a])[0];
    top.forEach((f, i) => ($("val" + i).textContent = fmt(f, feats[net.features.indexOf(f)])));
    $("buildAnswer").innerHTML = `<span class="ba-label">The network says</span><span class="ba-pred" style="color:${COLOR[pred]}">${NAME[pred]}</span><span class="ba-pct">${Math.round(p[pred] * 100)}% sure</span>`;
    $("buildBars").innerHTML = net.classes.map((c) => `<div class="prob"><span>${NAME[c]}</span><div class="track"><div class="fill" style="width:${p[c] * 100}%;background:${COLOR[c]}"></div></div><span>${Math.round(p[c] * 100)}%</span></div>`).join("");
    // the workout buddy acts out whatever the network currently thinks, at the slider's step rhythm
    const steps = feats[net.features.indexOf("step_freq")];
    Scenes.setPace(scene, steps);
    if (pred !== lastPred) { scene.opts.activity = pred; scene.opts.label = "MODEL SAYS: " + Scenes.CALLS[pred]; scene.labelW = 0; lastPred = pred; }
    // challenge
    if (preset === "mistake" && pred === "upstairs" && !solved) {
      solved = true;
      $("challenge").classList.add("won");
      $("challengeWin").hidden = false;
      if (window.Sound) Sound.win();
    }
    if (preset !== "mistake") { $("challenge").classList.remove("won", "active"); $("challengeWin").hidden = true; }
    drawNet();
  }

  function drawNet() {
    if (!$("buildNetPanel").open) return;
    const p = NetView.probsOf(net, feats);
    const pred = Object.keys(p).sort((a, b) => p[b] - p[a])[0];
    NetView.render($("buildNetView"), net, { feats, pred, true: pred }, true, { noFlow: true });
  }

  window.Builder = { init };
})();
