const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("client"));

/* ================= SESSIONS ================= */
const sessions = {};

function createSession(maxPlayers, hostId, width, height) {
  return {
    players: {},
    enemies: [],
    bullets: [],
    gameRunning: false,
    spawnTimer: null,
    maxPlayers,
    hostId,
    inLobby: true,
    width,
    height
  };
}

/* ================= HELPERS ================= */
function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function spawnInterval(score) {
  return Math.max(1800, 4200 - score * 40);
}

function shootDelay(score) {
  return Math.max(1200, 2600 - score * 30);
}


function randomAlivePlayer(players) {
  const alivePlayers = Object.values(players).filter(p => p.alive);
  if (alivePlayers.length === 0) return null;
  return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
}

/* ================= ENEMY SPAWN ================= */
function spawnEnemy(sessionId) {
  const s = sessions[sessionId];
  if (!s || !s.gameRunning) return;

  let x, y, valid;
  do {
    valid = true;
    x = s.width * 0.5 + Math.random() * (s.width * 0.5);
    y = 80 + Math.random() * (s.height - 160);

    for (const e of s.enemies) {
      if (distance(x, y, e.x, e.y) < 160) {
        valid = false;
        break;
      }
    }
  } while (!valid);

  s.enemies.push({
    x,
    y,
    radius: 45,
    lastShot: Date.now()
  });

  const avgScore =
    Object.values(s.players).reduce((a, p) => a + p.score, 0) /
    Math.max(1, Object.keys(s.players).length);

  s.spawnTimer = setTimeout(
    () => spawnEnemy(sessionId),
    spawnInterval(avgScore)
  );
}

/* ================= SOCKET ================= */
io.on("connection", socket => {
  let sessionId = null;

  socket.on("startSinglePlayer", ({ width, height }) => {
    sessionId = `solo:${socket.id}`;
    delete sessions[sessionId];

    const s = createSession(1, socket.id, width, height);
    sessions[sessionId] = s;
    socket.join(sessionId);

    s.players[socket.id] = {
      x: width * 0.1,
      y: height / 2,
      angle: 0,
      hearts: 5,
      score: 0,
      alive: true
    };

    s.inLobby = false;
    s.gameRunning = true;
    spawnEnemy(sessionId);
  });

  socket.on("createRoom", ({ roomName, width, height }) => {
    if (!roomName || sessions[roomName]) return;

    sessionId = roomName;
    const s = createSession(3, socket.id, width, height);
    sessions[sessionId] = s;
    socket.join(sessionId);

    s.players[socket.id] = {
      x: width * 0.1,
      y: height / 2,
      angle: 0,
      hearts: 5,
      score: 0,
      alive: true
    };

    io.to(sessionId).emit("lobbyUpdate", {
      sessionId,
      players: s.players,
      hostId: s.hostId
    });
  });

  socket.on("joinRoom", ({ roomName, width, height }) => {
    const s = sessions[roomName];
    if (!s || Object.keys(s.players).length >= s.maxPlayers) return;

    sessionId = roomName;
    socket.join(sessionId);

    s.width = Math.max(s.width, width);
    s.height = Math.max(s.height, height);

    s.players[socket.id] = {
      x: s.width * 0.1,
      y: s.height / 2,
      angle: 0,
      hearts: 5,
      score: 0,
      alive: true
    };

    io.to(sessionId).emit("lobbyUpdate", {
      sessionId,
      players: s.players,
      hostId: s.hostId
    });
  });

  socket.on("startGame", () => {
    const s = sessions[sessionId];
    if (!s || socket.id !== s.hostId) return;

    s.enemies = [];
    s.bullets = [];
    Object.values(s.players).forEach(p => {
      p.hearts = 5;
      p.alive = true;
      p.score = 0;
    });

    s.inLobby = false;
    s.gameRunning = true;
    spawnEnemy(sessionId);
  });

  socket.on("playerUpdate", data => {
    const s = sessions[sessionId];
    if (!s || s.inLobby || !s.players[socket.id]) return;
    Object.assign(s.players[socket.id], data);
  });

  socket.on("shoot", () => {
    const s = sessions[sessionId];
    const p = s?.players[socket.id];
    if (!p || !p.alive || s.inLobby) return;

    s.bullets.push({
      x: p.x,
      y: p.y,
      angle: p.angle,
      speed: 15,
      owner: socket.id
    });
  });

  socket.on("playAgain", () => {
    const s = sessions[sessionId];
    if (!s) return;

    s.inLobby = true;
    s.gameRunning = false;
    s.enemies = [];
    s.bullets = [];

    io.to(sessionId).emit("lobbyUpdate", {
      sessionId,
      players: s.players,
      hostId: s.hostId
    });
  });

  socket.on("exitRoom", () => {
    socket.leave(sessionId);
  });
});

/* ================= GAME LOOP ================= */
setInterval(() => {
  Object.entries(sessions).forEach(([id, s]) => {
    if (!s.gameRunning) return;

    /* ===== ENEMY SHOOTING (RANDOM TARGET) ===== */
    s.enemies.forEach(e => {
      const target = randomAlivePlayer(s.players);
      if (!target) return;

      if (Date.now() - e.lastShot >= shootDelay(target.score)) {
        s.bullets.push({
          x: e.x,
          y: e.y,
          angle: Math.atan2(target.y - e.y, target.x - e.x),
          speed: 15,
          owner: "enemy"
        });
        e.lastShot = Date.now();
      }
    });

    s.bullets.forEach(b => {
      b.x += b.speed * Math.cos(b.angle);
      b.y += b.speed * Math.sin(b.angle);
    });

    s.bullets = s.bullets.filter(b => {
      if (b.owner !== "enemy") {
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          if (distance(b.x, b.y, s.enemies[i].x, s.enemies[i].y) < s.enemies[i].radius) {
            s.players[b.owner].score++;
            s.enemies.splice(i, 1);
            return false;
          }
        }
        return true;
      }

      for (const p of Object.values(s.players)) {
        if (p.alive && distance(b.x, b.y, p.x, p.y) < 55) {
          p.hearts--;
          if (p.hearts <= 0) p.alive = false;
          return false;
        }
      }
      return true;
    });

    // ✅ MULTIPLAYER GAME OVER
    const allDead = Object.values(s.players).every(p => !p.alive);
    if (allDead) {
      s.gameRunning = false;
      io.to(id).emit("multiplayerGameOver");
    }

    io.to(id).emit("worldState", {
      sessionId: id,
      players: s.players,
      enemies: s.enemies,
      bullets: s.bullets,
      gameRunning: s.gameRunning,
      inLobby: s.inLobby,
      hostId: s.hostId
    });
  });
}, 50);

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
