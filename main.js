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

    // --- 3. Scene & Advanced Visuals Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4; // חשיפה עוצמתית לברק נאוון

    renderer.domElement.style.touchAction = 'none';
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // מערך תאורה עשיר ויוקרתי
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    mainLight.position.set(15, 40, 20);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 2.8); // Rim Light חזק להדגשת קצוות הלטאות והתותח
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

        return new THREE.CanvasTexture(canvas);
    }

    const galaxySkyGeo = new THREE.SphereGeometry(800, 32, 32);
    const galaxySkyMat = new THREE.MeshBasicMaterial({ map: createGalaxyTexture(), side: THREE.BackSide });
    const galaxySky = new THREE.Mesh(galaxySkyGeo, galaxySkyMat);
    scene.add(galaxySky);

    // --- 4. Metallic Track & Round Streaming Stars ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 2000;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x070d1e, 
        roughness: 0.1, 
        metalness: 0.9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.08
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    const railGeo = new THREE.BoxGeometry(0.3, 0.6, trackLength);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    
    const railLeft = new THREE.Mesh(railGeo, railMat);
    railLeft.position.set(-trackWidth / 2, 0.1, -trackLength / 2 + 10);
    scene.add(railLeft);

    const railRight = new THREE.Mesh(railGeo, railMat);
    railRight.position.set(trackWidth / 2, 0.1, -trackLength / 2 + 10);
    scene.add(railRight);

    // --- טקסטורת כוכב עגולה, זוהרת ורכה ---
    function createRoundStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.85)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }

    const starCount = 700;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starSpeeds = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        starPos[i * 3]     = (Math.random() - 0.5) * 70;
        starPos[i * 3 + 1] = Math.random() * 35 - 3;
        starPos[i * 3 + 2] = -Math.random() * 250;
        starSpeeds[i]      = 40 + Math.random() * 50;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));

    const starMat = new THREE.PointsMaterial({
        size: 1.8,
        map: createRoundStarTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    function updateStars(delta) {
        const positions = starField.geometry.attributes.position.array;
        for (let i = 0; i < starCount; i++) {
            positions[i * 3 + 2] += starSpeeds[i] * delta;
            if (positions[i * 3 + 2] > 15) {
                positions[i * 3 + 2] = -230;
                positions[i * 3] = (Math.random() - 0.5) * 70;
                positions[i * 3 + 1] = Math.random() * 35 - 3;
            }
        }
        starField.geometry.attributes.position.needsUpdate = true;
    }

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

        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.6), skinMat);
        body.position.set(0, 0.8, 0);
        lizardGroup.add(body);

        const headGeo = new THREE.ConeGeometry(1.1, 1.8, 4);
        headGeo.rotateX(-Math.PI / 2);
        headGeo.rotateY(Math.PI / 4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.0, 1.8);
        lizardGroup.add(head);

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
                triggerCameraShake(0.3);
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
                triggerCameraShake(0.5);
                if (currentHp <= 0) gameOver();
            }
        }
    }

    // --- 7. Metallic Cannon & Real-Time Color Picker ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.15, metalness: 0.85 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.95 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 24), baseMat);
    base.rotation.x = Math.PI / 12;
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

    // חיבור בחירת הצבעים ב-UI
    window.changeCannonColor = function(hexColor) {
        baseMat.color.set(hexColor);
    };

    // --- 8. Glowing Bullets & Dynamic Glow ---
    const bulletGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bullets = [];

    // מקור אור יחיד ויעיל שמלווה את מטח הירי בלי להאיט את המשחק!
    const bulletLight = new THREE.PointLight(0x38bdf8, 3.5, 20);
    bulletLight.visible = false;
    scene.add(bulletLight);

    function spawnBullet(x, z) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.scale.set(1, 1, 2.2);
        bullet.position.set(x, 1.1, z);
        scene.add(bullet);
        bullets.push(bullet);
    }

    function updateBullets(delta) {
        if (bullets.length > 0) {
            bulletLight.visible = true;
            const leadBullet = bullets[bullets.length - 1];
            bulletLight.position.set(leadBullet.position.x, 1.5, leadBullet.position.z);
        } else {
            bulletLight.visible = false;
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 95.0 * delta;

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
                playSound('hit');
                triggerCameraShake(0.1);
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

    // --- 9. Controls ---
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

    // --- 10. Game State ---
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

    // --- 11. Main Render Loop ---
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);
        const elapsedTime = clock.getElapsedTime();

        // עדכון כוכבים עגולים וזורמים
        updateStars(delta);

        if (gameStarted && !isPaused) {
            targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
            const prevX = cannonGroup.position.x;
            cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, delta * 12);
            
            const moveDelta = cannonGroup.position.x - prevX;
            cannonMeshGroup.rotation.z = -moveDelta * 0.8;
            cannonMeshGroup.rotation.x = Math.sin(elapsedTime * 8) * 0.03;

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