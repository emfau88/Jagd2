const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");

resize();
window.addEventListener("resize", resize);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

//////////////////////////////////////////////////////
// STATE MACHINE
//////////////////////////////////////////////////////

let STATE = "PREPARE"; 
// PREPARE → WAIT → ENCOUNTER → RESULT

//////////////////////////////////////////////////////
// REVIER MODEL
//////////////////////////////////////////////////////

let revier = {
  population: {
    deer: 12,
    boar: 6,
    duck: 18
  },
  pressure: 0,
  foodSpots: 1,
  saltSpots: 1,
  coins: 100
};

//////////////////////////////////////////////////////
// ENCOUNTER SYSTEM
//////////////////////////////////////////////////////

let encounter = null;
let encounterTimer = 0;

function startEncounter() {
  STATE = "ENCOUNTER";

  const types = ["deer", "boar", "duck"];
  const type = types[Math.floor(Math.random() * types.length)];

  encounter = {
    type,
    x: canvas.width / 2,
    y: canvas.height * 0.5,
    scale: 0.6,
    alive: true
  };

  encounterTimer = 5; // seconds
}

//////////////////////////////////////////////////////
// INPUT
//////////////////////////////////////////////////////

canvas.addEventListener("click", () => {
  if (STATE === "PREPARE") {
    STATE = "WAIT";
    setTimeout(startEncounter, 2000);
  } 
  else if (STATE === "ENCOUNTER" && encounter?.alive) {
    encounter.alive = false;
    revier.coins += 20;
    revier.pressure += 0.1;
    STATE = "RESULT";
  }
  else if (STATE === "RESULT") {
    STATE = "PREPARE";
    encounter = null;
  }
});

//////////////////////////////////////////////////////
// UPDATE LOOP
//////////////////////////////////////////////////////

let lastTime = 0;

function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

function update(dt) {
  if (STATE === "ENCOUNTER" && encounter) {
    encounter.scale += dt * 0.2;
    encounterTimer -= dt;

    if (encounterTimer <= 0) {
      STATE = "RESULT";
    }
  }
}

//////////////////////////////////////////////////////
// DRAWING
//////////////////////////////////////////////////////

function draw() {
  drawBackground();
  drawHUD();

  if (STATE === "WAIT") {
    drawTextCenter("Warten...");
  }

  if (STATE === "ENCOUNTER" && encounter) {
    drawAnimal(encounter);
    drawScope();
  }

  if (STATE === "RESULT") {
    drawTextCenter("Ergebnis - Tippen");
  }
}

function drawBackground() {
  ctx.fillStyle = "#2f4f2f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#3f6f3f";
  ctx.fillRect(0, canvas.height * 0.4, canvas.width, canvas.height * 0.6);
}

function drawHUD() {
  ui.innerHTML = `
    Coins: ${revier.coins} <br>
    Druck: ${revier.pressure.toFixed(2)} <br>
    State: ${STATE}
  `;
}

function drawAnimal(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.scale, a.scale);

  ctx.fillStyle = a.alive ? "#c07a2f" : "#555";
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScope() {
  ctx.save();
  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 200, canvas.height / 2);
  ctx.lineTo(canvas.width / 2 + 200, canvas.height / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2 - 200);
  ctx.lineTo(canvas.width / 2, canvas.height / 2 + 200);
  ctx.stroke();

  ctx.restore();
}

function drawTextCenter(text) {
  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}
