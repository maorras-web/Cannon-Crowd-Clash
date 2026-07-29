window.addEventListener('DOMContentLoaded', () => {

    // --- 0. Touch Hijacking & UI Setup ---
    document.documentElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    
    const uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
        uiContainer.style.pointerEvents = 'none';
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.style.pointerEvents = 'auto';
    }

    function requestFullScreen() {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        }
    }

    // --- 1. Audio Engine ---
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
                osc.frequency.setValueAtTime(700, now);
                osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'hit') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'boss_hit') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch(e) {}
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

    // --- 3. Scene, Visuals & Advanced Lighting ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.008); // ערפל עתידני כהה לעומק

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4; // חשיפה עוצמתית לברק
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.touchAction = 'none';
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- מערך תאורה מתקדם ---
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.2); // תאורת סביבה כחולה-סגולה
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.0); // תאורה ראשית קרה
    mainLight.position.set(15, 40, 20);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 2.5); // אור אחורי סגול (Rim Light) להדגשת קצוות
    rimLight.position.set(-15, 20, -30);
    scene.add(rimLight);

    let cameraShakeIntensity = 0;
    let cannonRecoilZ = 0;

    function triggerCameraShake(intensity) {
        cameraShakeIntensity = Math.max(cameraShakeIntensity, intensity);
    }

    // --- 3.1. DARK PURPLE NEBULA SKYBOX ---
    function createGalaxyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048; canvas.height = 2048;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#020208';
        ctx.fillRect(0, 0, 2048, 2048);

        const nebulae = [
            { x: 500,  y: 600,  r: 800, color: 'rgba(99, 102, 241, 0.65)' },
            { x: 1500, y: 500,  r: 950, color: 'rgba(168, 85, 247, 0.70)' },
            { x: 1000, y: 1400, r: 750, color: 'rgba(236, 72, 153, 0.50)' }
        ];

        nebulae.forEach(n => {
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            grad.addColorStop(0, n.color);
            grad.addColorStop(0.5, n.color.replace(/[\d\.]+\)$/, '0.25)'));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 2048, 2048);
        });

        for (let i = 0; i < 1500; i++) {
            const x = Math.random() * 2048;
            const y = Math.random() * 2048;
            const radius = Math.random() * 1.8;
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.9 + 0.1})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    const galaxySkyGeo = new THREE.SphereGeometry(800, 32, 32);
    const galaxySkyMat = new THREE.MeshBasicMaterial({ map: createGalaxyTexture(), side: THREE.BackSide });
    const galaxySky = new THREE.Mesh(galaxySkyGeo, galaxySkyMat);
    scene.add(galaxySky);

    // --- 4. High-Tech Track & Speed Dust ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 2000;

    // מסלול מבריק במראה זכוכית/מתכת
    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x070d1e, 
        roughness: 0.1, 
        metalness: 0.9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.05
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    track.receiveShadow = true;
    scene.add(track);

    // פסי ניאון זוהרים בצדי המסלול
    const railGeo = new THREE.BoxGeometry(0.3, 0.6, trackLength);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    
    const railLeft = new THREE.Mesh(railGeo, railMat);
    railLeft.position.set(-trackWidth / 2, 0.1, -trackLength / 2 + 10);
    scene.add(railLeft);

    const railRight = new THREE.Mesh(railGeo, railMat);
    railRight.position.set(trackWidth / 2, 0.1, -trackLength / 2 + 10);
    scene.add(railRight);

    // אבק מהירות (Speed Dust / Space Particles)
    const dustCount = 800;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3]     = (Math.random() - 0.5) * 40;
        dustPos[i * 3 + 1] = Math.random() * 20;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.25, transparent: true, opacity: 0.6 });
    const speedDust = new THREE.Points(dustGeo, dustMat);
    scene.add(speedDust);

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
        hpBar.style.boxShadow = `0 0 14px ${colorHex}`;
    }

    // --- 6. Lizards & Enemies ---
    const lizards = [];
    let lizardSpawnTimer = 0;

    const ENEMY_TYPES = {
        STANDARD: { skinColor: 0x16a34a, eyeColor: 0xef4444, scale: 1.1, speed: 16.0, hp: 1, scoreVal: 30 },
        FAST:     { skinColor: 0xca8a04, eyeColor: 0x38bdf8, scale: 0.85, speed: 24.0, hp: 1, scoreVal: 50 },
        ARMORED:  { skinColor: 0x7e22ce, eyeColor: 0xfacc15, scale: 1.5, speed: 10.0, hp: 4, scoreVal: 100 }
    };

    function createLizardMesh(typeConfig) {
        const lizardGroup = new THREE.Group();

        const skinMat = new THREE.MeshStandardMaterial({ 
            color: typeConfig.skinColor, 
            roughness: 0.25, 
            metalness: 0.4 
        });

        const eyeMat = new THREE.MeshBasicMaterial({ color: typeConfig.eyeColor });

        // גוף
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.6), skinMat);
        body.position.set(0, 0.8, 0);
        body.castShadow = true;
        lizardGroup.add(body);

        // ראש
        const headGeo = new THREE.ConeGeometry(1.1, 1.8, 4);
        headGeo.rotateX(-Math.PI / 2);
        headGeo.rotateY(Math.PI / 4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.0, 1.8);
        head.castShadow = true;
        lizardGroup.add(head);

        // עיניים זוהרות
        const eyeGeo = new THREE.SphereGeometry(0.3, 12, 12);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.75, 1.2, 1.8);
        lizardGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.75, 1.2, 1.8);
        lizardGroup.add(eyeR);

        lizardGroup.rotation.y = Math.PI;
        lizardGroup.scale.setScalar(typeConfig.scale * 1.35);
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

        const bossConfig = { skinColor: 0xd97706, eyeColor: 0xef4444, scale: 3.5, speed: 4.5, hp: 40 + (currentLevel * 20), scoreVal: 1000 };
        activeBoss = createLizardMesh(bossConfig);
        activeBoss.position.set(0, 0, cannonGroup.position.z - 110);
        activeBoss.userData.maxHp = bossConfig.hp;
        scene.add(activeBoss);
    }

    function updateLizards(delta) {
        if (!isBossActive) {
            lizardSpawnTimer += delta;
            if (lizardSpawnTimer >= 2.0) {
                lizardSpawnTimer = 0;
                spawnLizard();
            }
        }

        for (let i = lizards.length - 1; i >= 0; i--) {
            const liz = lizards[i];
            liz.position.z += liz.userData.speed * delta;

            if (liz.position.distanceTo(cannonGroup.position) < 2.5) {
                currentHp -= 100;
                updateHpBar();
                playSound('hit');
                triggerCameraShake(0.4);
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

            if (activeBoss.position.distanceTo(cannonGroup.position) < 5.0) {
                currentHp -= 200;
                updateHpBar();
                playSound('hit');
                triggerCameraShake(0.6);
                if (currentHp <= 0) gameOver();
            }
        }
    }

    // --- 7. Metallic Cannon & Engine Fire ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    // חומרים מתכתיים ומבריקים לתותח
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.15, metalness: 0.85 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.95 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 24), baseMat);
    base.rotation.x = Math.PI / 12;
    base.castShadow = true;
    cannonMeshGroup.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelL);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelR);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

    // --- 8. Glowing Bullets & Dynamic PointLights ---
    const bulletGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const bullets = [];

    function spawnBullet(x, z) {
        const bulletGroup = new THREE.Group();

        const mainBullet = new THREE.Mesh(bulletGeo, bulletMat);
        mainBullet.scale.set(1, 1, 2.0);
        bulletGroup.add(mainBullet);

        // אור נקודתי דינמי שמאיר את המסלול בזמן הטיסה!
        const bulletLight = new THREE.PointLight(0x38bdf8, 3.0, 12);
        bulletLight.position.set(0, 0.5, 0);
        bulletGroup.add(bulletLight);

        bulletGroup.position.set(x, 1.1, z);
        scene.add(bulletGroup);
        bullets.push(bulletGroup);
    }

    function updateBullets(delta) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 90.0 * delta;

            let hitEnemy = false;
            for (let j = lizards.length - 1; j >= 0; j--) {
                const liz = lizards[j];
                if (b.position.distanceTo(liz.position) < 1.6) {
                    liz.userData.hp--;
                    if (liz.userData.hp <= 0) {
                        score += liz.userData.scoreVal;
                        levelProgress += 5;
                        updateLevelUI();
                        scene.remove(liz);
                        lizards.splice(j, 1);
                        if (levelProgress >= maxLevelProgress && !isBossActive) {
                            spawnBoss();
                        }
                    }
                    hitEnemy = true;
                    playSound('hit');
                    break;
                }
            }

            if (hitEnemy) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            if (isBossActive && activeBoss && b.position.distanceTo(activeBoss.position) < 3.5) {
                activeBoss.userData.hp--;
                playSound('boss_hit');
                triggerCameraShake(0.15);
                scene.remove(b);
                bullets.splice(i, 1);

                if (activeBoss.userData.hp <= 0) {
                    scene.remove(activeBoss);
                    activeBoss = null;
                    isBossActive = false;
                    score += 1000;
                    currentLevel++;
                    levelProgress = 0;
                    updateLevelUI();
                }
                continue;
            }

            if (b.position.z < cannonGroup.position.z - 160) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }
    }

    // --- 9. Gates ---
    const gates = [];
    let gateIdCounter = 1;

    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 14;
        ctx.strokeRect(6, 6, 244, 244);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px sans-serif';
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

        const frameMat = new THREE.MeshBasicMaterial({ 
            map: createGateTexture(label, colorHex), 
            transparent: true 
        });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 4.2, 0.2), frameMat);
        frame.position.y = 2.1;
        gateGroup.add(frame);
        gateGroup.position.set(x, 0, z);
        
        gateGroup.userData = { id, type, value, width: gateWidth, height: 4.2, baseY: 0, floatOffset: Math.random() * Math.PI * 2 };

        scene.add(gateGroup);
        gates.push(gateGroup);
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

    for (let z = -80; z >= -800; z -= 65) spawnGatePairAt(z);

    // --- 10. Controls ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    function stopInput() { isDragging = false; isFiring = false; }

    renderer.domElement.addEventListener('touchstart', (e) => { 
        e.preventDefault(); isDragging = true; isFiring = true; previousTouchX = e.touches[0].clientX; 
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchend', (e) => { e.preventDefault(); stopInput(); }, { passive: false });
    
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

    // --- 11. Game State ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    function resetGame() {
        score = 0; currentHp = maxHp; currentLevel = 1; levelProgress = 0;
        isBossActive = false; cameraShakeIntensity = 0; cannonRecoilZ = 0;
        
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
        gameStarted = false; stopInput();
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
        requestFullScreen();
        document.getElementById('game-over-modal')?.classList.add('hidden');
        resetGame();
        gameStarted = true;
    });

    document.getElementById('start-btn')?.addEventListener('click', () => {
        requestFullScreen();
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
        requestFullScreen();
        isPaused = false; 
        document.getElementById('pause-menu')?.classList.add('hidden'); 
    });

    // --- 12. Main Render Loop ---
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);
        const elapsedTime = clock.getElapsedTime();

        if (gameStarted && !isPaused) {
            // תנועה חלקה לתותח + הטיה קלה (Tilt) לכיוון התנועה
            targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
            const prevX = cannonGroup.position.x;
            cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, delta * 12);
            
            // הטיות דינמיות
            const moveDelta = cannonGroup.position.x - prevX;
            cannonMeshGroup.rotation.z = -moveDelta * 0.8; // הטיה לצדדים
            cannonMeshGroup.rotation.x = Math.sin(elapsedTime * 8) * 0.03; // ריחופ קל

            // תנועת אבק המהירות
            const dustPositions = speedDust.geometry.attributes.position.array;
            for (let i = 0; i < dustCount; i++) {
                dustPositions[i * 3 + 2] += 40 * delta;
                if (dustPositions[i * 3 + 2] > 10) dustPositions[i * 3 + 2] = -150;
            }
            speedDust.geometry.attributes.position.needsUpdate = true;

            // ירי
            shootTimer += delta;
            if (isFiring && shootTimer >= 0.11) {
                shootTimer = 0;
                spawnBullet(cannonGroup.position.x - 0.45, cannonGroup.position.z - 1.2);
                spawnBullet(cannonGroup.position.x + 0.45, cannonGroup.position.z - 1.2);
                playSound('shoot');
                cannonRecoilZ = 0.2;
            }

            cannonRecoilZ = THREE.MathUtils.lerp(cannonRecoilZ, 0, delta * 10);
            cannonMeshGroup.position.z = cannonRecoilZ;

            updateBullets(delta);
            updateLizards(delta);

            // מצלמה
            if (cameraShakeIntensity > 0) {
                cameraShakeIntensity = THREE.MathUtils.lerp(cameraShakeIntensity, 0, delta * 8);
                camera.position.x = cannonGroup.position.x + (Math.random() - 0.5) * cameraShakeIntensity;
                camera.position.y = 8 + (Math.random() - 0.5) * cameraShakeIntensity;
                camera.position.z = cannonGroup.position.z + 12 + (Math.random() - 0.5) * cameraShakeIntensity;
            } else {
                camera.position.x = THREE.MathUtils.lerp(camera.position.x, cannonGroup.position.x, delta * 6);
                camera.position.y = 8;
                camera.position.z = cannonGroup.position.z + 12;
            }
            camera.lookAt(cannonGroup.position.x, 1.0, cannonGroup.position.z - 20);
        }

        renderer.render(scene, camera);
    }

    animate();
});