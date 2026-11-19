// Wearable Activity Detective — exhibit logic (no libraries needed)
const SHORT = { walking: "Walking", upstairs: "Stairs up", downstairs: "Stairs down" };
let DATA = null, deck = [], pos = 0, guessed = false;
let score = { you: 0, model: 0, played: 0 };

const $ = (id) => document.getElementById(id);
const pct = (v) => (v * 100).toFixed(1) + "%";

async function init() {
  try {
    DATA = await (await fetch("data/exhibit.json")).json();
  } catch (e) {
    $("trace").textContent = "Could not load data/exhibit.json. If you opened this file directly, run a local web server or view it on GitHub Pages.";
    return;
  }
  buildDeck();
  renderCard();
  renderSpotlight();
  renderResults();
  loadGuide();
  $("nextBtn").onclick = () => { pos = (pos + 1) % deck.length; renderCard(); };
  $("onlyMistakes").onchange = () => { buildDeck(); renderCard(); };
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildDeck() {
  const only = $("onlyMistakes").checked;
  deck = shuffle(DATA.gallery.filter((g) => !only || g.true !== g.pred));
  pos = 0;
}

// ---------- chart ----------
let YMAX = null;
function yMax() {
  if (YMAX) return YMAX;
  let m = 0;
  for (const g of DATA.gallery) for (const k of ["x", "y", "z"]) for (const v of g[k]) m = Math.max(m, Math.abs(v));
  return (YMAX = Math.ceil(m * 10) / 10);
}

function drawTrace(el, w) {
  el._w = w;
  const W = el.clientWidth || 900, H = el.clientHeight || 230, P = { l: 44, r: 10, t: 10, b: 26 };
  const n = w.z.length, ym = yMax(), secs = n / DATA.sample_rate_hz;
  const sx = (i) => P.l + (i / (n - 1)) * (W - P.l - P.r);
  const sy = (v) => P.t + (1 - (v + ym) / (2 * ym)) * (H - P.t - P.b);
  const path = (arr) => arr.map((v, i) => (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1)).join("");
  let grid = "";
  for (let s = 0; s <= Math.floor(secs); s++) {
    const x = P.l + (s / secs) * (W - P.l - P.r);
    grid += `<line x1="${x}" x2="${x}" y1="${P.t}" y2="${H - P.b}" stroke="#eee9df"/><text x="${x}" y="${H - 8}" font-size="12" fill="#8a8f96" text-anchor="middle">${s}s</text>`;
  }
  for (const v of [-ym, 0, ym]) {
    grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="${v === 0 ? "#d6d1c6" : "#eee9df"}"/><text x="${P.l - 6}" y="${sy(v) + 4}" font-size="12" fill="#8a8f96" text-anchor="end">${v.toFixed(1)}g</text>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="three-axis acceleration over ${secs} seconds">
    ${grid}
    <path d="${path(w.y)}" fill="none" stroke="var(--y)" stroke-width="1.4" opacity=".8"/>
    <path d="${path(w.x)}" fill="none" stroke="var(--x)" stroke-width="1.4" opacity=".85"/>
    <path d="${path(w.z)}" fill="none" stroke="var(--z)" stroke-width="2.2"/></svg>`;
}

// ---------- game ----------
function renderCard() {
  const w = deck[pos];
  guessed = false;
  $("cardCount").textContent = `Trace ${pos + 1} of ${deck.length}`;
  $("cardPerson").textContent = `Held-out person #${w.person}`;
  drawTrace($("trace"), w);
  $("reveal").hidden = true;
  const row = $("guessRow");
  row.innerHTML = "";
  for (const a of DATA.activities) {
    const b = document.createElement("button");
    b.className = "btn choice";
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

  const probs = DATA.activities.map((k) => `
    <div class="prob"><span>${SHORT[k]}</span><div class="track"><div class="fill ${k === w.pred && !modelRight ? "wrong" : ""}" style="width:${w.probs[k] * 100}%"></div></div><span>${Math.round(w.probs[k] * 100)}%</span></div>`).join("");
  let note = "";
  if (!modelRight) note = `<p class="small-note">The model got this one wrong. ${w.id === DATA.spotlight.id ? "This is the window in the <a href='#spotlight'>mistake spotlight</a>." : "Mix-ups like this usually happen when someone's step rhythm (here " + w.steps_per_sec + " steps/s) sits between the typical paces of two activities."}</p>`;
  $("reveal").innerHTML = `
    <div class="verdict">Truth: ${DATA.labels[w.true]}</div>
    <p>You said <b class="${youRight ? "good" : "bad"}">${SHORT[a]}</b> ${youRight ? "✓" : "✗"} &nbsp;·&nbsp;
       The model said <b class="${modelRight ? "good" : "bad"}">${SHORT[w.pred]}</b> ${modelRight ? "✓" : "✗"}</p>
    <p class="small-note">Model confidence for each activity · measured step rhythm: ${w.steps_per_sec} steps per second</p>
    ${probs}${note}`;
  $("reveal").hidden = false;
}

// ---------- spotlight ----------
function renderSpotlight() {
  const s = DATA.gallery.find((g) => g.id === DATA.spotlight.id);
  const comp = DATA.gallery
    .filter((g) => g.true === "walking" && g.pred === "walking" && g.person !== s.person)
    .sort((a, b) => b.probs.walking - a.probs.walking)[0];
  $("spotText").textContent = DATA.spotlight.explanation;
  drawTrace($("spotTrace"), s);
  drawTrace($("compTrace"), comp);
  $("spotStats").textContent = `Person #${s.person} · ${s.steps_per_sec} steps/s · model: ${Math.round(s.probs.upstairs * 100)}% stairs up`;
  $("compStats").textContent = `Person #${comp.person} · ${comp.steps_per_sec} steps/s · model: ${Math.round(comp.probs.walking * 100)}% walking`;
}

// ---------- results ----------
function renderResults() {
  const s = DATA.summary;
  $("bars").innerHTML = `
    <div class="barrow"><span>Neural network</span><div class="track"><div class="fill" style="width:${s.nn_accuracy * 100}%"></div></div><b>${pct(s.nn_accuracy)}</b></div>
    <div class="barrow"><span>Baseline</span><div class="track"><div class="fill base" style="width:${s.baseline_accuracy * 100}%"></div></div><b>${pct(s.baseline_accuracy)}</b></div>`;
  $("baselineNote").textContent = `Baseline rule: ${s.baseline_rule.replace("downstairs", "going down stairs")}. The three activities are equally common in the test set, so any always-the-same guess is right one-third of the time.`;
  const A = DATA.activities, cm = s.confusion_matrix;
  let html = `<tr><th>true ↓ / predicted →</th>${A.map((a) => `<th>${SHORT[a]}</th>`).join("")}</tr>`;
  A.forEach((a, i) => {
    html += `<tr><th>${SHORT[a]}</th>${cm[i].map((v, j) => `<td class="${i === j ? "diag" : v >= 20 ? "hot" : ""}">${v}</td>`).join("")}</tr>`;
  });
  $("cm").innerHTML = html;
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
  } catch (e) {
    $("guideBody").textContent = "Could not load guide.md.";
  }
}

let rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => document.querySelectorAll(".trace").forEach((el) => el._w && drawTrace(el, el._w)), 150);
});

init();
