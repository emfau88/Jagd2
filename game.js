const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const elCoins = document.getElementById("coins");
const elPressure = document.getElementById("pressure");
const elTod = document.getElementById("tod");
const elWind = document.getElementById("wind");
const elState = document.getElementById("state");
const elPop = document.getElementById("pop");
const elPrompt = document.getElementById("promptText");
const elHint = document.getElementById("hintText");

const btnPrimary = document.getElementById("btnPrimary");
const btnSecondary = document.getElementById("btnSecondary");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ---------- Background Image ----------
const BG_URL = "https://raw.githubusercontent.com/emfau88/Jagd2/refs/heads/main/bg.png";
const bgImg = new Image();
bgImg.crossOrigin = "anonymous";
let bgReady = false;
bgImg.onload = () => { bgReady = true; };
bgImg.onerror = () => { bgReady = false; };
bgImg.src = BG_URL;

// Draw cover (center-crop) helper
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

// ---------- State ----------
const S = {
  PREPARE: "PREPARE",
  WAIT: "WAIT",
  ENCOUNTER: "ENCOUNTER",
  RESULT: "RESULT",
};
let STATE = S.PREPARE;

// ---------- Revier Model ----------
let revier = {
  population: { deer: 12, boar: 6, duck: 18 },
  pressure: 0,
  foodSpots: 1,
  saltSpots: 1,
  coins: 100,
  timeMin: 6 * 60, // 06:00
  windDir: "NE",
  zoneName: "Lichtung",
};

// ---------- Save/Load (minimal, opt-in) ----------
const SAVE_KEY = "jagd2_revier_save_v1";
function saveGame() {
  const data = {
    revier,
    ts: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data?.revier) return false;
    revier = data.revier;
    return true;
  } catch {
    return false;
  }
}
// Auto-load on start (safe)
loadGame();

// ---------- Particles (subtle atmosphere) ----------
const dust = [];
function initDust(count = 28) {
  dust.length = 0;
  for (let i = 0; i < count; i++) {
    dust.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.8 + Math.random() * 1.8,
      a: 0.05 + Math.random() * 0.08,
      vx: -6 + Math.random() * 12,
      vy: -4 + Math.random() * 8,
    });
  }
}
initDust();

// ---------- Encounter ----------
let encounter = null;
let encounterTimer = 0;
let resultText = "";
let promptPulse = 0;

function fmtTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function rollEncounterType() {
  // simple weighted by population
  const pool = [];
  const { deer, boar, duck } = revier.population;
  for (let i = 0; i < deer; i++) pool.push("deer");
  for (let i = 0; i < boar; i++) pool.push("boar");
  for (let i = 0; i < duck; i++) pool.push("duck");
  return pool[Math.floor(Math.random() * pool.length)] || "deer";
}

function startEncounter() {
  STATE = S.ENCOUNTER;
  const type = rollEncounterType();

  encounter = {
    type,
    x: canvas.width * 0.5,
    y: canvas.height * 0.60,
    scale: 0.52,
    alive: true,
    wobble: Math.random() * Math.PI * 2,
  };

  encounterTimer = 7.0;

  elPrompt.textContent =
    type === "deer"
      ? "Begegnung: Reh — entscheiden."
      : type === "boar"
      ? "Begegnung: Wildschwein — Risiko."
      : "Begegnung: Ente — klein & flink.";

  elHint.textContent = "Im Encounter: links = Verschonen, rechts = Schießen";
}

function toResult(text) {
  STATE = S.RESULT;
  resultText = text;
  encounter = null;
  elPrompt.textContent = text + " (Weiter)";
  elHint.textContent = "Weiter tippen";
  saveGame();
}

// ---------- Actions ----------
btnPrimary.addEventListener("click", () => {
  if (STATE === S.PREPARE) {
    STATE = S.WAIT;
    elPrompt.textContent = "Ansitz… ruhig bleiben.";
    elHint.textContent = "Warte kurz auf eine Begegnung";
    // schedule encounter
    setTimeout(() => {
      if (STATE === S.WAIT) startEncounter();
    }, 1100);
  } else if (STATE === S.ENCOUNTER) {
    shoot();
  } else if (STATE === S.RESULT) {
    STATE = S.PREPARE;
    elPrompt.textContent = "Tippe „Vorbereiten“";
    elHint.textContent = "Vorbereiten → Warten → Begegnung → Entscheidung";
  }
  syncButtons();
});

btnSecondary.addEventListener("click", () => {
  if (STATE === S.ENCOUNTER) {
    spare();
  } else {
    // Info
    elPrompt.textContent =
      "Loop: Vorbereiten → Warten → Begegnung → Entscheidung. Druck steigt bei Abschuss.";
    elHint.textContent = "Tipp: Verschonen senkt Druck";
  }
  syncButtons();
});

// Tap on canvas: left half = spare, right half = shoot (nur im Encounter)
canvas.addEventListener("click", (e) => {
  if (STATE !== S.ENCOUNTER) return;
  const x = e.clientX;
  if (x < canvas.width * 0.5) spare();
  else shoot();
  syncButtons();
});

function shoot() {
  if (STATE !== S.ENCOUNTER || !encounter) return;
  const type = encounter.type;

  let gain = 0;
  let pressureGain = 0.10;

  if (type === "deer") {
    gain = 25; pressureGain = 0.10;
    revier.population.deer = Math.max(0, revier.population.deer - 1);
  } else if (type === "boar") {
    gain = 35; pressureGain = 0.14;
    revier.population.boar = Math.max(0, revier.population.boar - 1);
  } else {
    gain = 15; pressureGain = 0.06;
    revier.population.duck = Math.max(0, revier.population.duck - 2);
  }

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
    btnSecondary.classList.add("secondary");
  } else if (STATE === S.WAIT) {
    btnPrimary.textContent = "…";
    btnSecondary.textContent = "Info";
    btnSecondary.classList.add("secondary");
  } else if (STATE === S.ENCOUNTER) {
    btnPrimary.textContent = "Schießen (rechts)";
    btnSecondary.textContent = "Verschonen (links)";
    btnSecondary.classList.add("secondary");
  } else if (STATE === S.RESULT) {
    btnPrimary.textContent = "Weiter";
    btnSecondary.textContent = "Info";
    btnSecondary.classList.add("secondary");
  }
}
syncButtons();

// ---------- Update Loop ----------
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
  // time progresses slowly
  revier.timeMin = (revier.timeMin + dt * 2) % (24 * 60);

  // prompt pulse for "alive" feeling
  promptPulse += dt * 1.6;

  // encounter "approach"
  if (STATE === S.ENCOUNTER && encounter) {
    encounter.scale += dt * 0.06;
    encounter.wobble += dt * 2.2;

    encounterTimer -= dt;
    if (encounterTimer <= 0) {
      toResult("Chance verpasst (zu lange gezögert)");
    }
  }

  // dust drift
  for (const p of dust) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < -20) p.x = canvas.width + 20;
    if (p.x > canvas.width + 20) p.x = -20;
    if (p.y < -20) p.y = canvas.height + 20;
    if (p.y > canvas.height + 20) p.y = -20;
  }

  // HUD
  elCoins.textContent = String(revier.coins);
  elPressure.textContent = revier.pressure.toFixed(2);
  elTod.textContent = fmtTime(Math.floor(revier.timeMin));
  elWind.textContent = revier.windDir;
  elState.textContent = STATE;

  elPop.textContent = `D${revier.population.deer} B${revier.population.boar} E${revier.population.duck}`;
}

// ---------- Draw ----------
function draw() {
  drawBackground();
  drawAtmosphere();

  if (STATE === S.ENCOUNTER && encounter) {
    drawEncounterFocus();
    drawAnimalPlaceholder(encounter);
    drawScopeOverlay();
  } else {
    // subtle vignette even outside encounter
    drawVignette(0.35);
  }

  // Center hint in WAIT
  if (STATE === S.WAIT) {
    drawCenterHint("Ansitz…");
  }

  // Small pulse on prompt card via CSS not possible here; we slightly tint via overlay
  drawUIShade();
}

function drawBackground() {
  if (bgReady) {
    drawImageCover(bgImg, 0, 0, canvas.width, canvas.height);
  } else {
    // fallback if image not loaded yet
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#1c2d2a");
    g.addColorStop(0.4, "#163d2a");
    g.addColorStop(1, "#0c160f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Atmosphere overlay (dust + soft haze)
function drawAtmosphere() {
  // Haze
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.62;
  const haze = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.min(canvas.width, canvas.height) * 0.85);
  haze.addColorStop(0, "rgba(255, 235, 160, 0.10)");
  haze.addColorStop(0.55, "rgba(90, 200, 120, 0.06)");
  haze.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dust particles
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const p of dust) {
    ctx.globalAlpha = p.a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Focus area for encounter (helps readability)
function drawEncounterFocus() {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.62;
  const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(canvas.width, canvas.height) * 0.45);
  rg.addColorStop(0, "rgba(0,0,0,0.00)");
  rg.addColorStop(0.55, "rgba(0,0,0,0.18)");
  rg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAnimalPlaceholder(a) {
  // Placeholder “sprite” (until real PNGs are ready)
  const base =
    a.type === "deer" ? "#d28b3c" :
    a.type === "boar" ? "#6b5a4a" :
    "#d6d0c2";

  const outline = "rgba(0,0,0,0.35)";

  ctx.save();
  ctx.translate(a.x, a.y);

  // subtle bob
  const bob = Math.sin(a.wobble) * 3;
  ctx.translate(0, bob);

  ctx.scale(a.scale, a.scale);

  // shadow (inside contour only)
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse(0, 60, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
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

  // antlers for deer
  if (a.type === "deer") {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(62, -60); ctx.lineTo(45, -98); ctx.lineTo(28, -114);
    ctx.moveTo(80, -60); ctx.lineTo(95, -98); ctx.lineTo(112, -114);
    ctx.stroke();
  }

  // small alert wink (for encounter)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(58, -40, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScopeOverlay() {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.52;
  const r = Math.min(canvas.width, canvas.height) * 0.30;

  // Dark mask
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clear circle
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Scope ring
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner soft ring
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();

  // Tiny center dot
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Vignette overlay
function drawVignette(strength = 0.45) {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.55;
  const rad = Math.max(canvas.width, canvas.height) * 0.8;
  const vg = ctx.createRadialGradient(cx, cy, rad * 0.10, cx, cy, rad);
  vg.addColorStop(0, "rgba(0,0,0,0.0)");
  vg.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCenterHint(text) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(canvas.width * 0.5 - 130, canvas.height * 0.5 - 28, 260, 56, 16, true, false);
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5 + 6);
  ctx.restore();
}

// Gentle shade behind HUD area for readability (only top)
function drawUIShade() {
  const h = 160;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, h);
}

// ---------- geometry helpers ----------
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
