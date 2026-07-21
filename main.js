window.addEventListener('DOMContentLoaded', () => {
    // --- 1. אתחול סצנה ומצלמה ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.007);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // --- 2. תאורה ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);

    // --- 3. המסלול ---
    const trackWidth = 14;
    const trackLength = 220;
    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    const wallGeo = new THREE.BoxGeometry(0.5, 1.2, trackLength);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-trackWidth / 2 - 0.25, 0.35, track.position.z);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(trackWidth / 2 + 0.25, 0.35, track.position.z);
    scene.add(rightWall);

    // --- 4. התותח ---
    const cannonGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    cannonGroup.add(base);

    const barrelGeo = new THREE.CylinderGeometry(0.45, 0.55, 1.8, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.8 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.3, -1);
    cannonGroup.add(barrel);

    cannonGroup.position.set(0, 0.4, 0);
    scene.add(cannonGroup);

    // --- 5. טקסט על שערים ---
    function createGateTexture(label, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 256, 256);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, 244, 244);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 90px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);

        return new THREE.CanvasTexture(canvas);
    }

    // --- 6. שערים ---
    const gates = [];
    function createGate(x, z, type, value) {
        const gateGroup = new THREE.Group();
        const width = trackWidth / 2 - 0.6;
        const height = 4.5;

        const label = type === 'multiply' ? `x${value}` : `+${value}`;
        const colorHex = type === 'multiply' ? '#10b981' : '#06b6d4';
        const texture = createGateTexture(label, colorHex);

        const frameGeo = new THREE.BoxGeometry(width, height, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.85 });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height / 2;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { type, value };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    createGate(-3.3, -35, 'multiply', 2);
    createGate(3.3, -35, 'add', 5);
    createGate(-3.3, -85, 'multiply', 3);
    createGate(3.3, -85, 'multiply', 2);
    createGate(-3.3, -135, 'add', 10);
    createGate(3.3, -135, 'multiply', 2);

    // --- 7. רובוטים רשעים ואויבים ---
    const robots = [];

    function createRobot(x, z, hp) {
        const robotGroup = new THREE.Group();

        // גוף הרובוט
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        robotGroup.add(body);

        // ראש
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.0;
        robotGroup.add(head);

        // עיניים אדומות זוהרות
        const eyeGeo = new THREE.BoxGeometry(0.6, 0.2, 0.1);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1 });
        const eyes = new THREE.Mesh(eyeGeo, eyeMat);
        eyes.position.set(0, 2.0, -0.41);
        robotGroup.add(eyes);

        robotGroup.position.set(x, 0, z);
        robotGroup.userData = { hp, maxHp: hp };
        scene.add(robotGroup);
        robots.push(robotGroup);
    }

    // יצירת רובוטים לאורך המסלול הצועדים קדימה
    createRobot(-3, -60, 10);
    createRobot(3, -60, 10);
    createRobot(0, -110, 25);
    createRobot(-4, -160, 35);
    createRobot(4, -160, 35);

    // --- 8. בוס בסוף ---
    const bossGroup = new THREE.Group();
    const bossZ = -195;

    const bossGeo = new THREE.BoxGeometry(4.5, 5.5, 4.5);
    const bossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const bossMesh = new THREE.Mesh(bossGeo, bossMat);
    bossMesh.position.y = 2.75;
    bossGroup.add(bossMesh);

    // מד חיים לבוס
    const hpBgGeo = new THREE.PlaneGeometry(4, 0.6);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.position.set(0, 6.2, 0);
    bossGroup.add(hpBg);

    const hpBarGeo = new THREE.PlaneGeometry(3.9, 0.5);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const hpBar = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.set(0, 6.2, 0.01);
    bossGroup.add(hpBar);

    bossGroup.position.set(0, 0, bossZ);
    bossGroup.userData = { hp: 120, maxHp: 120 };
    scene.add(bossGroup);

    // --- 9. כדורים/פגזים ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 });

    function spawnBullet(x, z) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x + (Math.random() - 0.5) * 0.5, 0.35, z);
        scene.add(bullet);
        bullets.push(bullet);
    }

    let shootTimer = 0;

    // --- 10. בקרות ושליטה ---
    let targetX = 0;
    let isDragging = false;
    let previousTouchX = 0;
    let firstTouch = true;

    function hideInstructions() {
        if (firstTouch) {
            const inst = document.getElementById('instructions');
            if (inst) inst.style.opacity = '0';
            firstTouch = false;
        }
    }

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; hideInstructions(); });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging && !isPaused && !isGameOver) {
            targetX += (e.clientX - previousTouchX) * 0.025;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; previousTouchX = e.touches[0].clientX; hideInstructions(); });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging && !isPaused && !isGameOver) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.025;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 11. מצבי משחק ---
    let isPaused = false;
    let isGameOver = false;
    let score = 0;

    const pauseBtn = document.getElementById('pause-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');

    pauseBtn.addEventListener('click', () => {
        if (!isGameOver) {
            isPaused = true;
            pauseMenu.classList.remove('hidden');
        }
    });

    resumeBtn.addEventListener('click', () => {
        isPaused = false;
        pauseMenu.classList.add('hidden');
    });

    restartBtn.addEventListener('click', () => {
        window.location.reload();
    });

    function triggerGameOver(isWin) {
        isGameOver = true;
        const statusTitle = document.getElementById('status-title');
        const gameStatus = document.getElementById('game-status');

        if (isWin) {
            statusTitle.innerText = "🏆 ניצחת! הבוס הובס!";
        } else {
            statusTitle.innerText = "💥 הפסדת! הרובוטים הגיעו לתותח!";
        }
        gameStatus.classList.remove('hidden');
    }

    // --- 12. לולאת המשחק ---
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        if (isPaused || isGameOver) return;

        const delta = clock.getDelta();

        // תנועת התותח
        const maxX = trackWidth / 2 - 1.2;
        targetX = Math.max(-maxX, Math.min(maxX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.15);

        // ירייה אוטומטית
        shootTimer += delta;
        if (shootTimer >= 0.14) {
            spawnBullet(cannonGroup.position.x, cannonGroup.position.z - 1.2);
            shootTimer = 0;
        }

        // תנועת הרובוטים לכיוון התותח!
        for (let r = robots.length - 1; r >= 0; r--) {
            const robot = robots[r];
            robot.position.z += 2.5 * delta; // מהירות הצעידה של הרובוטים

            // אם רובוט הגיע לתותח - הפסד!
            if (robot.position.z >= cannonGroup.position.z - 1.2) {
                triggerGameOver(false);
                return;
            }
        }

        // עדכון כדורים והתנגשויות
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 28 * delta;

            // התנגשות בשערים
            gates.forEach(gate => {
                if (Math.abs(b.position.z - gate.position.z) < 0.5) {
                    if (Math.abs(b.position.x - gate.position.x) < (trackWidth / 4)) {
                        if (gate.userData.type === 'multiply') {
                            for (let k = 0; k < gate.userData.value - 1; k++) {
                                spawnBullet(b.position.x, b.position.z - 0.3);
                            }
                        } else if (gate.userData.type === 'add') {
                            for (let k = 0; k < gate.userData.value; k++) {
                                spawnBullet(b.position.x, b.position.z - 0.3);
                            }
                        }
                        score += 5;
                        document.getElementById('score-val').innerText = score;
                    }
                }
            });

            // התנגשות ברובוטים
            let bulletHit = false;
            for (let r = robots.length - 1; r >= 0; r--) {
                const robot = robots[r];
                if (b.position.distanceTo(robot.position) < 1.2) {
                    robot.userData.hp -= 1;
                    bulletHit = true;

                    if (robot.userData.hp <= 0) {
                        scene.remove(robot);
                        robots.splice(r, 1);
                        score += 50;
                        document.getElementById('score-val').innerText = score;
                    }
                    break;
                }
            }

            if (bulletHit) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            // התנגשות בבוס
            if (bossGroup.userData.hp > 0 && b.position.distanceTo(bossGroup.position) < 3.2) {
                bossGroup.userData.hp -= 1;

                const hpPercent = Math.max(0, bossGroup.userData.hp / bossGroup.userData.maxHp);
                hpBar.scale.x = hpPercent;
                hpBar.position.x = (1 - hpPercent) * -1.95;

                scene.remove(b);
                bullets.splice(i, 1);

                if (bossGroup.userData.hp <= 0) {
                    scene.remove(bossGroup);
                    triggerGameOver(true);
                }
                continue;
            }

            if (b && b.position.z < -trackLength) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }

        // מצלמה
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, cannonGroup.position.x * 0.3, 0.1);
        camera.position.y = 8.5;
        camera.position.z = cannonGroup.position.z + 12;
        camera.lookAt(cannonGroup.position.x * 0.15, 1, cannonGroup.position.z - 12);

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});