window.addEventListener('DOMContentLoaded', () => {

    // --- 0. Fix Mobile Touch Hijacking & Fullscreen Helper ---
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
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
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

    // --- 3. Scene, Renderer & Skybox ---
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.domElement.style.touchAction = 'none';
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(20, 60, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x030712, 0.8);
    scene.add(hemiLight);

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

        ctx.fillStyle = '#030108';
        ctx.fillRect(0, 0, 2048, 2048);

        const nebulae = [
            { x: 500,  y: 600,  r: 750, color: 'rgba(88, 28, 135, 0.70)' },
            { x: 1500, y: 500,  r: 900, color: 'rgba(58, 12, 107, 0.75)' },
            { x: 1000, y: 1400, r: 700, color: 'rgba(126, 34, 206, 0.60)' },
            { x: 400,  y: 1600, r: 650, color: 'rgba(76, 29, 149, 0.65)' },
            { x: 1600, y: 1500, r: 550, color: 'rgba(112, 26, 117, 0.50)' }
        ];

        nebulae.forEach(n => {
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            grad.addColorStop(0, n.color);
            grad.addColorStop(0.5, n.color.replace(/[\d\.]+\)$/, '0.30)'));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 2048, 2048);
        });

        for (let i = 0; i < 1200; i++) {
            const x = Math.random() * 2048;
            const y = Math.random() * 2048;
            const radius = Math.random() * 1.8;
            const opacity = Math.random() * 0.9 + 0.1;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    const galaxySkyGeo = new THREE.SphereGeometry(800, 32, 32);
    const galaxySkyMat = new THREE.MeshBasicMaterial({
        map: createGalaxyTexture(),
        side: THREE.BackSide
    });
    const galaxySky = new THREE.Mesh(galaxySkyGeo, galaxySkyMat);
    scene.add(galaxySky);

    // --- 4. Track & Environment ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 2000;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x0b1329, 
        roughness: 0.2, 
        metalness: 0.5,
        emissive: 0x030712,
        emissiveIntensity: 0.2
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    track.receiveShadow = true;
    scene.add(track);

    // Stars Particles
    const starCount = 3000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        starPositions[i * 3]     = side * (12 + Math.random() * 100);
        starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * trackLength;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.95 });
    scene.add(new THREE.Points(starGeo, starMat));

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

    // --- 6. REALISTIC LIZARD GEOMETRY & PROCEDURAL TEXTURES ---
    
    function createLizardScaleBumpMap() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 512, 512);

        const scaleSize = 16;
        for (let y = 0; y < 512; y += scaleSize) {
            for (let x = 0; x < 512; x += scaleSize) {
                const offsetX = (y / scaleSize) % 2 === 0 ? 0 : scaleSize / 2;
                ctx.beginPath();
                ctx.arc(x + offsetX, y, scaleSize * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#202020';
                ctx.stroke();
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    const scaleBumpMap = createLizardScaleBumpMap();

    const lizards = [];
    let lizardSpawnTimer = 0;

    const ENEMY_TYPES = {
        STANDARD: { skinColor: 0x16a34a, eyeColor: 0xef4444, scale: 1.1, speed: 16.0, hp: 1, scoreVal: 30 },
        FAST:     { skinColor: 0xca8a04, eyeColor: 0x38bdf8, scale: 0.85, speed: 24.0, hp: 1, scoreVal: 50 },
        ARMORED:  { skinColor: 0x6b21a8, eyeColor: 0xfacc15, scale: 1.5, speed: 10.0, hp: 4, scoreVal: 100 }
    };

    function createLizardMesh(typeConfig) {
        const lizardGroup = new THREE.Group();

        const skinMat = new THREE.MeshStandardMaterial({ 
            color: typeConfig.skinColor, 
            roughness: 0.3, 
            metalness: 0.2,
            bumpMap: scaleBumpMap,
            bumpScale: 0.15
        });

        const detailMat = new THREE.MeshStandardMaterial({ 
            color: 0x0f172a, 
            roughness: 0.5 
        });

        const eyeMat = new THREE.MeshStandardMaterial({ 
            color: typeConfig.eyeColor, 
            emissive: typeConfig.eyeColor, 
            emissiveIntensity: 4.0
        });

        // 1. גוף רחב ומסיבי
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.9, 2.6);
        const body = new THREE.Mesh(bodyGeo, skinMat);
        body.position.set(0, 0.8, 0);
        body.castShadow = true;
        lizardGroup.add(body);

        // 2. ראש מואץ ומשולשי
        const headGeo = new THREE.ConeGeometry(1.1, 1.8, 4);
        headGeo.rotateX(-Math.PI / 2);
        headGeo.rotateY(Math.PI / 4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 1.0, 1.8);
        head.castShadow = true;
        lizardGroup.add(head);

        // 3. עיניים בוהקות מוגדלות
        const eyeGeo = new THREE.SphereGeometry(0.3, 12, 12);
        
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.75, 1.2, 1.8);
        lizardGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.75, 1.2, 1.8);
        lizardGroup.add(eyeR);

        // 4. קוצים אגרסיביים לאורך הגב
        for (let z = -0.8; z <= 0.8; z += 0.5) {
            const spikeGeo = new THREE.ConeGeometry(0.25, 0.7, 4);
            const spike = new THREE.Mesh(spikeGeo, detailMat);
            spike.position.set(0, 1.5, z);
            lizardGroup.add(spike);
        }

        // 5. רגליים עבות ופרוסות לצדדים
        const legGeo = new THREE.BoxGeometry(1.1, 0.35, 0.45);

        const legFL = new THREE.Mesh(legGeo, skinMat);
        legFL.position.set(-1.1, 0.5, 0.7);
        legFL.rotation.z = 0.3;
        lizardGroup.add(legFL);

        const legFR = new THREE.Mesh(legGeo, skinMat);
        legFR.position.set(1.1, 0.5, 0.7);
        legFR.rotation.z = -0.3;
        lizardGroup.add(legFR);

        const legBL = new THREE.Mesh(legGeo, skinMat);
        legBL.position.set(-1.1, 0.5, -0.7);
        legBL.rotation.z = 0.3;
        lizardGroup.add(legBL);

        const legBR = new THREE.Mesh(legGeo, skinMat);
        legBR.position.set(1.1, 0.5, -0.7);
        legBR.rotation.z = -0.3;
        lizardGroup.add(legBR);

        // 6. זנב ארוך
        const tailGeo = new THREE.ConeGeometry(0.55, 2.5, 5);
        tailGeo.rotateX(Math.PI / 2);
        const tail = new THREE.Mesh(tailGeo, skinMat);
        tail.position.set(0, 0.7, -2.2);
        tail.castShadow = true;
        lizardGroup.add(tail);

        lizardGroup.rotation.y = Math.PI;

        lizardGroup.scale.setScalar(typeConfig.scale * 1.35);
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

        const bossConfig = { 
            skinColor: 0xc2410c, 
            eyeColor: 0xef4444, 
            scale: 3.5, 
            speed: 4.5, 
            hp: 40 + (currentLevel * 20), 
            scoreVal: 1000 
        };
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

    // --- 7. Cannon & Engine Fire ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.2, metalness: 0.7 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.1, metalness: 0.8 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 24), baseMat);
    base.rotation.x = Math.PI / 12;
    base.castShadow = true;
    cannonMeshGroup.add(base);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.9 });
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelL);

    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.0, 16), barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.45, 0.35, -1.0);
    cannonMeshGroup.add(barrelR);

    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.7, 16), thrusterMat);
    thrusterL.rotation.z = Math.PI / 2;
    thrusterL.position.set(-1.3, 0.2, 0);
    cannonMeshGroup.add(thrusterL);

    const thrusterR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.7, 16), thrusterMat);
    thrusterR.rotation.z = -Math.PI / 2;
    thrusterR.position.set(1.3, 0.2, 0);
    cannonMeshGroup.add(thrusterR);

    // Fire Particles
    const fireParticles = [];
    function createFireTextureCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
        grad.addColorStop(0.3, 'rgba(255, 140, 0, 0.85)');
        grad.addColorStop(0.7, 'rgba(220, 38, 38, 0.5)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    const fireTexture = createFireTextureCanvas();
    const fireMaterialTemplate = new THREE.SpriteMaterial({
        map: fireTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });

    function spawnEngineFireParticle(isLeft) {
        const sprite = new THREE.Sprite(fireMaterialTemplate.clone());
        const localPos = new THREE.Vector3(isLeft ? -1.65 : 1.65, 0.2, 0);
        const worldPos = localPos.applyMatrix4(cannonMeshGroup.matrixWorld);

        sprite.position.copy(worldPos);
        sprite.scale.set(0.45, 0.45, 1.0);
        scene.add(sprite);

        const sideDir = isLeft ? -1 : 1;
        fireParticles.push({
            sprite: sprite,
            life: 1.0,
            speedX: sideDir * (10.0 + Math.random() * 5.0),
            speedY: (Math.random() - 0.5) * 1.5,
            speedZ: (Math.random() - 0.5) * 1.5,
            scaleSpeed: 2.0 + Math.random() * 1.5
        });
    }

    function updateEngineFire(delta) {
        if (gameStarted && !isPaused) {
            cannonMeshGroup.updateMatrixWorld(true);
            for (let i = 0; i < 2; i++) {
                spawnEngineFireParticle(true);
                spawnEngineFireParticle(false);
            }
        }

        for (let i = fireParticles.length - 1; i >= 0; i--) {
            const p = fireParticles[i];
            p.life -= delta * 4.5;

            if (p.life <= 0) {
                scene.remove(p.sprite);
                p.sprite.material.dispose();
                fireParticles.splice(i, 1);
                continue;
            }

            p.sprite.position.x += p.speedX * delta;
            p.sprite.position.y += p.speedY * delta;
            p.sprite.position.z += p.speedZ * delta;

            const currentScale = (1.0 - p.life) * p.scaleSpeed + 0.35;
            p.sprite.scale.set(currentScale, currentScale, 1.0);
            p.sprite.material.opacity = p.life * p.life;
        }
    }

    // Muzzle Flashes
    const muzzleFlashes = [];
    const muzzleFlashGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 1.0 });

    function triggerMuzzleFlash(x, y, z) {
        const flash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat.clone());
        flash.position.set(x, y, z);
        scene.add(flash);
        muzzleFlashes.push({ mesh: flash, life: 1.0 });
    }

    function updateMuzzleFlashes(delta) {
        for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
            const f = muzzleFlashes[i];
            f.life -= delta * 15.0;
            if (f.life <= 0) {
                scene.remove(f.mesh);
                f.mesh.material.dispose();
                muzzleFlashes.splice(i, 1);
            } else {
                f.mesh.scale.setScalar(f.life * 1.2);
                f.mesh.material.opacity = f.life;
            }
        }
    }

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

    function updateCannonColor(hexColor) {
        baseMat.color.set(hexColor);
        domeMat.color.set(hexColor);
    }

    // --- 8. Bullets & Particle Effects ---
    const bulletGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ 
        color: 0xfacc15, 
        emissive: 0xffea00, 
        emissiveIntensity: 2.0,
        roughness: 0.1 
    });

    const trailGeo = new THREE.CylinderGeometry(0.04, 0.22, 2.8, 8);
    trailGeo.rotateX(Math.PI / 2);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.65 });

    const bullets = [];

    function spawnBullet(x, z) {
        const bulletGroup = new THREE.Group();

        const mainBullet = new THREE.Mesh(bulletGeo, bulletMat);
        mainBullet.scale.set(1, 1, 1.8);
        bulletGroup.add(mainBullet);

        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.position.z = 1.4;
        bulletGroup.add(trail);

        bulletGroup.position.set(x, 1.1, z);
        scene.add(bulletGroup);
        bullets.push(bulletGroup);
    }

    // Gate Particles
    const activeParticleSystems = [];
    function createGateParticles(position, isMultiply) {
        const count = 20;
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
            size: 0.4,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const system = new THREE.Points(geometry, material);
        scene.add(system);

        activeParticleSystems.push({ system, velocities, life: 1.0 });
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

        const frameMat = new THREE.MeshStandardMaterial({ 
            map: createGateTexture(label, colorHex), 
            transparent: true,
            roughness: 0.1,
            metalness: 0.2
        });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 4.2, 0.2), frameMat);
        frame.position.y = 2.1;
        gateGroup.add(frame);
        gateGroup.position.set(x, 0, z);
        
        gateGroup.userData = { 
            id, type, value, width: gateWidth, height: 4.2, baseY: 0,
            floatOffset: Math.random() * Math.PI * 2, hitScale: 1.0
        };

        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    function updateGates(elapsedTime, delta) {
        for (let g of gates) {
            const gData = g.userData;
            g.position.y = gData.baseY + Math.sin(elapsedTime * 3 + gData.floatOffset) * 0.15;
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

    // --- 11. UI & Game Loop State ---
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
        cannonMeshGroup.position.z = 0;
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

        galaxySky.rotation.y += delta * 0.01;

        updateEngineFire(delta);
        updateLizards(delta);
        updateParticles(delta);
        updateGates(elapsedTime, delta);
        updateMuzzleFlashes(delta);

        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        currentX = THREE.MathUtils.lerp(currentX, targetX, 0.25);
        cannonGroup.position.x = currentX;

        cannonRecoilZ = THREE.MathUtils.lerp(cannonRecoilZ, 0, delta * 15.0);
        cannonMeshGroup.position.z = cannonRecoilZ;

        let shakeOffsetX = 0, shakeOffsetY = 0;
        if (cameraShakeIntensity > 0) {
            shakeOffsetX = (Math.random() - 0.5) * cameraShakeIntensity;
            shakeOffsetY = (Math.random() - 0.5) * cameraShakeIntensity;
            cameraShakeIntensity = THREE.MathUtils.lerp(cameraShakeIntensity, 0, delta * 8.0);
        }

        camera.position.x = cannonGroup.position.x * 0.15 + shakeOffsetX;
        camera.position.y = cannonGroup.position.y + 12.5 + shakeOffsetY;
        camera.position.z = cannonGroup.position.z + 18.0;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 0.5, cannonGroup.position.z - 10.0);

        shootTimer += delta;
        if (isFiring && shootTimer >= 0.15) {
            const lx = cannonGroup.position.x - 0.45;
            const rx = cannonGroup.position.x + 0.45;
            const fz = cannonGroup.position.z - 2.0;

            spawnBullet(lx, cannonGroup.position.z - 1.2);
            spawnBullet(rx, cannonGroup.position.z - 1.2);

            triggerMuzzleFlash(lx, 1.35, fz);
            triggerMuzzleFlash(rx, 1.35, fz);

            cannonRecoilZ = 0.35;
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

            for (let g of gates) {
                const gData = g.userData;
                if (Math.abs(b.position.x - g.position.x) < gData.width / 2 && Math.abs(b.position.z - g.position.z) < 1.0) {
                    createGateParticles(b.position, gData.type === 'multiply');
                    gData.hitScale = 1.18;
                    break;
                }
            }

            if (isBossActive && activeBoss) {
                if (b.position.distanceTo(activeBoss.position) < 4.0) {
                    playSound('boss_hit');
                    triggerCameraShake(0.12);
                    activeBoss.userData.hp--;
                    scene.remove(b);
                    bullets.splice(i, 1);

                    if (activeBoss.userData.hp <= 0) {
                        score += activeBoss.userData.scoreVal;
                        const scoreValEl = document.getElementById('score-val');
                        if (scoreValEl) scoreValEl.innerText = score;
                        
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

            for (let j = lizards.length - 1; j >= 0; j--) {
                const liz = lizards[j];
                if (b.position.distanceTo(liz.position) < 2.0) {
                    playSound('hit');
                    liz.userData.hp--;
                    scene.remove(b);
                    bullets.splice(i, 1);

                    if (liz.userData.hp <= 0) {
                        score += liz.userData.scoreVal;
                        const scoreValEl = document.getElementById('score-val');
                        if (scoreValEl) scoreValEl.innerText = score;

                        if (!isBossActive) {
                            levelProgress += 5;
                            updateLevelUI();
                            if (levelProgress >= maxLevelProgress) spawnBoss();
                        }

                        scene.remove(liz);
                        lizards.splice(j, 1);
                    }
                    break;
                }
            }
        }
    }

    animate();
});