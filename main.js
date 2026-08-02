window.addEventListener('DOMContentLoaded', () => {

    // --- 0. Mobile Detection ---
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

    // --- 1. Canvas HD Setup ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    let width, height, dpr;
    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1; // תמיכה ברזולוציית HD גבוהה
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.scale(dpr, dpr);
        initClouds();
    }

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

    // --- 3. Particles System ---
    const particles = [];

    function createExplosion(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 40;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: color,
                alpha: 1,
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

    // --- 4. Environment Background ---
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
        // Sky Gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#38bdf8');
        skyGrad.addColorStop(0.6, '#bae6fd');
        skyGrad.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Mountains
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

        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(width * 0.15, height - 60);
        ctx.lineTo(width * 0.35, height - 130);
        ctx.lineTo(width * 0.55, height - 60);
        ctx.lineTo(width * 0.8, height - 140);
        ctx.lineTo(width * 1.1, height - 60);
        ctx.fill();

        // Clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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

        // Ground Floor
        const floorY = height - 60;
        ctx.fillStyle = '#15803d'; // Grass Green
        ctx.fillRect(0, floorY, width, 20);

        ctx.fillStyle = '#78350f'; // Dirt Brown
        ctx.fillRect(0, floorY + 20, width, 40);

        // Grass edge line
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, floorY);
        ctx.lineTo(width, floorY);
        ctx.stroke();
    }

    // --- 5. State & High Score ---
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

    // --- 6. HP Mechanics ---
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

    // --- 7. Cannon Entity ---
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

        // Wheels
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-22, 10, 12, 0, Math.PI * 2);
        ctx.arc(22, 10, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Barrels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-16, -30, 10, 30);
        ctx.fillRect(6, -30, 10, 30);

        // Dome / Body
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

    // --- 8. Bullets ---
    const bullets = [];
    let shootTimer = 0;

    function spawnBullet() {
        bullets.push({ x: cannon.x - 11, y: cannon.y - 30, radius: 6 });
        bullets.push({ x: cannon.x + 11, y: cannon.y - 30, radius: 6 });
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

            if (b.y < -10) {
                bullets.splice(i, 1);
            }
        }
    }

    // --- 9. Rocks (Slower Physics & Easier Difficulty) ---
    const rocks = [];
    const rockColors = ['#ef4444', '#f97316', '#22c55e', '#06b6d4', '#a855f7'];

    function createRockVertices(radius) {
        const points = [];
        const numSides = 8;
        for (let i = 0; i < numSides; i++) {
            const angle = (i / numSides) * Math.PI * 2;
            const variance = radius * (0.85 + Math.random() * 0.3);
            points.push({
                x: Math.cos(angle) * variance,
                y: Math.sin(angle) * variance
            });
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
            vx: (Math.random() > 0.5 ? 1 : -1) * (70 + Math.random() * 40), // מהירות אופקית איטית יותר
            vy: 0,
            gravity: 350, // כבידה נמוכה - נפילה איטית בהרבה!
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
            if (distToCannon < r.radius + 26) {
                currentHp -= 25; // הורדנו נזק מ-100 ל-25
                updateHpBar();
                playSound('hit');
                createExplosion(cannon.x, cannon.y - 10, '#ef4444', 12);
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
                    levelProgress += 3;

                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;

                    updateLevelUI();
                    playSound('hit');
                    createExplosion(b.x, b.y, r.color, 3);

                    if (r.hp <= 0) {
                        playSound('explode');
                        createExplosion(r.x, r.y, r.color, 20);

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

            // Draw Polygonal Rock
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
                ctx.fillText(r.hp, 0, 0);
                ctx.restore();
            }
        }

        if (rocks.length === 0 && gameStarted && !isPaused) {
            // כמות ניקוד/חיים מופחתת משמעותית לסלעים בראשוניים
            spawnRock(width * 0.3, 80, Math.max(5, 8 * currentLevel), 2);
            spawnRock(width * 0.7, 80, Math.max(4, 6 * currentLevel), 1);
        }
    }

    // --- 10. Controls ---
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

    // --- 11. State Transitions & UI ---
    function resetGame() {
        score = 0; currentHp = maxHp; currentLevel = 1; levelProgress = 0;
        rocks.length = 0; bullets.length = 0; particles.length = 0;
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

    // --- 12. Main Game Loop ---
    let lastTime = performance.now();

    function gameLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        drawEnvironment();

        if (gameStarted && !isPaused) {
            cannon.targetX = Math.max(30, Math.min(width - 30, cannon.targetX));
            cannon.x += (cannon.targetX - cannon.x) * 0.25;

            shootTimer += dt;
            if (isFiring && shootTimer >= 0.065) { // ירייה מהירה יותר!
                shootTimer = 0;
                spawnBullet();
                playSound('shoot');
            }

            updateBullets(dt);
            updateRocks(dt);
            updateParticles(dt);
        }

        drawCannon();
        requestAnimationFrame(gameLoop);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(gameLoop);
});