window.addEventListener('DOMContentLoaded', () => {

    // --- 1. שפות ותרגום ---
    const translations = {
        en: { 
            score: "Score", best: "Best", subtitle: "Pass through gates and get the highest score!", language: "Language", selectMap: "Select World 🌍", personalBest: "Personal Best", startGame: "Start Game 🚀", gamePaused: "Settings & Pause ⚙️", resumeGame: "Resume Game ▶️", volume: "Sound Volume 🔊", cannonColor: "Cannon Color 🎨", 
            mapSpace: "Space World 🚀", mapDesert: "Desert World 🏜️", mapSnow: "Snow World ❄️", dir: "ltr" 
        },
        he: { 
            score: "ניקוד", best: "שיא", subtitle: "עבור בשערים והגע לניקוד הגבוה ביותר!", language: "שפה", selectMap: "בחר עולם 🌍", personalBest: "שיא אישי", startGame: "התחל משחק 🚀", gamePaused: "הגדרות ופאוזה ⚙️", volume: "עוצמת שמע 🔊", cannonColor: "צבע התותח 🎨", 
            mapSpace: "עולם החלל 🚀", mapDesert: "עולם המדבר 🏜️", mapSnow: "עולם השלג ❄️", dir: "rtl" 
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

    // --- 3. סצנה ותאורה מתקדמת עם צללים ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b19);
    scene.fog = new THREE.FogExp2(0x070b19, 0.0012);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.2);
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

    // --- 4. מסלול ומערכת עולמות ---
    const trackWidth = 14; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 3500;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.4 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    track.receiveShadow = true;
    scene.add(track);

    let environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    let particlesGroup = new THREE.Group();
    scene.add(particlesGroup);

    const mapThemes = {
        space: { 
            bg: 0x050714, 
            fog: 0x050714, 
            track: 0x1d4ed8, 
            light: 0xa5b4fc, 
            dirLightColor: 0xffffff,
            type: 'space' 
        },
        desert: { 
            bg: 0xd97706, 
            fog: 0x92400e, 
            track: 0x3d1c0a, // מסלול חום כהה עמוק
            light: 0xfef08a, 
            dirLightColor: 0xffedd5,
            type: 'desert' 
        },
        snow: { 
            bg: 0xffffff,     
            fog: 0xffffff,     
            track: 0x1e3a8a,   
            light: 0xffffff, 
            dirLightColor: 0xe0f2fe,
            type: 'snow' 
        }
    };

    function loadWorldMap(themeKey) {
        const theme = mapThemes[themeKey] || mapThemes.space;

        scene.background.setHex(theme.bg);
        scene.fog.color.setHex(theme.fog);
        trackMat.color.setHex(theme.track);
        ambientLight.color.setHex(theme.light);
        dirLight.color.setHex(theme.dirLightColor);

        while (environmentGroup.children.length > 0) {
            environmentGroup.remove(environmentGroup.children[0]);
        }
        while (particlesGroup.children.length > 0) {
            particlesGroup.remove(particlesGroup.children[0]);
        }

        const safetyOffset = (trackWidth / 2) + 7.0;

        if (theme.type === 'space') {
            const astMat = new THREE.MeshStandardMaterial({ color: 0x475569, flatShading: true, roughness: 0.9 });
            const planetMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4, metalness: 0.2 });
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });

            for (let z = 200; z > -trackLength; z -= 45) {
                [-1, 1].forEach(side => {
                    if (Math.random() < 0.5) {
                        const radius = 5 + Math.random() * 6;
                        const ast = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), astMat);
                        ast.position.set(side * (safetyOffset + radius), Math.random() * 25 - 5, z);
                        ast.rotation.set(Math.random(), Math.random(), Math.random());
                        ast.castShadow = true;
                        ast.receiveShadow = true;
                        environmentGroup.add(ast);
                    } else {
                        const pRadius = 6 + Math.random() * 5;
                        const planet = new THREE.Mesh(new THREE.SphereGeometry(pRadius, 16, 16), planetMat);
                        planet.position.set(side * (safetyOffset + pRadius + 5), 10 + Math.random() * 15, z);
                        planet.castShadow = true;
                        const ring = new THREE.Mesh(new THREE.RingGeometry(pRadius + 2, pRadius + 6, 32), ringMat);
                        ring.rotation.x = Math.PI / 2.5;
                        planet.add(ring);
                        environmentGroup.add(planet);
                    }
                });
            }

            // כוכבים לבנים קטנים וצפופים בכל השטחים המתים והפינות
            const starGeo = new THREE.SphereGeometry(0.22, 6, 6);
            const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            for (let i = 0; i < 1200; i++) {
                const star = new THREE.Mesh(starGeo, starMat);
                const side = Math.random() < 0.5 ? -1 : 1;
                star.position.set(
                    side * (safetyOffset + 1 + Math.random() * 120),
                    Math.random() * 90 - 20,
                    (Math.random() - 0.5) * trackLength
                );
                environmentGroup.add(star);
            }
        } 
        else if (theme.type === 'desert') {
            const pyramidMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, flatShading: true });
            const cactusMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });

            for (let z = 200; z > -trackLength; z -= 40) {
                [-1, 1].forEach(side => {
                    if (Math.random() < 0.5) {
                        const size = 14 + Math.random() * 10;
                        const pyramid = new THREE.Mesh(new THREE.ConeGeometry(size, size, 4), pyramidMat);
                        pyramid.position.set(side * (safetyOffset + size * 0.6), size / 2 - 2, z);
                        pyramid.rotation.y = Math.PI / 4;
                        pyramid.castShadow = true;
                        pyramid.receiveShadow = true;
                        environmentGroup.add(pyramid);
                    } else {
                        const cactusGroup = new THREE.Group();
                        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 10, 8), cactusMat);
                        trunk.position.y = 5;
                        trunk.castShadow = true;
                        cactusGroup.add(trunk);
                        
                        const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 6), cactusMat);
                        arm1.rotation.z = Math.PI / 2;
                        arm1.position.set(-1.2, 6, 0);
                        arm1.castShadow = true;
                        cactusGroup.add(arm1);

                        const arm1Up = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), cactusMat);
                        arm1Up.position.set(-2.2, 7.5, 0);
                        arm1Up.castShadow = true;
                        cactusGroup.add(arm1Up);

                        cactusGroup.position.set(side * (safetyOffset + 2), 0, z);
                        environmentGroup.add(cactusGroup);
                    }
                });
            }

            // גרגירי חול מרחפים במדבר
            const sandGeo = new THREE.SphereGeometry(0.15, 6, 6);
            const sandMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
            for (let i = 0; i < 100; i++) {
                const grain = new THREE.Mesh(sandGeo, sandMat);
                grain.position.set((Math.random() - 0.5) * 40, Math.random() * 25, (Math.random() - 0.5) * 1500);
                particlesGroup.add(grain);
            }
        } 
        else if (theme.type === 'snow') {
            const iceMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.3, flatShading: true });
            const pineLeavesMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.8 });
            const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
            const bushMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });

            for (let z = 200; z > -trackLength; z -= 35) {
                [-1, 1].forEach(side => {
                    if (Math.random() < 0.5) {
                        const height = 18 + Math.random() * 15;
                        const radius = 6 + Math.random() * 6;
                        const iceberg = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), iceMat);
                        iceberg.position.set(side * (safetyOffset + radius * 0.5), height / 2 - 2, z);
                        iceberg.castShadow = true;
                        iceberg.receiveShadow = true;
                        environmentGroup.add(iceberg);
                    } else {
                        const treeGroup = new THREE.Group();
                        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), new THREE.MeshStandardMaterial({ color: 0x78350f }));
                        trunk.position.y = 1.5;
                        trunk.castShadow = true;
                        treeGroup.add(trunk);

                        for (let l = 0; l < 3; l++) {
                            const layer = new THREE.Mesh(new THREE.ConeGeometry(3 - l * 0.6, 4, 6), l === 0 ? snowCapMat : pineLeavesMat);
                            layer.position.y = 3 + l * 2.2;
                            layer.castShadow = true;
                            treeGroup.add(layer);
                        }
                        treeGroup.position.set(side * (safetyOffset + 3), 0, z);
                        environmentGroup.add(treeGroup);
                    }

                    // שיחי שלג קטנים וגבעות בשטחים המתים למילוי העין
                    if (Math.random() < 0.7) {
                        const bushSize = 0.8 + Math.random() * 1.2;
                        const bush = new THREE.Mesh(new THREE.SphereGeometry(bushSize, 8, 8), bushMat);
                        bush.position.set(side * (safetyOffset + 1.2 + Math.random() * 3), bushSize / 2, z + (Math.random() - 0.5) * 10);
                        bush.castShadow = true;
                        environmentGroup.add(bush);
                    }
                });
            }

            const flakeGeo = new THREE.SphereGeometry(0.15, 6, 6);
            const flakeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
            for (let i = 0; i < 120; i++) {
                const flake = new THREE.Mesh(flakeGeo, flakeMat);
                flake.position.set((Math.random() - 0.5) * 40, Math.random() * 30, (Math.random() - 0.5) * 1500);
                particlesGroup.add(flake);
            }
        }
    }

    let selectedMap = localStorage.getItem('ccc_map') || 'space';
    loadWorldMap(selectedMap);

    const startMapSelect = document.getElementById('start-map-select');
    const pauseMapSelect = document.getElementById('pause-map-select');

    if (startMapSelect) {
        startMapSelect.value = selectedMap;
        startMapSelect.addEventListener('change', (e) => {
            selectedMap = e.target.value;
            localStorage.setItem('ccc_map', selectedMap);
            if (pauseMapSelect) pauseMapSelect.value = selectedMap;
            loadWorldMap(selectedMap);
        });
    }

    if (pauseMapSelect) {
        pauseMapSelect.value = selectedMap;
        pauseMapSelect.addEventListener('change', (e) => {
            selectedMap = e.target.value;
            localStorage.setItem('ccc_map', selectedMap);
            if (startMapSelect) startMapSelect.value = selectedMap;
            loadWorldMap(selectedMap);
        });
    }

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

    // --- 6. כדורים ושובל זוהר (Trail / Glow) ---
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
        if (Math.random() > 0.5) {
            createGate(`g_${gateIdCounter++}`, -3.2, z, 'multiply', 2);
            createGate(`g_${gateIdCounter++}`, 3.2, z, 'add', 20);
        } else {
            createGate(`g_${gateIdCounter++}`, -3.2, z, 'add', 15);
            createGate(`g_${gateIdCounter++}`, 3.2, z, 'multiply', 3);
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

        // אנימציית חלקיקים (שלג/חול)
        if (selectedMap === 'snow' || selectedMap === 'desert') {
            particlesGroup.children.forEach(p => {
                p.position.y -= delta * 12;
                p.position.z += delta * 18;
                if (p.position.y < 0) p.position.y = 30;
                if (p.position.z > cannonGroup.position.z + 20) p.position.z = cannonGroup.position.z - 400;
            });
        }

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