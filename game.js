
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const elCoins = document.getElementById("coins");
const elPressure = document.getElementById("pressure");
const elTod = document.getElementById("tod");
const elWind = document.getElementById("wind");
const elPop = document.getElementById("pop");
const elPrompt = document.getElementById("promptText");
const elHint = document.getElementById("hintText");

const btnPrimary = document.getElementById("btnPrimary");
const btnSecondary = document.getElementById("btnSecondary");

function resize() {
  // use device pixels for crispness
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}
resize();
window.addEventListener("resize", resize);

// ---------------- Background ----------------
// FIXED URL (the refs/heads variant is often not a direct raw file)
const BG_URL = "https://raw.githubusercontent.com/emfau88/Jagd2/main/bg.png";

const bgImg = new Image();
let bgReady = false;
let bgFailed = false;

bgImg.onload = () => { bgReady = true; bgFailed = false; };
bgImg.onerror = () => { bgReady = false; bgFailed = true; };

// cache-bust so you see updates immediately
bgImg.src = BG_URL + "?v=" + Date.now();

function drawImageCover(img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ---------------- State ----------------
const S = { PREPARE:"PREPARE", WAIT:"WAIT", ENCOUNTER:"ENCOUNTER", RESULT:"RESULT" };
let STATE = S.PREPARE;

// ---------------- Model ----------------
let revier = {
  population: { deer: 12, boar: 6, duck: 18 },
  pressure: 0,
  coins: 100,
  timeMin: 6 * 60,
  windDir: "NE",
};

// ---------------- Save/Load ----------------
const SAVE_KEY = "jagd2_revier_save_v1";
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ revier, ts: Date.now() })); }
  catch {}
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data?.revier) revier = data.revier;
  } catch {}
}
loadGame();

// ---------------- Encounter ----------------
let encounter = null;
let encounterTimer = 0;

function fmtTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function rollEncounterType() {
  const pool = [];
  const { deer, boar, duck } = revier.population;
  for (let i=0;i<deer;i++) pool.push("deer");
  for (let i=0;i<boar;i++) pool.push("boar");
  for (let i=0;i<duck;i++) pool.push("duck");
  return pool[Math.floor(Math.random() * pool.length)] || "deer";
}

function startEncounter() {
  STATE = S.ENCOUNTER;

  const type = rollEncounterType();
  encounter = {
    type,
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.62,
    scale: 0.55,
    wobble: Math.random() * Math.PI * 2,
  };
  encounterTimer = 7.0;

  elPrompt.textContent =
    type === "deer" ? "Begegnung: Reh — entscheiden."
    : type === "boar" ? "Begegnung: Wildschwein — Risiko."
    : "Begegnung: Ente — klein & flink.";

  elHint.textContent = "Im Encounter: links = Verschonen, rechts = Schießen";
  syncButtons();
}

function toResult(text) {
  STATE = S.RESULT;
  encounter = null;
  elPrompt.textContent = text + " (Weiter)";
  elHint.textContent = "Weiter tippen";
  saveGame();
  syncButtons();
}

// ---------------- Actions ----------------
function primaryAction() {
  if (STATE === S.PREPARE) {
    STATE = S.WAIT;
    elPrompt.textContent = "Ansitz… ruhig bleiben.";
    elHint.textContent = "Warte kurz auf eine Begegnung";
    syncButtons();

    setTimeout(() => {
      if (STATE === S.WAIT) startEncounter();
    }, 900);
    return;
  }

  if (STATE === S.ENCOUNTER) {
    shoot();
    return;
  }

  if (STATE === S.RESULT) {
    STATE = S.PREPARE;
    elPrompt.textContent = "Tippe „Vorbereiten“";
    elHint.textContent = "Vorbereiten → Warten → Begegnung → Entscheidung";
    syncButtons();
    return;
  }
}

function secondaryAction() {
  if (STATE === S.ENCOUNTER) {
    spare();
    return;
  }
  elPrompt.textContent = "Loop: Vorbereiten → Warten → Begegnung → Entscheidung. Druck steigt bei Abschuss.";
  elHint.textContent = "Tipp: Verschonen senkt Druck";
}

function shoot() {
  if (STATE !== S.ENCOUNTER || !encounter) return;
  const type = encounter.type;

  let gain = 0;
  let pressureGain = 0.10;

  if (type === "deer") { gain = 25; pressureGain = 0.10; revier.population.deer = Math.max(0, revier.population.deer - 1); }
  else if (type === "boar") { gain = 35; pressureGain = 0.14; revier.population.boar = Math.max(0, revier.population.boar - 1); }
  else { gain = 15; pressureGain = 0.06; revier.population.duck = Math.max(0, revier.population.duck - 2); }

  revier.coins += gain;
  revier.pressure += pressureGain;

  toResult(`Abschuss: +${gain} Coins, Druck +${pressureGain.toFixed(2)}`);
}

function spare() {
  if (STATE !== S.ENCOUNTER) return;

  const bonus = revier.pressure > 0.6 ? 18 : 10;
  revier.coins += bonus;
  revier.pressure = Math.max(0, revier.pressure - 0.05);

  toResult(`Verschont: +${bonus} Coins, Druck -0.05`);
}

function syncButtons() {
  if (STATE === S.PREPARE) {
    btnPrimary.textContent = "Vorbereiten";
    btnSecondary.textContent = "Info";
  } else if (STATE === S.WAIT) {
    btnPrimary.textContent = "Warten…";
    btnSecondary.textContent = "Info";
  } else if (STATE === S.ENCOUNTER) {
    btnPrimary.textContent = "Schießen (rechts)";
    btnSecondary.textContent = "Verschonen (links)";
  } else if (STATE === S.RESULT) {
    btnPrimary.textContent = "Weiter";
    btnSecondary.textContent = "Info";
  }
}

btnPrimary.addEventListener("pointerdown", (e) => { e.preventDefault(); primaryAction(); }, { passive: false });
btnSecondary.addEventListener("pointerdown", (e) => { e.preventDefault(); secondaryAction(); }, { passive: false });

// Tap on canvas during encounter (left/right decision)
canvas.addEventListener("pointerdown", (e) => {
  if (STATE !== S.ENCOUNTER) return;
  e.preventDefault();
  const x = e.clientX;
  if (x < window.innerWidth * 0.5) spare();
  else shoot();
}, { passive: false });

syncButtons();

// ---------------- Atmosphere ----------------
const dust = [];
function initDust(n = 24) {
  dust.length = 0;
  for (let i = 0; i < n; i++) {
    dust.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.8 + Math.random() * 1.6,
      a: 0.05 + Math.random() * 0.07,
      vx: -6 + Math.random() * 12,
      vy: -4 + Math.random() * 8,
    });
  }
}
initDust();

// ---------------- Loop ----------------
let last = 0;
function loop(t) {
  const dt = (t - last) / 1000;
  last = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  revier.timeMin = (revier.timeMin + dt * 2) % (24 * 60);

  if (STATE === S.ENCOUNTER && encounter) {
    encounter.scale += dt * 0.06;
    encounter.wobble += dt * 2.2;
    encounterTimer -= dt;
    if (encounterTimer <= 0) {
      toResult("Chance verpasst (zu lange gezögert)");
    }
  }

  for (const p of dust) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -20) p.x = window.innerWidth + 20;
    if (p.x > window.innerWidth + 20) p.x = -20;
    if (p.y < -20) p.y = window.innerHeight + 20;
    if (p.y > window.innerHeight + 20) p.y = -20;
  }

  // HUD
  elCoins.textContent = String(revier.coins);
  elPressure.textContent = revier.pressure.toFixed(2);
  elTod.textContent = fmtTime(Math.floor(revier.timeMin));
  elWind.textContent = revier.windDir;
  elPop.textContent = `D${revier.population.deer} B${revier.population.boar} E${revier.population.duck}`;
}

function draw() {
  drawBackground();

  // subtle haze & dust
  drawAtmosphere();

  if (STATE === S.ENCOUNTER && encounter) {
    drawEncounterFocus();
    drawAnimalPlaceholder(encounter);
    drawScopeOverlay();
  } else {
    drawVignette(0.30);
  }

  // BG load debug (only if failed)
  if (bgFailed) {
    drawTopDebug("BG failed to load. Check URL/path.");
  }
}

function drawBackground() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (bgReady) {
    drawImageCover(bgImg, 0, 0, w, h);
    return;
  }

  // fallback
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1c2d2a");
  g.addColorStop(0.4, "#163d2a");
  g.addColorStop(1, "#0c160f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawAtmosphere() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // haze
  const cx = w * 0.5;
  const cy = h * 0.62;
  const haze = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.min(w, h) * 0.85);
  haze.addColorStop(0, "rgba(255, 235, 160, 0.10)");
  haze.addColorStop(0.55, "rgba(90, 200, 120, 0.06)");
  haze.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  // dust
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const p of dust) {
    ctx.globalAlpha = p.a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // top readability shade
  const top = ctx.createLinearGradient(0, 0, 0, 160);
  top.addColorStop(0, "rgba(0,0,0,0.35)");
  top.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, 160);
}

function drawEncounterFocus() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w * 0.5;
  const cy = h * 0.62;
  const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(w, h) * 0.45);
  rg.addColorStop(0, "rgba(0,0,0,0.00)");
  rg.addColorStop(0.55, "rgba(0,0,0,0.18)");
  rg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
}

function drawAnimalPlaceholder(a) {
  const base =
    a.type === "deer" ? "#d28b3c" :
    a.type === "boar" ? "#6b5a4a" :
    "#d6d0c2";

  const outline = "rgba(0,0,0,0.35)";

  ctx.save();
  ctx.translate(a.x, a.y);

  const bob = Math.sin(a.wobble) * 3;
  ctx.translate(0, bob);

  ctx.scale(a.scale, a.scale);

  // body shadow (inside only)
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse(0, 60, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = base;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  roundRect(-78, -30, 156, 76, 28, true, true);

  // head
  roundRect(38, -58, 58, 48, 18, true, true);

  // legs
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    roundRect(-60 + i * 36, 30, 16, 58, 8, true, true);
  }

  // antlers
  if (a.type === "deer") {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(62, -60); ctx.lineTo(45, -98); ctx.lineTo(28, -114);
    ctx.moveTo(80, -60); ctx.lineTo(95, -98); ctx.lineTo(112, -114);
    ctx.stroke();
  }

  ctx.restore();
}

function drawScopeOverlay() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.30;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawVignette(strength = 0.35) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w * 0.5;
  const cy = h * 0.55;
  const rad = Math.max(w, h) * 0.8;
  const vg = ctx.createRadialGradient(cx, cy, rad * 0.10, cx, cy, rad);
  vg.addColorStop(0, "rgba(0,0,0,0.0)");
  vg.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawTopDebug(text) {
  const w = window.innerWidth;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(12, 200, Math.min(520, w - 24), 44, 12, true, false);
  ctx.fillStyle = "#fff";
  ctx.font = "900 14px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(text, 24, 228);
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
