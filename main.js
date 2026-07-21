window.addEventListener('DOMContentLoaded', () => {
    // --- 1. אתחול סצנה, מצלמה ורנדרר ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // --- 2. תאורה ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // --- 3. המסלול (Track) ---
    const trackWidth = 14;
    const trackLength = 200;
    const trackGeo = new THREE.BoxGeometry(trackWidth, 0.5, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0, -0.25, -trackLength / 2 + 10);
    scene.add(track);

    // גבולות המסלול (קירות צדדיים)
    const wallGeo = new THREE.BoxGeometry(0.5, 1, trackLength);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-trackWidth / 2 - 0.25, 0.25, track.position.z);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(trackWidth / 2 + 0.25, 0.25, track.position.z);
    scene.add(rightWall);

    // --- 4. התותח (Player Cannon) ---
    const cannonGroup = new THREE.Group();
    
    // גוף התותח
    const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    cannonGroup.add(base);

    // קנה התותח
    const barrelGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.8, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.8 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.3, -1);
    cannonGroup.add(barrel);

    cannonGroup.position.set(0, 0.4, 0);
    scene.add(cannonGroup);

    // --- 5. יצירת שערי מכפילים (Gates) ---
    const gates = [];
    function createGate(x, z, type, value) {
        const gateGroup = new THREE.Group();
        const width = trackWidth / 2 - 0.5;
        const height = 4;

        // מסגרת השער
        const frameGeo = new THREE.BoxGeometry(width, height, 0.2);
        const color = type === 'multiply' ? 0x10b981 : 0x06b6d4; // ירוק למכפיל, טורקיז לחיבור
        const frameMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.65 
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height / 2;
        gateGroup.add(frame);

        gateGroup.position.set(x, 0, z);
        gateGroup.userData = { type, value, active: true };
        scene.add(gateGroup);
        gates.push(gateGroup);
    }

    // הוספת שערים לאורך המסלול
    createGate(-3.3, -30, 'multiply', 2); // x2
    createGate(3.3, -30, 'add', 5);        // +5
    createGate(-3.3, -80, 'multiply', 3); // x3
    createGate(3.3, -80, 'multiply', 2); // x2

    // --- 6. כדורים/פגזים (Crowd Bullets) ---
    const bullets = [];
    const bulletGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const bulletMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x2563eb, emissiveIntensity: 0.5 });

    function spawnBullet(x, z) {
        const bullet = new THREE.Mesh(bulletGeo, bulletMat);
        bullet.position.set(x + (Math.random() - 0.5) * 0.4, 0.3, z);
        scene.add(bullet);
        bullets.push(bullet);
    }

    // יריית כדורים אוטומטית מהתותח
    let shootTimer = 0;

    // --- 7. שליטה בתותח (Drag/Touch) ---
    let targetX = 0;
    let isDragging = false;
    let previousTouchX = 0;

    window.addEventListener('mousedown', (e) => { isDragging = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousTouchX;
            targetX += deltaX * 0.025;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => {
        isDragging = true;
        previousTouchX = e.touches[0].clientX;
    });
    window.addEventListener('touchend', () => { isDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            const deltaX = e.touches[0].clientX - previousTouchX;
            targetX += deltaX * 0.025;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 8. לולאת המשחק הראשת (Game Loop) ---
    let score = 0;
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        // הגבלת תנועת התותח לגבולות המסלול
        const maxX = trackWidth / 2 - 1.2;
        targetX = Math.max(-maxX, Math.min(maxX, targetX));
        cannonGroup.position.x = THREE.MathUtils.lerp(cannonGroup.position.x, targetX, 0.15);

        // קצב ירייה אוטומטי מהתותח
        shootTimer += delta;
        if (shootTimer >= 0.15) {
            spawnBullet(cannonGroup.position.x, cannonGroup.position.z - 1.2);
            shootTimer = 0;
        }

        // עדכון תנועת הכדורים והתנגשות בשערים
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.position.z -= 25 * delta; // מהירות הכדור קדימה

            // בדיקת התנגשות בשערים
            gates.forEach(gate => {
                if (gate.userData.active && Math.abs(b.position.z - gate.position.z) < 0.5) {
                    const gateX = gate.position.x;
                    const gateWidth = trackWidth / 2 - 0.5;

                    if (Math.abs(b.position.x - gateX) < gateWidth / 2) {
                        // שכפול הכדורים לפי סוג השער
                        if (gate.userData.type === 'multiply') {
                            const newCount = gate.userData.value - 1;
                            for (let k = 0; k < newCount; k++) {
                                spawnBullet(b.position.x, b.position.z - 0.3);
                            }
                        } else if (gate.userData.type === 'add') {
                            for (let k = 0; k < gate.userData.value; k++) {
                                spawnBullet(b.position.x, b.position.z - 0.3);
                            }
                        }
                        
                        score += 10;
                        document.getElementById('score-val').innerText = score;
                    }
                }
            });

            // מחיקת כדורים שעברו את סוף המסלול
            if (b.position.z < -trackLength) {
                scene.remove(b);
                bullets.splice(i, 1);
            }
        }

        // מיקום המצלמה מאחורי התותח במבט מורם (Third-Person Runner Style)
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, cannonGroup.position.x * 0.4, 0.1);
        camera.position.y = 8;
        camera.position.z = cannonGroup.position.z + 12;
        camera.lookAt(cannonGroup.position.x * 0.2, 1, cannonGroup.position.z - 10);

        renderer.render(scene, camera);
    }

    animate();

    // התאמה לגודל המסך ברענון/סיבוב המסך
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});