window.addEventListener('DOMContentLoaded', () => {

    // --- 1. מערכת תרגום ושפות ---
    const translations = {
        en: {
            score: "Score", best: "Best", instructions: "👈 Swipe left and right to move 👉",
            subtitle: "Destroy robots, pass through gates, and defeat the boss!",
            language: "Language", personalBest: "Personal Best", startGame: "Start Game 🚀",
            victory: "🏆 You Won! Boss Defeated!", defeat: "💥 Game Over! Robot crashed into cannon!",
            finalScore: "Your Final Score", playAgain: "Play Again 🔄", gamePaused: "Game Paused ⏸️",
            resumeGame: "Resume Game ▶️", dir: "ltr"
        },
        he: {
            score: "ניקוד", best: "שיא", instructions: "👈 החלק ימינה ושמאלה כדי להזיז 👉",
            subtitle: "השמד את הרובוטים, עבור בשערים והכנע את הבוס!",
            language: "שפה", personalBest: "שיא אישי", startGame: "התחל משחק 🚀",
            victory: "🏆 ניצחת! הבוס הובס!", defeat: "💥 הפסדת! רובוט התנגש בתותח!",
            finalScore: "הניקוד הסופי שלך", playAgain: "שחק שוב 🔄", gamePaused: "משחק מושהה ⏸️",
            resumeGame: "המשך משחק ▶️", dir: "rtl"
        }
    };

    let currentLang = localStorage.getItem('ccc_language') || 'he';

    function setLanguage(lang) {
        if (!translations[lang]) lang = 'he';
        currentLang = lang;
        localStorage.setItem('ccc_language', lang);
        const t = translations[lang];

        document.documentElement.setAttribute('dir', t.dir);
        document.documentElement.setAttribute('lang', lang);

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.innerText = t[key];
        });

        const langSelect = document.getElementById('lang-select');
        if (langSelect) langSelect.value = lang;
    }

    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
    setLanguage(currentLang);

    // --- 2. מנוע סאונד מבוסס קובצי אודיו אמיתיים ---
    const soundURLs = {
        shoot: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
        hit: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
        explosion: 'https://assets.mixkit.co/active_storage/sfx/1706/1706-preview.mp3',
        gate: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'
    };

    const audioBuffers = {};
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            Object.keys(soundURLs).forEach(key => {
                fetch(soundURLs[key])
                    .then(res => res.arrayBuffer())
                    .then(buffer => audioCtx.decodeAudioData(buffer))
                    .then(decoded => { audioBuffers[key] = decoded; })
                    .catch(() => {});
            });
        }
    }

    function playSound(name) {
        if (audioCtx && audioBuffers[name]) {
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffers[name];
            const gain = audioCtx.createGain();
            gain.gain.value = name === 'shoot' ? 0.15 : 0.4;
            source.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(0);
        }
    }

    // --- 3. סצנה ותאורה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.004);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    let shakeIntensity = 0;
    function addScreenShake(amount) { shakeIntensity = Math.min(shakeIntensity + amount, 0.6); }

    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);

    // --- 4. מסלול ---
    const trackWidth = 14;
    const maxBoundX = trackWidth / 2 - 1.2;
    const trackLength = 2400;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.7 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    // --- 5. תותח דינמי ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    cannonMeshGroup.add(base);

    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.8, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 });

    const barrelLeft = new THREE.Mesh(barrelGeo, barrelMat);
    barrelLeft.rotation.x = Math.PI / 2;
    barrelLeft.position.set(-0.4, 0.3, -1);
    cannonMeshGroup.add(barrelLeft);

    const barrelRight = new THREE.Mesh(barrelGeo, barrelMat);
    barrelRight.rotation.x = Math.PI / 2;
    barrelRight.position.set(0.4, 0.3, -1);
    cannonMeshGroup.add(barrelRight);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 0.4, 0);
    scene.add(cannonGroup);

    // --- 6. כדורים ושערים ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 2.0 });

    function spawnBullet(x, z, passedGates = []) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x, 0.35, z);
        bullet.userData = { passedGates: [...passedGates] };
        scene.add(bullet);
        bullets.push(bullet);
    }

    const gates = [];
    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 12;
        ctx.strokeRect(8, 8, 240, 240);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 80px Rubik';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

    function createGate(id, x, z, type, value) {
        const gateGroup = new THREE.Group();
        const gateWidth = trackWidth / 2 - 0.5;
        let label = `+${value}`, colorHex = '#0284c7';
        if (type === 'multiply') { label = `x${value}`; colorHex = '#10b981'; }

        const frameGeo = new THREE.BoxGeometry(gateWidth, 4.0, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ map: createGateTexture(label, colorHex), transparent: true, opacity: 0.85 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 2.0;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { id, type, value };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    let gateIdCounter = 1;
    for (let z = -80; z > -2200; z -= 120) {
        createGate(`g_${gateIdCounter++}`, -3.3, z, 'multiply', 2);
        createGate(`g_${gateIdCounter++}`, 3.3, z, 'add', 20);
    }

    // --- 7. רובוטים / אויבים ---
    const robots = [];
    const robotGeo = new THREE.BoxGeometry(1.6, 2.2, 1.2);
    const robotMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });

    for (let z = -150; z > -2100; z -= 150) {
        const robot = new THREE.Mesh(robotGeo, robotMat);
        robot.position.set((Math.random() - 0.5) * 6, 1.1, z);
        robot.userData = { hp: 25 };
        scene.add(robot);
        robots.push(robot);
    }

    // --- 8. בקרת נגיעה/עכבר ---
    let targetX = 0, isDragging = false, previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused && !isGameOver) {
            targetX += (e.clientX - previousTouchX) * 0.025;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging && gameStarted && !isPaused && !isGameOver) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.025;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 9. ניהול משחק ---
    let gameStarted = false, isPaused = false, isGameOver = false, score = 0, shootTimer = 0;

    document.getElementById('start-btn').addEventListener('click', () => {
        initAudio();
        gameStarted = true;
        document.getElementById('start-menu').classList.add('hidden');
        document.getElementById('start-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('start-overlay').classList.add('hidden'), 500);
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('score-card').classList.remove('hidden');
    });

    function triggerGameOver(won) {
        isGameOver = true;
        const statusPopup = document.getElementById('game-status');
        const title = document.getElementById('status-title');
        title.innerText = won ? translations[currentLang].victory : translations[currentLang].defeat;
        document.getElementById('final-score-text').innerText = `${translations[currentLang].finalScore}: ${score}`;
        statusPopup.classList.remove('hidden');
    }

    document.getElementById('restart-btn').addEventListener('click', () => location.reload());

    // --- 10. הלולאה הראשית (Loop) ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        if (!gameStarted || isPaused || isGameOver) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        // התקדמות התותח
        cannonGroup.position.z -= 18.0 * delta;

        // צידוד והטיית התותח
        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        const prevX = cannonGroup.position.x;
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.2);
        
        const moveDelta = cannonGroup.position.x - prevX;
        cannonMeshGroup.rotation.z = -moveDelta * 2.2;

        // מעקב מצלמה + שייק
        camera.position.x = cannonGroup.position.x * 0.3;
        camera.position.y = cannonGroup.position.y + 6.5;
        camera.position.z = cannonGroup.position.z + 11.5;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 1.0, cannonGroup.position.z - 10);

        if (shakeIntensity > 0) {
            camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            shakeIntensity = Math.max(0, shakeIntensity - delta * 2.0);
        }

        // ירי רציף
        shootTimer += delta;
        if (shootTimer >= 0.12) {
            spawnBullet(cannonGroup.position.x - 0.4, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.4, cannonGroup.position.z - 1.2);
            playSound('shoot');
            shootTimer = 0;
        }

        // לוגיקת כדורים, שערים ואויבים
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 40 * delta;

            if (b.position.z < cannonGroup.position.z - 100) {
                scene.remove(b); bullets.splice(i, 1); continue;
            }

            // 1. בדיקת פגיעה בשערים (הכפלת כדורים)
            for (let g of gates) {
                if (!b.userData.passedGates.includes(g.userData.id) && Math.abs(b.position.z - g.position.z) < 0.6) {
                    if (Math.abs(b.position.x - g.position.x) < trackWidth / 4) {
                        b.userData.passedGates.push(g.userData.id);
                        playSound('gate');

                        if (g.userData.type === 'multiply') {
                            const extraBullets = g.userData.value - 1;
                            for (let k = 0; k < extraBullets; k++) {
                                spawnBullet(b.position.x + (Math.random() - 0.5) * 0.5, b.position.z - 0.2, b.userData.passedGates);
                            }
                        } else if (g.userData.type === 'add') {
                            for (let k = 0; k < 2; k++) {
                                spawnBullet(b.position.x + (Math.random() - 0.5) * 0.6, b.position.z - 0.3, b.userData.passedGates);
                            }
                        }
                    }
                }
            }

            // 2. פגיעה ברובוטים
            for (let rIdx = robots.length - 1; rIdx >= 0; rIdx--) {
                const rob = robots[rIdx];
                if (b.position.distanceTo(rob.position) < 1.4) {
                    rob.userData.hp -= 1;
                    rob.scale.set(1.2, 0.8, 1.2);
                    playSound('hit');

                    if (rob.userData.hp <= 0) {
                        playSound('explosion');
                        addScreenShake(0.3);
                        scene.remove(rob); robots.splice(rIdx, 1);
                        score += 150;
                        document.getElementById('score-val').innerText = score;
                    }
                    scene.remove(b); bullets.splice(i, 1); break;
                }
            }
        }

        // התנגשות תותח ברובוט (הפסד)
        for (let rob of robots) {
            rob.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
            if (cannonGroup.position.distanceTo(rob.position) < 1.8) {
                playSound('explosion');
                addScreenShake(0.8);
                triggerGameOver(false);
            }
        }

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});