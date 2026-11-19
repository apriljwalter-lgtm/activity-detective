// In-browser chatbot using WebLLM (WebGPU). Loaded only after the visitor clicks "Enable chat".
// If anything fails, the rest of the exhibit keeps working.

const MODEL_F16 = "Llama-3.2-1B-Instruct-q4f16_1-MLC"; // ~0.9 GB download
const MODEL_F32 = "Llama-3.2-1B-Instruct-q4f32_1-MLC"; // for GPUs without 16-bit shader support
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";

const $ = (id) => document.getElementById(id);
let engine = null;
let history = [];
let busy = false;

const SUGGESTIONS = [
  "Where did your data come from?",
  "How did your model compare with the baseline?",
  "How well would this model work on a dataset you never tested?",
  "Why did the model think the slow walker was climbing stairs?",
];

function systemPrompt(guide) {
  return `You are the guide for a museum-style web exhibit called "Wearable Activity Detective".
Answer visitor questions using ONLY the SITE GUIDE below. Rules:
- If the guide does not contain the answer, say clearly: "The site guide doesn't cover that." Then share what the guide does say that is related, if anything. Never invent numbers, datasets, or results.
- Use the exact numbers from the guide.
- Keep answers short (2-5 sentences) and use plain language a high-school student can follow.

SITE GUIDE:
"""
${guide}
"""`;
}

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
  const gpu = await checkWebGPU();
  if (!gpu.ok) {
    setStatus("Chat unavailable: " + gpu.why + " The rest of the exhibit still works.", "bad");
    btn.disabled = false;
    return;
  }
  const guide = window.SITE_GUIDE || (await (await fetch("guide.md")).text());
  const model = gpu.f16 ? MODEL_F16 : MODEL_F32;
  setStatus("WebGPU detected ✓ Downloading and warming up the model (" + model + "). The first load can take a few minutes; later loads use your browser's cache.");
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
    setStatus("Chat failed to load (" + (e.message || e) + "). The rest of the exhibit still works. You can try again, or use Chrome/Edge on a computer with a dedicated or recent graphics chip.", "bad");
    $("progressWrap").hidden = true;
    btn.disabled = false;
    return;
  }
  history = [{ role: "system", content: systemPrompt(guide) }];
  $("progressWrap").hidden = true;
  $("progressText").textContent = "";
  btn.hidden = true;
  setStatus("Chat ready ✓ Answers come only from the site guide.", "good");
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
  addMsg("user", q);
  $("chatInput").value = "";
  const bubble = addMsg("bot", "…");
  // keep the system prompt plus the last few turns so the guide always fits in the model's context
  const msgs = [history[0], ...history.slice(1).slice(-6), { role: "user", content: q }];
  let reply = "";
  try {
    const stream = await engine.chat.completions.create({ messages: msgs, stream: true, temperature: 0.2, max_tokens: 300 });
    for await (const chunk of stream) {
      reply += chunk.choices[0]?.delta?.content || "";
      bubble.textContent = reply;
      $("chatLog").scrollTop = $("chatLog").scrollHeight;
    }
    history.push({ role: "user", content: q }, { role: "assistant", content: reply });
  } catch (e) {
    bubble.textContent = "Sorry, something went wrong generating that answer (" + (e.message || e) + ").";
  }
  busy = false;
}

buildSuggestions();
setReady(false);
$("enableChat").addEventListener("click", enableChat);
$("chatForm").addEventListener("submit", (e) => { e.preventDefault(); ask($("chatInput").value); });
if (!("gpu" in navigator)) setStatus("Heads up: this browser doesn't report WebGPU support, so chat probably won't load here. Everything else works.", "bad");
