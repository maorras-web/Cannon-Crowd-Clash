window.addEventListener('DOMContentLoaded', () => {

    // --- 1. Clean Audio Engine ---
    const soundURLs = {
        shoot: 'https://assets.mixkit.co/active_storage/sfx/1671/1671-preview.mp3',
        gate: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
        hit: 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3'
    };

    const audioBuffers = {};
    let audioCtx = null;
    let masterGainNode = null;
    let masterVolume = 0.25;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            masterGainNode = audioCtx.createGain();
            masterGainNode.gain.value = masterVolume;
            masterGainNode.connect(audioCtx.destination);

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
        if (audioCtx && audioBuffers[name] && masterVolume > 0 && !isPaused) {
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffers[name];
            
            const soundGain = audioCtx.createGain();
            soundGain.gain.value = (name === 'shoot') ? 0.35 : 1.0;
            
            source.connect(soundGain);
            soundGain.connect(masterGainNode);
            source.start(0);
        }
    }

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.value = masterVolume;
        volumeSlider.addEventListener('input', (e) => {
            masterVolume = parseFloat(e.target.value);
            if (masterGainNode) {
                masterGainNode.gain.value = masterVolume;
            }
        });
    }

    // --- 2. Scene & Lighting ---
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

    // --- 3. Track & Space World ---
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

        for (let i = 0; i < 3000; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            const side = Math.random() < 0.5 ? -1 : 1;
            
            star.position.set(
                side * (safetyOffset + Math.random() * 200),
                (Math.random() - 0.5) * 160,
                (Math.random() - 0.5) * trackLength
            );
            environmentGroup.add(star);
        }

        const orbGeometries = [
            new THREE.SphereGeometry(1.5, 16, 16),
            new THREE.SphereGeometry(2.5, 16, 16),
            new THREE.DodecahedronGeometry(2.0, 2)
        ];

        const orbColors = [0x38bdf8, 0x818cf8, 0xc084fc, 0x34d399, 0xf43f5e];

        for (let i = 0; i < 180; i++) {
            const geo = orbGeometries[Math.floor(Math.random() * orbGeometries.length)];
            const color = orbColors[Math.floor(Math.random() * orbColors.length)];
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.2,
                metalness: 0.7,
                emissive: color,
                emissiveIntensity: 0.2
            });

            const orb = new THREE.Mesh(geo, mat);
            const side = Math.random() < 0.5 ? -1 : 1;
            const x = side * (trackWidth / 2 + 4 + Math.random() * 35);
            const y = (Math.random() - 0.2) * 20;
            const z = -Math.random() * (trackLength - 200);

            orb.position.set(x, y, z);
            const scale = 0.6 + Math.random() * 1.2;
            orb.scale.set(scale, scale, scale);
            environmentGroup.add(orb);
        }
    }

    initSpaceWorld();

    // --- 4. UFO System ---
    let ufoTimer = 0.0;
    let activeUFO = null;
    let ufoSpawnInterval = 10.0;

    function cleanupUFO() {
        if (activeUFO) {
            activeUFO.laser.visible = false;
            scene.remove(activeUFO.group);
            activeUFO = null;
        }
    }

    function spawnUFO() {
        cleanupUFO();

        const ufoGroup = new THREE.Group();

        const bodyGeo = new THREE.CylinderGeometry(2.5, 3.5, 0.8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        ufoGroup.add(body);

        const domeGeo = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 0.3;
        ufoGroup.add(dome);

        const ringGeo = new THREE.TorusGeometry(3.2, 0.15, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.3;
        ufoGroup.add(ring);

        const beamGeo = new THREE.ConeGeometry(trackWidth * 0.6, 25, 16, 1, true);
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
        laserBeam.visible = false;
        ufoGroup.add(laserBeam);

        const startX = -45;
        const endX = 45;
        const startY = 16;
        const startZ = cannonGroup.position.z - 30;

        ufoGroup.position.set(startX, startY, startZ);
        scene.add(ufoGroup);

        activeUFO = {
            group: ufoGroup,
            laser: laserBeam,
            progress: 0,
            startX,
            endX,
            startY,
            startZ,
            duration: 4.5
        };
    }

    function updateUFOSystem(delta) {
        ufoTimer += delta;
        
        if (ufoTimer >= ufoSpawnInterval) {
            ufoTimer = 0;
            ufoSpawnInterval = 20.0;
            spawnUFO();
        }

        if (activeUFO) {
            activeUFO.progress += delta / activeUFO.duration;
            const p = activeUFO.progress;

            if (p >= 1.0) {
                cleanupUFO();
            } else {
                const currentX = THREE.MathUtils.lerp(activeUFO.startX, activeUFO.endX, p);
                activeUFO.group.position.x = currentX;
                activeUFO.group.position.y = activeUFO.startY + Math.sin(p * Math.PI * 6) * 0.5;
                activeUFO.group.rotation.y += delta * 4;

                const halfTrack = trackWidth / 2;
                if (currentX >= -halfTrack && currentX <= halfTrack) {
                    activeUFO.laser.visible = true;
                } else {
                    activeUFO.laser.visible = false;
                }
            }
        }
    }

    // --- 5. Enemies: Humanoid Lizardmen ---
    const lizards = [];
    let lizardSpawnTimer = 0;
    const lizardSpawnInterval = 3.0;

    function createLizardMesh() {
        const lizardGroup = new THREE.Group();

        const skinMat = new THREE.MeshStandardMaterial({ color: 0x1e5622, roughness: 0.5, metalness: 0.1 });
        const armorMat = new THREE.MeshStandardMaterial({ color: 0x143e17, roughness: 0.3, metalness: 0.3 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x0f2f11, roughness: 0.3 });

        const torsoGroup = new THREE.Group();
        const chestGeo = new THREE.CylinderGeometry(0.75, 0.45, 1.3, 16);
        const chest = new THREE.Mesh(chestGeo, skinMat);
        chest.position.y = 1.95;
        torsoGroup.add(chest);

        const pelvisGeo = new THREE.SphereGeometry(0.48, 12, 12);
        const pelvis = new THREE.Mesh(pelvisGeo, armorMat);
        pelvis.position.y = 1.25;
        torsoGroup.add(pelvis);

        lizardGroup.add(torsoGroup);

        const shoulderGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const upperArmGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.8, 12);
        const forearmGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.8, 12);

        const leftArmGroup = new THREE.Group();
        leftArmGroup.position.set(-0.82, 2.3, 0);
        const leftShoulder = new THREE.Mesh(shoulderGeo, armorMat);
        leftArmGroup.add(leftShoulder);
        const leftUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
        leftUpperArm.position.set(-0.15, -0.4, 0.1);
        leftUpperArm.rotation.z = Math.PI / 10;
        leftUpperArm.rotation.x = -Math.PI / 12;
        leftArmGroup.add(leftUpperArm);
        const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
        leftForearm.position.set(-0.25, -1.0, 0.3);
        leftForearm.rotation.x = -Math.PI / 4;
        leftArmGroup.add(leftForearm);
        lizardGroup.add(leftArmGroup);

        const rightArmGroup = new THREE.Group();
        rightArmGroup.position.set(0.82, 2.3, 0);
        const rightShoulder = new THREE.Mesh(shoulderGeo, armorMat);
        rightArmGroup.add(rightShoulder);
        const rightUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
        rightUpperArm.position.set(0.15, -0.4, 0.1);
        rightUpperArm.rotation.z = -Math.PI / 10;
        rightUpperArm.rotation.x = -Math.PI / 12;
        rightArmGroup.add(rightUpperArm);
        const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
        rightForearm.position.set(0.25, -1.0, 0.3);
        rightForearm.rotation.x = -Math.PI / 4;
        rightArmGroup.add(rightForearm);
        lizardGroup.add(rightArmGroup);

        const headGroup = new THREE.Group();
        const neckGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.35, 10);
        const neck = new THREE.Mesh(neckGeo, skinMat);
        neck.position.y = 2.65;
        headGroup.add(neck);

        const headGeo = new THREE.SphereGeometry(0.42, 16, 16);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.scale.set(0.9, 1.0, 1.2);
        head.position.set(0, 2.95, 0.05);
        headGroup.add(head);

        const snoutGeo = new THREE.ConeGeometry(0.28, 0.6, 12);
        const snout = new THREE.Mesh(snoutGeo, skinMat);
        snout.rotation.x = -Math.PI / 2;
        snout.position.set(0, 2.85, 0.55);
        headGroup.add(snout);

        const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.22, 3.02, 0.32);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.22, 3.02, 0.32);
        headGroup.add(rightEye);
        lizardGroup.add(headGroup);

        for (let i = 0; i < 4; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.rotation.x = -Math.PI / 3;
            spike.position.set(0, 2.4 - (i * 0.35), -0.42 - (i * 0.05));
            lizardGroup.add(spike);
        }

        const thighGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.85, 12);
        const shinGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.85, 12);

        const leftLegGroup = new THREE.Group();
        leftLegGroup.position.set(-0.35, 1.1, 0);
        const leftThigh = new THREE.Mesh(thighGeo, skinMat);
        leftThigh.position.set(0, -0.35, 0);
        leftLegGroup.add(leftThigh);
        const leftShin = new THREE.Mesh(shinGeo, skinMat);
        leftShin.position.set(0, -1.0, -0.05);
        leftLegGroup.add(leftShin);
        lizardGroup.add(leftLegGroup);

        const rightLegGroup = new THREE.Group();
        rightLegGroup.position.set(0.35, 1.1, 0);
        const rightThigh = new THREE.Mesh(thighGeo, skinMat);
        rightThigh.position.set(0, -0.35, 0);
        rightLegGroup.add(rightThigh);
        const rightShin = new THREE.Mesh(shinGeo, skinMat);
        rightShin.position.set(0, -1.0, -0.05);
        rightLegGroup.add(rightShin);
        lizardGroup.add(rightLegGroup);

        lizardGroup.scale.set(1.2, 1.2, 1.2);

        return lizardGroup;
    }

    function spawnLizard() {
        const lizard = createLizardMesh();
        const spawnX = (Math.random() - 0.5) * (trackWidth - 3);
        const spawnZ = cannonGroup.position.z - 120 - Math.random() * 30;

        lizard.position.set(spawnX, 0, spawnZ);
        scene.add(lizard);
        lizards.push(lizard);
    }

    function updateLizards(delta) {
        lizardSpawnTimer += delta;
        if (lizardSpawnTimer >= lizardSpawnInterval) {
            lizardSpawnTimer = 0;
            spawnLizard();
        }

        const lizardSpeed = 16.0;

        for (let i = lizards.length - 1; i >= 0; i--) {
            const liz = lizards[i];
            liz.position.z += lizardSpeed * delta;
            
            liz.position.y = Math.abs(Math.sin(clock.getElapsedTime() * 10)) * 0.35;
            liz.rotation.y = Math.sin(clock.getElapsedTime() * 8) * 0.12;

            const distToCannon = liz.position.distanceTo(cannonGroup.position);
            if (distToCannon < 1.8) {
                gameOver();
                return;
            }

            if (liz.position.z > cannonGroup.position.z + 10) {
                scene.remove(liz);
                lizards.splice(i, 1);
            }
        }
    }

    // --- 6. Cannon & Thrusters ---
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

    const thrusterGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.6, 16);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });

    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.rotation.z = Math.PI / 2;
    leftThruster.position.set(-1.2, 0.1, 0);
    cannonMeshGroup.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.rotation.z = -Math.PI / 2;
    rightThruster.position.set(1.2, 0.1, 0);
    cannonMeshGroup.add(rightThruster);

    function createThrusterFlame() {
        const flameGroup = new THREE.Group();

        const outerGeo = new THREE.ConeGeometry(0.25, 0.9, 12);
        outerGeo.translate(0, -0.45, 0); 
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        const outerFlame = new THREE.Mesh(outerGeo, outerMat);
        outerFlame.rotation.z = Math.PI;
        flameGroup.add(outerFlame);

        const innerGeo = new THREE.ConeGeometry(0.12, 0.6, 12);
        innerGeo.translate(0, -0.3, 0);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        const innerFlame = new THREE.Mesh(innerGeo, innerMat);
        innerFlame.rotation.z = Math.PI;
        flameGroup.add(innerFlame);

        return flameGroup;
    }

    const leftFlame = createThrusterFlame();
    leftFlame.position.set(0, 0.35, 0);
    leftThruster.add(leftFlame);

    const rightFlame = createThrusterFlame();
    rightFlame.position.set(0, 0.35, 0);
    rightThruster.add(rightFlame);

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

    // --- 7. Bullets & Effects ---
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
        for (let i = 0; i < 12; i++) {
            const p = new THREE.Mesh(particleGeo, particleMat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 2;
            p.position.y += Math.random() * 2;
            p.userData = { vx: (Math.random() - 0.5) * 12, vy: Math.random() * 10 + 3, vz: (Math.random() - 0.5) * 12, life: 1.0, mat: particleMat };
            scene.add(p);
            particles.push(p);
        }
    }

    // --- 8. Gates System ---
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
        ctx.font = '900 80px Rubik, sans-serif';
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

    // --- 9. Mobile Touch & Mouse Controls (עם מנגנון עצירה בטוח) ---
    let targetX = 0, isDragging = false, isFiring = false, previousTouchX = 0;

    function stopInput() {
        isDragging = false;
        isFiring = false;
    }

    window.addEventListener('mousedown', (e) => { isDragging = true; isFiring = true; previousTouchX = e.clientX; });
    window.addEventListener('mouseup', stopInput);
    window.addEventListener('mouseleave', stopInput);
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.clientX - previousTouchX) * 0.035;
            previousTouchX = e.clientX;
        }
    });

    window.addEventListener('touchstart', (e) => { isDragging = true; isFiring = true; previousTouchX = e.touches[0].clientX; });
    window.addEventListener('touchend', stopInput);
    window.addEventListener('touchcancel', stopInput);
    window.addEventListener('touchmove', (e) => {
        if (isDragging && gameStarted && !isPaused) {
            targetX += (e.touches[0].clientX - previousTouchX) * 0.035;
            previousTouchX = e.touches[0].clientX;
        }
    });

    // --- 10. Game States & Game Over ---
    let gameStarted = false, isPaused = false, score = 0, shootTimer = 0;

    function gameOver() {
        gameStarted = false;
        stopInput();
        alert(`Game Over! The lizardmen reached your cannon!\nYour Score: ${score}`);
        window.location.reload();
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            initAudio();
            gameStarted = true;
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) {
                startOverlay.style.opacity = '0';
                setTimeout(() => startOverlay.classList.add('hidden'), 400);
            }
            document.getElementById('pause-btn')?.classList.remove('hidden');
            document.getElementById('score-card')?.classList.remove('hidden');
        });
    }

    const pauseBtn = document.getElementById('pause-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeBtn = document.getElementById('resume-btn');

    if (pauseBtn) pauseBtn.addEventListener('click', () => { 
        isPaused = true; 
        stopInput();
        pauseMenu?.classList.remove('hidden'); 
    });
    
    if (resumeBtn) resumeBtn.addEventListener('click', () => { 
        isPaused = false; 
        pauseMenu?.classList.add('hidden'); 
    });

    // --- 11. Game Loop ---
    const clock = new THREE.Clock();
    const gateSpeed = 32.0;

    function animate() {
        requestAnimationFrame(animate);
        if (!gameStarted || isPaused) return;

        const delta = Math.min(clock.getDelta(), 0.1);

        updateUFOSystem(delta);
        updateLizards(delta);

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

        const flameTime = clock.getElapsedTime() * 20;
        const basePulse = 0.85 + Math.sin(flameTime) * 0.15;
        
        let leftBonus = moveDelta > 0.01 ? Math.abs(moveDelta) * 8 : 0;
        let rightBonus = moveDelta < -0.01 ? Math.abs(moveDelta) * 8 : 0;

        leftFlame.scale.set(basePulse + leftBonus, basePulse + leftBonus, basePulse + leftBonus);
        rightFlame.scale.set(basePulse + rightBonus, basePulse + rightBonus, basePulse + rightBonus);

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

            if (b.position.z < cannonGroup.position.z - 130) {
                scene.remove(b);
                bullets.splice(i, 1);
                continue;
            }

            let bulletDestroyed = false;
            for (let k = lizards.length - 1; k >= 0; k--) {
                const liz = lizards[k];
                if (b.position.distanceTo(liz.position) < 1.6) {
                    playSound('hit');
                    score += 30;
                    const scoreVal = document.getElementById('score-val');
                    if (scoreVal) scoreVal.innerText = score;

                    triggerExplosion(liz.position, 0x16a34a);
                    scene.remove(liz);
                    lizards.splice(k, 1);

                    scene.remove(b);
                    bullets.splice(i, 1);
                    bulletDestroyed = true;
                    break;
                }
            }

            if (bulletDestroyed) continue;

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