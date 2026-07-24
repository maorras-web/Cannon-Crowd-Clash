window.addEventListener('DOMContentLoaded', () => {

    // --- 1. מנוע אודיו ---
    const soundURLs = {
        shoot: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
        gate: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'
    };

    const audioBuffers = {};
    let audioCtx = null;
    let masterVolume = 0.25;

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
        if (audioCtx && audioBuffers[name] && masterVolume > 0) {
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffers[name];
            const gain = audioCtx.createGain();
            gain.gain.value = masterVolume;
            source.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(0);
        }
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.value = masterVolume;
        volumeSlider.addEventListener('input', (e) => {
            masterVolume = parseFloat(e.target.value);
        });
    }

    // --- 2. סצנה ותאורה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);
    scene.fog = new THREE.FogExp2(0x050714, 0.0008);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xa5b4fc, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(25, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 250;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // --- 3. מסלול ועולם החלל ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 3500;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3, metalness: 0.4 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    track.receiveShadow = true;
    scene.add(track);

    let environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    function initSpaceWorld() {
        while (environmentGroup.children.length > 0) {
            environmentGroup.remove(environmentGroup.children[0]);
        }

        const starGeo = new THREE.SphereGeometry(0.18, 6, 6);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const safetyOffset = (trackWidth / 2) + 3.0;

        for (let i = 0; i < 3500; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            const side = Math.random() < 0.5 ? -1 : 1;
            
            star.position.set(
                side * (safetyOffset + Math.random() * 200),
                (Math.random() - 0.5) * 160,
                (Math.random() - 0.5) * trackLength
            );
            environmentGroup.add(star);
        }
    }

    initSpaceWorld();

    // --- מערכת צלחת מעופפת (UFO) עם סריקת לייזר ירוקה (כל 60 שניות, 3 שניות משך) ---
    let ufoTimer = 55.0; // יופיע לראשונה כ-5 שניות לאחר תחילת המשחק
    let activeUFO = null;

    function spawnUFO() {
        if (activeUFO) {
            scene.remove(activeUFO.group);
            activeUFO = null;
        }

        const ufoGroup = new THREE.Group();

        // 1. גוף הצלחת המעופפת (מתכת כסופה)
        const bodyGeo = new THREE.CylinderGeometry(2.5, 3.5, 0.8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        ufoGroup.add(body);

        // 2. כיפת זכוכית עליונה זוהרת
        const domeGeo = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.3;
        ufoGroup.add(dome);

        // 3. אורות היקפיים תחתונים
        const ringGeo = new THREE.TorusGeometry(3.2, 0.15, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.3;
        ufoGroup.add(ring);

        // 4. אלומת לייזר ירוקה רחבה לסריקת המסלול
        const beamGeo = new THREE.ConeGeometry(trackWidth * 0.7, 25, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const laserBeam = new THREE.Mesh(beamGeo, beamMat);
        laserBeam.position.y = -12.5;
        ufoGroup.add(laserBeam);

        // מיקום התחלתי בשמיים מעל המסלול
        const startX = -35;
        const endX = 35;
        const startY = 16;
        const startZ = cannonGroup.position.z - 30;

        ufoGroup.position.set(startX, startY, startZ);
        scene.add(ufoGroup);

        activeUFO = {
            group: ufoGroup,
            progress: 0,
            startX,
            endX,
            startY,
            startZ,
            duration: 3.0 // נשאר 3 שניות בדיוק על המסלול
        };
    }

    function updateUFOSystem(delta) {
        ufoTimer += delta;
        if (ufoTimer >= 60.0) { // כל דקה (60 שניות)
            ufoTimer = 0;
            spawnUFO();
        }

        if (activeUFO) {
            activeUFO.progress += delta / activeUFO.duration;
            const p = activeUFO.progress;

            if (p >= 1.0) {
                scene.remove(activeUFO.group);
                activeUFO = null;
            } else {
                // תנועת חצייה חלקה של המסלול
                activeUFO.group.position.x = THREE.MathUtils.lerp(activeUFO.startX, activeUFO.endX, p);
                // רטט קל בגובה לחוויית טיפוף חייזרית
                activeUFO.group.position.y = activeUFO.startY + Math.sin(p * Math.PI * 6) * 0.5;
                // הצלחת מסתובבת תוך כדי תנועה
                activeUFO.group.rotation.y += delta * 4;
            }
        }
    }

    // --- 4. עיצוב תותח ומנועי דחף צדדיים משודרגים ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(1.1, 1.4, 0.8, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = Math.PI / 12;
    base.castShadow = true;
    cannonMeshGroup.add(base);

    const domeGeo = new THREE.SphereGeometry(0.9, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.9, roughness: 0.1 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.3;
    dome.castShadow = true;
    cannonMeshGroup.add(dome);

    const barrelGeo = new THREE.CylinderGeometry(0.28, 0.38, 1.8, 20);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });

    const barrelLeft = new THREE.Mesh(barrelGeo, barrelMat);
    barrelLeft.rotation.x = Math.PI / 2;
    barrelLeft.position.set(-0.45, 0.35, -0.9);
    barrelLeft.castShadow = true;
    cannonMeshGroup.add(barrelLeft);

    const barrelRight = new THREE.Mesh(barrelGeo, barrelMat);
    barrelRight.rotation.x = Math.PI / 2;
    barrelRight.position.set(0.45, 0.35, -0.9);
    barrelRight.castShadow = true;
    cannonMeshGroup.add(barrelRight);

    // --- מנועי דחף בצדדים ---
    const thrusterGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.7, 16);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });

    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.rotation.z = Math.PI / 2;
    leftThruster.position.set(-1.4, 0.2, 0);
    cannonMeshGroup.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.rotation.z = -Math.PI / 2;
    rightThruster.position.set(1.4, 0.2, 0);
    cannonMeshGroup.add(rightThruster);

    // --- להבות מדחף משודרגות ויזואלית (דו-שכבתיות עם אפקט זרימה לוהט) ---
    function createAdvancedFlame() {
        const flameGroup = new THREE.Group();

        // 1. מעטפת להבה חיצונית (ציאן / ניאון זוהר)
        const outerGeo = new THREE.ConeGeometry(0.4, 1.8, 16);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });
        const outerFlame = new THREE.Mesh(outerGeo, outerMat);
        outerFlame.position.y = -0.9;
        flameGroup.add(outerFlame);

        // 2. ליבת להבה פנימית חמה (לבן-כחול בוהק)
        const innerGeo = new THREE.ConeGeometry(0.22, 1.3, 16);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const innerFlame = new THREE.Mesh(innerGeo, innerMat);
        innerFlame.position.y = -0.65;
        flameGroup.add(innerFlame);

        return { group: flameGroup, outerMat, innerMat };
    }

    const leftFlameData = createAdvancedFlame();
    leftFlameData.group.rotation.z = Math.PI / 2;
    leftFlameData.group.position.set(-1.75, 0.2, 0);
    leftFlameData.group.visible = false;
    cannonMeshGroup.add(leftFlameData.group);

    const rightFlameData = createAdvancedFlame();
    rightFlameData.group.rotation.z = -Math.PI / 2;
    rightFlameData.group.position.set(1.75, 0.2, 0);
    rightFlameData.group.visible = false;
    cannonMeshGroup.add(rightFlameData.group);

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

    // שינוי צבע התותח
    function changeCannonColor(hexColor) {
        baseMat.color.setHex(hexColor);
        domeMat.color.setHex(hexColor);
    }

    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            colorButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const selectedColor = parseInt(e.target.getAttribute('data-color'));
            changeCannonColor(selectedColor);
        });
    });

    // --- 5. כדורים ואפקטים ---
    function createLightningBallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffaa00');
        gradient.addColorStop(0.7, '#ff3300');
        gradient.addColorStop(1, 'rgba(50, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

    const bulletGeo = new THREE.SphereGeometry(0.45, 12, 12);
    const bulletMat = new THREE.MeshBasicMaterial({ map: createLightningBallTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const bullets = [];

    function spawnBullet(x, z) {
        const energyBall = new THREE.Mesh(bulletGeo, bulletMat);
        energyBall.position.set(x, 1.1, z);
        scene.add(energyBall);
        bullets.push(energyBall);
    }

    const particles = [];
    const particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);

    function triggerExplosion(pos, colorHex) {
        const particleMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
        for (let i = 0; i < 10; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 3;
            p.position.y += Math.random() * 2;
            p.userData = { vx: (Math.random() - 0.5) * 12, vy: Math.random() * 10 + 3, vz: (Math.random() - 0.5) * 12, life: 1.0, mat: particleMat };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- 6. מערכת שערים ---
    const gates = [];
    let gateIdCounter = 1;
    const GATE_GAP = 50; 
    const SPAWN_LIMIT_Z = -800; 

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
        const gateWidth = trackWidth / 2 - 0.6;
        let label = `+${value}`, colorHex = '#0284c7';
        if (type === 'multiply') { label = `x${value}`; colorHex = '#10b981'; }

        const frameMat = new THREE.MeshStandardMaterial({ map: createGateTexture(label, colorHex), transparent: true, opacity: 0.9 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(gateWidth, 4.0, 0.2), frameMat);
        frame.position.y = 2.0;
        frame.castShadow = true;
        gateGroup.add(frame);
        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { id, type, value, colorHex, mat: frameMat };
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

    function updateGatesSystem() {
        let furthestZ = 0;
        for (let i = 0; i < gates.length; i++) {
            if (gates[i].position.z < furthestZ) furthestZ = gates[i].position.z;
        }
        while (furthestZ > SPAWN_LIMIT_Z) {
            furthestZ -= GATE_GAP;
            spawnGatePairAt(furthestZ);
        }
    }

    // --- 7. שליטה ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { isDragging = true; isFiring = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; isFiring = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.022;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; isFiring = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', () => { isDragging = false; isFiring = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.022;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 8. מצבי משחק ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            initAudio();
            gameStarted = true;
            document.getElementById('start-menu')?.classList.add('hidden');
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) {
                startOverlay.style.opacity = '0';
                setTimeout(() => startOverlay.classList.add('hidden'), 500);
            }
            document.getElementById('pause-btn')?.classList.remove('hidden');
            document.getElementById('score-card')?.classList.remove('hidden');
        });
    }

    const pauseBtn = document.getElementById('pause-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');

    if (pauseBtn) pauseBtn.addEventListener('click', () => { isPaused = true; pauseMenu?.classList.remove('hidden'); });
    if (resumeBtn) resumeBtn.addEventListener('click', () => { isPaused = false; pauseMenu?.classList.add('hidden'); });

    // --- 9. לולאת המשחק ---
    const clock = new THREE.Clock();
    const gateSpeed = 32.0;

    function animate() {
        requestAnimationFrame(animate);
        if (!gameStarted || isPaused) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        // עדכון צלחת מעופפת והלייזר הירוק
        updateUFOSystem(delta);

        for (let i = gates.length - 1; i >= 0; i--) {
            gates[i].position.z += gateSpeed * delta;
            if (gates[i].position.z > 20) {
                if (gates[i].userData.mat) gates[i].userData.mat.dispose();
                scene.remove(gates[i]);
                gates.splice(i, 1);
            }
        }

        updateGatesSystem();

        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        const prevX = cannonGroup.position.x;
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.2);
        
        const moveDelta = cannonGroup.position.x - prevX;
        cannonMeshGroup.rotation.z = -moveDelta * 0.6;

        // בקרת מנועי הדחף בצידי התותח + אפקט רטט וריצוד דינמי
        if (moveDelta > 0.015) {
            leftFlameData.group.visible = true;
            rightFlameData.group.visible = false;
            
            const flicker = 1.0 + (Math.random() - 0.5) * 0.35;
            leftFlameData.group.scale.set(flicker, 1.2 + Math.random() * 0.4, flicker);
        } else if (moveDelta < -0.015) {
            leftFlameData.group.visible = false;
            rightFlameData.group.visible = true;
            
            const flicker = 1.0 + (Math.random() - 0.5) * 0.35;
            rightFlameData.group.scale.set(flicker, 1.2 + Math.random() * 0.4, flicker);
        } else {
            leftFlameData.group.visible = false;
            rightFlameData.group.visible = false;
        }

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
            b.rotation.z += delta * 3;

            if (b.position.z < cannonGroup.position.z - 120) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            for (let j = gates.length - 1; j >= 0; j--) {
                const g = gates[j];
                if (Math.abs(b.position.z - g.position.z) < 1.5 && Math.abs(b.position.x - g.position.x) < trackWidth / 4) {
                    playSound('gate');
                    score += 20;
                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;

                    if (g.userData.type === 'multiply') {
                        const extra = Math.min(g.userData.value - 1, 2);
                        for (let k = 0; k < extra; k++) {
                            spawnBullet(b.position.x + (Math.random() - 0.5) * 0.5, b.position.z - (k * 0.4));
                        }
                    } else if (g.userData.type === 'add') {
                        for (let k = 0; k < 2; k++) {
                            spawnBullet(b.position.x + (Math.random() - 0.5) * 0.5, b.position.z - (k * 0.4));
                        }
                    }

                    triggerExplosion(g.position, g.userData.colorHex);
                    if (g.userData.mat) g.userData.mat.dispose();
                    scene.remove(g);
                    gates.splice(j, 1);
                    scene.remove(b);
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.userData.life -= delta * 2.5;
            p.position.x += p.userData.vx * delta;
            p.position.y += p.userData.vy * delta;
            p.position.z += p.userData.vz * delta;
            p.userData.vy -= 30 * delta;
            p.scale.setScalar(Math.max(0, p.userData.life));

            if (p.userData.life <= 0) {
                if (p.userData.mat) p.userData.mat.dispose();
                scene.remove(p);
                particles.splice(i, 1);
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