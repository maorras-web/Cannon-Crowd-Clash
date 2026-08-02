const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// הגדרות גודל קנבס התואמות למסך
let width = container.clientWidth;
let height = container.clientHeight;
canvas.width = width;
canvas.height = height;

window.addEventListener('resize', () => {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
});

// משתני משחק ושמירה
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let score = 0;
let bestScore = parseInt(localStorage.getItem('cannon_best_score') || '0');
let totalCoins = parseInt(localStorage.getItem('cannon_total_coins') || '0');
let level = 1;

let unlockedMaps = JSON.parse(localStorage.getItem('cannon_unlocked_maps') || '["day"]');
let currentMap = localStorage.getItem('cannon_current_map') || 'day';

// שדרוגים בחנות
let fireRateLevel = parseInt(localStorage.getItem('cannon_fire_rate_lvl') || '1');
let cannonPowerLevel = parseInt(localStorage.getItem('cannon_power_lvl') || '1');
let coinMultiLevel = parseInt(localStorage.getItem('cannon_coin_multi_lvl') || '1');

// אובייקט תותח
const cannon = {
    x: width / 2,
    y: height - 60,
    width: 44,
    height: 36,
    speed: 800,
    targetX: width / 2
};

let bullets = [];
let targets = [];
let coinsList = [];
let particles = [];
let floatingTexts = [];

let lastShootTime = 0;
let shootInterval = Math.max(60, 220 - (fireRateLevel - 1) * 15);

// אלמנטי UI
const mainMenu = document.getElementById('main-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const coinCountEl = document.getElementById('coin-count');
const menuCoinCountEl = document.getElementById('menu-coin-count');
const scoreDisplayEl = document.getElementById('score-display');
const levelDisplayEl = document.getElementById('level-display');
const bestScoreDisplayEl = document.getElementById('best-score-display');

function updateUI() {
    if (coinCountEl) coinCountEl.innerText = totalCoins;
    if (menuCoinCountEl) menuCoinCountEl.innerText = totalCoins;
    if (scoreDisplayEl) scoreDisplayEl.innerText = score;
    if (levelDisplayEl) levelDisplayEl.innerText = `LEVEL ${level}`;
    if (bestScoreDisplayEl) bestScoreDisplayEl.innerText = bestScore;
}

// ניהול הטאבים בחנות/מפות
document.getElementById('tab-btn-shop')?.addEventListener('click', () => {
    document.getElementById('tab-shop')?.classList.remove('hidden');
    document.getElementById('tab-maps')?.classList.add('hidden');
    document.getElementById('tab-btn-shop')?.classList.add('active');
    document.getElementById('tab-btn-maps')?.classList.remove('active');
});

document.getElementById('tab-btn-maps')?.addEventListener('click', () => {
    document.getElementById('tab-maps')?.classList.remove('hidden');
    document.getElementById('tab-shop')?.classList.add('hidden');
    document.getElementById('tab-btn-maps')?.classList.add('active');
    document.getElementById('tab-btn-shop')?.classList.remove('active');
});

// ניהול מפות ועדכון מחירי המפות (3000 ו-4000)
function updateMapSelectorUI() {
    const maps = [
        { id: 'day', card: 'map-card-day', btn: 'select-map-day', cost: 0 },
        { id: 'sunset', card: 'map-card-sunset', btn: 'select-map-sunset', cost: 3000 },
        { id: 'space', card: 'map-card-space', btn: 'select-map-space', cost: 4000 }
    ];

    maps.forEach(m => {
        const cardEl = document.getElementById(m.card);
        const btnEl = document.getElementById(m.btn);
        if (!cardEl || !btnEl) return;

        const isUnlocked = unlockedMaps.includes(m.id);
        const isSelected = currentMap === m.id;

        if (isSelected) {
            cardEl.classList.add('selected');
            btnEl.innerText = 'SELECTED';
            btnEl.className = 'map-btn selected-btn';
        } else if (isUnlocked) {
            cardEl.classList.remove('selected');
            btnEl.innerText = 'USE';
            btnEl.className = 'map-btn';
        } else {
            cardEl.classList.remove('selected');
            btnEl.innerText = `🪙 ${m.cost}`;
            btnEl.className = 'map-btn';
        }
    });
}

function handleMapClick(mapId, cost) {
    if (unlockedMaps.includes(mapId)) {
        currentMap = mapId;
    } else if (totalCoins >= cost) {
        totalCoins -= cost;
        unlockedMaps.push(mapId);
        currentMap = mapId;
        localStorage.setItem('cannon_total_coins', totalCoins);
        localStorage.setItem('cannon_unlocked_maps', JSON.stringify(unlockedMaps));
    }
    localStorage.setItem('cannon_current_map', currentMap);
    updateUI();
    updateMapSelectorUI();
}

document.getElementById('select-map-day')?.addEventListener('click', () => handleMapClick('day', 0));
document.getElementById('select-map-sunset')?.addEventListener('click', () => handleMapClick('sunset', 3000));
document.getElementById('select-map-space')?.addEventListener('click', () => handleMapClick('space', 4000));

// שליטה בתנועת התותח (מגע / עכבר)
function handlePointerMove(e) {
    if (gameState !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    cannon.targetX = clientX - rect.left;
}

window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('touchmove', handlePointerMove, { passive: true });

// התחלת המשחק
function startGame() {
    gameState = 'PLAYING';
    score = 0;
    level = 1;
    bullets = [];
    targets = [];
    coinsList = [];
    particles = [];
    floatingTexts = [];
    cannon.x = width / 2;
    cannon.targetX = width / 2;
    
    mainMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    
    spawnTarget();
    spawnTarget();
    updateUI();
}

document.getElementById('start-btn')?.addEventListener('click', startGame);
document.getElementById('restart-btn')?.addEventListener('click', startGame);
document.getElementById('to-menu-btn')?.addEventListener('click', () => {
    gameState = 'MENU';
    gameOverMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    updateUI();
    updateMapSelectorUI();
});

// יצירת בלונים/מטרות
function spawnTarget() {
    const radius = Math.random() * 18 + 24;
    const baseHp = Math.floor(Math.random() * (level * 8)) + 4;
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    targets.push({
        x: Math.random() * (width - radius * 2) + radius,
        y: -radius - 20,
        vx: (Math.random() - 0.5) * 140,
        vy: Math.random() * 40 + 20,
        radius: radius,
        hp: baseHp,
        maxHp: baseHp,
        color: color,
        splitCount: baseHp > 10 ? 2 : 0
    });
}

// לולאת המשחק הראשי (Game Loop)
let lastTime = performance.now();
function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    drawBackground();

    if (gameState === 'PLAYING') {
        // תנועת התותח
        cannon.x += (cannon.targetX - cannon.x) * 18 * dt;
        cannon.x = Math.max(cannon.width / 2, Math.min(width - cannon.width / 2, cannon.x));

        // ירי כדורים כפולים
        if (now - lastShootTime > shootInterval) {
            bullets.push({ x: cannon.x - 10, y: cannon.y - 18, vy: -950, radius: 4 });
            bullets.push({ x: cannon.x + 10, y: cannon.y - 18, vy: -950, radius: 4 });
            lastShootTime = now;
        }

        // יצירת מטרות חדשות
        if (targets.length < Math.min(7, 3 + Math.floor(level / 2)) && Math.random() < 0.03) {
            spawnTarget();
        }

        updateBullets(dt);
        updateTargets(dt);
        updateCoins(dt);
        updateParticles(dt);
        updateFloatingTexts(dt);
        drawCannon();
    }

    requestAnimationFrame(gameLoop);
}

// 1. מנגנון המגנט (איסוף אוטומטי של המטבעות לתותח מכל הלוח)
function updateCoins(dt) {
    for (let i = coinsList.length - 1; i >= 0; i--) {
        const c = coinsList[i];
        
        // חישוב המרחק והכיוון לתותח
        const dx = cannon.x - c.x;
        const dy = cannon.y - c.y;
        const distToCannon = Math.hypot(dx, dy);

        // משיכה מגנטית רציפה ומהירה לתותח מכל מרחק
        const pullSpeed = 750; 
        c.vx += (dx / distToCannon) * pullSpeed * dt;
        c.vy += (dy / distToCannon) * pullSpeed * dt;

        c.x += c.vx * dt;
        c.y += c.vy * dt;

        // איסוף מוחלט כשהמטבע מגיע לתותח
        if (distToCannon < c.radius + 28) {
            totalCoins += c.value;
            localStorage.setItem('cannon_total_coins', totalCoins);
            updateUI();
            
            // טקסט צף קטן בעת איסוף המטבע
            floatingTexts.push({
                x: c.x,
                y: c.y,
                text: `+${c.value}`,
                color: '#facc15',
                alpha: 1,
                vy: -40
            });

            coinsList.splice(i, 1);
            continue;
        }

        // ציור המטבע
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();

        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
        ctx.restore();
    }
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y += b.vy * dt;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fde047';
        ctx.fill();

        if (b.y < -10) {
            bullets.splice(i, 1);
        }
    }
}

function updateTargets(dt) {
    const floorY = height - 55;
    for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.x += t.vx * dt;
        t.y += t.vy * dt;

        // התנגשות בקירות צדדיים
        if (t.x - t.radius < 0) {
            t.x = t.radius;
            t.vx = Math.abs(t.vx);
        } else if (t.x + t.radius > width) {
            t.x = width - t.radius;
            t.vx = -Math.abs(t.vx);
        }

        // קפיצה כשהבלון נוגע ברצפה
        if (t.y + t.radius > floorY) {
            t.y = floorY - t.radius;
            t.vy = -Math.abs(t.vy) * 0.98;
        } else {
            t.vy += 220 * dt; // כוח כבידה
        }

        // התנגשות בתותח (פסילה)
        const distToCannon = Math.hypot(cannon.x - t.x, cannon.y - t.y);
        if (distToCannon < t.radius + 18) {
            triggerGameOver();
            return;
        }

        // התנגשות כדורים בבלונים
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.hypot(b.x - t.x, b.y - t.y) < t.radius + b.radius) {
                t.hp -= cannonPowerLevel;
                score += 5;
                bullets.splice(j, 1);

                // יצירת חלקיקים במכה
                for (let k = 0; k < 3; k++) {
                    particles.push({
                        x: b.x,
                        y: b.y,
                        vx: (Math.random() - 0.5) * 100,
                        vy: (Math.random() - 0.5) * 100,
                        radius: Math.random() * 3 + 1,
                        color: t.color,
                        alpha: 1
                    });
                }

                if (t.hp <= 0) {
                    // פליטת מטבעות לפי רמת הבלון
                    const coinsCount = Math.max(1, Math.floor(t.maxHp / 5));
                    for (let c = 0; c < coinsCount; c++) {
                        coinsList.push({
                            x: t.x + (Math.random() - 0.5) * 10,
                            y: t.y + (Math.random() - 0.5) * 10,
                            vx: (Math.random() - 0.5) * 180,
                            vy: -120,
                            radius: 7,
                            value: coinMultiLevel
                        });
                    }

                    targets.splice(i, 1);
                    level = 1 + Math.floor(score / 400);
                    updateUI();
                    break;
                }
            }
        }

        // ציור הבלון
        if (targets[i]) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = t.color;
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(12, t.radius * 0.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.hp, t.x, t.y);
            ctx.restore();
        }
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= dt * 2.5;
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.alpha -= dt * 1.8;
        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
        } else {
            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }
}

function drawCannon() {
    ctx.save();
    ctx.translate(cannon.x, cannon.y);

    // קנאי התותח (כפולים)
    ctx.fillStyle = '#475569';
    ctx.fillRect(-14, -22, 8, 18);
    ctx.fillRect(6, -22, 8, 18);

    // גוף התותח
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0);
    ctx.fill();

    // גלגלים
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-16, 6, 8, 0, Math.PI * 2);
    ctx.arc(16, 6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, height);
    if (currentMap === 'sunset') {
        grad.addColorStop(0, '#4c1d95');
        grad.addColorStop(0.5, '#c026d3');
        grad.addColorStop(1, '#db2777');
    } else if (currentMap === 'space') {
        grad.addColorStop(0, '#030712');
        grad.addColorStop(0.5, '#0b0f19');
        grad.addColorStop(1, '#1e1b4b');
    } else { // day
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.7, '#38bdf8');
        grad.addColorStop(1, '#bae6fd');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('cannon_best_score', bestScore);
    }
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-coins').innerText = totalCoins;
    document.getElementById('final-best').innerText = bestScore;
    gameOverMenu.classList.remove('hidden');
}

// אתחול UI ראשוני
updateUI();
updateMapSelectorUI();
requestAnimationFrame(gameLoop);