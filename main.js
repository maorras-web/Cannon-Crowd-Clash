/* main.js - v2.0.0 Complete Game Engine */

// --- הגדרות קנווס ---
const canvas = document.getElementById('gameCanvas') || createGameCanvas();
const ctx = canvas.getContext('2d');

function createGameCanvas() {
    const c = document.createElement('canvas');
    c.id = 'gameCanvas';
    document.body.appendChild(c);
    return c;
}

function resizeCanvas() {
    canvas.width = window.innerWidth > 500 ? 480 : window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- שמירת נתונים (LocalStorage) ---
const SAVE_KEY = 'ball_blast_save_data';
let saveData = JSON.parse(localStorage.getItem(SAVE_KEY)) || {
    coins: 0,
    bestScore: 0,
    fireRateLvl: 1,
    firePowerLvl: 1,
    coinMagnetLvl: 0,
    tripleCannonUnlocked: false
};

function saveProgress() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

// --- מצב המשחק (Game State) ---
let gameState = {
    score: 0,
    level: 1,
    levelProgress: 0,
    levelTarget: 1000,
    gameOver: false,
    inShop: false,
    rockSpawnTimer: 0,
    rockSpawnInterval: 90
};

// --- ישויות במשחק ---
let cannon;
let bullets = [];
let rocks = [];
let coins = [];
let particles = [];
let activeBat = null;
let playerInputX = canvas.width / 2;

// --- מחלקת השחקן (תותח) ---
class Cannon {
    constructor() {
        this.width = 64;
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 30;
        this.shootTimer = 0;
    }

    get fireRateCooldown() {
        // חישוב מהירות הירי לפי רמת ה-Fire Rate בחנות
        return Math.max(3, 12 - saveData.fireRateLvl * 0.7);
    }

    get damage() {
        // חישוב עוצמת הירי לפי רמת ה-Fire Power בחנות
        return 8 + saveData.firePowerLvl * 4;
    }

    get magnetRadius() {
        // טווח המגנט לפי הרמה בחנות
        return saveData.coinMagnetLvl * 65;
    }

    update(targetX) {
        if (targetX !== undefined) {
            this.x = targetX - this.width / 2;
        }
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // מנגנון ירי
        this.shootTimer++;
        if (this.shootTimer >= this.fireRateCooldown) {
            this.shoot();
            this.shootTimer = 0;
        }
    }

    shoot() {
        const centerX = this.x + this.width / 2;
        const topY = this.y - 10;

        if (saveData.tripleCannonUnlocked) {
            // ירי משולש (Triple Cannon)
            bullets.push(new Bullet(centerX, topY, 0));
            bullets.push(new Bullet(centerX - 10, topY, -0.18));
            bullets.push(new Bullet(centerX + 10, topY, 0.18));
        } else {
            // ירי יחיד רגיל
            bullets.push(new Bullet(centerX, topY, 0));
        }
    }

    draw() {
        ctx.save();
        
        // קנה/קנים
        ctx.fillStyle = '#1e272e';
        if (saveData.tripleCannonUnlocked) {
            ctx.fillRect(this.x + this.width / 2 - 16, this.y - 12, 8, 20);
            ctx.fillRect(this.x + this.width / 2 - 4, this.y - 16, 8, 24);
            ctx.fillRect(this.x + this.width / 2 + 8, this.y - 12, 8, 20);
        } else {
            ctx.fillRect(this.x + this.width / 2 - 6, this.y - 14, 12, 22);
        }

        // גוף התותח (כיפה חצי עגולה)
        ctx.fillStyle = '#00d2d3';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, Math.PI, 0, false);
        ctx.fill();

        // גלגלים
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(this.x + 12, this.y + this.height - 4, 11, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 12, this.y + this.height - 4, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// --- מחלקת כדורי הירי ---
class Bullet {
    constructor(x, y, angle = 0) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.speed = 14;
        this.vx = Math.sin(angle) * this.speed;
        this.vy = -Math.cos(angle) * this.speed;
        this.damage = cannon.damage;
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < 0 || this.x < 0 || this.x > canvas.width) {
            this.markedForDeletion = true;
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f39c12';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- מחלקת הסלעים (Rock) ---
class Rock {
    constructor(x, y, radius, hp) {
        this.radius = radius || Math.floor(Math.random() * 22) + 32;
        this.x = x || Math.random() * (canvas.width - this.radius * 2) + this.radius;
        this.y = y || -40;
        this.hp = hp || Math.floor(this.radius * (1.8 + gameState.level * 0.4));
        this.maxHp = this.hp;
        
        this.vx = (Math.random() - 0.5) * 3.5;
        this.vy = 1.5;
        this.gravity = 0.16;
        this.bouncePower = -9.2;
        this.markedForDeletion = false;

        // צבעים דינמיים לפי החיים
        const colors = ['#00b894', '#0984e3', '#6c5ce7', '#e17055', '#d63031'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;

        // הדהוד מהקירות
        if (this.x - this.radius <= 0 || this.x + this.radius >= canvas.width) {
            this.vx *= -1;
        }

        // קפיצה מהרצפה
        if (this.y + this.radius >= canvas.height - 25) {
            this.y = canvas.height - 25 - this.radius;
            this.vy = this.bouncePower;
        }

        // השמדה ופיצול
        if (this.hp <= 0) {
            this.markedForDeletion = true;
            createParticles(this.x, this.y, this.color, 14);
            spawnCoins(this.x, this.y, Math.floor(this.maxHp / 6) + 1);

            // פיצול לסלעים קטנים יותר
            if (this.radius > 22) {
                rocks.push(new Rock(this.x - 12, this.y, this.radius * 0.7, Math.floor(this.maxHp / 2)));
                rocks.push(new Rock(this.x + 12, this.y, this.radius * 0.7, Math.floor(this.maxHp / 2)));
            }
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;

        // ציור בצורת מضلע/משושה (Hexagon)
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides;
            const px = this.x + this.radius * Math.cos(angle);
            const py = this.y + this.radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // מספר חיים במרכז
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.ceil(this.hp), this.x, this.y);

        ctx.restore();
    }
}

// --- מחלקת עטלף-בוס מפלצתי (Bat Boss) ---
class BatEnemy {
    constructor(canvasWidth, canvasHeight, currentLevel) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // ממדים מפלצתיים
        this.width = 180;
        this.height = 110;
        
        this.x = (canvasWidth - this.width) / 2;
        this.y = 80;
        
        // חיים חזקים ומותאמים לשלב
        this.hp = currentLevel * 350 + 500;
        this.maxHp = this.hp;
        
        this.vx = 3.8;
        this.wingAngle = 0;
        this.wingSpeed = 0.16;
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.vx;
        if (this.x <= 10 || this.x + this.width >= this.canvasWidth - 10) {
            this.vx *= -1;
        }

        this.wingAngle += this.wingSpeed;

        if (this.hp <= 0) {
            this.markedForDeletion = true;
            createParticles(this.x + this.width / 2, this.y + this.height / 2, '#ff0044', 50);
            spawnCoins(this.x + this.width / 2, this.y + this.height / 2, 45); // שלל מטבעות ענק
        }
    }

    draw(ctx) {
        ctx.save();
        
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const wingFlap = Math.sin(this.wingAngle) * 45;

        // הילה אדומה-זוהרת
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff0044';

        // 1. גוף העטלף
        ctx.fillStyle = '#0d001a';
        ctx.strokeStyle = '#a600ff';
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 35, 45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 2. כנף שמאל מפלצתית
        ctx.beginPath();
        ctx.moveTo(centerX - 20, centerY - 10);
        ctx.quadraticCurveTo(centerX - 70, centerY - 60 + wingFlap, centerX - 110, centerY - 15 + wingFlap);
        ctx.lineTo(centerX - 85, centerY + 35 + wingFlap);
        ctx.lineTo(centerX - 55, centerY + 15 + wingFlap);
        ctx.lineTo(centerX - 35, centerY + 40 + wingFlap);
        ctx.lineTo(centerX - 15, centerY + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. כנף ימין מפלצתית
        ctx.beginPath();
        ctx.moveTo(centerX + 20, centerY - 10);
        ctx.quadraticCurveTo(centerX + 70, centerY - 60 + wingFlap, centerX + 110, centerY - 15 + wingFlap);
        ctx.lineTo(centerX + 85, centerY + 35 + wingFlap);
        ctx.lineTo(centerX + 55, centerY + 15 + wingFlap);
        ctx.lineTo(centerX + 35, centerY + 40 + wingFlap);
        ctx.lineTo(centerX + 15, centerY + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 4. אוזניים חדות
        ctx.fillStyle = '#260033';
        ctx.beginPath();
        ctx.moveTo(centerX - 25, centerY - 30);
        ctx.lineTo(centerX - 40, centerY - 70);
        ctx.lineTo(centerX - 10, centerY - 40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + 25, centerY - 30);
        ctx.lineTo(centerX + 40, centerY - 70);
        ctx.lineTo(centerX + 10, centerY - 40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 5. עיניים אדומות זוהרות
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.arc(centerX - 12, centerY - 12, 8, 0, Math.PI * 2);
        ctx.arc(centerX + 12, centerY - 12, 8, 0, Math.PI * 2);
        ctx.fill();

        // 6. ניבים חדים
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(centerX - 10, centerY + 15);
        ctx.lineTo(centerX - 6, centerY + 28);
        ctx.lineTo(centerX - 2, centerY + 15);
        ctx.moveTo(centerX + 2, centerY + 15);
        ctx.lineTo(centerX + 6, centerY + 28);
        ctx.lineTo(centerX + 10, centerY + 15);
        ctx.fill();

        ctx.restore();

        // 7. מד חיים (HP) מעל הראש
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(this.hp), centerX, this.y - 20);
    }
}

// --- מחלקת מטבעות זהב ---
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5 - 2;
        this.gravity = 0.25;
        this.markedForDeletion = false;
    }

    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        // מנע נפילה מחוץ לרצפה
        if (this.y + this.radius >= canvas.height - 20) {
            this.y = canvas.height - 20 - this.radius;
            this.vy *= -0.4;
            this.vx *= 0.8;
        }

        // לוגיקת מגנט (אקטיבי לפי השדרוג בחנות)
        const cannonCenterX = cannon.x + cannon.width / 2;
        const cannonCenterY = cannon.y + cannon.height / 2;
        const dist = Math.hypot(cannonCenterX - this.x, cannonCenterY - this.y);

        if (dist < cannon.magnetRadius) {
            const angle = Math.atan2(cannonCenterY - this.y, cannonCenterX - this.x);
            this.x += Math.cos(angle) * 9;
            this.y += Math.sin(angle) * 9;
        }

        // איסוף מטבע ע"י השחקן
        if (dist < cannon.width / 2 + this.radius) {
            saveData.coins++;
            saveProgress();
            this.markedForDeletion = true;
            createParticles(this.x, this.y, '#f1c40f', 5);
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function spawnCoins(x, y, amount) {
    for (let i = 0; i < amount; i++) {
        coins.push(new Coin(x, y));
    }
}

// --- חלקיקי פיצוץ (Particles) ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 4 + 2;
        this.vx = (Math.random() - 0.5) * 7;
        this.vy = (Math.random() - 0.5) * 7;
        this.color = color;
        this.alpha = 1;
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.03;
        if (this.alpha <= 0) this.markedForDeletion = true;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// --- אירועי קלט (מגע ועכבר) ---
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    playerInputX = e.clientX - rect.left;
});

window.addEventListener('touchmove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches.length > 0) {
        playerInputX = e.touches[0].clientX - rect.left;
    }
});

// --- מנגנון ניהול יצירת סלעים / בוס ---
function handleSpawning() {
    // 1. **שינוי קריטי:** אם יש עטלף פעיל במגרש -> עצירת נפילת סלעים מוחלטת!
    if (activeBat && activeBat.hp > 0 && !activeBat.markedForDeletion) {
        return;
    }

    // 2. נפילת סלעים רגילה לפי קצב
    if (gameState.levelProgress < gameState.levelTarget) {
        gameState.rockSpawnTimer++;
        if (gameState.rockSpawnTimer >= gameState.rockSpawnInterval) {
            rocks.push(new Rock());
            gameState.rockSpawnTimer = 0;
        }
    } else if (rocks.length === 0 && !activeBat) {
        // 3. הגעה ליעד השלב וסיום כל הסלעים -> זימון עטלף-בוס מפלצתי!
        activeBat = new BatEnemy(canvas.width, canvas.height, gameState.level);
    }
}

// --- בדיקת התנגשויות (Collisions) ---
function checkCollisions() {
    bullets.forEach(bullet => {
        // כדורים נגד סלעים
        rocks.forEach(rock => {
            const dist = Math.hypot(bullet.x - rock.x, bullet.y - rock.y);
            if (dist < bullet.radius + rock.radius) {
                rock.hp -= bullet.damage;
                bullet.markedForDeletion = true;
                gameState.score += 10;
                gameState.levelProgress += bullet.damage;
                createParticles(bullet.x, bullet.y, '#f1c40f', 3);
            }
        });

        // כדורים נגד העטלף
        if (activeBat && !activeBat.markedForDeletion) {
            if (
                bullet.x > activeBat.x &&
                bullet.x < activeBat.x + activeBat.width &&
                bullet.y > activeBat.y &&
                bullet.y < activeBat.y + activeBat.height
            ) {
                activeBat.hp -= bullet.damage;
                bullet.markedForDeletion = true;
                gameState.score += 20;
                createParticles(bullet.x, bullet.y, '#ff0044', 4);

                if (activeBat.hp <= 0) {
                    activeBat.markedForDeletion = true;
                    activeBat = null;
                    // מעבר לשלב הבא
                    gameState.level++;
                    gameState.levelProgress = 0;
                    gameState.levelTarget = gameState.level * 1200;
                }
            }
        }
    });

    // סלעים נגד תותח (פגיעה = Game Over)
    rocks.forEach(rock => {
        const dist = Math.hypot(rock.x - (cannon.x + cannon.width / 2), rock.y - (cannon.y + cannon.height / 2));
        if (dist < rock.radius + cannon.width / 3) {
            endGame();
        }
    });
}

// --- ממשק משתמש (HUD) ---
function drawHUD() {
    ctx.save();
    
    // 1. מד התקדמות בשלב (Top Progress Bar)
    const barW = 200;
    const barH = 16;
    const barX = canvas.width / 2 - barW / 2;
    const barY = 20;
    const progress = Math.min(1, gameState.levelProgress / gameState.levelTarget);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#00b894';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // טקסט התקדמות
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(gameState.levelProgress)} / ${gameState.levelTarget}`, canvas.width / 2, barY + 12);

    // 2. תווית LEVEL
    ctx.fillStyle = '#fdc23e';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`LEVEL ${gameState.level}`, canvas.width / 2, barY - 6);

    // 3. מציג מטבעות (Coins Counter)
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🪙 ${saveData.coins}`, 20, 32);

    // 4. ניקוד (Score)
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${gameState.score}`, canvas.width - 20, 32);

    ctx.restore();
}

// --- חנות שדרוגים (Shop UI) ---
function drawShop() {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 15, 30, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE SHOP', canvas.width / 2, 70);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Coins: 🪙 ${saveData.coins}`, canvas.width / 2, 105);

    // כפתורי שדרוג
    drawShopItem(150, 'FIRE RATE', `Lvl ${saveData.fireRateLvl}`, saveData.fireRateLvl * 150, () => {
        if (saveData.coins >= saveData.fireRateLvl * 150) {
            saveData.coins -= saveData.fireRateLvl * 150;
            saveData.fireRateLvl++;
            saveProgress();
        }
    });

    drawShopItem(230, 'FIRE POWER', `Lvl ${saveData.firePowerLvl}`, saveData.firePowerLvl * 200, () => {
        if (saveData.coins >= saveData.firePowerLvl * 200) {
            saveData.coins -= saveData.firePowerLvl * 200;
            saveData.firePowerLvl++;
            saveProgress();
        }
    });

    drawShopItem(310, 'COIN MAGNET', `Lvl ${saveData.coinMagnetLvl}`, (saveData.coinMagnetLvl + 1) * 250, () => {
        if (saveData.coins >= (saveData.coinMagnetLvl + 1) * 250) {
            saveData.coins -= (saveData.coinMagnetLvl + 1) * 250;
            saveData.coinMagnetLvl++;
            saveProgress();
        }
    });

    const tripleText = saveData.tripleCannonUnlocked ? 'OWNED' : '2000 COINS';
    drawShopItem(390, 'TRIPLE CANNON', saveData.tripleCannonUnlocked ? 'UNLOCKED' : 'BUY', 2000, () => {
        if (!saveData.tripleCannonUnlocked && saveData.coins >= 2000) {
            saveData.coins -= 2000;
            saveData.tripleCannonUnlocked = true;
            saveProgress();
        }
    });

    // כפתור התחלת משחק
    ctx.fillStyle = '#00b894';
    ctx.fillRect(canvas.width / 2 - 100, canvas.height - 100, 200, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('START GAME', canvas.width / 2, canvas.height - 68);

    ctx.restore();
}

function drawShopItem(y, title, subtitle, cost, onClick) {
    const btnW = 340;
    const btnH = 60;
    const btnX = canvas.width / 2 - btnW / 2;

    ctx.fillStyle = '#2d3436';
    ctx.fillRect(btnX, y, btnW, btnH);
    ctx.strokeStyle = '#00d2d3';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, y, btnW, btnH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, btnX + 15, y + 26);

    ctx.fillStyle = '#a4b0be';
    ctx.font = '14px Arial';
    ctx.fillText(subtitle, btnX + 15, y + 48);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(typeof cost === 'number' ? `🪙 ${cost}` : cost, btnX + btnW - 15, y + 36);
}

// לחיצות בחנות
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (gameState.inShop) {
        // בדיקת לחיצה על כפתורי השדרוגים
        if (clickY >= 150 && clickY <= 210) {
            if (saveData.coins >= saveData.fireRateLvl * 150) {
                saveData.coins -= saveData.fireRateLvl * 150;
                saveData.fireRateLvl++;
                saveProgress();
            }
        } else if (clickY >= 230 && clickY <= 290) {
            if (saveData.coins >= saveData.firePowerLvl * 200) {
                saveData.coins -= saveData.firePowerLvl * 200;
                saveData.firePowerLvl++;
                saveProgress();
            }
        } else if (clickY >= 310 && clickY <= 370) {
            if (saveData.coins >= (saveData.coinMagnetLvl + 1) * 250) {
                saveData.coins -= (saveData.coinMagnetLvl + 1) * 250;
                saveData.coinMagnetLvl++;
                saveProgress();
            }
        } else if (clickY >= 390 && clickY <= 450) {
            if (!saveData.tripleCannonUnlocked && saveData.coins >= 2000) {
                saveData.coins -= 2000;
                saveData.tripleCannonUnlocked = true;
                saveProgress();
            }
        } else if (clickY >= canvas.height - 100 && clickY <= canvas.height - 50) {
            gameState.inShop = false;
        }
    } else if (gameState.gameOver) {
        initGame();
    }
});

// --- אתחול וסיום משחק ---
function initGame() {
    cannon = new Cannon();
    bullets = [];
    rocks = [];
    coins = [];
    particles = [];
    activeBat = null;
    gameState.score = 0;
    gameState.level = 1;
    gameState.levelProgress = 0;
    gameState.levelTarget = 1000;
    gameState.gameOver = false;
    gameState.inShop = true; // פתיחת חנות בתחילה
}

function endGame() {
    gameState.gameOver = true;
    if (gameState.score > saveData.bestScore) {
        saveData.bestScore = gameState.score;
        saveProgress();
    }
}

// --- הלולאה הראשית (Game Loop) ---
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState.inShop) {
        drawShop();
    } else if (!gameState.gameOver) {
        // 1. ניהול יצירת סלעים/עטלף
        handleSpawning();

        // 2. עדכון מיקומים
        cannon.update(playerInputX);
        bullets.forEach(b => b.update());
        rocks.forEach(r => r.update());
        coins.forEach(c => c.update());
        particles.forEach(p => p.update());

        if (activeBat && !activeBat.markedForDeletion) {
            activeBat.update();
        }

        // 3. בדיקת התנגשויות
        checkCollisions();

        // 4. ניקוי עצמים שאינם פעילים
        bullets = bullets.filter(b => !b.markedForDeletion);
        rocks = rocks.filter(r => !r.markedForDeletion);
        coins = coins.filter(c => !c.markedForDeletion);
        particles = particles.filter(p => !p.markedForDeletion);

        // 5. ציור אלמנטים
        cannon.draw();
        bullets.forEach(b => b.draw());
        rocks.forEach(r => r.draw());
        coins.forEach(c => c.draw());
        particles.forEach(p => p.draw());

        if (activeBat && !activeBat.markedForDeletion) {
            activeBat.draw(ctx);
        }

        // 6. ממשק HUD
        drawHUD();
    } else {
        // מסך Game Over
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff0044';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText(`Final Score: ${gameState.score}`, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText(`Best Score: ${saveData.bestScore}`, canvas.width / 2, canvas.height / 2 + 40);

        ctx.fillStyle = '#00d2d3';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Tap to Restart', canvas.width / 2, canvas.height / 2 + 90);
    }

    requestAnimationFrame(animate);
}

// התחלת המשחק
initGame();
animate();