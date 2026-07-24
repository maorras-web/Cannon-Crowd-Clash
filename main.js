window.addEventListener('DOMContentLoaded', () => {

    // --- 1. שפות ותרגום ---
    const translations = {
        en: { 
            score: "Score", best: "Best", subtitle: "Pass through gates and get the highest score!", language: "Language", personalBest: "Personal Best", startGame: "Start Game 🚀", gamePaused: "Settings & Pause ⚙️", resumeGame: "Resume Game ▶️", volume: "Sound Volume 🔊", cannonColor: "Cannon Color 🎨", dir: "ltr" 
        },
        he: { 
            score: "ניקוד", best: "שיא", subtitle: "עבור בשערים והגע לניקוד הגבוה ביותר!", language: "שפה", personalBest: "שיא אישי", startGame: "התחל משחק 🚀", gamePaused: "הגדרות ופאוזה ⚙️", volume: "עוצמת שמע 🔊", cannonColor: "צבע התותח 🎨", dir: "rtl" 
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

    // --- 2. מנוע אודיו ---
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

    // --- 3. סצנה ותאורה מתקדמת ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);
    scene.fog = new THREE.FogExp2(0x050714, 0.0008);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 250;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // --- 4. מסלול ועולם החלל בלבד ---
    // הגדלת רוחב המסלול מ-14 ל-16 (+2 סנטימטרים/יחידות)
    const trackWidth = 16; 
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

        // יצירת כמות ענקית של כוכבים לבנים קטנים בשטחים המתים (3,500 כוכבים)
        const starGeo = new THREE.SphereGeometry(0.18, 6, 6);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const safetyOffset = (trackWidth / 2) + 3.0;

        for (let i = 0; i < 3500; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            const side = Math.random() < 0.5 ? -1 : 1;
            
            // פיזור רחב מאוד מסביב למסלול ולכל אורך החלל
            star.position.set(
                side * (safetyOffset + Math.random() * 200),
                (Math.random() - 0.5) * 160,
                (Math.random() - 0.5) * trackLength
            );
            environmentGroup.add(star);
        }
    }

    initSpaceWorld();

    // --- 5. עיצוב תותח וצללים ---
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

    cannonGroup.add(cannonMeshGroup);
    cannonGroup.position.set(0, 1.2, 0);
    scene.add(cannonGroup);

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

    // --- 6. כדורים ואפקטים ---
    function createLightningBallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffaa00');
        gradient.addColorStop(0.7, '#ff3300');
        gradient.addColorStop(1, 'rgba(50, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(canvas);
    }

    const bulletGeo = new THREE.SphereGeometry(0.45, 16, 16);
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
        for (let i = 0; i < 15; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 3;
            p.position.y += Math.random() * 2;
            p.userData = { vx: (Math.random() - 0.5) * 12, vy: Math.random() * 10 + 3, vz: (Math.random() - 0.5) * 12, life: 1.0 };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- מערכת שערים ---
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
        gateGroup.userData = { id, type, value, colorHex };
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

        for (let i = gates.length - 1; i >= 0; i--) {
            gates[i].position.z += gateSpeed * delta;
            if (gates[i].position.z > 20) {
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