const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const elCoins = document.getElementById("coins");
const elPressure = document.getElementById("pressure");
const elTod = document.getElementById("tod");
const elWind = document.getElementById("wind");
const elState = document.getElementById("state");
const elPop = document.getElementById("pop");
const elPrompt = document.getElementById("promptText");

const btnPrimary = document.getElementById("btnPrimary");
const btnSecondary = document.getElementById("btnSecondary");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

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
};

function fmtTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// ---------- Encounter ----------
let encounter = null;
let encounterTimer = 0;
let resultText = "";

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
    y: canvas.height * 0.55,
    scale: 0.55,
    alive: true,
    // simple size for hit test
    r: 46,
  };
  encounterTimer = 6.0;

  elPrompt.textContent =
    type === "deer"
      ? "Begegnung: Reh – Entscheide schnell."
      : type === "boar"
      ? "Begegnung: Wildschwein – Risiko höher."
      : "Begegnung: Ente – kleiner, schneller.";
}

function toResult(text) {
  STATE = S.RESULT;
  resultText = text;
  encounter = null;
  elPrompt.textContent = text + " (Weiter)";
}

// ---------- Actions ----------
btnPrimary.addEventListener("click", () => {
  if (STATE === S.PREPARE) {
    STATE = S.WAIT;
    elPrompt.textContent = "Warten… (Ansitz ruhig bleiben)";
    // schedule encounter
    setTimeout(() => {
      if (STATE === S.WAIT) startEncounter();
    }, 1200);
  } else if (STATE === S.ENCOUNTER) {
    // default primary = SCHIESSEN
    shoot();
  } else if (STATE === S.RESULT) {
    STATE = S.PREPARE;
    elPrompt.textContent = "Tippe „Vorbereiten“";
  }
  syncButtons();
});

btnSecondary.addEventListener("click", () => {
  if (STATE === S.ENCOUNTER) {
    spare();
  } else {
    // Info toggle quick hint
    elPrompt.textContent =
      "Loop: Vorbereiten → Warten → Begegnung → Entscheidung. Druck steigt bei Abschuss.";
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
  if (STATE !== S.ENCOUNTER) return;
  const type = encounter?.type || "deer";

  let gain = 0;
  let pressureGain = 0.10;

  if (type === "deer") { gain = 25; pressureGain = 0.10; revier.population.deer = Math.max(0, revier.population.deer - 1); }
  if (type === "boar") { gain = 35; pressureGain = 0.14; revier.population.boar = Math.max(0, revier.population.boar - 1); }
  if (type === "duck") { gain = 15; pressureGain = 0.06; revier.population.duck = Math.max(0, revier.population.duck - 2); }

  revier.coins += gain;
  revier.pressure += pressureGain;

  toResult(`Abschuss: +${gain} Coins, Druck +${pressureGain.toFixed(2)}`);
}

function spare() {
  if (STATE !== S.ENCOUNTER) return;
  // reward for restraint when pressure is high
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

  if (STATE === S.ENCOUNTER && encounter) {
    encounter.scale += dt * 0.08; // subtle approach
    encounterTimer -= dt;
    if (encounterTimer <= 0) {
      toResult("Chance verpasst (zu lange gezögert)");
    }
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
  drawForestPlaceholder();

  if (STATE === S.ENCOUNTER && encounter) {
    drawAnimalPlaceholder(encounter);
    drawScopeOverlay();
  }

  if (STATE === S.WAIT) {
    drawCenterHint("Ansitz…");
  }
}

function drawForestPlaceholder() {
  // Sky
  const g1 = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g1.addColorStop(0, "#1c2d2a");
  g1.addColorStop(0.45, "#1a3a25");
  g1.addColorStop(1, "#0f1b12");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distant trees band
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, canvas.height * 0.32, canvas.width, canvas.height * 0.20);

  // Clearing light spot
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.62;
  const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.min(canvas.width, canvas.height) * 0.6);
  rg.addColorStop(0, "rgba(255, 230, 120, 0.22)");
  rg.addColorStop(0.45, "rgba(120, 220, 120, 0.10)");
  rg.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Foreground grass
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, canvas.height * 0.72, canvas.width, canvas.height * 0.28);
}

function drawAnimalPlaceholder(a) {
  const color =
    a.type === "deer" ? "#d28b3c" :
    a.type === "boar" ? "#6b5a4a" :
    "#d6d0c2";

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.scale, a.scale);

  // body
  ctx.fillStyle = color;
  roundRect(-70, -30, 140, 70, 26, true);

  // head
  ctx.fillStyle = color;
  roundRect(35, -55, 55, 45, 18, true);

  // legs
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 4; i++) {
    roundRect(-55 + i * 35, 30, 16, 55, 8, true);
  }

  // antlers for deer
  if (a.type === "deer") {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(55, -55); ctx.lineTo(40, -95); ctx.lineTo(25, -110);
    ctx.moveTo(70, -55); ctx.lineTo(85, -95); ctx.lineTo(100, -110);
    ctx.stroke();
  }

  ctx.restore();
}

function drawScopeOverlay() {
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.52;
  const r = Math.min(canvas.width, canvas.height) * 0.28;

  // dark vignette
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // clear circle
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // ring + crosshair
  ctx.strokeStyle = "rgba(0,0,0,0.80)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();

  ctx.restore();
}

function drawCenterHint(text) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(canvas.width * 0.5 - 120, canvas.height * 0.5 - 28, 240, 56, 16, true);
  ctx.fillStyle = "#fff";
  ctx.font = "800 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5 + 6);
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y +
