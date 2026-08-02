window.addEventListener('DOMContentLoaded', () => {

    // --- 0. UI & Touch Controls ---
    document.documentElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';

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
            } else if (type === 'explode') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.25);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch(e) {}
    }

    // --- 2. HighScore & State ---
    let currentLevel = 1;
    let levelProgress = 0;
    const maxLevelProgress = 100;
    let highScore = localStorage.getItem('cannon_high_score') || 0;

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

    // --- 3. Three.js Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(0, 14, 28);
    camera.lookAt(0, 8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    renderer.domElement.style.touchAction = 'none';
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    mainLight.position.set(15, 40, 20);
    scene.add(mainLight);

    let cameraShakeIntensity = 0;
    function triggerCameraShake(intensity) {
        cameraShakeIntensity = Math.max(cameraShakeIntensity, intensity);
    }

    // Arena Bounds
    const arenaWidth = 18;
    const arenaHeight = 22;
    const floorY = 0;
    const maxBoundX = arenaWidth / 2 - 1.2;

    const floorGeo = new THREE.BoxGeometry(arenaWidth, 0.5, 6);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x070d1e, roughness: 0.1, metalness: 0.9, emissive: 0x0284c7, emissiveIntensity: 0.1 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, floorY - 0.25, 0);
    scene.add(floorMesh);

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

    // --- 5. Ball Physics System ---
    const rocks = [];
    const rockColors = [0xff3366, 0xff9900, 0x33cc33, 0x00ccff, 0xcc33ff];

    function createDynamicNumberTexture(text, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 52px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 64);

        return new THREE.CanvasTexture(canvas);
    }

    function spawnRock(x, y, hp, sizeIndex) {
        const sizes = [1.2, 1.8, 2.6];
        const radius = sizes[sizeIndex];
        const color = rockColors[Math.floor(Math.random() * rockColors.length)];

        const geo = new THREE.IcosahedronGeometry(radius, 2);
        const colorHexStr = '#' + color.toString(16).padStart(6, '0');
        
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.2, 
            metalness: 0.5,
            map: createDynamicNumberTexture(hp.toString(), colorHexStr)
        });

        const rockMesh = new THREE.Mesh(geo, mat);
        rockMesh.position.set(x || (Math.random() - 0.5) * (arenaWidth - 4), y || arenaHeight - 2, 0);

        const rockData = {
            mesh: rockMesh,
            vx: (Math.random() - 0.5) * 6,
            vy: -2,
            gravity: -18,
            bounceForce: 12 + sizeIndex * 2.5,
            radius: radius,
            hp: hp,
            maxHp: hp,
            sizeIndex: sizeIndex,
            color: color
        };

        scene.add(rockMesh);
        rocks.push(rockData);
    }

    function updateRocks(delta) {
        for (let i = rocks.length - 1; i >= 0; i--) {
            const r = rocks[i];
            
            r.vy += r.gravity * delta;
            r.mesh.position.x += r.vx * delta;
            r.mesh.position.y += r.vy * delta;
            r.mesh.rotation.x += delta * 2;
            r.mesh.rotation.z += delta * 2;

            if (r.mesh.position.x - r.radius < -arenaWidth / 2 || r.mesh.position.x + r.radius > arenaWidth / 2) {
                r.vx *= -1;
                r.mesh.position.x = THREE.MathUtils.clamp(r.mesh.position.x, -arenaWidth / 2 + r.radius, arenaWidth / 2 - r.radius);
            }

            if (r.mesh.position.y - r.radius <= floorY) {
                r.mesh.position.y = floorY + r.radius;
                r.vy = r.bounceForce;
            }

            if (Math.abs(r.mesh.position.x - cannonGroup.position.x) < r.radius + 1.0 && r.mesh.position.y - r.radius < 1.5) {
                currentHp -= 150;
                updateHpBar();
                playSound('hit');
                triggerCameraShake(0.4);
                r.vy = r.bounceForce;

                if (currentHp <= 0) {
                    gameOver();
                    return;
                }
            }
        }

        if (rocks.length === 0 && gameStarted && !isPaused) {
            spawnRock(-4, arenaHeight - 2, 20 * currentLevel, 2);
            spawnRock(4, arenaHeight - 2, 15 * currentLevel, 1);
        }
    }

    // --- 6. Cannon ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.15, metalness: 0.85 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.95 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 24), baseMat);
    cannonMeshGroup.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelL.position.set(-0.45, 1.2, 0);
    cannonMeshGroup.add(barrelL);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelR.position.set(0.45, 1.2, 0);
    cannonMeshGroup.add(barrelR);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, floorY + 0.5, 0);
    scene.add(cannonGroup);

    window.changeCannonColor = function(hexColor) {
        baseMat.color.set(hexColor);
    };

    // --- 7. Bullets ---
    const bulletGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    const bullets = [];

    function spawnBullet(x, y) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x, y, 0);
        scene.add(bullet);
        bullets.push(bullet);
    }

    function updateBullets(delta) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.y += 45.0 * delta;

            let hit = false;
            for (let j = rocks.length - 1; j >= 0; j--) {
                const r = rocks[j];
                const dist = b.position.distanceTo(r.mesh.position);

                if (dist < r.radius + 0.3) {
                    r.hp--;
                    score += 10;
                    levelProgress += 2;
                    
                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;
                    
                    updateLevelUI();
                    playSound('hit');

                    const colorHexStr = '#' + r.color.toString(16).padStart(6, '0');
                    r.mesh.material.map = createDynamicNumberTexture(r.hp.toString(), colorHexStr);
                    r.mesh.material.map.needsUpdate = true;

                    if (r.hp <= 0) {
                        playSound('explode');
                        scene.remove(r.mesh);

                        if (r.sizeIndex > 0) {
                            spawnRock(r.mesh.position.x - 0.8, r.mesh.position.y, Math.ceil(r.maxHp / 2), r.sizeIndex - 1);
                            spawnRock(r.mesh.position.x + 0.8, r.mesh.position.y, Math.ceil(r.maxHp / 2), r.sizeIndex - 1);
                        }

                        rocks.splice(j, 1);

                        if (levelProgress >= maxLevelProgress) {
                            currentLevel++;
                            levelProgress = 0;
                            updateLevelUI();
                        }
                    }

                    hit = true;
                    break;
                }
            }

            if (hit || b.position.y > arenaHeight) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }
    }

    // --- 8. Controls & State Handling ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

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

    function resetGame() {
        score = 0; currentHp = maxHp; currentLevel = 1; levelProgress = 0;
        cameraShakeIntensity = 0;
        
        for (let r of rocks) scene.remove(r.mesh);
        rocks.length = 0;
        for (let b of bullets) scene.remove(b);
        bullets.length = 0;

        cannonGroup.position.set(0, floorY + 0.5, 0);
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

    // --- Event Listeners לתפריטים ---
    document.getElementById('start-btn')?.addEventListener('click', () => {
        requestFullScreen();
        initAudio();
        resetGame();
        gameStarted = true;
        isPaused = false;
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) startOverlay.classList.add('hidden');
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

    // --- 9. Render Loop ---
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        if (gameStarted && !isPaused) {
            targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
            cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, delta * 15);

            shootTimer += delta;
            if (isFiring && shootTimer >= 0.08) {
                shootTimer = 0;
                spawnBullet(cannonGroup.position.x - 0.45, cannonGroup.position.y + 1.2);
                spawnBullet(cannonGroup.position.x + 0.45, cannonGroup.position.y + 1.2);
                playSound('shoot');
            }

            updateBullets(delta);
            updateRocks(delta);

            if (cameraShakeIntensity > 0) {
                cameraShakeIntensity = THREE.MathUtils.lerp(cameraShakeIntensity, 0, delta * 8);
                camera.position.x = (Math.random() - 0.5) * cameraShakeIntensity;
                camera.position.y = 14 + (Math.random() - 0.5) * cameraShakeIntensity;
            } else {
                camera.position.x = 0;
                camera.position.y = 14;
            }
        }

        renderer.render(scene, camera);
    }

    animate();
});