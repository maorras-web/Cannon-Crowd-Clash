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

            if (type === 'gate') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'damage') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            }
        } catch(e) {}
    }

    // --- 2. HighScore & Distance ---
    let highScore = localStorage.getItem('wheel_high_score') || 0;
    const startBestScoreEl = document.getElementById('start-best-score');
    if (startBestScoreEl) startBestScoreEl.innerText = highScore;

    // --- 3. Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
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

    // תאורה
    const ambientLight = new THREE.AmbientLight(0x1e1b4b, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    mainLight.position.set(15, 40, 20);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xc084fc, 2.8);
    rimLight.position.set(-15, 20, -30);
    scene.add(rimLight);

    let cameraShakeIntensity = 0;
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

    // --- 4. Track & Streaming Stars ---
    const trackWidth = 18; 
    const maxBoundX = trackWidth / 2 - 1.5; 
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

    // כוכבים
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

    // --- 5. Spike Wheel Player ---
    const wheelGroup = new THREE.Group();
    let spikeCount = 5; // כמות קוצים התחלתית

    // גליל מרכזי
    const cylinderGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.5, 32);
    cylinderGeo.rotateZ(Math.PI / 2);
    const cylinderMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f172a, 
        roughness: 0.2, 
        metalness: 0.9 
    });
    const wheelCore = new THREE.Mesh(cylinderGeo, cylinderMat);
    wheelGroup.add(wheelCore);

    // קוצים
    const spikeMeshGroup = new THREE.Group();
    wheelGroup.add(spikeMeshGroup);

    const spikeGeo = new THREE.ConeGeometry(0.25, 1.2, 16);
    spikeGeo.rotateX(Math.PI / 2);
    const spikeMat = new THREE.MeshStandardMaterial({ 
        color: 0x38bdf8, 
        emissive: 0x0284c7, 
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.2
    });

    function rebuildSpikes() {
        while(spikeMeshGroup.children.length > 0) {
            spikeMeshGroup.remove(spikeMeshGroup.children[0]);
        }

        const radius = 1.2;
        const width = 2.0;

        for (let i = 0; i < spikeCount; i++) {
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            const angle = (i / spikeCount) * Math.PI * 2;
            const xOffset = ((i % 5) / 4 - 0.5) * width;

            spike.position.set(xOffset, Math.sin(angle) * radius, Math.cos(angle) * radius);
            spike.rotation.x = angle;
            spikeMeshGroup.add(spike);
        }

        // עדכון UI
        const scoreVal = document.getElementById('score-val');
        if (scoreVal) scoreVal.innerText = spikeCount;
    }

    wheelGroup.position.set(0, 1.2, 0);
    scene.add(wheelGroup);

    // --- 6. Portals System ---
    const portals = [];
    let portalSpawnTimer = 0;

    function createPortalCanvasTexture(text, isPositive) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = isPositive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 12;
        ctx.strokeRect(0, 0, 256, 256);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 90px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 128);

        return new THREE.CanvasTexture(canvas);
    }

    function spawnPortalPair() {
        const isMathPortal = Math.random() > 0.4;
        let leftVal, rightVal, leftText, rightText;

        if (isMathPortal) {
            leftVal = Math.floor(Math.random() * 8) + 2;
            leftText = `+${leftVal}`;
            rightVal = Math.floor(Math.random() * 5) + 1;
            rightText = `-${rightVal}`;
        } else {
            leftVal = 2;
            leftText = `x${leftVal}`;
            rightVal = 0.5;
            rightText = `÷2`;
        }

        const pairZ = wheelGroup.position.z - 120;

        // פורטל שמאל
        const portalGeo = new THREE.PlaneGeometry(6.5, 5);
        const matLeft = new THREE.MeshBasicMaterial({ map: createPortalCanvasTexture(leftText, true), side: THREE.DoubleSide });
        const pLeft = new THREE.Mesh(portalGeo, matLeft);
        pLeft.position.set(-4.2, 2.5, pairZ);
        pLeft.userData = { val: leftVal, isMult: !isMathPortal, text: leftText, active: true };

        // פורטל ימין
        const matRight = new THREE.MeshBasicMaterial({ map: createPortalCanvasTexture(rightText, false), side: THREE.DoubleSide });
        const pRight = new THREE.Mesh(portalGeo, matRight);
        pRight.position.set(4.2, 2.5, pairZ);
        pRight.userData = { val: rightVal, isMult: !isMathPortal, text: rightText, active: true };

        scene.add(pLeft);
        scene.add(pRight);
        portals.push(pLeft, pRight);
    }

    function updatePortals(delta) {
        portalSpawnTimer += delta;
        if (portalSpawnTimer >= 2.5) {
            portalSpawnTimer = 0;
            spawnPortalPair();
        }

        for (let i = portals.length - 1; i >= 0; i--) {
            const p = portals[i];
            p.position.z += 25.0 * delta; // מהירות התקדמות המסלול

            // בדיקת פגיעה בפורטל
            if (p.userData.active && Math.abs(p.position.z - wheelGroup.position.z) < 1.5) {
                if (Math.abs(p.position.x - wheelGroup.position.x) < 3.5) {
                    p.userData.active = false;

                    if (p.userData.isMult) {
                        spikeCount = Math.floor(spikeCount * p.userData.val);
                    } else {
                        spikeCount += p.userData.val;
                    }

                    if (spikeCount <= 0) {
                        spikeCount = 0;
                        rebuildSpikes();
                        gameOver();
                        return;
                    }

                    playSound(p.userData.val > 0 ? 'gate' : 'damage');
                    rebuildSpikes();
                    triggerCameraShake(0.2);
                }
            }

            if (p.position.z > wheelGroup.position.z + 10) {
                scene.remove(p);
                portals.splice(i, 1);
            }
        }
    }

    // --- 7. Controls ---
    let targetX = 0, isDragging = false, previousTouchX = 0;

    function stopInput() { isDragging = false; }

    renderer.domElement.addEventListener('touchstart', (e) => { 
        e.preventDefault(); isDragging = true; previousTouchX = e.touches[0].clientX; 
    }, { passive: false });
    
    renderer.domElement.addEventListener('touchend', (e) => { e.preventDefault(); stopInput(); }, { passive: false });
    
    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.045;
            previousTouchX = e.touches[0].clientX;
        }
    }, { passive: false });

    renderer.domElement.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; });
    renderer.domElement.addEventListener('mouseup', stopInput);
    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.045;
            previousTouchX = e.clientX;
        }
    });

    // --- 8. Game State & Loop ---
    let gameStarted = false, isPaused = false, distanceMetres = 0;

    function resetGame() {
        spikeCount = 5;
        distanceMetres = 0;
        cameraShakeIntensity = 0;

        for (let p of portals) scene.remove(p);
        portals.length = 0;

        wheelGroup.position.set(0, 1.2, 0);
        targetX = 0;

        rebuildSpikes();
    }

    function gameOver() {
        gameStarted = false; stopInput();
        playSound('damage');

        const score = Math.floor(distanceMetres);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('wheel_high_score', highScore);
        }

        const gameOverModal = document.getElementById('game-over-modal');
        const finalScoreVal = document.getElementById('final-score-val');
        const bestScoreVal = document.getElementById('best-score-val');

        if (finalScoreVal) finalScoreVal.innerText = `${score}m`;
        if (bestScoreVal) bestScoreVal.innerText = `${highScore}m`;
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

    // --- 9. Main Render Loop ---
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        updateStars(delta);

        if (gameStarted && !isPaused) {
            // תנועה אופקית
            targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
            wheelGroup.position.x = THREE.MathUtils.lerp(wheelGroup.position.x, targetX, delta * 12);
            
            // סיבוב גלגל הקוצים
            wheelGroup.rotation.x += delta * 8;

            // עדכון פורטלים ומרחק
            updatePortals(delta);
            distanceMetres += delta * 15;
            
            const distanceVal = document.getElementById('distance-val');
            if (distanceVal) distanceVal.innerText = `${Math.floor(distanceMetres)}m`;

            // מצלמה עוקבת
            if (cameraShakeIntensity > 0) {
                cameraShakeIntensity = THREE.MathUtils.lerp(cameraShakeIntensity, 0, delta * 8);
                camera.position.x = wheelGroup.position.x + (Math.random() - 0.5) * cameraShakeIntensity;
                camera.position.y = 8 + (Math.random() - 0.5) * cameraShakeIntensity;
                camera.position.z = wheelGroup.position.z + 12 + (Math.random() - 0.5) * cameraShakeIntensity;
            } else {
                camera.position.x = THREE.MathUtils.lerp(camera.position.x, wheelGroup.position.x, delta * 6);
                camera.position.y = 8;
                camera.position.z = wheelGroup.position.z + 12;
            }
            camera.lookAt(wheelGroup.position.x, 1.0, wheelGroup.position.z - 20);
        }

        renderer.render(scene, camera);
    }

    animate();
});