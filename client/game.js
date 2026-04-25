const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const socket = io();

/* ================= FULLSCREEN ================= */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

const W = () => canvas.width;
const H = () => canvas.height;

/* ================= ASSETS ================= */
const bg = new Image(); bg.src = "assets/space.jpg";
const playerImg = new Image(); playerImg.src = "assets/Battleplane.png";
const enemyImg = new Image(); enemyImg.src = "assets/enemy.png";
const heartImg = new Image(); heartImg.src = "assets/heart.png";

/* ================= STATE ================= */
let screen = "menu";
// menu | multiplayer | mp-create | mp-join | lobby | game | gameover
// 🔵 ADDED: pvp-menu | pvp-create | pvp-join

let world = null;
let currentSessionId = null;
let isSinglePlayer = false;

let lobbyPlayers = {};
let hostId = null;

let keys = {};
let mouse = { x: 0, y: 0 };
let roomInput = "";

/* ================= EXISTING ================= */
let finalScore = 0;

/* ================= PvP ADDITION ================= */
let isPvP = false;
let bulletsLeft = 15;

/* ================= INPUT ================= */
canvas.addEventListener("mousemove", e => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
});

window.addEventListener("keydown", e => {
  keys[e.key] = true;

  if (
    screen === "mp-create" || screen === "mp-join" ||
    screen === "pvp-create" || screen === "pvp-join"
  ) {
    if (e.key.length === 1) roomInput += e.key;
    if (e.key === "Backspace") roomInput = roomInput.slice(0, -1);
  }
});

window.addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("mousedown", e => {
  const x = e.offsetX;
  const y = e.offsetY;

  /* ===== MAIN MENU ===== */
  if (screen === "menu") {
    if (inside(x, y, W()/2 - 120, H()/2 - 30, 240, 50)) {
      socket.emit("startSinglePlayer", { width: W(), height: H() });
      isSinglePlayer = true;
      isPvP = false;
      finalScore = 0;
      screen = "game";
    }

    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) {
      screen = "multiplayer";
    }

    if (inside(x, y, W()/2 - 120, H()/2 + 110, 240, 50)) {
      roomInput = "";
      screen = "pvp-menu";
    }
    return;
  }

  /* ===== MULTIPLAYER ===== */
  if (screen === "multiplayer") {
    roomInput = "";
    if (inside(x, y, W()/2 - 120, H()/2 - 20, 240, 50)) screen = "mp-create";
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) screen = "mp-join";
    return;
  }

  /* ===== PvP MENU ===== */
  if (screen === "pvp-menu") {
    roomInput = "";
    if (inside(x, y, W()/2 - 120, H()/2 - 20, 240, 50)) screen = "pvp-create";
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) screen = "pvp-join";
    return;
  }

  /* ===== CREATE ROOM ===== */
  if (screen === "mp-create") {
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) {
      if (!roomInput.trim()) return;
      socket.emit("createRoom", {
        roomName: roomInput.trim(),
        width: W(),
        height: H()
      });
      isSinglePlayer = false;
      isPvP = false;
      screen = "lobby";
    }
    return;
  }

  /* ===== JOIN ROOM ===== */
  if (screen === "mp-join") {
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) {
      if (!roomInput.trim()) return;
      socket.emit("joinRoom", {
        roomName: roomInput.trim(),
        width: W(),
        height: H()
      });
      isSinglePlayer = false;
      isPvP = false;
      screen = "lobby";
    }
    return;
  }

  /* ===== CREATE PvP ROOM ===== */
  if (screen === "pvp-create") {
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) {
      if (!roomInput.trim()) return;
      socket.emit("createPvPRoom", {
        roomName: "pvp:" + roomInput.trim(),
        width: W(),
        height: H()
      });
      isPvP = true;
      bulletsLeft = 15;
      screen = "lobby";
    }
    return;
  }

  /* ===== JOIN PvP ROOM ===== */
  if (screen === "pvp-join") {
    if (inside(x, y, W()/2 - 120, H()/2 + 40, 240, 50)) {
      if (!roomInput.trim()) return;
      socket.emit("joinPvPRoom", {
        roomName: "pvp:" + roomInput.trim(),
        width: W(),
        height: H()
      });
      isPvP = true;
      bulletsLeft = 15;
      screen = "lobby";
    }
    return;
  }

  /* ===== LOBBY ===== */
  if (screen === "lobby" && socket.id === hostId) {
    if (inside(x, y, W()/2 - 120, H()/2 + 120, 240, 50)) {
      socket.emit("startGame");
    }
    return;
  }

  /* ===== GAME OVER ===== */
  if (screen === "gameover") {
    if (inside(x, y, W()/2 - 140, H()/2 + 10, 280, 50)) {
      if (isSinglePlayer) {
        socket.emit("startSinglePlayer", { width: W(), height: H() });
        finalScore = 0;
        screen = "game";
      } else if (isPvP) {
        socket.emit("startPvP", { width: W(), height: H() });
        bulletsLeft = 15;
        screen = "game";
      } else {
        socket.emit("playAgain");
        screen = "lobby";
      }
    }

    if (inside(x, y, W()/2 - 140, H()/2 + 80, 280, 50)) {
      socket.emit("exitRoom");
      screen = "menu";
      world = null;
      roomInput = "";
      isPvP = false;
    }
    return;
  }

  /* ===== GAME ===== */
  if (screen === "game") {
    if (isPvP && bulletsLeft <= 0) return;
    socket.emit("shoot");
    if (isPvP) bulletsLeft--;
  }
});

/* ================= HELPERS ================= */
function inside(x, y, bx, by, bw, bh) {
  return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}

function drawButton(x, y, w, h, text) {
  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "white";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
}

/* ================= NETWORK ================= */
socket.on("lobbyUpdate", data => {
  currentSessionId = data.sessionId;
  lobbyPlayers = data.players;
  hostId = data.hostId;
  screen = "lobby";
});

socket.on("multiplayerGameOver", () => {
  const me = world?.players?.[socket.id];
  if (me) finalScore = me.score;
  screen = "gameover";
});

socket.on("worldState", data => {
  if (!currentSessionId) currentSessionId = data.sessionId;
  if (data.sessionId !== currentSessionId) return;

  world = data;
  hostId = data.hostId;

  if (!data.inLobby && screen === "lobby") screen = "game";

  const me = world.players?.[socket.id];
  if (isSinglePlayer && me && !me.alive) {
    finalScore = me.score;
    screen = "gameover";
  }
});

/* ================= PLAYER ================= */
function updatePlayer() {
  if (!world || !world.players || !world.players[socket.id]) return;

  const p = world.players[socket.id];
  const speed = 5;

  if (keys["w"]) p.y -= speed;
  if (keys["s"]) p.y += speed;
  if (keys["a"]) p.x -= speed;
  if (keys["d"]) p.x += speed;

  p.x = Math.max(60, Math.min(W() * 0.25, p.x));
  p.y = Math.max(60, Math.min(H() - 60, p.y));
  p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  socket.emit("playerUpdate", p);
}

/* ================= DRAW ================= */
function drawBullet(b) {
  ctx.fillStyle = b.owner === "enemy" ? "red" : "cyan";
  ctx.beginPath();
  ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
  ctx.fill();
}

/* ================= SCREENS ================= */
function drawMenu() {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "white";
  ctx.font = "42px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SPACE SHOOTER", W()/2, H()/2 - 100);
  drawButton(W()/2 - 120, H()/2 - 30, 240, 50, "Single Player");
  drawButton(W()/2 - 120, H()/2 + 40, 240, 50, "Multiplayer");
}

function drawPvPMenu() {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PLAYER VS PLAYER", W()/2, H()/2 - 100);
  drawButton(W()/2 - 120, H()/2 - 20, 240, 50, "Create PvP Room");
  drawButton(W()/2 - 120, H()/2 + 40, 240, 50, "Join PvP Room");
}

function drawMultiplayer() {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("MULTIPLAYER", W()/2, H()/2 - 100);
  drawButton(W()/2 - 120, H()/2 - 20, 240, 50, "Create Room");
  drawButton(W()/2 - 120, H()/2 + 40, 240, 50, "Join Room");
}

function drawRoomInput(title) {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, W()/2, H()/2 - 80);
  ctx.fillText("Room Name:", W()/2, H()/2 - 40);
  ctx.fillText(roomInput, W()/2, H()/2 - 10);
  drawButton(W()/2 - 120, H()/2 + 40, 240, 50, "Confirm");
}

function drawLobby() {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "white";
  ctx.font = "36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("LOBBY", W()/2, 80);

  let y = 150;
  Object.keys(lobbyPlayers).forEach((_, i) => {
    ctx.fillText(`Player ${i + 1}`, W()/2, y);
    y += 40;
  });

  if (socket.id === hostId) {
    drawButton(W()/2 - 120, H()/2 + 120, 240, 50, "Start Game");
  } else {
    ctx.font = "20px Arial";
    ctx.fillText("Waiting for host...", W()/2, H()/2 + 140);
  }
}

function drawGame() {
  if (!world) return;
  ctx.drawImage(bg, 0, 0, W(), H());

  Object.values(world.players).forEach(p => {
    if (!p.alive) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.drawImage(playerImg, -55, -55, 110, 110);
    ctx.restore();
  });

  world.enemies.forEach(e =>
    ctx.drawImage(enemyImg, e.x - 45, e.y - 45, 90, 90)
  );

  world.bullets.forEach(drawBullet);

  const me = world.players[socket.id];
  if (!me) return;

  for (let i = 0; i < me.hearts; i++) {
    ctx.drawImage(heartImg, 10 + i * 40, H() - 60, 40, 40);
  }

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`Score: ${me.score}`, W() - 20, 40);

  if (isPvP) {
    ctx.textAlign = "left";
    ctx.fillStyle = "yellow";
    ctx.fillText(`Ammo: ${bulletsLeft}`, 20, 40);
  }
}

function drawGameOver() {
  ctx.drawImage(bg, 0, 0, W(), H());
  ctx.fillStyle = "red";
  ctx.font = "40px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    isSinglePlayer ? "GAME OVER" : "GAME OVER",
    W()/2,
    H()/2 - 60
  );

  ctx.fillStyle = "white";
  ctx.font = "26px Arial";
  ctx.fillText(`Final Score: ${finalScore}`, W()/2, H()/2 - 10);

  drawButton(W()/2 - 140, H()/2 + 20, 280, 50, "Play Again");
  drawButton(W()/2 - 140, H()/2 + 90, 280, 50, "Exit to Main Menu");
}

/* ================= LOOP ================= */
function loop() {
  ctx.clearRect(0, 0, W(), H());

  if (screen === "menu") drawMenu();
  else if (screen === "multiplayer") drawMultiplayer();
  else if (screen === "mp-create") drawRoomInput("Create Room");
  else if (screen === "mp-join") drawRoomInput("Join Room");
  else if (screen === "pvp-menu") drawPvPMenu();
  else if (screen === "pvp-create") drawRoomInput("Create PvP Room");
  else if (screen === "pvp-join") drawRoomInput("Join PvP Room");
  else if (screen === "lobby") drawLobby();
  else if (screen === "game") {
    updatePlayer();
    drawGame();
  }
  else if (screen === "gameover") drawGameOver();

  requestAnimationFrame(loop);
}
loop();
