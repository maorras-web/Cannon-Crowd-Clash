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

    // קירות
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

    // --- 5. יצירת טקסט על השערים בעזרת Canvas2D ---
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

    // --- 6. שערים מכפילים ---
    const gates = [];
    function createGate(x, z, type, value) {
        const gateGroup = new THREE.Group();
        const width = trackWidth / 2 - 0.6;
        const height = 4.5;

        const label = type === 'multiply' ? `x${value}` : `+${value}`;
        const colorHex = type === 'multiply' ? '#10b981' : '#06b6d4';
        const texture = createGateTexture(label, colorHex);

        const frameGeo = new THREE.BoxGeometry(width, height, 0.2);
        const frameMat = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: 0.85
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height / 2;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { type, value, active: true };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    createGate(-3.3, -35, 'multiply', 2);
    createGate(3.3, -35, 'add', 5);
    createGate(-3.3, -85, 'multiply', 3);
    createGate(3.3, -85, 'multiply', 2);
    createGate(-3.3, -135, 'add', 10);
    createGate(3.3, -135, 'multiply', 2);

    // --- 7. אויבים ובוס בסוף המסלול ---
    const enemies = [];
    const enemyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });

    // צבא אויבים קטנים
    const bossZ = -185;
    for (let row = 0; row < 5; row++) {
        for (let col = -5; col <= 5; col += 2) {
            const enemy = new THREE.Mesh(enemyGeo, enemyMat);
            enemy.position.set(col, 0.4, bossZ + row * 2);
            enemy.userData = { hp: 1 };
            scene.add(enemy);
            enemies.push(enemy);
        }
    }

    // 👹 בוס ענקי בסוף
    const bossGeo = new THREE.BoxGeometry(4, 5, 4);
    const bossMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.3 });
    const boss = new THREE.Mesh(bossGeo, bossMat);
    boss.position.set(0, 2.5, bossZ - 10);
    boss.userData = { hp: 120, maxHp: 120, isBoss: true };
    scene.add(boss);
    enemies.push(boss);

    // --- 8. כדורים/פגזים ---
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

    // --- 9. בקרות גרירה ---
    let targetX = 0;
    let isDragging = false;
    let previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            targetX += (e.clientX - previousTouchX) * 0.025;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.025;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 10. לולאת המשחק ---
    let score = 0;
    let gameOver = false;
    const clock = new THREE.Clock();

    function animate() {
        if (gameOver) return;
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        // תנועת תותח
        const maxX = trackWidth / 2 - 1.2;
        targetX = Math.max(-maxX, Math.min(maxX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.15);

        // ירייה אוטומטית
        shootTimer += delta;
        if (shootTimer >= 0.14) {
            spawnBullet(cannonGroup.position.x, cannonGroup.position.z - 1.2);
            shootTimer = 0;
        }

        // תנועת כדורים
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

            // התנגשות באויבים/בוס
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (b.position.distanceTo(e.position) < (e.userData.isBoss ? 2.5 : 0.8)) {
                    e.userData.hp -= 1;

                    // מחיקת כדור
                    scene.remove(b);
                    bullets.splice(i, 1);

                    // פגיעה באויב
                    if (e.userData.hp <= 0) {
                        scene.remove(e);
                        enemies.splice(j, 1);

                        if (e.userData.isBoss) {
                            gameOver = true;
                            const popup = document.getElementById('game-status');
                            popup.innerText = "🏆 ניצחת! הבוס הובס!";
                            popup.classList.remove('hidden');
                        }
                    }
                    break;
                }
            }

            if (b && b.position.z < -trackLength) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }

        // מצלמה עוקבת
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