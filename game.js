(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const elCoins = document.getElementById("coins");
  const elPressure = document.getElementById("pressure");
  const elTod = document.getElementById("tod");
  const elWind = document.getElementById("wind");
  const elPop = document.getElementById("pop");

  const promptBox = document.getElementById("promptBox");
  const hintBox = document.getElementById("hintBox");

  const btnPrimary = document.getElementById("btnPrimary");
  const btnSecondary = document.getElementById("btnSecondary");
  const btnPrimaryText = document.getElementById("btnPrimaryText");
  const btnSecondaryText = document.getElementById("btnSecondaryText");

  const errWrap = document.getElementById("err");
  const errBox = document.getElementById("errBox");

  function showError(msg) {
    errWrap.style.display = "block";
    errBox.textContent = String(msg);
  }

  window.addEventListener("error", (e) => showError(e?.message || e));
  window.addEventListener("unhandledrejection", (e) => showError("Unhandled Promise:\n" + (e?.reason || e)));

  // ---------- Resize (DPR correct) ----------
  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // ---------- Assets (same-origin, relative) ----------
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ img, ok: true, src });
      img.onerror = () => resolve({ img, ok: false, src });
      img.src = src + (src.includes("?") ? "" : "?v=" + Date.now());
    });
  }

  const ASSETS = {
    bg: null,
    deer: null,
    leckstein: null,
    scope: null,
  };

  // Start loading immediately
  Promise.all([
    loadImage("bg.png"),
    loadImage("deer.png"),
    loadImage("leckstein.png"),
    loadImage("scope.png"),
  ]).then((results) => {
    const map = Object.fromEntries(results.map(r => [r.src.split("?")[0], r]));
    ASSETS.bg = map["bg.png"]?.img || null;
    ASSETS.deer = map["deer.png"]?.img || null;
    ASSETS.leckstein = map["leckstein.png"]?.img || null;
    ASSETS.scope = map["scope.png"]?.img || null;

    // Report missing (non-fatal)
    const missing = results.filter(r => !r.ok).map(r => r.src);
    if (missing.length) showError("Asset load failed:\n" + missing.join("\n"));
  });

  // ---------- Helpers ----------
  function drawImageCover(img, x, y, w, h) {
    if (!img || !(img.naturalWidth || img.width)) return false;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const scale = Math.max(w / iw, h / ih);
    const sw = w / scale;
    const sh = h / scale;

    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  function drawImageContain(img, x, y, w, h) {
    if (!img || !(img.naturalWidth || img.width)) return false;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }

  function fmtTime(min) {
    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  // ---------- Game State ----------
  const S = { PREPARE: "PREPARE", WAIT: "WAIT", ENCOUNTER: "ENCOUNTER", RESULT: "RESULT" };
  let STATE = S.PREPARE;

  let revier = {
    population: { deer: 12, boar: 6, duck: 18 },
    pressure: 0,
    coins: 100,
    timeMin: 6 * 60,
    windDir: "NE",
  };

  const SAVE_KEY = "jagd2_revier_save_v1";
  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ revier, ts: Date.now() })); } catch {}
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

  // ---------- Encounter ----------
  let encounter = null;
  let encounterTimer = 0;

  function rollEncounterType() {
    // Only deer for now (you have deer sprite). Keep structure for later.
    return "deer";
  }

  function startEncounter() {
    STATE = S.ENCOUNTER;
    const type = rollEncounterType();

    encounter = {
      type,
      x: window.innerWidth * 0.52,
      y: window.innerHeight * 0.64,
      scale: 0.48,
      wobble: Math.random() * Math.PI * 2,
    };

    encounterTimer = 7.0;

    promptBox.textContent = "Begegnung: Reh — entscheiden.";
    hintBox.textContent = "Links = Verschonen, rechts = Schießen";
    syncButtons();
  }

  function toResult(text) {
    STATE = S.RESULT;
    encounter = null;
    promptBox.textContent = text + " (Weiter)";
    hintBox.textContent = "Weiter tippen";
    saveGame();
    syncButtons();
  }

  function shoot() {
    if (STATE !== S.ENCOUNTER) return;

    const gain = 25;
    const pressureGain = 0.10;

    revier.coins += gain;
    revier.pressure += pressureGain;
    revier.population.deer = Math.max(0, revier.population.deer - 1);

    toResult(`Abschuss: +${gain} Coins, Druck +${pressureGain.toFixed(2)}`);
  }

  function spare() {
    if (STATE !== S.ENCOUNTER) return;

    const bonus = revier.pressure > 0.6 ? 18 : 10;
    revier.coins += bonus;
    revier.pressure = Math.max(0, revier.pressure - 0.05);

    toResult(`Verschont: +${bonus} Coins, Druck -0.05`);
  }

  // ---------- UI actions ----------
  function primaryAction() {
    if (STATE === S.PREPARE) {
      STATE = S.WAIT;
      promptBox.textContent = "Ansitz… ruhig bleiben.";
      hintBox.textContent = "Warte kurz auf eine Begegnung";
      syncButtons();

      setTimeout(() => {
        if (STATE === S.WAIT) startEncounter();
      }, 900);
      return;
    }

    if (STATE === S.ENCOUNTER) { shoot(); return; }

    if (STATE === S.RESULT) {
      STATE = S.PREPARE;
      promptBox.textContent = "Tippe „Vorbereiten“";
      hintBox.textContent = "Vorbereiten → Warten → Begegnung → Entscheidung";
      syncButtons();
      return;
    }
  }

  function secondaryAction() {
    if (STATE === S.ENCOUNTER) { spare(); return; }
    promptBox.textContent = "Loop: Vorbereiten → Warten → Begegnung → Entscheidung.";
    hintBox.textContent = "Tipp: Verschonen senkt Druck";
  }

  function syncButtons() {
    if (STATE === S.PREPARE) {
      btnPrimaryText.textContent = "Vorbereiten";
      btnSecondaryText.textContent = "Info";
    } else if (STATE === S.WAIT) {
      btnPrimaryText.textContent = "Warten…";
      btnSecondaryText.textContent = "Info";
    } else if (STATE === S.ENCOUNTER) {
      btnPrimaryText.textContent = "Schießen (rechts)";
      btnSecondaryText.textContent = "Verschonen (links)";
    } else if (STATE === S.RESULT) {
      btnPrimaryText.textContent = "Weiter";
      btnSecondaryText.textContent = "Info";
    }
  }
  syncButtons();

  btnPrimary.addEventListener("pointerdown", (e) => { e.preventDefault(); primaryAction(); }, { passive: false });
  btnSecondary.addEventListener("pointerdown", (e) => { e.preventDefault(); secondaryAction(); }, { passive: false });

  // Tap on canvas in encounter: left = spare, right = shoot
  canvas.addEventListener("pointerdown", (e) => {
    if (STATE !== S.ENCOUNTER) return;
    e.preventDefault();
    const x = e.clientX;
    if (x < window.innerWidth * 0.5) spare();
    else shoot();
  }, { passive: false });

  // ---------- Atmosphere (subtle dust) ----------
  const dust = [];
  function initDust(n = 18) {
    dust.length = 0;
    for (let i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.8 + Math.random() * 1.6,
        a: 0.05 + Math.random() * 0.07,
        vx: -5 + Math.random() * 10,
        vy: -3 + Math.random() * 6,
      });
    }
  }
  initDust();

  // ---------- Loop ----------
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

    // Encounter timer / slight bob
    if (STATE === S.ENCOUNTER && encounter) {
      encounter.scale += dt * 0.03; // subtle “approach”
      encounter.wobble += dt * 2.0;

      encounterTimer -= dt;
      if (encounterTimer <= 0) toResult("Chance verpasst (zu lange gezögert)");
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
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Background
    if (!drawImageCover(ASSETS.bg, 0, 0, w, h)) {
      // fallback
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1c2d2a");
      g.addColorStop(0.45, "#163d2a");
      g.addColorStop(1, "#0c160f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Slight vignette for depth
    drawVignette(0.28);

    // World object (Leckstein) in prepare/wait
    if (STATE === S.PREPARE || STATE === S.WAIT) {
      drawLeckstein();
    }

    // Atmosphere
    drawDust();

    // Encounter: draw deer + scope overlay
    if (STATE === S.ENCOUNTER && encounter) {
      drawEncounterFocus();
      drawDeer(encounter);
      drawScopeOverlay();
    }
  }

  function drawLeckstein() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Bottom-middle placement in the “clearing”
    const boxW = Math.min(220, w * 0.42);
    const boxH = boxW * 0.70;
    const x = w * 0.5 - boxW * 0.5;
    const y = h * 0.72 - boxH * 0.5;

    // subtle shadow (inside scene, not UI)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, y + boxH * 0.88, boxW * 0.34, boxH * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawImageContain(ASSETS.leckstein, x, y, boxW, boxH);
  }

  function drawDeer(a) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // desired deer box size relative to screen
    const boxW = Math.min(420, w * 0.70);
    const boxH = Math.min(300, h * 0.30);

    const bob = Math.sin(a.wobble) * 4;

    const x = a.x - boxW * 0.5;
    const y = a.y - boxH * 0.65 + bob;

    // subtle ground shadow for readability (not outside sprite, just scene)
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(a.x, a.y + boxH * 0.20, boxW * 0.20, boxH * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // draw deer sprite (contain, maintain alpha)
    drawImageContain(ASSETS.deer, x, y, boxW, boxH);
  }

  function drawScopeOverlay() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // draw scope PNG over full screen as overlay
    if (ASSETS.scope && (ASSETS.scope.naturalWidth || ASSETS.scope.width)) {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.drawImage(ASSETS.scope, 0, 0, w, h);
      ctx.restore();
      return;
    }

    // fallback if scope missing
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawEncounterFocus() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w * 0.52;
    const cy = h * 0.64;

    const rg = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.min(w, h) * 0.55);
    rg.addColorStop(0, "rgba(0,0,0,0.00)");
    rg.addColorStop(0.55, "rgba(0,0,0,0.18)");
    rg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawDust() {
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

  function drawVignette(strength = 0.30) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w * 0.5;
    const cy = h * 0.55;
    const rad = Math.max(w, h) * 0.9;
    const vg = ctx.createRadialGradient(cx, cy, rad * 0.10, cx, cy, rad);
    vg.addColorStop(0, "rgba(0,0,0,0.0)");
    vg.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
})();
