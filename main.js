window.addEventListener('DOMContentLoaded', () => {

    // --- 1. מערכת תרגום ושפות (i18n) ---
    const translations = {
        en: {
            score: "Score",
            best: "Best",
            instructions: "👈 Swipe left and right to move 👉",
            subtitle: "Destroy robots, pass through gates, and defeat the boss!",
            language: "Language",
            personalBest: "Personal Best",
            startGame: "Start Game 🚀",
            victory: "🏆 You Won! Boss Defeated!",
            defeat: "💥 Game Over! Robots reached the cannon!",
            finalScore: "Your Final Score",
            playAgain: "Play Again 🔄",
            gamePaused: "Game Paused ⏸️",
            resumeGame: "Resume Game ▶️",
            dir: "ltr"
        },
        he: {
            score: "ניקוד",
            best: "שיא",
            instructions: "👈 החלק ימינה ושמאלה כדי להזיז 👉",
            subtitle: "השמד את הרובוטים, עבור בשערים והכנע את הבוס!",
            language: "שפה",
            personalBest: "שיא אישי",
            startGame: "התחל משחק 🚀",
            victory: "🏆 ניצחת! הבוס הובס!",
            defeat: "💥 הפסדת! הרובוטים הגיעו לתותח!",
            finalScore: "הניקוד הסופי שלך",
            playAgain: "שחק שוב 🔄",
            gamePaused: "משחק מושהה ⏸️",
            resumeGame: "המשך משחק ▶️",
            dir: "rtl"
        },
        es: {
            score: "Puntuación",
            best: "Mejor",
            instructions: "👈 Desliza a la izquierda y derecha para moverte 👉",
            subtitle: "¡Destruye robots, cruza puertas y derrota al jefe!",
            language: "Idioma",
            personalBest: "Mejor Personal",
            startGame: "Iniciar Juego 🚀",
            victory: "🏆 ¡Ganaste! ¡Jefe Derrotado!",
            defeat: "💥 ¡Juego Terminado! ¡Los robots llegaron!",
            finalScore: "Tu Puntuación Final",
            playAgain: "Jugar de Nuevo 🔄",
            gamePaused: "Juego En Pausa ⏸️",
            resumeGame: "Continuar ▶️",
            dir: "ltr"
        }
    };

    let currentLang = localStorage.getItem('ccc_language') || 'en';

    function setLanguage(lang) {
        if (!translations[lang]) lang = 'en';
        currentLang = lang;
        localStorage.setItem('ccc_language', lang);

        const t = translations[lang];

        document.documentElement.setAttribute('dir', t.dir);
        document.documentElement.setAttribute('lang', lang);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                el.innerText = t[key];
            }
        });

        const langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = lang;
    }

    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    setLanguage(currentLang);

    // --- 2. מנוע סאונד מונמך ומאוזן ---
    let audioCtx = null;
    let lastSoundTime = 0;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        if (now - lastSoundTime < 0.03 && type === 'hit') return;
        lastSoundTime = now;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'shoot') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'gate') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'hit') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.03);
            gain.gain.setValueAtTime(0.025, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
        } else if (type === 'explosion') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, now);
            osc.frequency.exponentialRampToValueAtTime(15, now + 0.25);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    }

    // --- 3. אתחול סצנה ומצלמה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.006);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);

    // --- 4. תאורה ותשתית ---
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(15, 40, 20);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 2, 30);
    scene.add(pointLight);

    // --- 5. מסלול ---
    const trackWidth = 14;
    const trackLength = 400;
    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    const wallGeo = new THREE.BoxGeometry(0.4, 1.4, trackLength);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.5 });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-trackWidth / 2 - 0.2, 0.45, track.position.z);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(trackWidth / 2 + 0.2, 0.45, track.position.z);
    scene.add(rightWall);

    // --- 6. תותח ---
    const cannonGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    cannonGroup.add(base);

    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.8, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1 });
    
    const barrelLeft = new THREE.Mesh(barrelGeo, barrelMat);
    barrelLeft.rotation.x = Math.PI / 2;
    barrelLeft.position.set(-0.4, 0.3, -1);
    cannonGroup.add(barrelLeft);

    const barrelRight = new THREE.Mesh(barrelGeo, barrelMat);
    barrelRight.rotation.x = Math.PI / 2;
    barrelRight.position.set(0.4, 0.3, -1);
    cannonGroup.add(barrelRight);

    const flashGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
    
    const flashLeft = new THREE.Mesh(flashGeo, flashMat);
    flashLeft.position.set(-0.4, 0.3, -1.9);
    cannonGroup.add(flashLeft);

    const flashRight = new THREE.Mesh(flashGeo, flashMat);
    flashRight.position.set(0.4, 0.3, -1.9);
    cannonGroup.add(flashRight);

    cannonGroup.position.set(0, 0.4, 0);
    scene.add(cannonGroup);

    function triggerMuzzleFlash() {
        flashMat.opacity = 0.8;
        flashLeft.scale.set(1.3, 1.3, 1.3);
        flashRight.scale.set(1.3, 1.3, 1.3);
    }

    // --- 7. שערים ---
    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 14;
        ctx.strokeRect(8, 8, 240, 240);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 95px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);

        return new THREE.CanvasTexture(canvas);
    }

    const gates = [];
    function createGate(id, x, z, type, value) {
        const gateGroup = new THREE.Group();
        const width = trackWidth / 2 - 0.6;
        const height = 4.2;

        const label = type === 'multiply' ? `x${value}` : `+${value}`;
        const colorHex = type === 'multiply' ? '#059669' : '#0284c7';
        const texture = createGateTexture(label, colorHex);

        const frameGeo = new THREE.BoxGeometry(width, height, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.9, roughness: 0.1 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height / 2;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { id, type, value };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    createGate('g1', -3.3, -40, 'multiply', 2);
    createGate('g2', 3.3, -40, 'add', 10);
    createGate('g3', -3.3, -130, 'multiply', 3);
    createGate('g4', 3.3, -130, 'multiply', 2);
    createGate('g5', -3.3, -220, 'add', 20);
    createGate('g6', 3.3, -220, 'multiply', 4);

    // --- 8. מכשולים ---
    const barriers = [];
    function createBarrier(x, z, hp) {
        const geo = new THREE.BoxGeometry(3.5, 2.0, 1.0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 1.0, z);
        mesh.userData = { hp, maxHp: hp };
        scene.add(mesh);
        barriers.push(mesh);
    }

    createBarrier(0, -100, 30);
    createBarrier(-3, -190, 45);

    // --- 9. רובוטים ---
    const robots = [];
    function createRobot(x, z, hp, speedX = 0) {
        const robotGroup = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(1.4, 1.6, 1.0);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.0;
        robotGroup.add(body);

        const headGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.25;
        robotGroup.add(head);

        const eyeGeo = new THREE.BoxGeometry(0.7, 0.25, 0.1);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1 });
        const eyes = new THREE.Mesh(eyeGeo, eyeMat);
        eyes.position.set(0, 2.25, -0.46);
        robotGroup.add(eyes);

        robotGroup.position.set(x, 0, z);
        robotGroup.userData = { hp, maxHp: hp, speedX, initialX: x };
        scene.add(robotGroup);
        robots.push(robotGroup);
    }

    createRobot(-3, -85, 20, 2.5);
    createRobot(3, -85, 20, -2.5);
    createRobot(0, -170, 45, 3.0);
    createRobot(-4, -260, 80, 3.5);
    createRobot(4, -260, 80, -3.5);

    // --- 10. בוס ---
    const bossGroup = new THREE.Group();
    const bossZ = -350;

    const bossGeo = new THREE.BoxGeometry(5.5, 6.5, 5.5);
    const bossMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.5 });
    const bossMesh = new THREE.Mesh(bossGeo, bossMat);
    bossMesh.position.y = 3.25;
    bossGroup.add(bossMesh);

    const hpBgGeo = new THREE.PlaneGeometry(4.5, 0.7);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.set(0, 7.5, 0);
    bossGroup.add(hpBg);

    const hpBarGeo = new THREE.PlaneGeometry(4.4, 0.6);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const hpBar = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.set(0, 7.5, 0.01);
    bossGroup.add(hpBar);

    bossGroup.position.set(0, 0, bossZ);
    bossGroup.userData = { hp: 450, maxHp: 450 };
    scene.add(bossGroup);

    // --- 11. VFX ---
    const particles = [];
    const particleGeo = new THREE.SphereGeometry(0.12, 6, 6);

    function createExplosionVFX(pos, colorHex = 0x38bdf8, count = 8) {
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(particleGeo, mat.clone());
            p.position.copy(pos);
            p.userData = {
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 5 + 1,
                vz: (Math.random() - 0.5) * 8,
                life: 0.3,
                maxLife: 0.3
            };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- 12. כדורים ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.26, 10, 10);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.1 });

    function spawnBullet(x, z, passedGates = []) {
        if (bullets.length > 200) return;

        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x + (Math.random() - 0.5) * 0.2, 0.35, z);
        bullet.userData = { passedGates: [...passedGates] };
        scene.add(bullet);
        bullets.push(bullet);
    }

    let shootTimer = 0;

    // --- 13. בקרות שליטה ---
    let targetX = 0;
    let isDragging = false;
    let previousTouchX = 0;
    let firstTouch = true;

    function hideInstructions() {
        if (firstTouch) {
            const inst = document.getElementById('instructions');
            if (inst) inst.style.opacity = '0';
            firstTouch = false;
        }
    }

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; hideInstructions(); });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused && !isGameOver) {
            targetX += (e.clientX - previousTouchX) * 0.025;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => {
        isDragging = true;
        previousTouchX = e.touches[0].clientX;
        hideInstructions();
    }, { passive: false });

    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging && gameStarted && !isPaused && !isGameOver) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.025;
            previousTouchX = e.touches[0].clientX;
        }
    }, { passive: false });

    // --- 14. מנהל מצבי משחק ---
    let gameStarted = false;
    let isPaused = false;
    let isGameOver = false;
    let score = 0;

    let highScore = localStorage.getItem('ccc_high_score') || 0;
    document.getElementById('start-high-score').innerText = Number(highScore).toLocaleString('en-US');
    document.getElementById('high-score-hud').innerText = Number(highScore).toLocaleString('en-US');

    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    const pauseBtn = document.getElementById('pause-btn');
    const scoreCard = document.getElementById('score-card');
    const instructions = document.getElementById('instructions');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');

    startBtn.addEventListener('click', () => {
        initAudio();
        gameStarted = true;
        startMenu.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        scoreCard.classList.remove('hidden');
        instructions.classList.remove('hidden');
    });

    pauseBtn.addEventListener('click', () => {
        if (!isGameOver && gameStarted) {
            isPaused = true;
            pauseMenu.classList.remove('hidden');
        }
    });

    resumeBtn.addEventListener('click', () => {
        isPaused = false;
        pauseMenu.classList.add('hidden');
    });

    restartBtn.addEventListener('click', () => {
        window.location.reload();
    });

    function addScore(amount) {
        score += amount;
        document.getElementById('score-val').innerText = score.toLocaleString('en-US');

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('ccc_high_score', highScore);
            document.getElementById('high-score-hud').innerText = Number(highScore).toLocaleString('en-US');
        }
    }

    function triggerGameOver(isWin) {
        isGameOver = true;
        const statusTitle = document.getElementById('status-title');
        const gameStatus = document.getElementById('game-status');
        const finalScoreText = document.getElementById('final-score-text');

        const t = translations[currentLang];
        finalScoreText.innerText = `${t.finalScore}: ${score.toLocaleString('en-US')}`;

        if (isWin) {
            statusTitle.innerText = t.victory;
            playSound('explosion');
        } else {
            statusTitle.innerText = t.defeat;
            playSound('explosion');
        }
        gameStatus.classList.remove('hidden');
    }

    // --- 15. לולאת המשחק הראשת ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        if (!gameStarted || isPaused || isGameOver) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        if (flashMat.opacity > 0) {
            flashMat.opacity -= delta * 6;
        }

        for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
            const p = particles[pIdx];
            p.position.x += p.userData.vx * delta;
            p.position.y += p.userData.vy * delta;
            p.position.z += p.userData.vz * delta;
            p.userData.life -= delta;

            p.material.opacity = p.userData.life / p.userData.maxLife;

            if (p.userData.life <= 0) {
                scene.remove(p);
                particles.splice(pIdx, 1);
            }
        }

        const maxX = trackWidth / 2 - 1.2;
        targetX = Math.max(-maxX, Math.min(maxX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.18);
        pointLight.position.set(cannonGroup.position.x, 3, cannonGroup.position.z - 2);

        const fireInterval = 0.14;
        shootTimer += delta;
        if (shootTimer >= fireInterval) {
            spawnBullet(cannonGroup.position.x - 0.4, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.4, cannonGroup.position.z - 1.2);
            triggerMuzzleFlash();
            playSound('shoot');
            shootTimer = 0;
        }

        for (let r = robots.length - 1; r >= 0; r--) {
            const robot = robots[r];
            robot.position.z += 2.2 * delta;

            if (robot.userData.speedX !== 0) {
                robot.position.x += robot.userData.speedX * delta;
                if (Math.abs(robot.position.x - robot.userData.initialX) > 3.0) {
                    robot.userData.speedX *= -1;
                }
            }

            if (robot.position.z >= cannonGroup.position.z - 1.2) {
                triggerGameOver(false);
                return;
            }
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 38 * delta;

            let hitBarrier = false;
            for (let barIdx = barriers.length - 1; barIdx >= 0; barIdx--) {
                const bar = barriers[barIdx];
                if (b.position.distanceTo(bar.position) < 1.8) {
                    bar.userData.hp -= 1;
                    hitBarrier = true;
                    createExplosionVFX(b.position, 0xd97706, 4);
                    playSound('hit');

                    if (bar.userData.hp <= 0) {
                        createExplosionVFX(bar.position, 0xd97706, 15);
                        scene.remove(bar);
                        barriers.splice(barIdx, 1);
                        addScore(100);
                    }
                    break;
                }
            }

            if (hitBarrier) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            gates.forEach((gate) => {
                const gateId = gate.userData.id;
                if (!b.userData.passedGates.includes(gateId)) {
                    if (Math.abs(b.position.z - gate.position.z) < 1.0) {
                        if (Math.abs(b.position.x - gate.position.x) < (trackWidth / 4)) {
                            b.userData.passedGates.push(gateId);

                            createExplosionVFX(b.position, 0x38bdf8, 5);
                            playSound('gate');

                            const newPassed = [...b.userData.passedGates];
                            if (gate.userData.type === 'multiply') {
                                for (let k = 0; k < gate.userData.value - 1; k++) {
                                    spawnBullet(b.position.x, b.position.z - 2.0, newPassed);
                                }
                            } else if (gate.userData.type === 'add') {
                                for (let k = 0; k < gate.userData.value; k++) {
                                    spawnBullet(b.position.x, b.position.z - 2.0, newPassed);
                                }
                            }
                            addScore(5);
                        }
                    }
                }
            });

            let bulletHit = false;
            for (let r = robots.length - 1; r >= 0; r--) {
                const robot = robots[r];
                if (b.position.distanceTo(robot.position) < 1.4) {
                    robot.userData.hp -= 1;
                    bulletHit = true;
                    createExplosionVFX(b.position, 0x0284c7, 4);
                    playSound('hit');
                    addScore(2);

                    if (robot.userData.hp <= 0) {
                        createExplosionVFX(robot.position, 0xd97706, 20);
                        playSound('explosion');
                        scene.remove(robot);
                        robots.splice(r, 1);
                        addScore(100);
                    }
                    break;
                }
            }

            if (bulletHit) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            if (bossGroup.userData.hp > 0 && b.position.distanceTo(bossGroup.position) < 3.8) {
                bossGroup.userData.hp -= 1;
                createExplosionVFX(b.position, 0x38bdf8, 5);
                playSound('hit');

                const hpPercent = Math.max(0, bossGroup.userData.hp / bossGroup.userData.maxHp);
                hpBar.scale.x = hpPercent;
                hpBar.position.x = (1 - hpPercent) * -2.2;

                addScore(5);
                scene.remove(b);
                bullets.splice(i, 1);

                if (bossGroup.userData.hp <= 0) {
                    createExplosionVFX(bossGroup.position, 0xd97706, 50);
                    addScore(5000);
                    scene.remove(bossGroup);
                    triggerGameOver(true);
                }
                continue;
            }

            if (b && b.position.z < -trackLength) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, cannonGroup.position.x * 0.2, 0.08);
        camera.position.y = 8.5;
        camera.position.z = cannonGroup.position.z + 12;
        camera.lookAt(cannonGroup.position.x * 0.08, 1, cannonGroup.position.z - 12);

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});