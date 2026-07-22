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
            defeat: "💥 Game Over! Robot crashed into cannon!",
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
            defeat: "💥 הפסדת! רובוט התנגש בתותח!",
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
            defeat: "💥 ¡Juego Terminado! ¡Un robot chocó contra el cañón!",
            finalScore: "Tu Puntuación Final",
            playAgain: "Jugar de Nuevo 🔄",
            gamePaused: "En Pausa ⏸️",
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

    // --- 2. מנוע סאונד ---
    let audioCtx = null;
    let lastSoundTime = 0;
    let comboPitchLevel = 0;
    let comboResetTimer = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(type) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        if (now - lastSoundTime < 0.015 && type === 'hit') return;
        lastSoundTime = now;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'shoot') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'gate') {
            comboPitchLevel = Math.min(comboPitchLevel + 1, 10);
            clearTimeout(comboResetTimer);
            comboResetTimer = setTimeout(() => { comboPitchLevel = 0; }, 2000);

            const pitchFreq = 523.25 * Math.pow(1.06, comboPitchLevel);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(pitchFreq, now);
            osc.frequency.setValueAtTime(pitchFreq * 1.25, now + 0.05);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'bad_gate') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'powerup') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'hit') {
            // צליל פגיעה רך, עמוק ונעים לאוזן (Triangle wave בתדר נמוך)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);
            gain.gain.setValueAtTime(0.05, now);
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

    // --- 3. אתחול סצנה, מצלמה ו-Screen Shake ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.003);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild(renderer.domElement);

    let shakeIntensity = 0;
    function addScreenShake(amount) {
        shakeIntensity = Math.min(shakeIntensity + amount, 0.8);
    }

    // --- 4. תאורה ---
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(15, 40, 20);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xff6600, 2, 30);
    scene.add(pointLight);

    // --- 5. מסלול וגבולות גשר קשיחים ---
    const trackWidth = 14;
    const maxBoundX = trackWidth / 2 - 1.2;

    const trackLength = 2400;
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

    const barrelCenter = new THREE.Mesh(barrelGeo, barrelMat);
    barrelCenter.rotation.x = Math.PI / 2;
    barrelCenter.position.set(0, 0.5, -1.2);
    barrelCenter.visible = false;
    cannonGroup.add(barrelCenter);

    const flashGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0 });

    const flashLeft = new THREE.Mesh(flashGeo, flashMat);
    flashLeft.position.set(-0.4, 0.3, -1.9);
    cannonGroup.add(flashLeft);

    const flashRight = new THREE.Mesh(flashGeo, flashMat);
    flashRight.position.set(0.4, 0.3, -1.9);
    cannonGroup.add(flashRight);

    cannonGroup.position.set(0, 0.4, 0);
    scene.add(cannonGroup);

    function triggerMuzzleFlash() {
        flashMat.opacity = 0.9;
        flashLeft.scale.set(1.3, 1.3, 1.3);
        flashRight.scale.set(1.3, 1.3, 1.3);
    }

    function updateCannonVisuals() {
        if (rapidFireActive || score >= 5000) {
            barrelCenter.visible = true;
            baseMat.color.setHex(0xf59e0b);
            cannonGroup.scale.set(1.15, 1.15, 1.15);
        } else {
            barrelCenter.visible = false;
            baseMat.color.setHex(0x2563eb);
            cannonGroup.scale.set(1, 1, 1);
        }
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
        ctx.font = '900 90px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);

        return new THREE.CanvasTexture(canvas);
    }

    const gates = [];
    function createGate(id, x, z, type, value, isMoving = false) {
        const gateGroup = new THREE.Group();
        const gateWidth = trackWidth / 2 - 0.8;
        const height = 4.2;

        let label = `+${value}`;
        let colorHex = '#0284c7';

        if (type === 'multiply') {
            label = `x${value}`;
            colorHex = '#059669';
        } else if (type === 'sub') {
            label = `-${value}`;
            colorHex = '#dc2626';
        } else if (type === 'divide') {
            label = `/${value}`;
            colorHex = '#991b1b';
        }

        const texture = createGateTexture(label, colorHex);

        const frameGeo = new THREE.BoxGeometry(gateWidth, height, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.9, roughness: 0.1 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height / 2;
        gateGroup.add(frame);

        const halfGate = gateWidth / 2;
        const boundedX = Math.max(-trackWidth / 2 + halfGate, Math.min(trackWidth / 2 - halfGate, x));

        gateGroup.position.set(boundedX, 0, z);
        gateGroup.userData = { 
            id, type, value, 
            isMoving, 
            minX: -trackWidth / 2 + halfGate,
            maxX: trackWidth / 2 - halfGate,
            moveSpeed: isMoving ? (Math.random() > 0.5 ? 1.8 : -1.8) : 0 
        };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    let gateIdCounter = 1;
    for (let z = -90; z > -2250; z -= 140) {
        const rand = Math.random();
        if (rand < 0.6) {
            const multVal = Math.floor(Math.random() * 2) + 2;
            const addVal = (Math.floor(Math.random() * 3) + 1) * 10;
            createGate(`g_${gateIdCounter++}`, -3.2, z, 'multiply', multVal, rand < 0.2);
            createGate(`g_${gateIdCounter++}`, 3.2, z, 'add', addVal, rand < 0.2);
        } else {
            const multVal = Math.floor(Math.random() * 2) + 2;
            const subVal = (Math.floor(Math.random() * 2) + 1) * 10;
            const positiveOnLeft = Math.random() > 0.5;

            createGate(`g_${gateIdCounter++}`, positiveOnLeft ? -3.2 : 3.2, z, 'multiply', multVal, true);
            createGate(`g_${gateIdCounter++}`, positiveOnLeft ? 3.2 : -3.2, z, 'sub', subVal, true);
        }
    }

    // --- 8. מכשולים וחביות נפץ ---
    const barriers = [];
    function createBarrier(x, z, hp) {
        const geo = new THREE.BoxGeometry(3.5, 2.0, 1.0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 1.0, z);
        mesh.userData = { type: 'barrier', hp, maxHp: hp };
        scene.add(mesh);
        barriers.push(mesh);
    }

    const barrels = [];
    function createBarrel(x, z) {
        const geo = new THREE.CylinderGeometry(0.8, 0.8, 2.2, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 1.1, z);
        mesh.userData = { type: 'barrel', hp: 12 };
        scene.add(mesh);
        barrels.push(mesh);
    }

    for (let z = -120; z > -2200; z -= 180) {
        const posX = (Math.random() - 0.5) * 5.5;
        if (Math.random() > 0.4) {
            createBarrier(posX, z, Math.floor(Math.abs(z) / 10) + 30);
        } else {
            createBarrel(posX, z);
        }
    }

    // --- 9. Power-ups ---
    const powerups = [];
    function createPowerup(x, z) {
        const geo = new THREE.OctahedronGeometry(0.9, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 1.2, z);
        mesh.userData = { type: 'rapid_fire' };
        scene.add(mesh);
        powerups.push(mesh);
    }

    for (let z = -200; z > -2100; z -= 350) {
        const posX = (Math.random() - 0.5) * 5.5;
        createPowerup(posX, z);
    }

    let rapidFireActive = false;
    let rapidFireTimer = null;

    function activateRapidFire() {
        rapidFireActive = true;
        playSound('powerup');
        addScreenShake(0.3);
        const banner = document.getElementById('powerup-banner');
        if (banner) banner.classList.remove('hidden');

        clearTimeout(rapidFireTimer);
        rapidFireTimer = setTimeout(() => {
            rapidFireActive = false;
            if (banner) banner.classList.add('hidden');
        }, 5000);
    }

    // --- 10. רובוטים ---
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

        const boundedX = Math.max(-trackWidth / 2 + 0.9, Math.min(trackWidth / 2 - 0.9, x));

        robotGroup.position.set(boundedX, 0, z);
        robotGroup.userData = { 
            hp, maxHp: hp, 
            speedX, 
            minX: -trackWidth / 2 + 0.9,
            maxX: trackWidth / 2 - 0.9
        };
        scene.add(robotGroup);
        robots.push(robotGroup);
    }

    for (let z = -140; z > -2300; z -= 120) {
        const robotHp = Math.floor(Math.abs(z) / 12) + 20;
        const speed = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.6);
        createRobot(-3.2, z, robotHp, speed);
        createRobot(3.2, z, robotHp, -speed);
    }

    // --- 11. בוס ענק ---
    const bossGroup = new THREE.Group();
    const bossZ = -2350;

    const bossGeo = new THREE.BoxGeometry(6.5, 7.5, 6.5);
    const bossMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.5 });
    const bossMesh = new THREE.Mesh(bossGeo, bossMat);
    bossMesh.position.y = 3.75;
    bossGroup.add(bossMesh);

    const hpBgGeo = new THREE.PlaneGeometry(5.5, 0.8);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.set(0, 8.5, 0);
    bossGroup.add(hpBg);

    const hpBarGeo = new THREE.PlaneGeometry(5.4, 0.7);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const hpBar = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.set(0, 8.5, 0.01);
    bossGroup.add(hpBar);

    bossGroup.position.set(0, 0, bossZ);
    bossGroup.userData = { hp: 15000, maxHp: 15000 };
    scene.add(bossGroup);

    // --- 12. VFX ---
    const particles = [];
    const particleGeo = new THREE.SphereGeometry(0.12, 6, 6);

    function createExplosionVFX(pos, colorHex = 0xff6600, count = 8) {
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(particleGeo, mat.clone());
            p.position.copy(pos);
            p.userData = {
                vx: (Math.random() - 0.5) * 10,
                vy: Math.random() * 6 + 2,
                vz: (Math.random() - 0.5) * 10,
                life: 0.35,
                maxLife: 0.35
            };
            scene.add(p);
            particles.push(p);
        }
    }

    const floatingTexts = [];
    function spawnFloatingText(text, pos, colorHex = '#ff8800') {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = colorHex;
        ctx.font = '900 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(mat);

        sprite.position.copy(pos);
        sprite.position.y += 1.5;
        sprite.scale.set(2.5, 1.25, 1);
        sprite.userData = { life: 0.6, maxLife: 0.6 };

        scene.add(sprite);
        floatingTexts.push(sprite);
    }

    function createConfettiVFX() {
        const colors = [0xf59e0b, 0xff6600, 0x10b981, 0xef4444, 0x8b5cf6];
        for (let i = 0; i < 150; i++) {
            const cGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);
            const cMat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
            const p = new THREE.Mesh(cGeo, cMat);

            p.position.set(
                cannonGroup.position.x + (Math.random() - 0.5) * 12,
                cannonGroup.position.y + Math.random() * 8 + 2,
                cannonGroup.position.z - Math.random() * 10
            );

            p.userData = {
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 8 + 4,
                vz: (Math.random() - 0.5) * 8,
                life: 2.5,
                maxLife: 2.5
            };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- 13. כדורים ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ 
        color: 0xff6600, 
        emissive: 0xff4500, 
        emissiveIntensity: 1.6, 
        roughness: 0.1 
    });

    function spawnBullet(x, z, passedGates = []) {
        if (bullets.length > 500) return;

        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x + (Math.random() - 0.5) * 0.2, 0.35, z);
        bullet.userData = { passedGates: [...passedGates] };
        scene.add(bullet);
        bullets.push(bullet);
    }

    let shootTimer = 0;

    // --- 14. בקרות שליטה ---
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

    // --- 15. מצב משחק ---
    let gameStarted = false;
    let isPaused = false;
    let isGameOver = false;
    let score = 0;

    let highScore = localStorage.getItem('ccc_high_score') || 0;
    document.getElementById('start-high-score').innerText = Number(highScore).toLocaleString('en-US');
    document.getElementById('high-score-hud').innerText = Number(highScore).toLocaleString('en-US');

    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    const startOverlay = document.getElementById('start-overlay');
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
        if (startOverlay) {
            startOverlay.style.opacity = '0';
            setTimeout(() => startOverlay.classList.add('hidden'), 400);
        }
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
            createConfettiVFX();
            addScreenShake(0.6);
            playSound('explosion');
        } else {
            statusTitle.innerText = t.defeat;
            addScreenShake(0.5);
            playSound('explosion');
        }
        gameStatus.classList.remove('hidden');
    }

    // --- 16. לולאת המשחק הראשית ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        if (!gameStarted || isPaused || isGameOver) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        // התקדמות התותח קדימה
        cannonGroup.position.z -= 18.5 * delta;

        // מצלמה עוקבת אחרי התותח
        camera.position.x = cannonGroup.position.x * 0.4;
        camera.position.y = cannonGroup.position.y + 6.5;
        camera.position.z = cannonGroup.position.z + 12.0;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 1.2, cannonGroup.position.z - 10);

        if (shakeIntensity > 0) {
            camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            shakeIntensity = Math.max(0, shakeIntensity - delta * 2.0);
        }

        updateCannonVisuals();

        if (flashMat.opacity > 0) {
            flashMat.opacity -= delta * 6;
        }

        // ניהול חלקיקים
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

        // ניהול טקסט צף
        for (let tIdx = floatingTexts.length - 1; tIdx >= 0; tIdx--) {
            const ft = floatingTexts[tIdx];
            ft.position.y += 1.5 * delta;
            ft.userData.life -= delta;
            ft.material.opacity = ft.userData.life / ft.userData.maxLife;

            if (ft.userData.life <= 0) {
                scene.remove(ft);
                floatingTexts.splice(tIdx, 1);
            }
        }

        // תנועת שערים
        gates.forEach((gate) => {
            if (gate.userData.isMoving) {
                gate.position.x += gate.userData.moveSpeed * delta;
                if (gate.position.x >= gate.userData.maxX || gate.position.x <= gate.userData.minX) {
                    gate.userData.moveSpeed *= -1;
                    gate.position.x = Math.max(gate.userData.minX, Math.min(gate.userData.maxX, gate.position.x));
                }
            }
        });

        // מיקום התותח
        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.18);
        pointLight.position.set(cannonGroup.position.x, 3, cannonGroup.position.z - 2);

        // קצב ירייה
        const fireInterval = rapidFireActive ? 0.05 : 0.12;
        shootTimer += delta;
        if (shootTimer >= fireInterval) {
            spawnBullet(cannonGroup.position.x - 0.4, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.4, cannonGroup.position.z - 1.2);
            if (rapidFireActive || score >= 5000) {
                spawnBullet(cannonGroup.position.x, cannonGroup.position.z - 1.4);
            }
            triggerMuzzleFlash();
            playSound('shoot');
            shootTimer = 0;
        }

        // איסוף Power-ups
        for (let pwIdx = powerups.length - 1; pwIdx >= 0; pwIdx--) {
            const pw = powerups[pwIdx];
            pw.rotation.y += 3.0 * delta;

            if (cannonGroup.position.distanceTo(pw.position) < 1.8) {
                activateRapidFire();
                spawnFloatingText("RAPID FIRE! ⚡", pw.position, "#facc15");
                scene.remove(pw);
                powerups.splice(pwIdx, 1);
            }
        }

        // תנועת רובוטים ובדיקת התנגשות פיזית ישירה בלבד
        for (let r = robots.length - 1; r >= 0; r--) {
            const robot = robots[r];
            
            robot.position.z += 0.6 * delta;

            if (robot.userData.speedX !== 0) {
                robot.position.x += robot.userData.speedX * delta;
                if (robot.position.x >= robot.userData.maxX || robot.position.x <= robot.userData.minX) {
                    robot.userData.speedX *= -1;
                    robot.position.x = Math.max(robot.userData.minX, Math.min(robot.userData.maxX, robot.position.x));
                }
            }

            // Game Over מתרחש אך ורק בנגיעה פיזית ישירה בתותח (מרחק קטן מאוד ב-X, Y, Z)
            const dx = Math.abs(cannonGroup.position.x - robot.position.x);
            const dz = Math.abs(cannonGroup.position.z - robot.position.z);
            if (dx < 1.2 && dz < 1.2) {
                triggerGameOver(false);
                return;
            }
        }

        // כדורים והתנגשויות
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 42 * delta;

            if (b.position.z < bossZ - 50) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            // שערים
            for (let gIdx = 0; gIdx < gates.length; gIdx++) {
                const gate = gates[gIdx];
                if (!b.userData.passedGates.includes(gate.userData.id)) {
                    if (Math.abs(b.position.z - gate.position.z) < 0.6 && Math.abs(b.position.x - gate.position.x) < 3.0) {
                        b.userData.passedGates.push(gate.userData.id);
                        
                        if (gate.userData.type === 'multiply') {
                            for (let m = 0; m < gate.userData.value - 1; m++) {
                                spawnBullet(b.position.x, b.position.z, b.userData.passedGates);
                            }
                            playSound('gate');
                        } else if (gate.userData.type === 'add') {
                            for (let a = 0; a < 2; a++) {
                                spawnBullet(b.position.x, b.position.z, b.userData.passedGates);
                            }
                            playSound('gate');
                        } else if (gate.userData.type === 'sub' || gate.userData.type === 'divide') {
                            playSound('bad_gate');
                            scene.remove(b);
                            bullets.splice(i, 1);
                            i--;
                            break;
                        }
                    }
                }
            }

            if (i < 0 || i >= bullets.length) continue;

            // פגיעה במכשולים
            let hitBarrier = false;
            for (let barIdx = barriers.length - 1; barIdx >= 0; barIdx--) {
                const bar = barriers[barIdx];
                if (b.position.distanceTo(bar.position) < 1.8) {
                    bar.userData.hp -= 1;
                    hitBarrier = true;
                    createExplosionVFX(b.position, 0xff6600, 4);
                    playSound('hit');

                    if (bar.userData.hp <= 0) {
                        createExplosionVFX(bar.position, 0xd97706, 15);
                        spawnFloatingText("+100", bar.position, "#f59e0b");
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

            // פגיעה בחביות
            let hitBarrel = false;
            for (let barIdx = barrels.length - 1; barIdx >= 0; barIdx--) {
                const barrel = barrels[barIdx];
                if (b.position.distanceTo(barrel.position) < 1.6) {
                    barrel.userData.hp -= 1;
                    hitBarrel = true;
                    createExplosionVFX(b.position, 0xef4444, 4);
                    playSound('hit');

                    if (barrel.userData.hp <= 0) {
                        createExplosionVFX(barrel.position, 0xef4444, 35);
                        addScreenShake(0.4);
                        playSound('explosion');
                        spawnFloatingText("BOOM! 💣", barrel.position, "#ef4444");

                        for (let r = robots.length - 1; r >= 0; r--) {
                            if (robots[r].position.distanceTo(barrel.position) < 7.0) {
                                createExplosionVFX(robots[r].position, 0xd97706, 15);
                                scene.remove(robots[r]);
                                robots.splice(r, 1);
                                addScore(250);
                            }
                        }

                        scene.remove(barrel);
                        barrels.splice(barIdx, 1);
                        addScore(200);
                    }
                    break;
                }
            }

            if (hitBarrel) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            // פגיעה ברובוטים
            let hitRobot = false;
            for (let r = robots.length - 1; r >= 0; r--) {
                const robot = robots[r];
                if (b.position.distanceTo(robot.position) < 1.4) {
                    robot.userData.hp -= 1;
                    hitRobot = true;
                    createExplosionVFX(b.position, 0x38bdf8, 3);
                    playSound('hit');

                    if (robot.userData.hp <= 0) {
                        createExplosionVFX(robot.position, 0xd97706, 12);
                        spawnFloatingText("+50", robot.position, "#38bdf8");
                        scene.remove(robot);
                        robots.splice(r, 1);
                        addScore(50);
                    }
                    break;
                }
            }

            if (hitRobot) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            // פגיעה בבוס
            if (b.position.distanceTo(bossGroup.position) < 4.5) {
                bossGroup.userData.hp -= 1;
                createExplosionVFX(b.position, 0x10b981, 3);
                playSound('hit');

                const pct = Math.max(0, bossGroup.userData.hp / bossGroup.userData.maxHp);
                hpBar.scale.x = pct;

                if (bossGroup.userData.hp <= 0) {
                    createExplosionVFX(bossGroup.position, 0x10b981, 100);
                    scene.remove(bossGroup);
                    addScore(5000);
                    triggerGameOver(true);
                }

                scene.remove(b);
                bullets.splice(i, 1);
            }
        }

        // בדיקת ניצחון/הגעה לבוס
        if (cannonGroup.position.z <= bossZ + 15 && !isGameOver) {
            triggerGameOver(bossGroup.userData.hp <= 0);
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