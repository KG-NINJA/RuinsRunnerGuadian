const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const restartButton = document.getElementById("restart");

const W = 320;
const H = 180;
const FLOOR = 142;
const WORLD_END = 2320;

const stageSegments = [
  { name: "RUN", start: 0, end: 210 },
  { name: "JUMP", start: 210, end: 410 },
  { name: "SWING", start: 410, end: 640 },
  { name: "SLIDE", start: 640, end: 830 },
  { name: "CLIMB", start: 830, end: 1040 },
  { name: "DASH", start: 1040, end: 1360 },
  { name: "TEMPLE RUN", start: 1360, end: 1580 },
  { name: "PIT LEAP", start: 1580, end: 1780 },
  { name: "BOULDER ESCAPE", start: 1780, end: 2040 },
  { name: "BOSS", start: 2040, end: WORLD_END }
];

const hazardTemplates = [
  { type: "bat", x: 175, y: 62, r: 10, hp: 1 },
  { type: "trapSwitch", x: 255, y: 126, r: 10, target: "arrowA", hp: 1 },
  { type: "arrowTrap", id: "arrowA", x: 315, y: 117, r: 10, hp: 1 },
  { type: "fallingPlatform", x: 365, y: 129, r: 13, hp: 1 },
  { type: "bug", x: 518, y: 95, r: 9, hp: 1 },
  { type: "trapSwitch", x: 604, y: 104, r: 10, target: "spearA", hp: 1 },
  { type: "spearTrap", id: "spearA", x: 665, y: 132, r: 12, hp: 1 },
  { type: "rock", x: 715, y: 18, r: 10, hp: 1 },
  { type: "trapSwitch", x: 735, y: 78, r: 10, target: "arrowB", hp: 1 },
  { type: "arrowTrap", id: "arrowB", x: 775, y: 98, r: 10, hp: 1 },
  { type: "fallingPlatform", x: 930, y: 82, r: 13, hp: 1 },
  { type: "trapSwitch", x: 970, y: 75, r: 10, target: "spearB", hp: 1 },
  { type: "spearTrap", id: "spearB", x: 1020, y: 132, r: 12, hp: 1 },
  { type: "bat", x: 1085, y: 56, r: 10, hp: 1 },
  { type: "switch", x: 1212, y: 116, r: 11, hp: 1 },
  { type: "pit", x: 1515, y: FLOOR, r: 18, hp: 1 },
  { type: "snake", x: 1605, y: 134, r: 10, hp: 1 },
  { type: "spider", x: 1710, y: 76, r: 9, hp: 1 },
  { type: "arrowTrap", id: "innerArrow", x: 1815, y: 96, r: 10, hp: 1 },
  { type: "boulder", x: 1760, y: 122, r: 16, hp: 1 },
  { type: "snake", x: 1935, y: 134, r: 10, hp: 1 },
  { type: "spider", x: 2015, y: 68, r: 9, hp: 1 },
  { type: "boss", x: 2190, y: 102, r: 24, hp: 10, maxHp: 10, cooldown: 1.5 }
];

let player;
let hazards;
let particles;
let arrows;
let state;
let doorOpen;
let score;
let shots;
let hits;
let lastTime;
let cameraX;
let shake;
let cloudTick;
let debugInvincible;
let reloadTimer;
let audioCtx;
let musicTimer;
let musicStep = 0;
let musicOn = false;
let endingMusicStep = 0;
let endingMusicTimer;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  startMusic();
}

function playTone(freq, duration, type = "square", volume = 0.08, slide = 1) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function startMusic() {
  if (musicOn || !audioCtx) return;
  musicOn = true;
  musicStep = 0;
  musicTimer = setInterval(playMusicStep, 145);
}

function playMusicStep() {
  if (!audioCtx || state !== "play") return;
  const melody = [392, 440, 523, 587, 659, 587, 523, 440, 392, 523, 659, 784, 698, 587, 523, 440];
  const bass = [98, 98, 131, 131, 147, 147, 131, 131, 110, 110, 147, 147, 165, 165, 147, 147];
  const i = musicStep % melody.length;
  const bossMode = player && player.x > 2040;
  const templeMode = player && player.x > 1360;
  const lead = bossMode ? melody[(i * 3) % melody.length] * 0.75 : melody[i];
  if (i % 2 === 0) playTone(lead, 0.12, "triangle", 0.025, 1.0);
  if (i % 4 === 0) playTone(lead * 0.5, 0.18, "sawtooth", 0.018, 1.0);
  if (i % 4 === 0) playTone(bass[i], 0.16, "square", templeMode ? 0.028 : 0.022, 1.0);
  if (i % 2 === 1) playTone(190 + (i % 3) * 30, 0.035, "square", 0.012, 0.55);
  if (i % 8 === 6) playTone(880, 0.055, "triangle", 0.014, 0.75);
  musicStep += 1;
}
function startEndingMusic() {
  if (!audioCtx) return;
  if (musicTimer) clearInterval(musicTimer);
  if (endingMusicTimer) clearInterval(endingMusicTimer);
  endingMusicStep = 0;
  endingMusicTimer = setInterval(playEndingMusicStep, 180);
}

function playEndingMusicStep() {
  if (!audioCtx || state !== "ending") return;
  const notes = [523, 659, 784, 1046, 988, 784, 880, 1046];
  const bass = [131, 196, 220, 262, 196, 247, 262, 330];
  const i = endingMusicStep % notes.length;
  playTone(notes[i], 0.16, "triangle", 0.035, 1.08);
  if (i % 2 === 0) playTone(bass[i], 0.22, "square", 0.018, 1.0);
  if (i % 4 === 3) playTone(notes[i] * 1.5, 0.12, "triangle", 0.018, 1.12);
  endingMusicStep += 1;
}
function playSfx(name) {
  ensureAudio();
  if (name === "shot") playTone(620, 0.08, "square", 0.06, 1.8);
  if (name === "empty") playTone(120, 0.08, "sawtooth", 0.04, 0.7);
  if (name === "hit") { playTone(340, 0.07, "square", 0.07, 0.45); setTimeout(() => playTone(520, 0.05, "square", 0.05, 0.8), 45); }
  if (name === "switch") { playTone(440, 0.08, "triangle", 0.07, 1.4); setTimeout(() => playTone(780, 0.09, "triangle", 0.06, 1.1), 80); }
  if (name === "hurt") playTone(180, 0.14, "sawtooth", 0.08, 0.5);
  if (name === "clear") { playTone(520, 0.1, "triangle", 0.06, 1.2); setTimeout(() => playTone(720, 0.12, "triangle", 0.06, 1.2), 110); }
  if (name === "gameover") playTone(150, 0.22, "sawtooth", 0.08, 0.6);
}
function resetGame() {
  player = {
    x: 24,
    y: FLOOR - 22,
    w: 12,
    h: 22,
    hp: 3,
    speed: 44,
    stumble: 0,
    invuln: 0,
    frame: 0
  };
  hazards = hazardTemplates.map((h) => ({ ...h, alive: true, disabled: false, cooldown: 0, crumble: 0, extend: 0 }));
  particles = [];
  arrows = [];
  state = "play";
  doorOpen = false;
  score = 0;
  shots = 0;
  hits = 0;
  lastTime = performance.now();
  cameraX = 0;
  shake = 0;
  cloudTick = 0;
  reloadTimer = 0;
  restartButton.classList.remove("is-visible");
}

function segmentAt(x) {
  return stageSegments.find((s) => x >= s.start && x < s.end) || stageSegments[stageSegments.length - 1];
}

function segmentT(seg, x) {
  return Math.max(0, Math.min(1, (x - seg.start) / (seg.end - seg.start)));
}

function obstacleActionAt(x) {
  const near = (target, range) => Math.abs(x - target) < range;
  if (near(315, 34)) return { name: "DUCK", y: 7, t: (x - 281) / 68 };
  if (near(775, 34)) return { name: "DUCK", y: 7, t: (x - 741) / 68 };
  if (near(365, 38)) return { name: "GAP STEP", y: -Math.sin(((x - 327) / 76) * Math.PI) * 18, t: (x - 327) / 76 };
  if (near(665, 42)) return { name: "VAULT", y: -Math.sin(((x - 623) / 84) * Math.PI) * 24, t: (x - 623) / 84 };
  if (near(1020, 42)) return { name: "VAULT", y: -Math.sin(((x - 978) / 84) * Math.PI) * 24, t: (x - 978) / 84 };
  if (near(930, 46)) return { name: "LEDGE PULL", y: -Math.sin(((x - 884) / 92) * Math.PI) * 16, t: (x - 884) / 92 };
  if (near(1212, 34) && !doorOpen) return { name: "BRACE", y: 0, t: 0.5 };
  if (near(1515, 42)) return { name: "PIT LEAP", y: -Math.sin(((x - 1473) / 84) * Math.PI) * 34, t: (x - 1473) / 84 };
  if (near(1760, 50)) return { name: "DODGE ROLL", y: 8, t: (x - 1710) / 100 };
  if (near(2190, 70)) return { name: "BOSS BRACE", y: 0, t: 0.5 };
  return null;
}

function currentActionName() {
  return player.actionName || segmentAt(player.x).name;
}
function groundYAt(x) {
  const seg = segmentAt(x);
  const t = segmentT(seg, x);
  let y = FLOOR + Math.sin(t * Math.PI * 2) * 1.5;
  if (seg.name === "JUMP") y = FLOOR - Math.sin(t * Math.PI) * 42 + Math.sin(t * Math.PI * 3) * 4;
  if (seg.name === "SWING") y = FLOOR - 20 - Math.sin(t * Math.PI) * 55 + Math.sin(t * Math.PI * 2) * 7;
  if (seg.name === "SLIDE") y = 98 + t * 42 + Math.sin(t * Math.PI) * 6;
  if (seg.name === "CLIMB") y = 140 - t * 72 + Math.sin(t * Math.PI * 5) * 3;
  if (seg.name === "TEMPLE RUN") y = FLOOR;
  if (seg.name === "PIT LEAP") y = FLOOR - Math.sin(t * Math.PI) * 28;
  if (seg.name === "BOULDER ESCAPE") y = FLOOR + Math.sin(t * Math.PI * 4) * 2;
  if (seg.name === "BOSS") y = FLOOR;
  const cue = obstacleActionAt(x);
  return y + (cue ? cue.y : 0);
}

function updatePlayer(dt) {
  if (state !== "play") return;
  const seg = segmentAt(player.x);
  let speed = seg.name === "DASH" ? 48 : 31;
  if (seg.name === "JUMP") speed = 29;
  if (seg.name === "SWING") speed = 34;
  if (seg.name === "SLIDE") speed = 37;
  if (seg.name === "CLIMB") speed = 23;
  if (seg.name === "TEMPLE RUN") speed = 30;
  if (seg.name === "PIT LEAP") speed = 29;
  if (seg.name === "BOULDER ESCAPE") speed = 35;
  if (seg.name === "BOSS") speed = 18;
  if (player.stumble > 0) {
    speed *= 0.28;
    player.stumble -= dt;
  }
  player.x += speed * dt;
  if (!doorOpen && player.x > 1258) {
    player.x = 1258;
    player.stumble = Math.max(player.stumble, 0.12);
  }
  const cue = obstacleActionAt(player.x);
  player.actionName = cue ? cue.name : seg.name;
  player.actionT = cue ? Math.max(0, Math.min(1, cue.t)) : segmentT(seg, player.x);
  player.y = groundYAt(player.x) - player.h;
  player.frame += dt * (seg.name === "DASH" ? 13 : 8);
  player.invuln = Math.max(0, player.invuln - dt);
  cameraX += ((player.x - 92) - cameraX) * Math.min(1, dt * 5);
  cameraX = Math.max(0, Math.min(WORLD_END - W, cameraX));
  const boss = hazards.find((h) => h.type === "boss" && h.alive);
  if (boss && player.x > 2115) {
    player.x = 2115;
    player.stumble = Math.max(player.stumble, 0.1);
  }
  if (!boss && player.x >= 2245) {
    score += 1000;
    finish("ending");
  }
}

function updateHazards(dt) {
  if (state !== "play") return;
  for (const h of hazards) {
    if (!h.alive) continue;
    h.cooldown -= dt;
    if (h.type === "bat") {
      const dx = player.x - h.x;
      const dy = player.y + 8 - h.y;
      h.x += Math.sign(dx) * dt * 15;
      h.y += Math.sign(dy) * dt * 10;
    }
    if (h.type === "bug") {
      h.x += Math.sin(performance.now() / 180) * dt * 7;
      if (Math.abs(player.x - h.x) < 24 && segmentAt(player.x).name === "SWING") damagePlayer(h);
    }
    if (h.type === "rock") {
      if (Math.abs(player.x - h.x) < 110) h.y += dt * 50;
    }
    if (h.type === "snake") {
      h.x -= dt * (h.illusion ? 18 : 10);
    }
    if (h.type === "spider") {
      h.baseY = h.baseY || h.y;
      if (Math.abs(player.x - h.x) < 120) h.drop = Math.min(1, (h.drop || 0) + dt * 0.45);
      h.y = h.baseY + (h.drop || 0) * 58 + Math.sin(performance.now() / 180) * 2;
    }
    if (h.disabled) continue;
    if (h.type === "arrowTrap" && Math.abs(player.x - h.x) < 170 && h.cooldown <= 0) {
      arrows.push({ x: h.x - 8, y: h.y, vx: -82, life: 2.5 });
      h.cooldown = 1.55;
    }
    if (h.type === "spearTrap") {
      h.extend = Math.max(0, h.extend - dt * 1.8);
      if (Math.abs(player.x - h.x) < 54) h.extend = Math.min(1, h.extend + dt * 4.5);
      if (h.extend > 0.55 && Math.abs(player.x - h.x) < 13 && player.y + player.h > h.y - 28) damagePlayer(h);
    }
    if (h.type === "fallingPlatform") {
      if (Math.abs(player.x - h.x) < 60) h.crumble += dt;
      if (h.crumble > 1.4 && Math.abs(player.x - h.x) < 18) damagePlayer(h);
    }
    if (h.type === "boss") {
      h.cooldown -= dt;
      if (Math.abs(player.x - h.x) < 110 && h.cooldown <= 0) {
        spawnBossIllusion(h);
        h.cooldown = 1.6 + h.hp * 0.12;
      }
    }
    if (h.type !== "switch" && h.type !== "trapSwitch" && h.type !== "spearTrap" && h.type !== "pit" && h.type !== "boss" && collideCircleRect(h.x, h.y, h.r, player)) damagePlayer(h);
  }

  for (const a of arrows) {
    a.x += a.vx * dt;
    a.life -= dt;
    if (collideCircleRect(a.x, a.y, 3, player)) {
      damagePlayer(a);
      a.life = 0;
    }
  }
  arrows = arrows.filter((a) => a.life > 0);
}

function spawnBossIllusion(boss) {
  const count = hazards.filter((h) => h.illusion && h.alive).length;
  if (count > 5) return;
  const roll = Math.floor(Math.random() * 4);
  const x = player.x + 70 + Math.random() * 72;
  if (roll === 0) hazards.push({ type: "snake", x: player.x + 150, y: 134, r: 10, hp: 1, alive: true, illusion: true, cooldown: 0, crumble: 0, extend: 0, disabled: false });
  if (roll === 1) hazards.push({ type: "spider", x, y: 42, baseY: 42, drop: 0, r: 9, hp: 1, alive: true, illusion: true, cooldown: 0, crumble: 0, extend: 0, disabled: false });
  if (roll === 2) hazards.push({ type: "spearTrap", x, y: 132, r: 12, hp: 1, alive: true, illusion: true, cooldown: 0, crumble: 0, extend: 1, disabled: false });
  if (roll === 3) hazards.push({ type: "boulder", x: player.x - 58, y: 122, r: 16, hp: 1, alive: true, illusion: true, cooldown: 0, crumble: 0, extend: 0, disabled: false });
  burst(boss.x, boss.y - 20, "#b983ff", 14);
  playSfx("switch");
}
function collideCircleRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= cr ** 2;
}

function damagePlayer(source) {
  if (debugInvincible) {
    burst(player.x + 6, player.y + 10, "#8fe7ff", 5);
    if (source && source.life !== undefined) source.life = 0;
    return;
  }
  if (player.invuln > 0 || state !== "play") return;
  player.hp -= 1;
  player.invuln = 1.2;
  shake = 7;
  playSfx("hurt");
  burst(player.x + 6, player.y + 10, "#f05b4f", 10);
  if (source && source.type !== "switch") source.alive = false;
  if (player.hp <= 0) finish("gameover");
}
function finish(nextState) {
  state = nextState;
  if (nextState === "ending") startEndingMusic();
  restartButton.classList.add("is-visible");
}

function handlePointer(e) {
  e.preventDefault();
  if (state !== "play") return;
  const rect = canvas.getBoundingClientRect();
  const sx = ((e.clientX - rect.left) / rect.width) * W;
  const sy = ((e.clientY - rect.top) / rect.height) * H;
  const wx = sx + cameraX;
  if (reloadTimer > 0) {
    playSfx("empty");
    return;
  }
  reloadTimer = 2;
  shots += 1;
  playSfx("shot");
  if (wx >= player.x - 4 && wx <= player.x + player.w + 4 && sy >= player.y - 4 && sy <= player.y + player.h + 4) {
    player.stumble = 0.45;
    playSfx("empty");
    burst(player.x + 6, player.y + 10, "#ffe08a", 8);
    return;
  }

  for (const h of hazards) {
    if (!h.alive) continue;
    const d = Math.hypot(wx - h.x, sy - h.y);
    if (d <= h.r + 7) {
      hits += 1;
      if (h.type === "switch") {
        doorOpen = true;
        score += 250;
        playSfx("switch");
        burst(h.x, h.y, "#9ff28f", 16);
      } else if (h.type === "trapSwitch") {
        const target = hazards.find((item) => item.id === h.target);
        if (target) target.disabled = true;
        score += 180;
        playSfx("switch");
        burst(h.x, h.y, "#8fe7ff", 16);
      } else if (h.type === "boss") {
        h.hp -= 1;
        score += 150;
        playSfx("hit");
        burst(h.x, h.y, "#ffd166", 18);
        spawnBossIllusion(h);
        if (h.hp > 0) return;
        score += 800;
        hazards.forEach((item) => { if (item.illusion) item.alive = false; });
        playSfx("clear");
      } else {
        score += 100;
        playSfx("hit");
        burst(h.x, h.y, "#ffd166", 12);
      }
      h.alive = false;
      return;
    }
  }

  for (const a of arrows) {
    if (Math.hypot(wx - a.x, sy - a.y) <= 9) {
      hits += 1;
      score += 40;
      a.life = 0;
      playSfx("hit");
      burst(a.x, a.y, "#d9d29b", 7);
      return;
    }
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 70,
      vy: (Math.random() - 0.7) * 55,
      life: 0.45 + Math.random() * 0.25,
      color
    });
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

function draw() {
  ctx.save();
  const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.translate(Math.round(shx), Math.round(shy));
  drawBackground();
  ctx.translate(-Math.floor(cameraX), 0);
  drawWorld();
  drawHazards();
  drawPlayer();
  drawParticles();
  ctx.restore();
  drawHud();
  if (state !== "play") drawOverlay();
}

function drawBackground() {
  cloudTick += 0.02;
  ctx.fillStyle = "#87b7b5";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d9f2d0";
  for (let i = 0; i < 4; i++) {
    const x = (i * 98 - (cloudTick * (8 + i) + cameraX * 0.12)) % 430;
    pixelCloud(x - 40, 22 + i * 9);
  }
  ctx.fillStyle = "#5d7e6b";
  mountain(-cameraX * 0.18, 102, 94, 42);
  mountain(92 - cameraX * 0.12, 108, 120, 54);
  mountain(220 - cameraX * 0.16, 100, 100, 48);
  ctx.fillStyle = "#7ea760";
  for (let x = -20; x < W + 40; x += 11) {
    const y = 137 + Math.sin((x + cloudTick * 40) / 9) * 2;
    ctx.fillRect(x - (cameraX * 0.35) % 11, y, 3, 10);
  }
}


function drawTempleBackground() {
  ctx.fillStyle = "#1a1718";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2b2726";
  for (let x = -40; x < W + 80; x += 32) {
    const px = x - (cameraX * 0.18) % 32;
    ctx.fillRect(px, 28, 18, 112);
    ctx.fillRect(px - 4, 22, 26, 8);
  }
  ctx.fillStyle = "#574c42";
  for (let x = -20; x < W + 40; x += 24) ctx.fillRect(x - (cameraX * 0.35) % 24, 134, 18, 7);
  ctx.fillStyle = "#d6b45f";
  ctx.fillRect(260 - (cameraX * 0.12) % 320, 38, 8, 22);
  ctx.fillStyle = "#5b3a25";
  ctx.fillRect(259 - (cameraX * 0.12) % 320, 58, 10, 4);
}
function pixelCloud(x, y) {
  ctx.fillRect(Math.floor(x), y, 18, 6);
  ctx.fillRect(Math.floor(x + 10), y - 4, 18, 10);
  ctx.fillRect(Math.floor(x + 27), y + 1, 16, 5);
}

function mountain(x, base, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x + width * 0.45, base - height);
  ctx.lineTo(x + width, base);
  ctx.closePath();
  ctx.fill();
}

function drawWorld() {
  ctx.fillStyle = "#35523d";
  ctx.fillRect(-80, FLOOR, WORLD_END + 160, 50);
  ctx.fillStyle = "#26382e";
  ctx.fillRect(430, FLOOR - 6, 210, 58);
  ctx.clearRect(455, FLOOR - 4, 150, 42);
  ctx.fillStyle = "#35523d";
  ctx.fillRect(640, 104, 190, 10);
  for (let x = 0; x < WORLD_END; x += 24) {
    ctx.fillStyle = x % 48 ? "#607356" : "#819264";
    ctx.fillRect(x, FLOOR - 6 + Math.sin(x) * 2, 18, 6);
  }
  drawSteps();
  drawVines();
  drawPillars();
  drawDoor();
}


function drawTempleWorld() {
  ctx.fillStyle = "#2b2726";
  ctx.fillRect(1320, 24, 980, 118);
  ctx.fillStyle = "#3a3330";
  ctx.fillRect(1320, FLOOR, 1000, 50);
  ctx.fillStyle = "#75695b";
  for (let x = 1360; x < 2240; x += 72) {
    ctx.fillRect(x, 56, 18, 86);
    ctx.fillRect(x - 5, 50, 28, 7);
  }
  ctx.fillStyle = "#d6b45f";
  ctx.fillRect(2258, FLOOR - 18, 22, 18);
  ctx.fillStyle = "#fff0a8";
  ctx.fillRect(2264, FLOOR - 26, 10, 8);
}
function drawSteps() {
  ctx.fillStyle = "#87906e";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(226 + i * 30, FLOOR - 7 - i * 4, 22, 8);
    ctx.fillStyle = i % 2 ? "#6f785d" : "#87906e";
  }
}

function drawVines() {
  ctx.strokeStyle = "#2f6f42";
  ctx.lineWidth = 2;
  for (let x = 462; x <= 610; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 33);
    ctx.quadraticCurveTo(x + 14, 75, x - 4, 116);
    ctx.stroke();
  }
}

function drawPillars() {
  ctx.fillStyle = "#6f785d";
  for (const x of [720, 872, 1005]) {
    ctx.fillRect(x, FLOOR - 58, 20, 58);
    ctx.fillRect(x - 4, FLOOR - 64, 28, 7);
  }
}

function drawDoor() {
  ctx.fillStyle = "#50483d";
  ctx.fillRect(1270, 84, 42, 58);
  ctx.fillStyle = doorOpen ? "#80d681" : "#26382e";
  ctx.fillRect(1282, doorOpen ? 106 : 94, 18, doorOpen ? 36 : 48);
  ctx.fillStyle = "#caa75b";
  ctx.fillRect(1288, 112, 5, 5);
}

function drawHazards() {
  for (const h of hazards) {
    if (!h.alive) continue;
    if (h.type === "bat") drawBat(h);
    if (h.type === "bug") drawBug(h);
    if (h.type === "rock") drawRock(h);
    if (h.type === "snake") drawSnake(h);
    if (h.type === "spider") drawSpider(h);
    if (h.type === "boulder") drawBoulder(h);
    if (h.type === "pit") drawPit(h);
    if (h.type === "boss") drawBoss(h);
    if (h.type === "arrowTrap") drawTrap(h);
    if (h.type === "spearTrap") drawSpearTrap(h);
    if (h.type === "fallingPlatform") drawCrumble(h);
    if (h.type === "trapSwitch") drawTrapSwitch(h);
    if (h.type === "switch") drawSwitch(h);
  }
  ctx.fillStyle = "#d9d29b";
  for (const a of arrows) {
    ctx.fillRect(a.x - 5, a.y - 1, 9, 2);
    ctx.fillRect(a.x - 7, a.y - 2, 3, 4);
  }
}

function drawBat(h) {
  ctx.fillStyle = "#2b2738";
  ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
  const flap = Math.sin(player.frame) > 0 ? 3 : 0;
  ctx.fillRect(h.x - 13, h.y - 2 - flap, 9, 4);
  ctx.fillRect(h.x + 4, h.y - 2 - flap, 9, 4);
  ctx.fillStyle = "#f7d36b";
  ctx.fillRect(h.x - 2, h.y - 1, 1, 1);
  ctx.fillRect(h.x + 2, h.y - 1, 1, 1);
}

function drawBug(h) {
  ctx.fillStyle = "#63335f";
  ctx.fillRect(h.x - 5, h.y - 4, 10, 8);
  ctx.fillStyle = "#9ff28f";
  ctx.fillRect(h.x - 7, h.y - 1, 3, 2);
  ctx.fillRect(h.x + 4, h.y - 1, 3, 2);
}


function drawSnake(h) {
  ctx.fillStyle = h.illusion ? "#7d55c7" : "#3f8f4d";
  ctx.fillRect(h.x - 8, h.y - 3, 14, 5);
  ctx.fillRect(h.x - 11, h.y - 6, 5, 4);
  ctx.fillStyle = "#f05b4f";
  ctx.fillRect(h.x - 13, h.y - 4, 2, 1);
}

function drawSpider(h) {
  const anchorY = h.baseY || 42;
  ctx.strokeStyle = h.illusion ? "#7d55c7" : "#22201f";
  ctx.beginPath();
  ctx.moveTo(h.x, anchorY - 16);
  ctx.lineTo(h.x, h.y);
  ctx.stroke();
  ctx.fillStyle = h.illusion ? "#6b3fa0" : "#3b2438";
  ctx.fillRect(h.x - 5, h.y - 4, 10, 8);
  ctx.fillStyle = "#d9d29b";
  ctx.fillRect(h.x - 2, h.y - 1, 1, 1);
  ctx.fillRect(h.x + 2, h.y - 1, 1, 1);
}

function drawBoulder(h) {
  ctx.fillStyle = "#5d554d";
  ctx.fillRect(h.x - 15, h.y - 15, 30, 30);
  ctx.fillStyle = "#81766a";
  ctx.fillRect(h.x - 8, h.y - 11, 9, 5);
  ctx.fillRect(h.x + 4, h.y + 2, 7, 4);
}

function drawPit(h) {
  ctx.fillStyle = "#070909";
  ctx.fillRect(h.x - 24, FLOOR - 2, 48, 42);
  ctx.fillStyle = "#50483d";
  ctx.fillRect(h.x - 26, FLOOR - 5, 12, 4);
  ctx.fillRect(h.x + 14, FLOOR - 5, 12, 4);
}

function drawBoss(h) {
  ctx.fillStyle = "#5d6360";
  ctx.fillRect(h.x - 18, h.y - 30, 36, 54);
  ctx.fillStyle = "#7b8580";
  ctx.fillRect(h.x - 12, h.y - 42, 24, 16);
  ctx.fillStyle = "#1c2020";
  ctx.fillRect(h.x - 7, h.y - 35, 4, 4);
  ctx.fillRect(h.x + 4, h.y - 35, 4, 4);
  ctx.fillStyle = "#d6b45f";
  ctx.fillRect(h.x - 18, h.y - 50, 36 * (h.hp / (h.maxHp || 10)), 4);
  ctx.fillStyle = "#b983ff";
  if (h.cooldown < 0.4) ctx.fillRect(h.x - 24, h.y - 18, 48, 3);
}
function drawRock(h) {
  ctx.fillStyle = "#74685c";
  ctx.fillRect(h.x - 7, h.y - 7, 14, 14);
  ctx.fillStyle = "#9b907b";
  ctx.fillRect(h.x - 4, h.y - 6, 5, 4);
}

function drawTrap(h) {
  ctx.fillStyle = h.disabled ? "#444c45" : "#6f785d";
  ctx.fillRect(h.x - 8, h.y - 8, 16, 16);
  ctx.fillStyle = h.disabled ? "#26382e" : "#121a19";
  ctx.fillRect(h.x - 8, h.y - 2, 6, 4);
  if (!h.disabled) {
    ctx.fillStyle = "#d9d29b";
    ctx.fillRect(h.x - 18, h.y - 1, 6, 2);
  }
}

function drawSpearTrap(h) {
  const rise = h.disabled ? 0 : Math.floor((h.extend || 0) * 28);
  ctx.fillStyle = h.illusion ? "#5d4678" : h.disabled ? "#3e463e" : "#59493b";
  ctx.fillRect(h.x - 13, h.y + 2, 26, 7);
  ctx.fillStyle = h.disabled ? "#46514d" : "#d9d29b";
  for (let i = -9; i <= 9; i += 9) {
    ctx.fillRect(h.x + i - 1, h.y - rise, 3, rise + 5);
    ctx.fillRect(h.x + i - 3, h.y - rise, 7, 3);
  }
}

function drawTrapSwitch(h) {
  ctx.fillStyle = "#214456";
  ctx.fillRect(h.x - 8, h.y - 6, 16, 12);
  ctx.fillStyle = "#8fe7ff";
  ctx.fillRect(h.x - 3, h.y - 12, 6, 8);
  ctx.fillStyle = "#e8f2cf";
  ctx.fillRect(h.x - 1, h.y - 10, 2, 4);
}
function drawCrumble(h) {
  ctx.fillStyle = h.crumble > 0.8 ? "#a36f54" : "#887f64";
  ctx.fillRect(h.x - 15, h.y - 5, 30, 8);
  ctx.fillStyle = "#4d4639";
  ctx.fillRect(h.x - 5, h.y - 3, 2, 6);
  ctx.fillRect(h.x + 7, h.y - 4, 2, 5);
}

function drawSwitch(h) {
  ctx.fillStyle = doorOpen ? "#88df70" : "#c7584a";
  ctx.fillRect(h.x - 7, h.y - 7, 14, 14);
  ctx.fillStyle = "#f4e7a1";
  ctx.fillRect(h.x - 2, h.y - 10, 4, 8);
}

function drawPlayer() {
  const blink = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
  if (blink) return;
  const seg = segmentAt(player.x);
  const t = player.actionT ?? segmentT(seg, player.x);
  const cycle = player.frame;
  const step = Math.sin(cycle);
  const lift = Math.abs(step);
  const actionName = currentActionName();
  const pose = makeExplorerPose(actionName, t, step);
  const x = player.x + 6;
  const y = player.y + 5 + pose.crouch;
  const hip = { x: x + pose.lean * 0.35, y: y + 13 };
  const chest = { x: x + pose.lean, y: y + 4 };
  const head = { x: chest.x + pose.headX, y: chest.y - 8 + pose.headY };

  drawBackpack(chest.x - 7 + pose.packX, chest.y + 1 + pose.packY);
  drawLimb(chest.x - 4, chest.y + 4, chest.x + pose.armL.x, chest.y + pose.armL.y, "#d8a95e", pose.armL.s || 3);
  drawLimb(chest.x + 4, chest.y + 4, chest.x + pose.armR.x, chest.y + pose.armR.y, "#d8a95e", pose.armR.s || 3);
  drawLimb(hip.x - 3, hip.y, hip.x + pose.legL.x, hip.y + pose.legL.y, "#20282c", 3);
  drawLimb(hip.x + 3, hip.y, hip.x + pose.legR.x, hip.y + pose.legR.y, "#20282c", 3);

  ctx.fillStyle = "#6a432b";
  ctx.fillRect(Math.floor(chest.x - 5), Math.floor(chest.y), 10, 9);
  ctx.fillStyle = "#9a6a3e";
  ctx.fillRect(Math.floor(chest.x - 4), Math.floor(chest.y + 1), 8, 3);
  ctx.fillStyle = "#b34b68";
  ctx.fillRect(Math.floor(chest.x - 5), Math.floor(chest.y + 3), 11, 4);
  ctx.fillStyle = "#3e5f65";
  ctx.fillRect(Math.floor(chest.x - 8), Math.floor(chest.y + 2), 4, 5);
  ctx.fillRect(Math.floor(chest.x + 5), Math.floor(chest.y + 2), 4, 5);
  ctx.fillStyle = "#5b3a25";
  ctx.fillRect(Math.floor(hip.x - 5), Math.floor(hip.y - 3), 10, 6);
  ctx.fillStyle = "#d6b45f";
  ctx.fillRect(Math.floor(hip.x - 1), Math.floor(hip.y - 3), 3, 3);

  drawHeadAndHat(head.x, head.y, pose.face);
  drawBoot(hip.x + pose.legL.x, hip.y + pose.legL.y, pose.legL.foot || -1);
  drawBoot(hip.x + pose.legR.x, hip.y + pose.legR.y, pose.legR.foot || 1);

  if (actionName === "SWING") {
    ctx.strokeStyle = "#2f6f42";
    ctx.beginPath();
    ctx.moveTo(player.x + 5, 31);
    ctx.quadraticCurveTo(player.x + 18, 58, chest.x, chest.y - 1);
    ctx.stroke();
  }
  if (actionName === "JUMP" || actionName === "DASH" || actionName === "VAULT" || actionName === "GAP STEP") {
    ctx.fillStyle = "#d6b45f";
    ctx.fillRect(player.x - 8 - lift * 3, player.y + 20, 8, 2);
    ctx.fillRect(player.x - 16 - lift * 2, player.y + 23, 6, 2);
  }
  if (actionName === "SLIDE") {
    ctx.fillStyle = "#f2d06b";
    ctx.fillRect(player.x - 10, player.y + 23, 25, 2);
    ctx.fillStyle = "#d6b45f";
    ctx.fillRect(player.x - 17, player.y + 18, 9, 2);
  }
}

function makeExplorerPose(name, t, step) {
  const run = {
    lean: 3,
    crouch: Math.round(Math.abs(step) * 1),
    headX: 1,
    headY: 0,
    face: 1,
    packX: -1,
    packY: 0,
    armL: { x: -8 - step * 3, y: 9 + step * 4 },
    armR: { x: 9 + step * 4, y: 8 - step * 5 },
    legL: { x: -5 - step * 5, y: 12 + step * 2, foot: -1 },
    legR: { x: 6 + step * 5, y: 12 - step * 2, foot: 1 }
  };
  if (name === "JUMP") {
    const up = Math.sin(t * Math.PI);
    return { ...run, lean: 1, crouch: -3, headY: -1, armL: { x: -7, y: -7 - up * 4 }, armR: { x: 8, y: -8 - up * 4 }, legL: { x: -4, y: 13 - up * 8, foot: -1 }, legR: { x: 8, y: 10 + up * 2, foot: 1 } };
  }
  if (name === "SWING") {
    const swing = Math.sin(t * Math.PI * 2);
    return { ...run, lean: swing * 5, crouch: -4, headY: -1, armL: { x: -4, y: -10, s: 2 }, armR: { x: 5, y: -11, s: 2 }, legL: { x: -7 - swing * 2, y: 12, foot: -1 }, legR: { x: 10 + swing * 2, y: 9, foot: 1 } };
  }
  if (name === "SLIDE") {
    return { ...run, lean: 9, crouch: 5, headX: 2, packX: -2, armL: { x: -7, y: 5 }, armR: { x: 9, y: 4 }, legL: { x: 10, y: 12, foot: 1 }, legR: { x: -8, y: 13, foot: -1 } };
  }
  if (name === "CLIMB") {
    return { ...run, lean: step > 0 ? -1 : 2, crouch: -1, headY: -1, armL: { x: -5, y: -8 + step * 4 }, armR: { x: 7, y: -7 - step * 4 }, legL: { x: -5, y: 11 - step * 5, foot: -1 }, legR: { x: 6, y: 12 + step * 5, foot: 1 } };
  }
  if (name === "DUCK") {
    return { ...run, lean: 6, crouch: 7, headY: 3, packY: 2, armL: { x: -8, y: 8 }, armR: { x: 10, y: 6 }, legL: { x: -7, y: 9, foot: -1 }, legR: { x: 8, y: 9, foot: 1 } };
  }
  if (name === "VAULT") {
    const up = Math.sin(t * Math.PI);
    return { ...run, lean: 7, crouch: -4, headY: -2, armL: { x: -4, y: 4 - up * 7 }, armR: { x: 11, y: 1 - up * 4 }, legL: { x: -9, y: 11 - up * 5, foot: -1 }, legR: { x: 12, y: 6 + up * 3, foot: 1 } };
  }
  if (name === "GAP STEP") {
    const up = Math.sin(t * Math.PI);
    return { ...run, lean: 5, crouch: -2, armL: { x: -8, y: 2 }, armR: { x: 10, y: 5 }, legL: { x: -8, y: 12 - up * 4, foot: -1 }, legR: { x: 12, y: 10 + up * 2, foot: 1 } };
  }
  if (name === "LEDGE PULL") {
    return { ...run, lean: 2, crouch: -3, headY: -2, armL: { x: -4, y: -9, s: 2 }, armR: { x: 6, y: -9, s: 2 }, legL: { x: -7, y: 12, foot: -1 }, legR: { x: 8, y: 10, foot: 1 } };
  }
  if (name === "BRACE") {
    return { ...run, lean: -1, crouch: 3, armL: { x: -7, y: 7 }, armR: { x: 7, y: 7 }, legL: { x: -5, y: 12, foot: -1 }, legR: { x: 6, y: 12, foot: 1 } };
  }  if (name === "DASH") return { ...run, lean: 6, armL: { x: -8, y: 10 }, armR: { x: 12, y: 2 }, legL: { x: -8 - step * 4, y: 12, foot: -1 }, legR: { x: 10 + step * 5, y: 11, foot: 1 } };
  return run;
}

function drawHeadAndHat(x, y, face) {
  ctx.fillStyle = "#f0a070";
  ctx.fillRect(Math.floor(x - 3), Math.floor(y), 7, 7);
  ctx.fillStyle = "#2a1b18";
  ctx.fillRect(Math.floor(x + 3 * face), Math.floor(y + 2), 1, 2);
  ctx.fillStyle = "#6f4a2d";
  ctx.fillRect(Math.floor(x - 6), Math.floor(y - 3), 13, 3);
  ctx.fillRect(Math.floor(x - 3), Math.floor(y - 7), 8, 4);
  ctx.fillStyle = "#b77b45";
  ctx.fillRect(Math.floor(x - 2), Math.floor(y - 6), 6, 1);
}

function drawBackpack(x, y) {
  ctx.fillStyle = "#4d3324";
  ctx.fillRect(Math.floor(x - 4), Math.floor(y + 2), 7, 11);
  ctx.fillStyle = "#7a5130";
  ctx.fillRect(Math.floor(x - 5), Math.floor(y + 5), 3, 5);
  ctx.fillStyle = "#201714";
  ctx.fillRect(Math.floor(x - 1), Math.floor(y + 1), 1, 10);
}

function drawBoot(x, y, dir) {
  ctx.fillStyle = "#5a3325";
  ctx.fillRect(Math.floor(x - 2), Math.floor(y), 5, 3);
  ctx.fillRect(Math.floor(x - 2 + dir * 2), Math.floor(y + 2), 6, 2);
}

function drawLimb(x1, y1, x2, y2, color, size = 3) {
  ctx.fillStyle = color;
  const mx = Math.floor((x1 + x2) / 2);
  const my = Math.floor((y1 + y2) / 2);
  ctx.fillRect(Math.floor(x1), Math.floor(y1), size, size);
  ctx.fillRect(mx, my, size, size);
  ctx.fillRect(Math.floor(x2), Math.floor(y2), size, size);
}
function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

function drawHud() {
  ctx.fillStyle = "rgba(10, 18, 17, 0.72)";
  ctx.fillRect(6, 6, 146, 42);
  ctx.fillStyle = "#e8f2cf";
  ctx.font = "8px Courier New";
  ctx.fillText(`HP ${"[]".repeat(player.hp)}${"--".repeat(3 - player.hp)}`, 12, 17);
  ctx.fillText(`SCORE ${score}`, 12, 28);
  const acc = shots ? Math.round((hits / shots) * 100) : 100;
  ctx.fillText(`HIT ${acc}%  ACT ${currentActionName()}`, 12, 39);
  if (musicOn) {
    ctx.fillStyle = "#c6d7ad";
    ctx.fillText("BGM", 287, 17);
  }
  if (reloadTimer > 0) {
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`RELOAD ${reloadTimer.toFixed(1)}s`, 190, 29);
  }
  if (debugInvincible) {
    ctx.fillStyle = "#8fe7ff";
    ctx.fillText("DEBUG INVINCIBLE", 190, 17);
  }
}

function drawOverlay() {
  ctx.fillStyle = "rgba(10, 15, 14, 0.78)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = state === "ending" ? "#ffd166" : state === "clear" ? "#9ff28f" : "#f05b4f";
  ctx.font = "18px Courier New";
  ctx.fillText(state === "ending" ? "TREASURE FOUND" : state === "clear" ? "RUINS CLEARED" : "GAME OVER", W / 2, 70);
  ctx.fillStyle = "#e8f2cf";
  ctx.font = "9px Courier New";
  const acc = shots ? Math.round((hits / shots) * 100) : 100;
  ctx.fillText(`SCORE ${score}  HIT ${acc}%`, W / 2, 91);
  ctx.fillText(state === "ending" ? "The guardian saved the relic" : "Press restart to guard again", W / 2, 108);
  ctx.textAlign = "left";
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  shake = Math.max(0, shake - dt * 18);
  reloadTimer = Math.max(0, reloadTimer - dt);
  updatePlayer(dt);
  updateHazards(dt);
  updateParticles(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") debugInvincible = !debugInvincible;
});
canvas.addEventListener("pointerdown", handlePointer);
restartButton.addEventListener("click", resetGame);
resetGame();
requestAnimationFrame(loop);
