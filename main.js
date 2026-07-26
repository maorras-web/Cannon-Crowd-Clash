window.addEventListener('DOMContentLoaded', () => {

    // --- 1. Pure Synthetic Audio Engine ---
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
        } catch (e) {
            console.warn("AudioContext error:", e);
        }
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
            } else if (type === 'gate') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

                osc.start(now);
                osc.stop(now + 0.12);
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
            if (masterGainNode) {
                masterGainNode.gain.value = masterVolume;
            }
        });
    }

    // --- 2. Game Progression & Level State ---
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

    // --- 3. Scene & Lighting ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // --- 4. Track & Space World ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 2000;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    let environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    function initSpaceWorld() {
        const starGeo = new THREE.SphereGeometry(0.2, 4, 4);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const safetyOffset = (trackWidth / 2) + 4.0;

        for (let i = 0; i < 400; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            const side = Math.random() < 0.5 ? -1 : 1;
            
            star.position.set(
                side * (safetyOffset + Math.random() * 80),
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * trackLength
            );
            environmentGroup.add(star);
        }
    }

    initSpaceWorld();

    // --- 5. HP Health Bar Mechanics ---
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
        if (percentage < 30) {
            colorHex = '#ef4444';
        } else if (percentage < 60) {
            colorHex = '#eab308';
        }

        hpBar.style.backgroundColor = colorHex;
        hpBar.style.boxShadow = `0 0 12px ${colorHex}`;
    }

    // --- 6. Enemies & Boss Factory ---
    const lizards = [];
    let lizardSpawnTimer = 0;
    const lizardSpawnInterval = 2.5;

    const ENEMY_TYPES = {
        STANDARD: { skinColor: 0x1e5622, scale: 1.2, speed: 16.0, hp: 1, scoreVal: 30 },
        FAST:     { skinColor: 0xd97706, scale: 0.9, speed: 25.0, hp: 1, scoreVal: 50 },
        ARMORED:  { skinColor: 0x581c87, scale: 1.6, speed: 10.0, hp: 4, scoreVal: 100 }
    };

    function createLizardMesh(typeConfig) {
        const lizardGroup = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color: typeConfig.skinColor, roughness: 0.5 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

        const bodyGeo = new THREE.BoxGeometry(1.0, 1.8, 1.0);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.y = 1.2;
        lizardGroup.add(body);

        const headGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 2.3, 0.2);
        lizardGroup.add(head);

        const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), eyeMat);
        eyeLeft.position.set(-0.25, 2.4, 0.6);
        lizardGroup.add(eyeLeft);

        const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), eyeMat);
        eyeRight.position.set(0.25, 2.4, 0.6);
        lizardGroup.add(eyeRight);

        lizardGroup.scale.setScalar(typeConfig.scale);
        lizardGroup.userData = { 
            hp: typeConfig.hp, 
            speed: typeConfig.speed, 
            scoreVal: typeConfig.scoreVal
        };

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

        const bossConfig = { skinColor: 0xd97706, scale: 3.5, speed: 4.0, hp: 40 + (currentLevel * 20), scoreVal: 1000 };
        activeBoss = createLizardMesh(bossConfig);
        activeBoss.position.set(0, 0, cannonGroup.position.z - 100);
        activeBoss.userData.maxHp = bossConfig.hp;
        scene.add(activeBoss);
    }

    function updateLizards(delta) {
        if (!isBossActive) {
            lizardSpawnTimer += delta;
            if (lizardSpawnTimer >= lizardSpawnInterval) {
                lizardSpawnTimer = 0;
                spawnLizard();
            }
        }

        for (let i = lizards.length - 1; i >= 0; i--) {
            const liz = lizards[i];
            liz.position.z += liz.userData.speed * delta;

            const distToCannon = liz.position.distanceTo(cannonGroup.position);
            if (distToCannon < 1.8) {
                currentHp -= 100;
                updateHpBar();
                playSound('hit');

                scene.remove(liz);
                lizards.splice(i, 1);

                if (currentHp <= 0) {
                    gameOver();
                    return;
                }
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

            const distToCannon = activeBoss.position.distanceTo(cannonGroup.position);
            if (distToCannon < 4.0) {
                currentHp -= 200;
                updateHpBar();
                playSound('hit');

                if (currentHp <= 0) {
                    gameOver();
                }
            }
        }
    }

    // --- 7. Cannon ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.2 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.2 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.8, 16), baseMat);
    base.rotation.x = Math.PI / 12;
    cannonMeshGroup.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const barrelLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.8, 12), barrelMat);
    barrelLeft.rotation.x = Math.PI / 2;
    barrelLeft.position.set(-0.45, 0.35, -0.9);
    cannonMeshGroup.add(barrelLeft);

    const barrelRight = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.8, 12), barrelMat);
    barrelRight.rotation.x = Math.PI / 2;
    barrelRight.position.set(0.45, 0.35, -0.9);
    cannonMeshGroup.add(barrelRight);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

    function updateCannonColor(hexColor) {
        baseMat.color.set(hexColor);
        domeMat.color.set(hexColor);
    }

    // --- 8. Bullets ---
    const bulletGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfbfb04 });
    const bullets = [];

    function spawnBullet(x, z) {
        const b = new THREE.Mesh(bulletGeo, bulletMat);
        b.position.set(x, 1.1, z);
        scene.add(b);
        bullets.push(b);
    }

    // --- 9. Gates System ---
    const gates = [];
    let gateIdCounter = 1;
    const GATE_GAP = 60; 
    const SPAWN_LIMIT_Z = -800; 

    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 45px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    function createGate(id, x, z, type, value) {
        const gateGroup = new THREE.Group();
        const gateWidth = trackWidth / 2 - 0.6;
        let label = `+${value}`, colorHex = '#0284c7';
        if (type === 'multiply') { label = `x${value}`; colorHex = '#10b981'; }

        const frameMat = new THREE.MeshStandardMaterial({ map: createGateTexture(label, colorHex), transparent: true });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 4.0, 0.2), frameMat);
        frame.position.y = 2.0;
        gateGroup.add(frame);
        gateGroup.position.set(x, 0, z);
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

    for (let z = -80; z >= SPAWN_LIMIT_Z; z -= GATE_GAP) {
        spawnGatePairAt(z);
    }

    // --- 10. Controls ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    function stopInput() {
        isDragging = false;
        isFiring = false;
    }

    window.addEventListener('mousedown', (e) => { isDragging = true; isFiring = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', stopInput);
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.035;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; isFiring = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', stopInput);
    window.addEventListener('touchmove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.035;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 11. UI & Game Loop ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    function resetGame() {
        score = 0;
        currentHp = maxHp;
        currentLevel = 1;
        levelProgress = 0;
        isBossActive = false;
        
        if (activeBoss) {
            scene.remove(activeBoss);
            activeBoss = null;
        }

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

    // --- 12. Main Loop ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        // Render scene constantly so screen is never black
        renderer.render(scene, camera);

        if (!gameStarted || isPaused) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        updateLizards(delta);

        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.2);

        camera.position.x = cannonGroup.position.x * 0.2;
        camera.position.y = cannonGroup.position.y + 12.5;
        camera.position.z = cannonGroup.position.z + 18.0;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 0.5, cannonGroup.position.z - 10.0);

        shootTimer += delta;
        if (isFiring && shootTimer >= 0.12) {
            spawnBullet(cannonGroup.position.x - 0.45, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.45, cannonGroup.position.z - 1.2);
            playSound('shoot');
            shootTimer = 0;
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 55 * delta;

            if (b.position.z < cannonGroup.position.z - 120) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
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