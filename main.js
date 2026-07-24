window.addEventListener('DOMContentLoaded', () => {

    // --- 1. שפות ותרגום ---
    const translations = {
        en: { score: "Score", best: "Best", instructions: "👈 Swipe left/right to move 👉", subtitle: "Pass through gates and get the highest score!", language: "Language", selectMap: "Select World 🌍", personalBest: "Personal Best", startGame: "Start Game 🚀", gamePaused: "Settings & Pause ⚙️", resumeGame: "Resume Game ▶️", volume: "Sound Volume 🔊", cannonColor: "Cannon Color 🎨", dir: "ltr" },
        he: { score: "ניקוד", best: "שיא", instructions: "👈 החלק ימינה ושמאלה כדי להזיז 👉", subtitle: "עבור בשערים והגע לניקוד הגבוה ביותר!", language: "שפה", selectMap: "בחר עולם 🌍", personalBest: "שיא אישי", startGame: "התחל משחק 🚀", gamePaused: "הגדרות ופאוזה ⚙️", volume: "עוצמת שמע 🔊", cannonColor: "צבע התותח 🎨", dir: "rtl" }
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

    // --- 3. סצנה ותאורה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.001);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(40, 80, 20);
    scene.add(dirLight);

    // --- 4. מסלול ומערכת עולמות (מפות) ---
    const trackWidth = 14; 
    const maxBoundX = trackWidth / 2 - 1.2; 
    const trackLength = 3500;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.5 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    let environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    // הגדרות עיצוב לכל עולם
    const mapThemes = {
        space: {
            bg: 0x070b19,
            fog: 0x070b19,
            track: 0x1e293b,
            light: 0x94a3b8,
            type: 'asteroids'
        },
        desert: {
            bg: 0xd97706,
            fog: 0xb45309,
            track: 0x78350f,
            light: 0xfef08a,
            type: 'dunes'
        },
        snow: {
            bg: 0x38bdf8,
            fog: 0xbae6fd,
            track: 0xe0f2fe,
            light: 0xffffff,
            type: 'icebergs'
        }
    };

    function loadWorldMap(themeKey) {
        const theme = mapThemes[themeKey] || mapThemes.space;

        scene.background.setHex(theme.bg);
        scene.fog.color.setHex(theme.fog);
        trackMat.color.setHex(theme.track);
        ambientLight.color.setHex(theme.light);

        // ניקוי אלמנטים של העולם הקודם
        while (environmentGroup.children.length > 0) {
            const obj = environmentGroup.children[0];
            environmentGroup.remove(obj);
        }

        const safetyOffset = (trackWidth / 2) + 6.0;

        if (theme.type === 'asteroids') {
            const astMat = new THREE.MeshStandardMaterial({ color: 0x475569, flatShading: true, roughness: 0.8 });
            for (let z = 200; z > -trackLength; z -= 40) {
                [-1, 1].forEach(side => {
                    const radius = 6 + Math.random() * 8;
                    const geo = new THREE.DodecahedronGeometry(radius, 1);
                    const ast = new THREE.Mesh(geo, astMat);
                    ast.position.set(side * (safetyOffset + radius), Math.random() * 20 - 5, z);
                    ast.rotation.set(Math.random(), Math.random(), Math.random());
                    environmentGroup.add(ast);
                });
            }
        } else if (theme.type === 'dunes') {
            const duneMat = new THREE.MeshStandardMaterial({ color: 0x92400e, flatShading: true, roughness: 0.9 });
            for (let z = 200; z > -trackLength; z -= 35) {
                [-1, 1].forEach(side => {
                    const height = 15 + Math.random() * 20;
                    const radius = 12 + Math.random() * 8;
                    const geo = new THREE.ConeGeometry(radius, height, 6);
                    const dune = new THREE.Mesh(geo, duneMat);
                    dune.position.set(side * (safetyOffset + radius * 0.5), height / 2 - 2, z);
                    environmentGroup.add(dune);
                });
            }
        } else if (theme.type === 'icebergs') {
            const iceMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, flatShading: true, roughness: 0.1, metalness: 0.1 });
            for (let z = 200; z > -trackLength; z -= 35) {
                [-1, 1].forEach(side => {
                    const height = 25 + Math.random() * 25;
                    const radius = 10 + Math.random() * 6;
                    const geo = new THREE.ConeGeometry(radius, height, 4);
                    const ice = new THREE.Mesh(geo, iceMat);
                    ice.position.set(side * (safetyOffset + radius * 0.5), height / 2 - 2, z);
                    ice.rotation.y = Math.random() * Math.PI;
                    environmentGroup.add(ice);
                });
            }
        }
    }

    // טעינת עולם ברירת מחדל
    let selectedMap = localStorage.getItem('ccc_map') || 'space';
    loadWorldMap(selectedMap);

    // חיבור הסלקטורים ב-HTML
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

    // --- 5. עיצוב תותח ושינוי צבעים ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(1.1, 1.4, 0.8, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = Math.PI / 12;
    cannonMeshGroup.add(base);

    const domeGeo = new THREE.SphereGeometry(0.9, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.9, roughness: 0.1 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.3;
    cannonMeshGroup.add(dome);

    const barrelGeo = new THREE.CylinderGeometry(0.28, 0.38, 1.8, 20);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });

    const barrelLeft = new THREE.Mesh(barrelGeo, barrelMat);
    barrelLeft.rotation.x = Math.PI / 2;
    barrelLeft.position.set(-0.45, 0.35, -0.9);
    cannonMeshGroup.add(barrelLeft);

    const barrelRight = new THREE.Mesh(barrelGeo, barrelMat);
    barrelRight.rotation.x = Math.PI / 2;
    barrelRight.position.set(0.45, 0.35, -0.9);
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
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffaa00');
        gradient.addColorStop(0.7, '#ff3300');
        gradient.addColorStop(1, 'rgba(50, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        for (let i = 0; i < 16; i++) {
            ctx.beginPath();
            let x = 128, y = 128;
            ctx.moveTo(x, y);
            const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
            const length = 80 + Math.random() * 40;
            
            for (let j = 0; j < 4; j++) {
                x += Math.cos(angle) * (length / 4) + (Math.random() - 0.5) * 15;
                y += Math.sin(angle) * (length / 4) + (Math.random() - 0.5) * 15;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        return new THREE.CanvasTexture(canvas);
    }

    const bulletGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const bulletMat = new THREE.MeshBasicMaterial({
        map: createLightningBallTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

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

            p.userData = {
                vx: (Math.random() - 0.5) * 12,
                vy: Math.random() * 10 + 3,
                vz: (Math.random() - 0.5) * 12,
                life: 1.0
            };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- מערכת שערים אינסופית ומניעת התנגשויות ---
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

        const frameGeo = new THREE.BoxGeometry(gateWidth, 4.0, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ map: createGateTexture(label, colorHex), transparent: true, opacity: 0.9 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = 2.0;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { id, type, value, colorHex };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    function spawnGatePairAt(z) {
        const isLeftMultiply = Math.random() > 0.5;
        if (isLeftMultiply) {
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
            if (gates[i].position.z < furthestZ) {
                furthestZ = gates[i].position.z;
            }
        }

        while (furthestZ > SPAWN_LIMIT_Z) {
            furthestZ -= GATE_GAP;
            spawnGatePairAt(furthestZ);
        }
    }

    // --- 7. שליטה ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { 
        isDragging = true; 
        isFiring = true; 
        previousTouchX = e.clientX; 
    });
    window.addEventListener('mouseup', () => { 
        isDragging = false; 
        isFiring = false; 
    });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.022;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { 
        isDragging = true; 
        isFiring = true; 
        previousTouchX = e.touches[0].clientX; 
    });
    window.addEventListener('touchend', () => { 
        isDragging = false; 
        isFiring = false; 
    });
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
            const startMenu = document.getElementById('start-menu');
            const startOverlay = document.getElementById('start-overlay');
            if (startMenu) startMenu.classList.add('hidden');
            if (startOverlay) {
                startOverlay.style.opacity = '0';
                setTimeout(() => startOverlay.classList.add('hidden'), 500);
            }
            const pauseBtn = document.getElementById('pause-btn');
            const scoreCard = document.getElementById('score-card');
            if (pauseBtn) pauseBtn.classList.remove('hidden');
            if (scoreCard) scoreCard.classList.remove('hidden');
        });
    }

    const pauseBtn = document.getElementById('pause-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');

    if (pauseBtn) pauseBtn.addEventListener('click', () => { isPaused = true; if (pauseMenu) pauseMenu.classList.remove('hidden'); });
    if (resumeBtn) resumeBtn.addEventListener('click', () => { isPaused = false; if (pauseMenu) pauseMenu.classList.add('hidden'); });

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