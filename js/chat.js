// In-browser chatbot using WebLLM (WebGPU). Loaded only after the visitor clicks "Enable chat".
// If anything fails, the rest of the exhibit keeps working.
//
// Speed: small models in the browser are slowest at *reading* the prompt, so for each question we
// send only the most relevant sections of the site guide (simple keyword matching), not the whole guide.

const MODELS = {
  quality: { f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC", f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC", label: "Llama 3.2 1B" },
  fast:    { f16: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC", label: "Qwen 2.5 0.5B" },
};
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";

const $ = (id) => document.getElementById(id);
let engine = null;
let busy = false;
let SECTIONS = [];

const SUGGESTIONS = [
  "Where did your data come from?",
  "How did your model compare with the baseline?",
  "How well would this model work on a dataset you never tested?",
  "Why did the model think volunteer 9 was walking?",
];

// ---------- pick the relevant guide sections for a question ----------
const HINTS = {
  "Purpose": "purpose goal why exhibit about question discover point",
  "Data": "data dataset come from source synthetic real fake simulated collected people volunteers windows uci recorded phone samsung license credit",
  "Model inputs and outputs": "model input inputs output features feature network neural layer neurons hidden train trained tuning alpha predict works how",
  "Test results": "result results accuracy accurate baseline compare compared comparison score test performance good well confusion recall percent mistakes",
  "Highlighted mistake": "mistake wrong error spotlight volunteer light-footed climber why confused stairs barometer gyroscope helped",
  "How to use the exhibit": "use play game guess animation figure buddy lady sound sounds music slow-mo filter playhead build builder slider sliders challenge preset peek inside neurons glow",
  "Limitations": "limitation limitations real phone other dataset never tested different generalize work smartwatch accurate trust medical weakness",
  "About the chatbot": "chatbot chat you language webllm webgpu llm ai bot",
};
const STOP = new Set("the a an is are was were do does did how what why where when who your you our this that it of in on to for with and or be can would will".split(" "));

function splitGuide(md) {
  const parts = md.split(/\n(?=## )/);
  return parts.slice(1).map((p) => {
    const title = p.split("\n")[0].replace(/^##\s*/, "").trim();
    return { title, text: p.trim(), words: new Set((p + " " + (HINTS[title] || "")).toLowerCase().match(/[a-z0-9.-]+/g)) };
  });
}

function relevantGuide(q) {
  const qw = (q.toLowerCase().match(/[a-z0-9.-]+/g) || []).filter((w) => !STOP.has(w) && w.length > 2);
  const scored = SECTIONS.map((s) => {
    let score = 0;
    for (const w of qw) {
      if (s.words.has(w)) score += (HINTS[s.title] || "").includes(w) ? 2 : 1;
      else if (w.length > 4 && [...s.words].some((x) => x.startsWith(w.slice(0, 5)))) score += 0.5;
    }
    return { s, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0].score;
  let pick = scored.filter((x, i) => x.score > 0 && (i === 0 || x.score >= 0.6 * top)).slice(0, 2).map((x) => x.s);
  // nothing matched: give the overview and the limitations so the bot can say what the guide does/doesn't cover
  if (!pick.length) pick = SECTIONS.filter((s) => s.title === "Purpose" || s.title === "Limitations");
  return pick.map((s) => s.text).join("\n\n");
}

function systemPrompt(excerpt) {
  return `You answer visitor questions for a web exhibit called "Wearable Activity Detective".
Use ONLY the GUIDE EXCERPT below.
- If the excerpt does not answer the question, say "The site guide doesn't cover that." and then mention anything related it does say. Never invent numbers, datasets, or results.
- Use the exact numbers from the excerpt.
- Answer in 2-3 short sentences of plain language.

GUIDE EXCERPT:
${excerpt}`;
}

// ---------- WebGPU + loading ----------
async function checkWebGPU() {
  if (!("gpu" in navigator)) return { ok: false, why: "This browser doesn't support WebGPU. Try a recent Chrome or Edge on a desktop or laptop." };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ok: false, why: "WebGPU is available, but no compatible graphics adapter was found on this device." };
    return { ok: true, f16: adapter.features.has("shader-f16") };
  } catch (e) {
    return { ok: false, why: "WebGPU check failed: " + e.message };
  }
}

function setStatus(html, cls = "") { $("chatStatus").innerHTML = `<span class="${cls}">${html}</span>`; }

function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + (role === "user" ? "user" : "bot");
  d.textContent = text;
  $("chatLog").appendChild(d);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
  return d;
}

async function enableChat() {
  const btn = $("enableChat");
  btn.disabled = true;
  $("modelChoice").disabled = true;
  const gpu = await checkWebGPU();
  if (!gpu.ok) {
    setStatus("Chat unavailable: " + gpu.why + " The rest of the exhibit still works.", "bad");
    btn.disabled = false; $("modelChoice").disabled = false;
    return;
  }
  const guide = window.SITE_GUIDE || (await (await fetch("guide.md")).text());
  SECTIONS = splitGuide(guide);
  const choice = MODELS[$("modelChoice").value] || MODELS.quality;
  const model = gpu.f16 ? choice.f16 : choice.f32;
  setStatus("WebGPU detected ✓ Downloading and warming up " + choice.label + ". The first load can take a few minutes; later loads use your browser's cache.");
  $("progressWrap").hidden = false;
  try {
    const webllm = await import(WEBLLM_URL);
    engine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: (r) => {
        $("progressBar").style.width = Math.round((r.progress || 0) * 100) + "%";
        $("progressText").textContent = r.text || "";
      },
    });
  } catch (e) {
    console.error(e);
    setStatus("Chat failed to load (" + (e.message || e) + "). The rest of the exhibit still works. You can try again, or pick the other model.", "bad");
    $("progressWrap").hidden = true;
    btn.disabled = false; $("modelChoice").disabled = false;
    return;
  }
  $("progressWrap").hidden = true;
  $("progressText").textContent = "";
  btn.hidden = true;
  $("modelPick").hidden = true;
  setStatus("Chat ready ✓ (" + choice.label + "). Answers come only from the site guide.", "good");
  $("chat").classList.add("ready");   // hide the intro text to make room for the conversation
  setReady(true);
  addMsg("bot", "Hi! Type any question about the data, the model, its results, or the mistake spotlight.");
  $("chatInput").focus();
}

function setReady(on) {
  $("chatInput").disabled = !on;
  $("sendBtn").disabled = !on;
  $("chatInput").placeholder = on ? "Type your question and press Enter" : "Enable chat first, then type your question";
  document.querySelectorAll("#suggest button").forEach((b) => (b.disabled = !on));
}

function buildSuggestions() {
  const sug = $("suggest");
  for (const q of SUGGESTIONS) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = q;
    b.onclick = () => ask(q);
    sug.appendChild(b);
  }
}

async function ask(q) {
  if (!engine || busy || !q.trim()) return;
  busy = true;
  setReady(false);
  addMsg("user", q);
  $("chatInput").value = "";
  const bubble = addMsg("bot", "Thinking…");
  const start = performance.now();
  // each question is answered on its own, with only the guide sections that match it
  const msgs = [{ role: "system", content: systemPrompt(relevantGuide(q)) }, { role: "user", content: q }];
  let reply = "";
  try {
    const stream = await engine.chat.completions.create({ messages: msgs, stream: true, temperature: 0.2, max_tokens: 160 });
    for await (const chunk of stream) {
      reply += chunk.choices[0]?.delta?.content || "";
      bubble.textContent = reply;
      $("chatLog").scrollTop = $("chatLog").scrollHeight;
    }
    const secs = ((performance.now() - start) / 1000).toFixed(1);
    const t = document.createElement("div");
    t.className = "msg-time"; t.textContent = `answered in ${secs}s`;
    bubble.after(t);
  } catch (e) {
    bubble.textContent = "Sorry, something went wrong generating that answer (" + (e.message || e) + ").";
  }
  busy = false;
  setReady(true);
  $("chatInput").focus();
}

buildSuggestions();
setReady(false);
$("enableChat").addEventListener("click", enableChat);
$("chatForm").addEventListener("submit", (e) => { e.preventDefault(); ask($("chatInput").value); });
if (!("gpu" in navigator)) setStatus("Heads up: this browser doesn't report WebGPU support, so chat probably won't load here. Everything else works.", "bad");

// exposed for testing
window.__chatTest = { splitGuide, relevantGuide, setSections: (md) => (SECTIONS = splitGuide(md)) };
