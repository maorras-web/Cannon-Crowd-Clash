window.addEventListener('DOMContentLoaded', () => {

    // --- 0. Fix Mobile Touch Hijacking ---
    document.documentElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
        uiContainer.style.pointerEvents = 'none';
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.style.pointerEvents = 'auto';
    }

    // --- 1. Audio Engine ---
    let audioCtx = null;
    let masterGainNode = null;
    let masterVolume = 0.15;

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
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'boss_hit') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch(e) {}
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.value = masterVolume;
        volumeSlider.addEventListener('input', (e) => {
            masterVolume = parseFloat(e.target.value);
            if (masterGainNode) masterGainNode.gain.value = masterVolume;
        });
    }

    // --- 2. Level State & HighScore ---
    let currentLevel = 1;
    let levelProgress = 0;
    const maxLevelProgress = 100;
    let isBossActive = false;
    let activeBoss = null;
    let highScore = localStorage.getItem('cannon_high_score') || 0;

    const startBestScoreEl = document.getElementById('start-best-score');
    if (startBestScoreEl) startBestScoreEl.innerText = highScore;

    function updateLevelUI() {
        const progressFill = document.getElementById('level-progress-fill');
        const levelText = document.getElementById('level-text');
        
        if (progressFill) {
            const percentage = isBossActive ? 100 : Math.min(100, (levelProgress / maxLevelProgress) * 100);
            progressFill.style.width = `${percentage}%`;
        }
        if (levelText) {
            levelText.innerText = isBossActive ? `LEVEL ${currentLevel} - BOSS FIGHT!` : `LEVEL ${currentLevel}`;
        }
    }

    // --- 3. Scene, Renderer & Lighting ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.005);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.touchAction = 'none';
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333355, 0.6);
    scene.add(hemiLight);

    // --- 4. Track & Environment ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 2000;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 25 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    const starGroup = new THREE.Group();
    const starGeo = new THREE.SphereGeometry(0.2, 4, 4);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 200; i++) {
        const star = new THREE.Mesh(starGeo, starMat);
        const side = Math.random() < 0.5 ? -1 : 1;
        star.position.set(
            side * (12 + Math.random() * 50),
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * trackLength
        );
        starGroup.add(star);
    }
    scene.add(starGroup);

    // --- 5. HP Mechanics ---
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
        hpBar.style.boxShadow = `0 0 12px ${colorHex}`;
    }

    // --- 6. Lizard Enemies & Boss ---
    const lizards = [];
    let lizardSpawnTimer = 0;

    const ENEMY_TYPES = {
        STANDARD: { skinColor: 0x16a34a, scale: 1.2, speed: 16.0, hp: 1, scoreVal: 30 },
        FAST:     { skinColor: 0xeab308, scale: 0.9, speed: 24.0, hp: 1, scoreVal: 50 },
        ARMORED:  { skinColor: 0x9333ea, scale: 1.6, speed: 10.0, hp: 4, scoreVal: 100 }
    };

    function createLizardMesh(typeConfig) {
        const lizardGroup = new THREE.Group();
        const skinMat = new THREE.MeshPhongMaterial({ color: typeConfig.skinColor, shininess: 50 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.0), skinMat);
        body.position.y = 1.2;
        lizardGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), skinMat);
        head.position.set(0, 2.3, 0.2);
        lizardGroup.add(head);

        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
        eyeL.position.set(-0.25, 2.4, 0.6);
        lizardGroup.add(eyeL);

        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
        eyeR.position.set(0.25, 2.4, 0.6);
        lizardGroup.add(eyeR);

        lizardGroup.scale.setScalar(typeConfig.scale);
        lizardGroup.userData = { hp: typeConfig.hp, speed: typeConfig.speed, scoreVal: typeConfig.scoreVal };

        return lizardGroup;
    }

    function spawnLizard() {
        if (isBossActive) return;
        const rand = Math.random();
        let config = ENEMY_TYPES.STANDARD;
        if (rand > 0.75) config = ENEMY_TYPES.ARMORED;
        else if (rand > 0.5) config = ENEMY_TYPES.FAST;

        const lizard = createLizardMesh(config);
        const spawnX = (Math.random() - 0.5) * (trackWidth - 3);
        const spawnZ = cannonGroup.position.z - 120 - Math.random() * 30;

        lizard.position.set(spawnX, 0, spawnZ);
        scene.add(lizard);
        lizards.push(lizard);
    }

    function spawnBoss() {
        isBossActive = true;
        updateLevelUI();

        const bossConfig = { skinColor: 0xd97706, scale: 3.5, speed: 4.5, hp: 40 + (currentLevel * 20), scoreVal: 1000 };
        activeBoss = createLizardMesh(bossConfig);
        activeBoss.position.set(0, 0, cannonGroup.position.z - 110);
        activeBoss.userData.maxHp = bossConfig.hp;
        scene.add(activeBoss);
    }

    function updateLizards(delta) {
        if (!isBossActive) {
            lizardSpawnTimer += delta;
            if (lizardSpawnTimer >= 2.2) {
                lizardSpawnTimer = 0;
                spawnLizard();
            }
        }

        for (let i = lizards.length - 1; i >= 0; i--) {
            const liz = lizards[i];
            liz.position.z += liz.userData.speed * delta;

            if (liz.position.distanceTo(cannonGroup.position) < 1.8) {
                currentHp -= 100;
                updateHpBar();
                playSound('hit');
                scene.remove(liz);
                lizards.splice(i, 1);
                if (currentHp <= 0) { gameOver(); return; }
                continue;
            }

            if (liz.position.z > cannonGroup.position.z + 10) {
                scene.remove(liz);
                lizards.splice(i, 1);
            }
        }

        if (isBossActive && activeBoss) {
            if (activeBoss.position.z < cannonGroup.position.z - 18) {
                activeBoss.position.z += activeBoss.userData.speed * delta;
            }

            if (activeBoss.position.distanceTo(cannonGroup.position) < 4.0) {
                currentHp -= 200;
                updateHpBar();
                playSound('hit');
                if (currentHp <= 0) gameOver();
            }
        }
    }

    // --- 7. High-Detail Cannon with Side Thrusters ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseMat = new THREE.MeshPhongMaterial({ color: 0x2563eb, shininess: 80 });
    const domeMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6, shininess: 90 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 20), baseMat);
    base.rotation.x = Math.PI / 12;
    cannonMeshGroup.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 60 });
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelL);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelR);

    // מדחפים בצידי התותח
    const thrusterMat = new THREE.MeshPhongMaterial({ color: 0x1e293b, shininess: 40 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 12), thrusterMat);
    thrusterL.rotation.z = Math.PI / 2;
    thrusterL.position.set(-1.3, 0.2, 0);
    cannonMeshGroup.add(thrusterL);

    const glowL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), glowMat);
    glowL.position.set(-1.6, 0.2, 0);
    cannonMeshGroup.add(glowL);

    const thrusterR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 12), thrusterMat);
    thrusterR.rotation.z = -Math.PI / 2;
    thrusterR.position.set(1.3, 0.2, 0);
    cannonMeshGroup.add(thrusterR);

    const glowR = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), glowMat);
    glowR.position.set(1.6, 0.2, 0);
    cannonMeshGroup.add(glowR);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

    function updateCannonColor(hexColor) {
        baseMat.color.set(hexColor);
        domeMat.color.set(hexColor);
    }

    // --- 8. Bullets ---
    const bulletGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const bulletMat = new THREE.MeshPhongMaterial({ color: 0xfacc15, emissive: 0xca8a04, shininess: 100 });
    const bullets = [];

    function spawnBullet(x, z) {
        const b = new THREE.Mesh(bulletGeo, bulletMat);
        b.scale.set(1, 1, 2.5);
        b.position.set(x, 1.1, z);
        scene.add(b);
        bullets.push(b);
    }

    // --- 8.5. מערכת החלקיקים (Particles System) ---
    const activeParticleSystems = [];

    function createGateParticles(position, isMultiply) {
        const count = 18;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        const particleColor = isMultiply ? 0x10b981 : 0x0284c7;

        for (let i = 0; i < count; i++) {
            positions.push(position.x, position.y, position.z);
            velocities.push(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.2) * 0.4 + 0.1,
                (Math.random() - 0.5) * 0.35
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: particleColor,
            size: 0.35,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const system = new THREE.Points(geometry, material);
        scene.add(system);

        activeParticleSystems.push({
            system: system,
            velocities: velocities,
            life: 1.0
        });
    }

    function updateParticles(delta) {
        for (let i = activeParticleSystems.length - 1; i >= 0; i--) {
            const p = activeParticleSystems[i];
            p.life -= delta * 2.5;

            if (p.life <= 0) {
                scene.remove(p.system);
                p.system.geometry.dispose();
                p.system.material.dispose();
                activeParticleSystems.splice(i, 1);
                continue;
            }

            const pos = p.system.geometry.attributes.position.array;
            for (let j = 0; j < p.velocities.length / 3; j++) {
                pos[j * 3]     += p.velocities[j * 3];
                pos[j * 3 + 1] += p.velocities[j * 3 + 1];
                pos[j * 3 + 2] += p.velocities[j * 3 + 2];
            }
            p.system.geometry.attributes.position.needsUpdate = true;
            p.system.material.opacity = p.life;
        }
    }

    // --- 9. Gates (שערים עם משתני ציפה וגודל) ---
    const gates = [];
    let gateIdCounter = 1;

    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, 244, 244);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);

        return new THREE.CanvasTexture(canvas);
    }

    function createGate(id, x, z, type, value) {
        const gateGroup = new THREE.Group();
        const gateWidth = trackWidth / 2 - 0.6;
        let label = `+${value}`, colorHex = 'rgba(2, 132, 199, 0.85)';
        if (type === 'multiply') { label = `x${value}`; colorHex = 'rgba(16, 185, 129, 0.85)'; }

        const frameMat = new THREE.MeshBasicMaterial({ map: createGateTexture(label, colorHex), transparent: true });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 4.2, 0.2), frameMat);
        frame.position.y = 2.1;
        gateGroup.add(frame);
        gateGroup.position.set(x, 0, z);
        
        // נתונים נדרשים לאנימציית הציפה וה-Punch
        gateGroup.userData = { 
            id, 
            type, 
            value, 
            width: gateWidth, 
            height: 4.2,
            baseY: 0,
            floatOffset: Math.random() * Math.PI * 2,
            hitScale: 1.0
        };

        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    function updateGates(elapsedTime, delta) {
        for (let g of gates) {
            const gData = g.userData;

            // 1. ציפה קלה בלולאה למעלה/למטה
            const floatY = Math.sin(elapsedTime * 3 + gData.floatOffset) * 0.15;
            g.position.y = gData.baseY + floatY;

            // 2. החזרת גודל השער בהדרגה לקדמותו לאחר פגיעה
            if (gData.hitScale > 1.0) {
                gData.hitScale = THREE.MathUtils.lerp(gData.hitScale, 1.0, delta * 12);
                g.scale.set(gData.hitScale, gData.hitScale, gData.hitScale);
            }
        }
    }

    function spawnGatePairAt(z) {
        const offset = trackWidth / 4;
        if (Math.random() > 0.5) {
            createGate(`g_${gateIdCounter++}`, -offset, z, 'multiply', 2);
            createGate(`g_${gateIdCounter++}`, offset, z, 'add', 20);
        } else {
            createGate(`g_${gateIdCounter++}`, -offset, z, 'add', 15);
            createGate(`g_${gateIdCounter++}`, offset, z, 'multiply', 3);
        }
    }

    for (let z = -80; z >= -800; z -= 65) {
        spawnGatePairAt(z);
    }

    // --- 10. Touch / Drag Controls ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    function stopInput() { isDragging = false; isFiring = false; }

    renderer.domElement.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        isDragging = true; 
        isFiring = true; 
        previousTouchX = e.touches[0].clientX; 
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchend', (e) => { 
        e.preventDefault();
        stopInput(); 
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.045;
            previousTouchX = e.touches[0].clientX;
        }
    }, { passive: false });

    renderer.domElement.addEventListener('mousedown', (e) => { isDragging = true; isFiring = true; previousTouchX = e.clientX; });
    renderer.domElement.addEventListener('mouseup', stopInput);
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.045;
            previousTouchX = e.clientX;
        }
    });

    // --- 11. UI & Game State ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    function resetGame() {
        score = 0;
        currentHp = maxHp;
        currentLevel = 1;
        levelProgress = 0;
        isBossActive = false;
        
        if (activeBoss) { scene.remove(activeBoss); activeBoss = null; }
        for (let liz of lizards) scene.remove(liz);
        lizards.length = 0;
        for (let b of bullets) scene.remove(b);
        bullets.length = 0;

        cannonGroup.position.set(0, 1.2, 0);
        targetX = 0;

        const scoreVal = document.getElementById('score-val');
        if (scoreVal) scoreVal.innerText = '0';

        updateHpBar();
        updateLevelUI();
    }

    function gameOver() {
        gameStarted = false;
        stopInput();

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('cannon_high_score', highScore);
        }

        const gameOverModal = document.getElementById('game-over-modal');
        const finalScoreVal = document.getElementById('final-score-val');
        const bestScoreVal = document.getElementById('best-score-val');

        if (finalScoreVal) finalScoreVal.innerText = score;
        if (bestScoreVal) bestScoreVal.innerText = highScore;
        if (gameOverModal) gameOverModal.classList.remove('hidden');
    }

    document.getElementById('restart-btn')?.addEventListener('click', () => {
        document.getElementById('game-over-modal')?.classList.add('hidden');
        resetGame();
        gameStarted = true;
    });

    document.getElementById('start-btn')?.addEventListener('click', () => {
        initAudio();
        resetGame();
        gameStarted = true;
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) {
            startOverlay.style.opacity = '0';
            setTimeout(() => startOverlay.classList.add('hidden'), 300);
        }
    });

    document.getElementById('pause-btn')?.addEventListener('click', () => {
        if (!gameStarted) return;
        isPaused = true;
        document.getElementById('pause-menu')?.classList.remove('hidden');
    });

    document.getElementById('resume-btn')?.addEventListener('click', () => { 
        isPaused = false; 
        document.getElementById('pause-menu')?.classList.add('hidden'); 
    });

    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const selectedColor = e.target.getAttribute('data-color');
            if (selectedColor) updateCannonColor(selectedColor);
        });
    });

    // --- 12. Main Render Loop ---
    const clock = new THREE.Clock();
    let currentX = 0;

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);

        if (!gameStarted || isPaused) return;

        const delta = Math.min(clock.getDelta(), 0.1);
        const elapsedTime = clock.getElapsedTime();

        updateLizards(delta);
        updateParticles(delta);
        updateGates(elapsedTime, delta); // מעדכן ציפה ורעד שערים

        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        currentX = THREE.MathUtils.lerp(currentX, targetX, 0.25);
        cannonGroup.position.x = currentX;

        camera.position.x = cannonGroup.position.x * 0.15;
        camera.position.y = cannonGroup.position.y + 12.5;
        camera.position.z = cannonGroup.position.z + 18.0;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 0.5, cannonGroup.position.z - 10.0);

        shootTimer += delta;
        if (isFiring && shootTimer >= 0.15) {
            spawnBullet(cannonGroup.position.x - 0.45, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.45, cannonGroup.position.z - 1.2);
            playSound('shoot');
            shootTimer = 0;
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 80 * delta;

            if (b.position.z < cannonGroup.position.z - 120) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            // פגיעה בשערים + הפעלת חלקיקים ואפקט Scale Punch לשער
            for (let g of gates) {
                const gData = g.userData;
                const halfW = gData.width / 2;
                if (Math.abs(b.position.x - g.position.x) < halfW && Math.abs(b.position.z - g.position.z) < 1.0) {
                    createGateParticles(b.position, gData.type === 'multiply');
                    gData.hitScale = 1.18; // הגדלת השער לשבריר שנייה בזמן פגיעה
                    break;
                }
            }

            if (isBossActive && activeBoss) {
                if (b.position.distanceTo(activeBoss.position) < 3.2) {
                    playSound('boss_hit');
                    activeBoss.userData.hp -= 1;
                    scene.remove(b);
                    bullets.splice(i, 1);

                    if (activeBoss.userData.hp <= 0) {
                        score += activeBoss.userData.scoreVal;
                        document.getElementById('score-val').innerText = score;
                        scene.remove(activeBoss);
                        activeBoss = null;
                        isBossActive = false;
                        currentLevel++;
                        levelProgress = 0;
                        updateLevelUI();
                    }
                    continue;
                }
            }

            for (let k = lizards.length - 1; k >= 0; k--) {
                const liz = lizards[k];
                if (b.position.distanceTo(liz.position) < 1.6) {
                    playSound('hit');
                    liz.userData.hp -= 1;
                    scene.remove(b);
                    bullets.splice(i, 1);

                    if (liz.userData.hp <= 0) {
                        score += liz.userData.scoreVal;
                        document.getElementById('score-val').innerText = score;

                        if (!isBossActive) {
                            levelProgress += 10;
                            if (levelProgress >= maxLevelProgress) spawnBoss();
                            else updateLevelUI();
                        }

                        scene.remove(liz);
                        lizards.splice(k, 1);
                    }
                    break;
                }
            }
        }
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});