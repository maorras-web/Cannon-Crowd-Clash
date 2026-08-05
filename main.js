window.addEventListener('DOMContentLoaded', () => {

    // --- Splash Screen ---
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        const hideSplash = () => {
            splashScreen.style.opacity = '0';
            setTimeout(() => { splashScreen.style.display = 'none'; }, 500);
            window.removeEventListener('pointerdown', hideSplash);
        };
        window.addEventListener('pointerdown', hideSplash);
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

    // --- Audio System ---
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
        } else if (currentMap === 'space') {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#38bdf8';
            for (let i = 0; i < 20; i++) {
                ctx.fillRect((i * 97) % width, (i * 131) % (height * 0.7), 2, 2);
            }
        } else {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
            skyGrad.addColorStop(0, '#38bdf8');
            skyGrad.addColorStop(0.6, '#bae6fd');
            skyGrad.addColorStop(1, '#e0f2fe');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, width, height);
        }

        const floorY = height - 60;
        ctx.fillStyle = currentMap === 'space' ? '#0f172a' : (currentMap === 'sunset' ? '#451a03' : '#15803d');
        ctx.fillRect(0, floorY, width, 20);
        ctx.fillStyle = currentMap === 'space' ? '#020617' : (currentMap === 'sunset' ? '#292524' : '#78350f');
        ctx.fillRect(0, floorY + 20, width, 40);
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

        const frLvl = document.getElementById('fire-rate-lvl');
        const frCost = document.getElementById('fire-rate-cost');
        const frBtn = document.getElementById('buy-fire-rate-btn');
        if (frLvl) frLvl.innerText = `LVL: ${fireRateLevel}`;
        if (frCost) frCost.innerText = fireRateCost;
        if (frBtn) frBtn.disabled = totalCoins < fireRateCost;

        const fpLvl = document.getElementById('fire-power-lvl');
        const fpCost = document.getElementById('fire-power-cost');
        const fpBtn = document.getElementById('buy-fire-power-btn');
        if (fpLvl) fpLvl.innerText = `LVL: ${firePowerLevel}`;
        if (fpCost) fpCost.innerText = firePowerCost;
        if (fpBtn) fpBtn.disabled = totalCoins < firePowerCost;

        const magnetLvlEl = document.getElementById('magnet-lvl');
        const magnetCostEl = document.getElementById('magnet-cost');
        const buyMagnetBtn = document.getElementById('buy-magnet-btn');
        if (magnetLvlEl) magnetLvlEl.innerText = `LVL: ${magnetLevel}`;
        if (magnetCostEl) magnetCostEl.innerText = magnetCost;
        if (buyMagnetBtn) buyMagnetBtn.disabled = totalCoins < magnetCost;

        const multishotBtn = document.getElementById('buy-multishot-btn');
        const multishotStatus = document.getElementById('multishot-status');
        if (hasMultishot) {
            if (multishotStatus) multishotStatus.innerText = 'UNLOCKED';
            if (multishotBtn) {
                multishotBtn.innerText = 'OWNED';
                multishotBtn.disabled = true;
            }
        } else {
            if (multishotStatus) multishotStatus.innerText = 'Locked';
            if (multishotBtn) multishotBtn.disabled = totalCoins < 500;
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
    }

    // --- Cannon & Bullets ---
    const cannon = { x: 0, y: 0, targetX: 0 };
    function drawCannon() {
        const floorY = height - 60;
        cannon.y = floorY - 20;

        ctx.save();
        ctx.translate(cannon.x, cannon.y);
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(0, 0, 24, Math.PI, 0, false);
        ctx.fill();
        ctx.restore();
    }

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

    // --- Rocks ---
    const rocks = [];
    function spawnRock(x, y, hp, sizeIndex) {
        const radii = [28, 42, 60];
        rocks.push({
            x: x || width / 2, y: y || 80,
            vx: (Math.random() > 0.5 ? 1 : -1) * 80, vy: 0,
            gravity: 350, bounceForce: -260,
            radius: radii[sizeIndex], hp: hp, maxHp: hp, sizeIndex: sizeIndex
        });
    }

    function updateRocks(dt) {
        const floorY = height - 60;
        for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];
            r.vy += r.gravity * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;

            if (r.x - r.radius <= 0 || r.x + r.radius >= width) r.vx = -r.vx;
            if (r.y + r.radius >= floorY) { r.y = floorY - r.radius; r.vy = r.bounceForce; }

            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
        }
    }

    // --- Controls ---
    let isDragging = false, touchStartX = 0;
    canvas.addEventListener('touchstart', (e) => {
        isDragging = true; touchStartX = e.touches[0].clientX;
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (isDragging) {
            const currentX = e.touches[0].clientX;
            cannon.targetX += (currentX - touchStartX);
            touchStartX = currentX;
        }
    }, { passive: true });

    window.addEventListener('touchend', () => { isDragging = false; });

    // --- Menu Navigation & Purchases ---
    const playTabBtn = document.getElementById('tab-play-btn');
    const shopTabBtn = document.getElementById('tab-shop-btn');
    const mapsTabBtn = document.getElementById('tab-maps-btn');

    const playTabContent = document.getElementById('tab-play');
    const shopTabContent = document.getElementById('tab-shop');
    const mapsTabContent = document.getElementById('tab-maps');

    function switchTab(activeBtn, activeContent) {
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

    // Maps Handlers
    function handleMapClick(mapId, cost) {
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

    // Game Lifecycle
    function startGame() {
        initAudio();
        gameStarted = true;
        isPaused = false;
        score = 0;
        currentLevel = 1;
        levelProgress = 0;
        currentHp = maxHp;

        cannon.x = width / 2;
        cannon.targetX = width / 2;

        document.getElementById('start-menu')?.classList.add('hidden');
        document.getElementById('game-ui')?.classList.remove('hidden');

        spawnRock(width * 0.3, 80, 8, 2);
    }

    document.getElementById('start-btn')?.addEventListener('click', startGame);

    // Main Loop
    let lastTime = performance.now();
    function gameLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        ctx.clearRect(0, 0, width, height);
        drawEnvironment();

        if (gameStarted && !isPaused) {
            cannon.x += (cannon.targetX - cannon.x) * 0.2;
            shootTimer += dt;
            if (shootTimer >= Math.max(0.08, 0.25 - (fireRateLevel * 0.02))) {
                spawnBullet();
                playSound('shoot');
                shootTimer = 0;
            }
            updateBullets(dt);
            updateRocks(dt);
            updateCoins(dt);
            updateParticles(dt);
        }

        drawCannon();
        requestAnimationFrame(gameLoop);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(gameLoop);
});