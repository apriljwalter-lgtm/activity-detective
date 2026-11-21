// Wearable Activity Detective — exhibit logic (no libraries needed)
const SHORT = { walking: "Walking", upstairs: "Stairs up", downstairs: "Stairs down" };
let DATA = null, deck = [], pos = 0, guessed = false;
let score = { you: 0, model: 0, played: 0 };

const $ = (id) => document.getElementById(id);
const pct = (v) => (v * 100).toFixed(1) + "%";

async function init() {
  heroScenes();
  try {
    DATA = await (await fetch("data/exhibit.json")).json();
  } catch (e) {
    $("trace").textContent = "Could not load data/exhibit.json. If you opened this file directly, run a local web server or view it on GitHub Pages.";
    return;
  }
  renderGlance();
  buildDeck();
  renderCard();
  renderSpotlight();
  renderResults();
  loadGuide();
  $("nextBtn").onclick = () => { Sound.click(); pos = (pos + 1) % deck.length; renderCard(); };
  $("onlyMistakes").onchange = () => { buildDeck(); renderCard(); };
  const toggle = (id, fn, label) => ($(id).onclick = () => {
    const on = $(id).getAttribute("aria-pressed") !== "true";
    if (fn(on) !== false) { $(id).setAttribute("aria-pressed", on); label(on); }
  });
  toggle("musicBtn", (on) => Sound.setMusic(on), (on) => ($("musicBtn").querySelector(".mlabel").textContent = "🎵 Workout music: " + (on ? "ON" : "OFF")));
  // Browsers block sound until the visitor interacts, so the music starts on the first click, tap, or key press
  // anywhere on the page (clicking the music button itself still just toggles it).
  const musicLabel = (on) => ($("musicBtn").querySelector(".mlabel").textContent = "🎵 Workout music: " + (on ? "ON" : "OFF"));
  const autoStart = (e) => {
    ["pointerdown", "keydown"].forEach((ev) => removeEventListener(ev, autoStart, true));
    if (e.target.closest && e.target.closest("#musicBtn")) return;       // the button handles its own click
    if (!Sound.state.music && Sound.setMusic(true) !== false) { $("musicBtn").setAttribute("aria-pressed", true); musicLabel(true); }
  };
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, autoStart, true));
  toggle("sfxBtn", (on) => Sound.setSfx(on), (on) => ($("sfxBtn").querySelector(".sk-state").textContent = on ? "footstep sounds are ON (click to turn off)" : "click to turn footstep sounds ON"));
  $("slowBtn").onclick = () => {
    const on = $("slowBtn").getAttribute("aria-pressed") !== "true";
    $("slowBtn").setAttribute("aria-pressed", on);
    window.ANIM.speed = on ? 0.35 : 1;
  };
}

function heroScenes() {
  Scenes.createScene($("heroWalk"), { activity: "walking", f: 1.9, label: Scenes.CALLS.walking });
  Scenes.createScene($("heroUp"), { activity: "upstairs", f: 1.6, label: Scenes.CALLS.upstairs });
  Scenes.createScene($("heroDown"), { activity: "downstairs", f: 1.85, label: Scenes.CALLS.downstairs });
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildDeck() {
  const only = $("onlyMistakes").checked;
  deck = shuffle(DATA.gallery.filter((g) => !only || g.true !== g.pred));
  pos = 0;
}

// a scene that walks in time with a specific trace window (footfalls land on the bounce peaks)
function windowScene(el, w, activity, label, mystery = false, withSteps = false) {
  const T = w.z.length / DATA.sample_rate_hz;
  const t0 = Scenes.firstPeakTime(w.z, DATA.sample_rate_hz, w.steps_per_sec);
  const onStep = withSteps ? (n) => Sound.footstep(mystery ? "mystery" : activity, n) : null;
  return Scenes.createScene(el, { activity, f: w.steps_per_sec, t0, loop: T, label, mystery, onStep });
}

// ---------- chart ----------
let YMAX = null;
function yMax() {
  if (YMAX) return YMAX;
  const all = [];
  for (const g of DATA.gallery) for (const k of ["x", "y", "z"]) for (const v of g[k]) all.push(Math.abs(v));
  all.sort((a, b) => a - b);
  return (YMAX = Math.ceil(all[all.length - 1] * 10) / 10);   // fit the biggest peak so nothing is cut off
}

function drawTrace(el, w) {
  el._w = w;
  const W = el.clientWidth || 900, H = el.clientHeight || 230, P = { l: 44, r: 10, t: 10, b: 26 };
  const n = w.z.length, ym = yMax(), secs = n / DATA.sample_rate_hz;
  const sx = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const sy = (v) => P.t + (1 - (Math.max(-ym, Math.min(ym, v)) + ym) / (2 * ym)) * (H - P.t - P.b);
  const path = (arr) => arr.map((v, i) => (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1)).join("");
  let grid = "";
  for (let s = 0; s <= Math.floor(secs); s++) {
    const x = P.l + (s / secs) * (W - P.l - P.r);
    grid += `<line x1="${x}" x2="${x}" y1="${P.t}" y2="${H - P.b}" stroke="rgba(255,62,165,.18)"/><text x="${x}" y="${H - 8}" font-size="12" fill="#a893cc" text-anchor="middle">${s}s</text>`;
  }
  for (const v of [-ym, 0, ym]) {
    grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="${v === 0 ? "rgba(255,255,255,.25)" : "rgba(255,62,165,.18)"}"/><text x="${P.l - 6}" y="${sy(v) + 4}" font-size="12" fill="#a893cc" text-anchor="end">${v.toFixed(1)}g</text>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="three-axis acceleration over ${secs} seconds">
    ${grid}
    <path d="${path(w.y)}" fill="none" stroke="var(--y)" stroke-width="1.4" opacity=".75"/>
    <path d="${path(w.x)}" fill="none" stroke="var(--x)" stroke-width="1.4" opacity=".8"/>
    <path d="${path(w.z)}" fill="none" stroke="var(--z)" stroke-width="6" opacity=".18"/>
    <path d="${path(w.z)}" fill="none" stroke="var(--z)" stroke-width="2.4"/></svg>`;
  Scenes.registerPlayhead(el, { sx, sy, n, z: w.z, fs: DATA.sample_rate_hz, top: P.t, bottom: H - P.b });
}

// ---------- game ----------
function renderCard() {
  const w = deck[pos];
  guessed = false;
  $("cardCount").textContent = `Trace ${pos + 1} of ${deck.length}`;
  $("cardPerson").textContent = `Test volunteer #${w.person}`;
  drawTrace($("trace"), w);
  windowScene($("gameScene"), w, "walking", "WHAT'S HER MOVE?", true, false); // silent until you guess
  $("reveal").hidden = true;
  $("reveal").innerHTML = "";
  const row = $("guessRow");
  row.innerHTML = "";
  for (const a of DATA.activities) {
    const b = document.createElement("button");
    b.className = "btn choice";
    b.dataset.a = a;
    b.textContent = SHORT[a];
    b.onclick = () => guess(a, b);
    row.appendChild(b);
  }
}

function guess(a, btn) {
  if (guessed) return;
  guessed = true;
  btn.classList.add("picked");
  [...$("guessRow").children].forEach((b) => (b.disabled = true));
  const w = deck[pos];
  const youRight = a === w.true, modelRight = w.pred === w.true;
  score.played++; if (youRight) score.you++; if (modelRight) score.model++;
  $("youScore").textContent = score.you; $("modelScore").textContent = score.model;
  $("played").textContent = $("played2").textContent = score.played;

  // fog lifts: the main scene now shows what really happened
  windowScene($("gameScene"), w, w.true, "REALLY: " + Scenes.CALLS[w.true], false, true);
  if (youRight) Sound.win(); else Sound.lose();
  setTimeout(() => Sound.coach(Scenes.CALLS[w.true].replace("!", "")), 450);

  const probs = DATA.activities.map((k) => `
    <div class="prob"><span>${SHORT[k]}</span><div class="track"><div class="fill ${k === w.pred && !modelRight ? "wrong" : ""}" style="width:${w.probs[k] * 100}%"></div></div><span>${Math.round(w.probs[k] * 100)}%</span></div>`).join("");
  let note = "";
  if (!modelRight) note = `<p class="small-note">The model fumbled this one. ${w.id === DATA.spotlight.id ? "It's the window in the <a href='#spotlight'>mistake spotlight</a>." : "A phone's accelerometer can't feel height change, so a gentle stair climb or descent can shake the phone a lot like flat walking."}</p>`;
  $("reveal").innerHTML = `
    <div class="verdict">${youRight && modelRight ? "Totally awesome! You both nailed it" : youRight ? "You beat the machine!" : modelRight ? "The model wins this round" : "Gnarly! You both missed it"}</div>
    <p>Truth: <b>${DATA.labels[w.true]}</b> &nbsp;·&nbsp; You said <b>${SHORT[a]}</b><span class="badge ${youRight ? "ok" : "no"}">${youRight ? "✓" : "✗"}</span>
       &nbsp;·&nbsp; Model said <b>${SHORT[w.pred]}</b><span class="badge ${modelRight ? "ok" : "no"}">${modelRight ? "✓" : "✗"}</span></p>
    <div class="reveal-grid">
      <div>
        <div class="scene" id="modelScene"></div>
        <p class="small-note">What the model pictured, in time with the same trace</p>
      </div>
      <div>
        <p class="small-note">Model confidence for each activity · measured step rhythm: ${w.steps_per_sec} steps per second</p>
        ${probs}${note}
      </div>
    </div>`;
  $("reveal").hidden = false;
  windowScene($("modelScene"), w, w.pred, "MODEL: " + Scenes.CALLS[w.pred]);
}

// ---------- spotlight ----------
function renderSpotlight() {
  const s = DATA.gallery.find((g) => g.id === DATA.spotlight.id);
  // comparison: a correctly predicted window of the same true activity, from a different volunteer
  const comp = DATA.gallery
    .filter((g) => g.true === s.true && g.pred === s.true && g.person !== s.person)
    .sort((a, b) => b.probs[s.true] - a.probs[s.true])[0];
  const cls = { walking: "c-cyan", upstairs: "c-pink", downstairs: "c-yellow" };
  $("spotCap").innerHTML = `The mistake: truly <b class="${cls[s.true]}">${SHORT[s.true].toLowerCase()}</b>, predicted <b class="${cls[s.pred]}">${SHORT[s.pred].toLowerCase()}</b>`;
  $("compCap").innerHTML = `For comparison: a correctly predicted <b class="${cls[s.true]}">${SHORT[s.true].toLowerCase()}</b> window from another volunteer`;
  $("spotText").textContent = DATA.spotlight.explanation;
  drawTrace($("spotTrace"), s);
  drawTrace($("compTrace"), comp);
  windowScene($("spotTruth"), s, s.true, "REALLY: " + Scenes.CALLS[s.true]);
  windowScene($("spotModel"), s, s.pred, "MODEL: " + Scenes.CALLS[s.pred]);
  windowScene($("compScene"), comp, comp.true, "REALLY: " + Scenes.CALLS[comp.true]);
  $("spotStats").textContent = `Volunteer #${s.person} · ${s.steps_per_sec} steps/s · model: ${Math.round(s.probs[s.pred] * 100)}% ${SHORT[s.pred].toLowerCase()}`;
  $("compStats").textContent = `Volunteer #${comp.person} · ${comp.steps_per_sec} steps/s · model: ${Math.round(comp.probs[comp.true] * 100)}% ${SHORT[comp.true].toLowerCase()}`;
}

// ---------- results ----------
function renderResults() {
  const s = DATA.summary;
  $("bars").innerHTML = `
    <div class="barrow"><span>Neural network</span><div class="track"><div class="fill" style="width:${s.nn_accuracy * 100}%"></div></div><b>${pct(s.nn_accuracy)}</b></div>
    <div class="barrow"><span>Baseline</span><div class="track"><div class="fill base" style="width:${s.baseline_accuracy * 100}%"></div></div><b>${pct(s.baseline_accuracy)}</b></div>`;
  $("baselineNote").textContent = `Baseline rule: always guess "walking", the most common activity in the training data. It is right only when the test volunteer really was walking (${s.test_counts.walking} of ${s.n_test_windows.toLocaleString()} test windows).`;
  $("resultsHint").textContent = `Scored on ${s.n_test_windows.toLocaleString()} windows from ${s.n_test_people} test volunteers the model never saw (it trained on ${s.n_train_people} other volunteers).`;
  const A = DATA.activities, cm = s.confusion_matrix;
  let html = `<tr><th>true ↓ / predicted →</th>${A.map((a) => `<th>${SHORT[a]}</th>`).join("")}</tr>`;
  A.forEach((a, i) => {
    html += `<tr><th>${SHORT[a]}</th>${cm[i].map((v, j) => `<td class="${i === j ? "diag" : v >= 20 ? "hot" : ""}">${v}</td>`).join("")}</tr>`;
  });
  $("cm").innerHTML = html;
}

// ---------- at a glance ----------
function renderGlance() {
  const s = DATA.summary;
  const people = s.n_train_people + s.n_test_people;
  const chips = [
    ["📱", `${people} real volunteers`, "UCI smartphone dataset", "#guide"],
    ["🧠", "Small neural network", `${s.n_features} motion features`, "#results"],
    ["🎯", `${pct(s.nn_accuracy)} correct`, `vs. ${pct(s.baseline_accuracy)} baseline`, "#results"],
    ["🧪", `Tested on ${s.n_test_people} new people`, `${s.n_test_windows.toLocaleString()} windows it never saw`, "#results"],
  ];
  $("glance").innerHTML = chips.map(([i, a, b, href]) => `<a class="chip" href="${href}"><span class="ci">${i}</span><span><b>${a}</b><small>${b}</small></span></a>`).join("");
}

// ---------- guide ----------
function mdToHtml(md) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
  let out = "", inList = 0;
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const m = line.match(/^(\s*)- (.*)/);
    if (m) {
      const depth = m[1].length >= 2 ? 2 : 1;
      while (inList < depth) { out += "<ul>"; inList++; }
      while (inList > depth) { out += "</ul>"; inList--; }
      out += `<li>${inline(m[2])}</li>`;
      continue;
    }
    while (inList) { out += "</ul>"; inList--; }
    if (line.startsWith("## ")) out += `<h2>${inline(line.slice(3))}</h2>`;
    else if (line.startsWith("# ")) out += `<h1>${inline(line.slice(2))}</h1>`;
    else if (line) out += `<p>${inline(line)}</p>`;
  }
  while (inList) { out += "</ul>"; inList--; }
  return out;
}

async function loadGuide() {
  try {
    const md = await (await fetch("guide.md")).text();
    window.SITE_GUIDE = md;
    $("guideBody").innerHTML = mdToHtml(md);
    // fill the in-page "ⓘ" panels from the matching guide sections, so the page and the chatbot always agree
    const sections = {};
    md.split(/\n(?=## )/).slice(1).forEach((p) => { const nl = p.indexOf("\n"); sections[p.slice(3, nl).trim()] = p.slice(nl + 1); });
    document.querySelectorAll("details.info").forEach((d) => {
      const body = sections[d.dataset.sec];
      if (body) d.querySelector(".info-body").innerHTML = mdToHtml(body);
    });
  } catch (e) {
    $("guideBody").textContent = "Could not load guide.md.";
  }
}

// the "Site guide" link at the top opens the collapsed guide
document.querySelectorAll('a[href="#guide"]').forEach((a) => a.addEventListener("click", () => ($("guideDetails").open = true)));
if (location.hash === "#guide") $("guideDetails").open = true;

let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => document.querySelectorAll(".trace").forEach((el) => el._w && drawTrace(el, el._w)), 150);
});

init();
