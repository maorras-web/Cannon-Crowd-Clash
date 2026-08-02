window.addEventListener('DOMContentLoaded', () => {

    // --- 0. Mobile Detection & Fullscreen ---
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    if (!isMobileDevice()) {
        const warning = document.getElementById('mobile-only-warning');
        if (warning) warning.style.display = 'flex';
    }

    function requestFullScreen() {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        }
    }

    // --- 1. Canvas Setup (2D Context) ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    let width, height;
    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // --- 2. Audio Engine ---
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
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'explode') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch(e) {}
    }

    // --- 3. State & High Score ---
    let gameStarted = false, isPaused = false;
    let currentLevel = 1, levelProgress = 0;
    const maxLevelProgress = 100;
    let score = 0;
    let highScore = localStorage.getItem('cannon_high_score_2d') || 0;

    const startBestScoreEl = document.getElementById('start-best-score');
    if (startBestScoreEl) startBestScoreEl.innerText = highScore;

    function updateLevelUI() {
        const progressFill = document.getElementById('level-progress-fill');
        const levelText = document.getElementById('level-text');
        
        if (progressFill) {
            const percentage = Math.min(100, (levelProgress / maxLevelProgress) * 100);
            progressFill.style.width = `${percentage}%`;
        }
        if (levelText) {
            levelText.innerText = `LEVEL ${currentLevel}`;
        }
    }

    // --- 4. HP Mechanics ---
    const maxHp = 500;
    let currentHp = 500;

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

    // --- 5. Cannon Entity ---
    let cannonColor = '#2563eb';
    const cannon = {
        x: 0,
        y: 0,
        targetX: 0
    };

    window.changeCannonColor = function(hexColorStr) {
        cannonColor = hexColorStr;
    };

    function drawCannon() {
        const floorY = height - 40;
        cannon.y = floorY - 20;

        ctx.save();
        ctx.translate(cannon.x, cannon.y);

        // Barrels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-18, -25, 10, 25);
        ctx.fillRect(8, -25, 10, 25);

        // Dome
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(1, cannonColor);

        ctx.beginPath();
        ctx.arc(0, 0, 28, Math.PI, 0, false);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
    }

    // --- 6. Bullets ---
    const bullets = [];
    let shootTimer = 0;

    function spawnBullet() {
        bullets.push({ x: cannon.x - 13, y: cannon.y - 25, radius: 5 });
        bullets.push({ x: cannon.x + 13, y: cannon.y - 25, radius: 5 });
    }

    function updateBullets(dt) {
        const speed = 1200 * dt;
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y -= speed;

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffeb3b';
            ctx.fill();

            if (b.y < -10) {
                bullets.splice(i, 1);
            }
        }
    }

    // --- 7. Balls (2D Physics) ---
    const rocks = [];
    const rockColors = ['#ff3366', '#ff9900', '#22c55e', '#00ccff', '#a855f7'];

    function spawnRock(x, y, hp, sizeIndex) {
        const radii = [25, 38, 55];
        const radius = radii[sizeIndex];
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];

        rocks.push({
            x: x !== undefined ? x : Math.random() * (width - 100) + 50,
            y: y !== undefined ? y : 80,
            vx: (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 60),
            vy: 0,
            gravity: 800,
            bounceForce: -(380 + sizeIndex * 70),
            radius: radius,
            hp: hp,
            maxHp: hp,
            sizeIndex: sizeIndex,
            color: color
        });
    }

    function updateRocks(dt) {
        const floorY = height - 40;

        for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];

            r.vy += r.gravity * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;

            // Walls
            if (r.x - r.radius <= 0) {
                r.x = r.radius;
                r.vx = Math.abs(r.vx);
            } else if (r.x + r.radius >= width) {
                r.x = width - r.radius;
                r.vx = -Math.abs(r.vx);
            }

            // Floor
            if (r.y + r.radius >= floorY) {
                r.y = floorY - r.radius;
                r.vy = r.bounceForce;
            }

            // Hit Cannon
            const distToCannon = Math.hypot(r.x - cannon.x, r.y - cannon.y);
            if (distToCannon < r.radius + 28) {
                currentHp -= 100;
                updateHpBar();
                playSound('hit');
                r.vy = r.bounceForce;

                if (currentHp <= 0) {
                    gameOver();
                    return;
                }
            }

            // Hit Bullet
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                const distToBullet = Math.hypot(r.x - b.x, r.y - b.y);

                if (distToBullet < r.radius + b.radius) {
                    bullets.splice(j, 1);
                    r.hp--;
                    score += 10;
                    levelProgress += 2;

                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;

                    updateLevelUI();
                    playSound('hit');

                    if (r.hp <= 0) {
                        playSound('explode');

                        if (r.sizeIndex > 0) {
                            const newHp = Math.ceil(r.maxHp / 2);
                            spawnRock(r.x - 20, r.y, newHp, r.sizeIndex - 1);
                            spawnRock(r.x + 20, r.y, newHp, r.sizeIndex - 1);
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

            // Draw Ball
            if (rocks[i]) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);

                const grad = ctx.createRadialGradient(r.x - r.radius * 0.3, r.y - r.radius * 0.3, r.radius * 0.1, r.x, r.y, r.radius);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.3, r.color);
                grad.addColorStop(1, '#000000');

                ctx.fillStyle = grad;
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = `900 ${Math.max(16, r.radius * 0.7)}px Rubik, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(r.hp, r.x, r.y);
                ctx.restore();
            }
        }

        if (rocks.length === 0 && gameStarted && !isPaused) {
            spawnRock(width * 0.25, 80, 20 * currentLevel, 2);
            spawnRock(width * 0.75, 80, 15 * currentLevel, 1);
        }
    }

    // --- 8. Mobile Controls ---
    let isDragging = false, isFiring = false, touchStartX = 0;

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
        isFiring = true;
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

    // --- 9. Game State Transitions ---
    function resetGame() {
        score = 0; currentHp = maxHp; currentLevel = 1; levelProgress = 0;
        rocks.length = 0; bullets.length = 0;
        cannon.x = width / 2;
        cannon.targetX = width / 2;

        const scoreVal = document.getElementById('score-val');
        if (scoreVal) scoreVal.innerText = '0';

        updateHpBar();
        updateLevelUI();
    }

    function gameOver() {
        gameStarted = false; isFiring = false; isDragging = false;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('cannon_high_score_2d', highScore);
        }

        const gameOverModal = document.getElementById('game-over-modal');
        const finalScoreVal = document.getElementById('final-score-val');
        const bestScoreVal = document.getElementById('best-score-val');

        if (finalScoreVal) finalScoreVal.innerText = score;
        if (bestScoreVal) bestScoreVal.innerText = highScore;
        if (gameOverModal) gameOverModal.classList.remove('hidden');
    }

    // UI Buttons
    document.getElementById('start-btn')?.addEventListener('click', () => {
        requestFullScreen();
        initAudio();
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
        requestFullScreen();
        isPaused = false;
        document.getElementById('pause-menu')?.classList.add('hidden');
    });

    document.getElementById('restart-from-pause-btn')?.addEventListener('click', () => {
        requestFullScreen();
        document.getElementById('pause-menu')?.classList.add('hidden');
        resetGame();
        isPaused = false;
        gameStarted = true;
    });

    document.getElementById('restart-btn')?.addEventListener('click', () => {
        requestFullScreen();
        document.getElementById('game-over-modal')?.classList.add('hidden');
        resetGame();
        isPaused = false;
        gameStarted = true;
    });

    // --- 10. Loop ---
    let lastTime = performance.now();

    function gameLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        ctx.fillStyle = '#050714';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(0, height - 40, width, 40);

        if (gameStarted && !isPaused) {
            cannon.targetX = Math.max(30, Math.min(width - 30, cannon.targetX));
            cannon.x += (cannon.targetX - cannon.x) * 0.25;

            shootTimer += dt;
            if (isFiring && shootTimer >= 0.08) {
                shootTimer = 0;
                spawnBullet();
                playSound('shoot');
            }

            updateBullets(dt);
            updateRocks(dt);
        }

        drawCannon();
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});