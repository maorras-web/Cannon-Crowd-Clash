window.addEventListener('DOMContentLoaded', () => {

    // --- 1. שפות ותרגום ---
    const translations = {
        en: { score: "Score", best: "Best", instructions: "👈 Swipe left/right to move 👉", subtitle: "Pass through gates and get the highest score!", language: "Language", personalBest: "Personal Best", startGame: "Start Game 🚀", gamePaused: "Game Paused ⏸️", resumeGame: "Resume Game ▶️", volume: "Sound Volume 🔊", dir: "ltr" },
        he: { score: "ניקוד", best: "שיא", instructions: "👈 החלק ימינה ושמאלה כדי להזיז 👉", subtitle: "עבור בשערים והגע לניקוד הגבוה ביותר!", language: "שפה", personalBest: "שיא אישי", startGame: "התחל משחק 🚀", gamePaused: "משחק מושהה ⏸️", volume: "עוצמת שמע 🔊", dir: "rtl" }
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
    let masterVolume = 0.15;

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
        volumeSlider.addEventListener('input', (e) => {
            masterVolume = parseFloat(e.target.value);
        });
    }

    // --- 3. סצנה ותאורה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.001);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(40, 80, 20);
    scene.add(dirLight);

    // --- 4. מסלול והרים (מורחקים מהמסלול) ---
    const trackWidth = 14;
    const maxBoundX = trackWidth / 2 - 1.2;
    const trackLength = 3500;

    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.5 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    function createMountainRange(sideMultiplier) {
        const mountainGroup = new THREE.Group();
        
        const frontMat = new THREE.MeshStandardMaterial({ color: 0x475569, flatShading: true, roughness: 0.9 });
        const backMat = new THREE.MeshStandardMaterial({ color: 0x334155, flatShading: true, roughness: 1.0 });

        // מרחק ביטחון בסיסי מקצה המסלול
        const safetyOffset = 4.0;

        // שכבה קדמית
        for (let z = 200; z > -trackLength - 200; z -= 35) {
            const height = 30 + Math.random() * 40;
            const radius = 18 + Math.random() * 12;
            const geo = new THREE.ConeGeometry(radius, height, 5);
            const mountain = new THREE.Mesh(geo, frontMat);

            // חישוב המיקום כך שהבסיס של ההר יישאר מחוץ למסלול בכל מקרה
            const xPos = sideMultiplier * (trackWidth / 2 + safetyOffset + radius * 0.9);
            mountain.position.set(xPos, height / 2 - 2, z);
            mountain.rotation.y = Math.random() * Math.PI;
            mountainGroup.add(mountain);
        }

        // שכבה אחורית
        for (let z = 200; z > -trackLength - 200; z -= 50) {
            const height = 50 + Math.random() * 50;
            const radius = 28 + Math.random() * 15;
            const geo = new THREE.ConeGeometry(radius, height, 5);
            const mountain = new THREE.Mesh(geo, backMat);

            const xPos = sideMultiplier * (trackWidth / 2 + safetyOffset + radius * 1.4);
            mountain.position.set(xPos, height / 2 - 2, z);
            mountain.rotation.y = Math.random() * Math.PI;
            mountainGroup.add(mountain);
        }

        scene.add(mountainGroup);
    }

    createMountainRange(1);
    createMountainRange(-1);

    // --- 5. עיצוב תותח ---
    const cannonGroup = new THREE.Group();
    const cannonMeshGroup = new THREE.Group();

    const baseGeo = new THREE.CylinderGeometry(1.1, 1.4, 0.8, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = Math.PI / 12;
    cannonMeshGroup.add(base);

    const domeGeo = new THREE.SphereGeometry(0.9, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.1 });
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

    // --- 6. כדורים, שערים ואפקטי התנפצות ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 2.0 });

    function spawnBullet(x, z) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x, 1.1, z);
        scene.add(bullet);
        bullets.push(bullet);
    }

    const particles = [];
    const particleGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);

    function triggerExplosion(pos, colorHex) {
        const particleMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
        for (let i = 0; i < 25; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 3;
            p.position.y += Math.random() * 2;

            p.userData = {
                vx: (Math.random() - 0.5) * 14,
                vy: Math.random() * 12 + 4,
                vz: (Math.random() - 0.5) * 14,
                life: 1.0
            };
            scene.add(p);
            particles.push(p);
        }
    }

    const gates = [];
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
        const gateWidth = trackWidth / 2 - 0.5;
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

    let gateIdCounter = 1;
    for (let z = -100; z > -3200; z -= 130) {
        createGate(`g_${gateIdCounter++}`, -3.3, z, 'multiply', 2);
        createGate(`g_${gateIdCounter++}`, 3.3, z, 'add', 20);
    }

    // --- 7. שליטה ---
    let targetX = 0, isDragging = false, previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.022;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.022;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 8. מצבי משחק ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    document.getElementById('start-btn').addEventListener('click', () => {
        initAudio();
        gameStarted = true;
        document.getElementById('start-menu').classList.add('hidden');
        document.getElementById('start-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('start-overlay').classList.add('hidden'), 500);
        document.getElementById('pause-btn').classList.remove('hidden');
        document.getElementById('score-card').classList.remove('hidden');
    });

    const pauseBtn = document.getElementById('pause-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');

    pauseBtn.addEventListener('click', () => { isPaused = true; pauseMenu.classList.remove('hidden'); });
    resumeBtn.addEventListener('click', () => { isPaused = false; pauseMenu.classList.add('hidden'); });

    // --- 9. לולאת המשחק ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        if (!gameStarted || isPaused) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        cannonGroup.position.z -= 20.0 * delta;

        targetX = Math.max(-maxBoundX, Math.min(maxBoundX, targetX));
        const prevX = cannonGroup.position.x;
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.2);
        
        const moveDelta = cannonGroup.position.x - prevX;
        cannonMeshGroup.rotation.z = -moveDelta * 0.6;

        camera.position.x = cannonGroup.position.x * 0.35;
        camera.position.y = cannonGroup.position.y + 9.5;
        camera.position.z = cannonGroup.position.z + 14.0;
        camera.lookAt(cannonGroup.position.x, cannonGroup.position.y + 0.5, cannonGroup.position.z - 12.0);

        shootTimer += delta;
        if (shootTimer >= 0.11) {
            spawnBullet(cannonGroup.position.x - 0.45, cannonGroup.position.z - 1.2);
            spawnBullet(cannonGroup.position.x + 0.45, cannonGroup.position.z - 1.2);
            playSound('shoot');
            shootTimer = 0;
        }

        // תנועת חלקיקים
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.userData.life -= delta * 2.0;
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

        // כדורים והתנפצות שערים
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 55 * delta;

            if (b.position.z < cannonGroup.position.z - 120) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            for (let j = gates.length - 1; j >= 0; j--) {
                const g = gates[j];
                
                if (Math.abs(b.position.z - g.position.z) < 1.0 && Math.abs(b.position.x - g.position.x) < trackWidth / 4) {
                    playSound('gate');
                    score += 20;
                    document.getElementById('score-val').innerText = score;

                    if (g.userData.type === 'multiply') {
                        const extraBullets = g.userData.value - 1;
                        for (let k = 0; k < extraBullets; k++) {
                            spawnBullet(b.position.x + (Math.random() - 0.5) * 0.8, b.position.z - (k * 0.5));
                        }
                    } else if (g.userData.type === 'add') {
                        for (let k = 0; k < 3; k++) {
                            spawnBullet(b.position.x + (Math.random() - 0.5) * 0.8, b.position.z - (k * 0.5));
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

        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
});