window.addEventListener('DOMContentLoaded', () => {

    // --- Background Ambient Music System ---
    const MENU_MUSIC_URL = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=space-ambient-111154.mp3';
    
    let menuMusic = new Audio(MENU_MUSIC_URL);
    menuMusic.loop = true;
    menuMusic.volume = 0.3;

    function playMenuMusic() {
        if (menuMusic.paused) {
            menuMusic.play().catch(err => {
                console.warn("Autoplay blocked, waiting for user interaction:", err);
            });
        }
    }

    function stopMenuMusic() {
        menuMusic.pause();
        menuMusic.currentTime = 0;
    }

    // ניסיון הפעלה מיידי בטעינה
    playMenuMusic();

    // --- Audio Initializer Helper ---
    let audioUnlocked = false;
    function unlockAudio() {
        if (!audioUnlocked) {
            initAudio();
            audioUnlocked = true;
        }
        playMenuMusic(); // מבטיח שהמוזיקה תופעל בנגיעה הראשונה במידה והדפדפן חסם אוטופליי
    }

    // --- Splash Screen ---
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        const hideSplash = () => {
            unlockAudio();
            splashScreen.style.opacity = '0';
            setTimeout(() => { splashScreen.style.display = 'none'; }, 500);
            window.removeEventListener('pointerdown', hideSplash);
        };
        window.addEventListener('pointerdown', hideSplash);
    }

    // --- Mobile Detection ---
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }
    if (!isMobileDevice()) {
        const warning = document.getElementById('mobile-only-warning');
        if (warning) warning.style.display = 'flex';
    }

    function requestFullScreen() {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
    }

    // --- Canvas Setup ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    let width, height, dpr;
    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.scale(dpr, dpr);
        initClouds();
    }

    // --- Persistent Upgrades & Maps Data ---
    let totalCoins = parseInt(localStorage.getItem('cannon_total_coins')) || 0;
    let highScore = parseInt(localStorage.getItem('cannon_high_score_2d')) || 0;

    let fireRateLevel = parseInt(localStorage.getItem('cannon_lvl_firerate')) || 1;
    let firePowerLevel = parseInt(localStorage.getItem('cannon_lvl_firepower')) || 1;
    let magnetLevel = parseInt(localStorage.getItem('cannon_lvl_magnet')) || 0;
    let hasMultishot = localStorage.getItem('cannon_has_multishot') === 'true';

    let currentMap = localStorage.getItem('cannon_selected_map') || 'day';
    let unlockedMaps = JSON.parse(localStorage.getItem('cannon_unlocked_maps')) || ['day'];

    // --- Sound Effects System ---
    let audioCtx = null;
    let masterGainNode = null;
    let masterVolume = 0.25;

    function initAudio() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                masterGainNode = audioCtx.createGain();
                masterGainNode.gain.value = masterVolume;
                masterGainNode.connect(audioCtx.destination);
            } else if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        } catch (e) {}
    }

    function playSound(type) {
        if (!audioCtx || isPaused || masterVolume <= 0) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.connect(gain);
            gain.connect(masterGainNode);

            if (type === 'shoot') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'coin') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(987.77, now);
                osc.frequency.setValueAtTime(1318.51, now + 0.08);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.16);
                osc.start(now);
                osc.stop(now + 0.16);
            } else if (type === 'explode') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch(e) {}
    }

    // --- Particles & Coins ---
    const particles = [];
    const coinsList = [];

    function spawnCoins(x, y, count = 3) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.random() * Math.PI) + Math.PI;
            const speed = Math.random() * 180 + 120;
            coinsList.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 10, gravity: 450, value: 1
            });
        }
    }

    function updateCoins(dt) {
        const floorY = height - 60;
        const magnetRadius = 150 + (magnetLevel * 120);
        const magnetSpeed = 5 + (magnetLevel * 4);

        for (let i = coinsList.length - 1; i >= 0; i--) {
            const c = coinsList[i];
            c.vy += c.gravity * dt;
            c.x += c.vx * dt;
            c.y += c.vy * dt;

            if (c.y + c.radius >= floorY) {
                c.y = floorY - c.radius;
                c.vy = -c.vy * 0.4;
                c.vx *= 0.8;
            }

            const distToCannon = Math.hypot(c.x - cannon.x, c.y - cannon.y);
            if (distToCannon < magnetRadius) {
                c.vx += (cannon.x - c.x) * magnetSpeed * dt;
                c.vy += (cannon.y - c.y) * magnetSpeed * dt;
            }

            if (distToCannon < c.radius + 28) {
                totalCoins += c.value;
                localStorage.setItem('cannon_total_coins', totalCoins);
                updateUI();
                playSound('coin');
                coinsList.splice(i, 1);
                continue;
            }

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
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
            ctx.restore();
        }
    }

    function createExplosion(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 40;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: color, alpha: 1,
                decay: Math.random() * 1.5 + 1
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay * dt;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // --- Environment Backgrounds ---
    const clouds = [];
    function initClouds() {
        clouds.length = 0;
        for (let i = 0; i < 4; i++) {
            clouds.push({
                x: Math.random() * width,
                y: Math.random() * (height * 0.25) + 40,
                speed: Math.random() * 15 + 10,
                scale: Math.random() * 0.5 + 0.8
            });
        }
    }

    function drawEnvironment() {
        if (currentMap === 'sunset') {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
            skyGrad.addColorStop(0, '#4c1d95');
            skyGrad.addColorStop(0.5, '#c026d3');
            skyGrad.addColorStop(1, '#f97316');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#31104b';
            ctx.beginPath();
            ctx.moveTo(0, height - 60);
            ctx.lineTo(width * 0.25, height - 190);
            ctx.lineTo(width * 0.5, height - 60);
            ctx.lineTo(width * 0.8, height - 220);
            ctx.lineTo(width, height - 60);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fill();
        } else if (currentMap === 'space') {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#38bdf8';
            for (let i = 0; i < 20; i++) {
                const sx = (i * 97) % width;
                const sy = (i * 131) % (height * 0.7);
                ctx.fillRect(sx, sy, 2, 2);
            }

            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.moveTo(0, height - 60);
            ctx.lineTo(width * 0.3, height - 160);
            ctx.lineTo(width * 0.6, height - 60);
            ctx.lineTo(width, height - 140);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fill();
        } else {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
            skyGrad.addColorStop(0, '#38bdf8');
            skyGrad.addColorStop(0.6, '#bae6fd');
            skyGrad.addColorStop(1, '#e0f2fe');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(0, height - 60);
            ctx.lineTo(width * 0.2, height - 180);
            ctx.lineTo(width * 0.45, height - 60);
            ctx.lineTo(width * 0.75, height - 210);
            ctx.lineTo(width, height - 60);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fill();
        }

        if (currentMap !== 'space') {
            ctx.fillStyle = currentMap === 'sunset' ? 'rgba(253, 186, 116, 0.6)' : 'rgba(255, 255, 255, 0.85)';
            clouds.forEach(c => {
                if (gameStarted && !isPaused) c.x += c.speed * 0.016;
                if (c.x - 100 > width) c.x = -100;

                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.scale(c.scale, c.scale);
                ctx.beginPath();
                ctx.arc(0, 0, 25, 0, Math.PI * 2);
                ctx.arc(20, -10, 20, 0, Math.PI * 2);
                ctx.arc(40, 0, 22, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        }

        const floorY = height - 60;
        ctx.fillStyle = currentMap === 'space' ? '#0f172a' : (currentMap === 'sunset' ? '#451a03' : '#15803d');
        ctx.fillRect(0, floorY, width, 20);
        ctx.fillStyle = currentMap === 'space' ? '#020617' : (currentMap === 'sunset' ? '#292524' : '#78350f');
        ctx.fillRect(0, floorY + 20, width, 40);

        ctx.strokeStyle = currentMap === 'space' ? '#38bdf8' : (currentMap === 'sunset' ? '#f97316' : '#4ade80');
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(width, floorY);
        ctx.stroke();
    }

    // --- State & UI Updates ---
    let gameStarted = false, isPaused = false;
    let currentLevel = 1, levelProgress = 0;
    const maxLevelProgress = 100;
    let score = 0;

    function updateUI() {
        const coinsVal = document.getElementById('coins-val');
        const startCoins = document.getElementById('start-coins');
        const startBest = document.getElementById('start-best-score');

        if (coinsVal) coinsVal.innerText = totalCoins;
        if (startCoins) startCoins.innerText = totalCoins;
        if (startBest) startBest.innerText = highScore;

        const fireRateCost = fireRateLevel * 100;
        const firePowerCost = firePowerLevel * 150;
        const magnetCost = (magnetLevel + 1) * 200;

        document.getElementById('fire-rate-lvl').innerText = `Lvl ${fireRateLevel}`;
        document.getElementById('fire-rate-cost').innerText = fireRateCost;
        document.getElementById('buy-fire-rate-btn').disabled = totalCoins < fireRateCost;

        document.getElementById('fire-power-lvl').innerText = `Lvl ${firePowerLevel}`;
        document.getElementById('fire-power-cost').innerText = firePowerCost;
        document.getElementById('buy-fire-power-btn').disabled = totalCoins < firePowerCost;

        const magnetLvlEl = document.getElementById('magnet-lvl');
        const magnetCostEl = document.getElementById('magnet-cost');
        const buyMagnetBtn = document.getElementById('buy-magnet-btn');

        if (magnetLvlEl) magnetLvlEl.innerText = `Lvl ${magnetLevel}`;
        if (magnetCostEl) magnetCostEl.innerText = magnetCost;
        if (buyMagnetBtn) buyMagnetBtn.disabled = totalCoins < magnetCost;

        const multishotBtn = document.getElementById('buy-multishot-btn');
        if (hasMultishot) {
            document.getElementById('multishot-status').innerText = 'UNLOCKED';
            multishotBtn.innerText = 'OWNED';
            multishotBtn.disabled = true;
        } else {
            document.getElementById('multishot-status').innerText = 'Locked';
            multishotBtn.disabled = totalCoins < 500;
        }

        updateMapSelectorUI();
    }

    function updateMapSelectorUI() {
        const maps = [
            { id: 'day', card: 'map-card-day', btn: 'select-map-day', cost: 0 },
            { id: 'sunset', card: 'map-card-sunset', btn: 'select-map-sunset', cost: 500 },
            { id: 'space', card: 'map-card-space', btn: 'select-map-space', cost: 1500 }
        ];

        maps.forEach(m => {
            const cardEl = document.getElementById(m.card);
            const btnEl = document.getElementById(m.btn);
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

    updateUI();

    function updateLevelUI() {
        const progressFill = document.getElementById('level-progress-fill');
        const levelText = document.getElementById('level-text');
        if (progressFill) progressFill.style.width = `${Math.min(100, (levelProgress / maxLevelProgress) * 100)}%`;
        if (levelText) levelText.innerText = `LEVEL ${currentLevel}`;
    }

    // --- HP Mechanics ---
    const maxHp = 1000;
    let currentHp = 1000;

    function updateHpBar() {
        const hpBar = document.getElementById('hp-bar');
        const hpText = document.getElementById('hp-text');
        if (!hpBar || !hpText) return;

        const percentage = Math.max(0, (currentHp / maxHp) * 100);
        hpBar.style.width = `${percentage}%`;
        hpText.innerText = `${Math.max(0, currentHp)} / ${maxHp}`;

        let colorHex = '#22c55e';
        if (percentage < 30) colorHex = '#ef4444';
        else if (percentage < 60) colorHex = '#eab308';
        hpBar.style.backgroundColor = colorHex;
    }

    // --- Cannon Entity ---
    let cannonColor = '#2563eb';
    const cannon = { x: 0, y: 0, targetX: 0 };

    window.changeCannonColor = function(hexColorStr) {
        cannonColor = hexColorStr;
    };

    function drawCannon() {
        const floorY = height - 60;
        cannon.y = floorY - 20;

        ctx.save();
        ctx.translate(cannon.x, cannon.y);

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-22, 10, 12, 0, Math.PI * 2);
        ctx.arc(22, 10, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        if (hasMultishot) {
            ctx.fillRect(-20, -30, 8, 30);
            ctx.fillRect(-4, -34, 8, 34);
            ctx.fillRect(12, -30, 8, 30);
        } else {
            ctx.fillRect(-16, -30, 10, 30);
            ctx.fillRect(6, -30, 10, 30);
        }

        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
        gradient.addColorStop(0, '#93c5fd');
        gradient.addColorStop(1, cannonColor);

        ctx.beginPath();
        ctx.arc(0, 0, 26, Math.PI, 0, false);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
    }

    // --- Bullets & Upgrades Logic ---
    const bullets = [];
    let shootTimer = 0;

    function spawnBullet() {
        const damage = firePowerLevel;
        if (hasMultishot) {
            bullets.push({ x: cannon.x - 16, y: cannon.y - 30, radius: 6, dmg: damage });
            bullets.push({ x: cannon.x, y: cannon.y - 34, radius: 6, dmg: damage });
            bullets.push({ x: cannon.x + 16, y: cannon.y - 30, radius: 6, dmg: damage });
        } else {
            bullets.push({ x: cannon.x - 11, y: cannon.y - 30, radius: 6, dmg: damage });
            bullets.push({ x: cannon.x + 11, y: cannon.y - 30, radius: 6, dmg: damage });
        }
    }

    function updateBullets(dt) {
        const speed = 1400 * dt;
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y -= speed;

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#facc15';
            ctx.fill();

            if (b.y < -10) bullets.splice(i, 1);
        }
    }

    // --- Rocks Mechanics ---
    const rocks = [];
    const rockColors = ['#ef4444', '#f97316', '#22c55e', '#06b6d4', '#a855f7'];

    function createRockVertices(radius) {
        const points = [];
        const numSides = 8;
        for (let i = 0; i < numSides; i++) {
            const angle = (i / numSides) * Math.PI * 2;
            const variance = radius * (0.85 + Math.random() * 0.3);
            points.push({ x: Math.cos(angle) * variance, y: Math.sin(angle) * variance });
        }
        return points;
    }

    function spawnRock(x, y, hp, sizeIndex) {
        const radii = [28, 42, 60];
        const radius = radii[sizeIndex];
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];

        rocks.push({
            x: x !== undefined ? x : Math.random() * (width - 100) + 50,
            y: y !== undefined ? y : 80,
            vx: (Math.random() > 0.5 ? 1 : -1) * (70 + Math.random() * 40),
            vy: 0,
            gravity: 350,
            bounceForce: -(260 + sizeIndex * 40),
            radius: radius,
            hp: hp,
            maxHp: hp,
            sizeIndex: sizeIndex,
            color: color,
            vertices: createRockVertices(radius)
        });
    }

    function updateRocks(dt) {
        const floorY = height - 60;

        for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];
            r.vy += r.gravity * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;

            if (r.x - r.radius <= 0) { r.x = r.radius; r.vx = Math.abs(r.vx); }
            else if (r.x + r.radius >= width) { r.x = width - r.radius; r.vx = -Math.abs(r.vx); }

            if (r.y + r.radius >= floorY) { r.y = floorY - r.radius; r.vy = r.bounceForce; }

            const distToCannon = Math.hypot(r.x - cannon.x, r.y - cannon.y);
            if (distToCannon < r.radius + 26) {
                currentHp -= 25;
                updateHpBar();
                playSound('hit');
                createExplosion(cannon.x, cannon.y - 10, '#ef4444', 12);
                r.vy = r.bounceForce;

                if (currentHp <= 0) { gameOver(); return; }
            }

            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                const distToBullet = Math.hypot(r.x - b.x, r.y - b.y);

                if (distToBullet < r.radius + b.radius) {
                    bullets.splice(j, 1);
                    r.hp -= b.dmg;
                    score += 10;
                    levelProgress += 3;

                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;

                    updateLevelUI();
                    playSound('hit');
                    createExplosion(b.x, b.y, r.color, 3);

                    if (r.hp <= 0) {
                        playSound('explode');
                        createExplosion(r.x, r.y, r.color, 20);
                        spawnCoins(r.x, r.y, (r.sizeIndex + 1) * 3);

                        if (r.sizeIndex > 0) {
                            const newHp = Math.ceil(r.maxHp / 2);
                            spawnRock(r.x - 18, r.y, newHp, r.sizeIndex - 1);
                            spawnRock(r.x + 18, r.y, newHp, r.sizeIndex - 1);
                        }

                        rocks.splice(i, 1);

                        if (levelProgress >= maxLevelProgress) {
                            currentLevel++;
                            levelProgress = 0;
                            updateLevelUI();
                        }
                        break;
                    }
                }
            }

            if (rocks[i]) {
                ctx.save();
                ctx.translate(r.x, r.y);
                ctx.beginPath();
                ctx.moveTo(r.vertices[0].x, r.vertices[0].y);
                for (let v = 1; v < r.vertices.length; v++) {
                    ctx.lineTo(r.vertices[v].x, r.vertices[v].y);
                }
                ctx.closePath();
                ctx.fillStyle = r.color;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = `900 ${Math.max(16, r.radius * 0.65)}px Rubik, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(Math.max(0, r.hp), 0, 0);
                ctx.restore();
            }
        }

        if (rocks.length === 0 && gameStarted && !isPaused) {
            spawnRock(width * 0.3, 80, Math.max(5, 8 * currentLevel), 2);
            spawnRock(width * 0.7, 80, Math.max(4, 6 * currentLevel), 1);
        }
    }

    // --- Controls ---
    let isDragging = false, isFiring = false, touchStartX = 0;

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        unlockAudio();
        isDragging = true; isFiring = true;
        touchStartX = e.touches[0].clientX;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging && gameStarted && !isPaused) {
            const currentX = e.touches[0].clientX;
            const deltaX = currentX - touchStartX;
            cannon.targetX += deltaX;
            touchStartX = currentX;
        }
    }, { passive: false });

    const stopInput = (e) => { if (e && e.preventDefault) e.preventDefault(); isDragging = false; isFiring = false; };
    canvas.addEventListener('touchend', stopInput, { passive: false });

    // --- Menu Navigation & Purchases ---
    const playTabBtn = document.getElementById('tab-play-btn');
    const shopTabBtn = document.getElementById('tab-shop-btn');
    const mapsTabBtn = document.getElementById('tab-maps-btn');

    const playTabContent = document.getElementById('tab-play');
    const shopTabContent = document.getElementById('tab-shop');
    const mapsTabContent = document.getElementById('tab-maps');

    function switchTab(activeBtn, activeContent) {
        unlockAudio();
        [playTabBtn, shopTabBtn, mapsTabBtn].forEach(b => b?.classList.remove('active'));
        [playTabContent, shopTabContent, mapsTabContent].forEach(c => c?.classList.add('hidden'));

        activeBtn?.classList.add('active');
        activeContent?.classList.remove('hidden');
    }

    playTabBtn?.addEventListener('click', () => switchTab(playTabBtn, playTabContent));
    shopTabBtn?.addEventListener('click', () => switchTab(shopTabBtn, shopTabContent));
    mapsTabBtn?.addEventListener('click', () => switchTab(mapsTabBtn, mapsTabContent));

    // Shop Buy Handlers
    document.getElementById('buy-fire-rate-btn')?.addEventListener('click', () => {
        const cost = fireRateLevel * 100;
        if (totalCoins >= cost) {
            totalCoins -= cost;
            fireRateLevel++;
            localStorage.setItem('cannon_total_coins', totalCoins);
            localStorage.setItem('cannon_lvl_firerate', fireRateLevel);
            updateUI();
            playSound('coin');
        }
    });

    document.getElementById('buy-fire-power-btn')?.addEventListener('click', () => {
        const cost = firePowerLevel * 150;
        if (totalCoins >= cost) {
            totalCoins -= cost;
            firePowerLevel++;
            localStorage.setItem('cannon_total_coins', totalCoins);
            localStorage.setItem('cannon_lvl_firepower', firePowerLevel);
            updateUI();
            playSound('coin');
        }
    });

    document.getElementById('buy-magnet-btn')?.addEventListener('click', () => {
        const cost = (magnetLevel + 1) * 200;
        if (totalCoins >= cost) {
            totalCoins -= cost;
            magnetLevel++;
            localStorage.setItem('cannon_total_coins', totalCoins);
            localStorage.setItem('cannon_lvl_magnet', magnetLevel);
            updateUI();
            playSound('coin');
        }
    });

    document.getElementById('buy-multishot-btn')?.addEventListener('click', () => {
        if (!hasMultishot && totalCoins >= 500) {
            totalCoins -= 500;
            hasMultishot = true;
            localStorage.setItem('cannon_total_coins', totalCoins);
            localStorage.setItem('cannon_has_multishot', 'true');
            updateUI();
            playSound('coin');
        }
    });

    // Maps Selection & Purchase Handlers
    function handleMapClick(mapId, cost) {
        unlockAudio();
        if (unlockedMaps.includes(mapId)) {
            currentMap = mapId;
            localStorage.setItem('cannon_selected_map', currentMap);
            updateUI();
        } else if (totalCoins >= cost) {
            totalCoins -= cost;
            unlockedMaps.push(mapId);
            currentMap = mapId;
            localStorage.setItem('cannon_total_coins', totalCoins);
            localStorage.setItem('cannon_unlocked_maps', JSON.stringify(unlockedMaps));
            localStorage.setItem('cannon_selected_map', currentMap);
            updateUI();
            playSound('coin');
        }
    }

    document.getElementById('select-map-day')?.addEventListener('click', () => handleMapClick('day', 0));
    document.getElementById('select-map-sunset')?.addEventListener('click', () => handleMapClick('sunset', 500));
    document.getElementById('select-map-space')?.addEventListener('click', () => handleMapClick('space', 1500));

    // --- State Transitions ---
    function resetGame() {
        score = 0; currentHp = maxHp; currentLevel = 1; levelProgress = 0;
        rocks.length = 0; bullets.length = 0; particles.length = 0; coinsList.length = 0;
        cannon.x = width / 2;
        cannon.targetX = width / 2;

        const scoreVal = document.getElementById('score-val');
        if (scoreVal) scoreVal.innerText = '0';

        updateHpBar();
        updateLevelUI();
        updateUI();
    }

    function gameOver() {
        gameStarted = false; isFiring = false; isDragging = false;
        playMenuMusic(); // מחזיר את מוזיקת הרקע כשחוזרים לטאב הפסידה/תפריט

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('cannon_high_score_2d', highScore);
        }

        const gameOverModal = document.getElementById('game-over-modal');
        const finalScoreVal = document.getElementById('final-score-val');
        const finalCoinsVal = document.getElementById('final-coins-val');
        const bestScoreVal = document.getElementById('best-score-val');

        if (finalScoreVal) finalScoreVal.innerText = score;
        if (finalCoinsVal) finalCoinsVal.innerText = totalCoins;
        if (bestScoreVal) bestScoreVal.innerText = highScore;
        if (gameOverModal) gameOverModal.classList.remove('hidden');
    }

    function returnToMainMenu() {
        gameStarted = false;
        isPaused = false;
        isFiring = false;
        isDragging = false;
        playMenuMusic(); // מחזיר את המוזיקה בחזרה לתפריט הראשי

        document.getElementById('game-over-modal')?.classList.add('hidden');
        document.getElementById('pause-menu')?.classList.add('hidden');
        document.getElementById('start-overlay')?.classList.remove('hidden');

        updateUI();
    }

    document.getElementById('start-btn')?.addEventListener('click', () => {
        unlockAudio();
        stopMenuMusic(); // מפסיק את מוזיקת התפריט כשמתחילים משחק
        requestFullScreen();
        resetGame();
        gameStarted = true;
        isPaused = false;
        document.getElementById('start-overlay')?.classList.add('hidden');
    });

    document.getElementById('pause-btn')?.addEventListener('click', () => {
        if (!gameStarted) return;
        isPaused = true;
        document.getElementById('pause-menu')?.classList.remove('hidden');
    });

    document.getElementById('resume-btn')?.addEventListener('click', () => {
        unlockAudio();
        requestFullScreen();
        isPaused = false;
        document.getElementById('pause-menu')?.classList.add('hidden');
    });

    document.getElementById('pause-home-btn')?.addEventListener('click', returnToMainMenu);
    document.getElementById('home-btn')?.addEventListener('click', returnToMainMenu);

    document.getElementById('restart-btn')?.addEventListener('click', () => {
        unlockAudio();
        stopMenuMusic(); // מפסיק מוזיקה אם הייתה פעילה ב-Game Over
        requestFullScreen();
        document.getElementById('game-over-modal')?.classList.add('hidden');
        resetGame();
        isPaused = false;
        gameStarted = true;
    });

    // --- Main Game Loop ---
    let lastTime = performance.now();

    function gameLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        drawEnvironment();

        if (gameStarted && !isPaused) {
            cannon.targetX = Math.max(30, Math.min(width - 30, cannon.targetX));
            cannon.x += (cannon.targetX - cannon.x) * 0.25;

            const fireInterval = Math.max(0.02, 0.075 - (fireRateLevel * 0.007));

            shootTimer += dt;
            if (isFiring && shootTimer >= fireInterval) {
                shootTimer = 0;
                spawnBullet();
                playSound('shoot');
            }

            updateBullets(dt);
            updateRocks(dt);
            updateCoins(dt);
            updateParticles(dt);
        }

        drawCannon();
        requestAnimationFrame(gameLoop);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(gameLoop);
});