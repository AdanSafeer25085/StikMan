// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game elements
const scoreElement = document.getElementById('scoreValue');
const gameOverElement = document.getElementById('gameOver');
const instructionsElement = document.getElementById('instructions');

// Game state
let gameRunning = false;
let gameInitialized = false;
let score = 0;
let gameSpeed = 4;

// Pre-game flow state
let gameFlowState = 'starting'; // 'starting', 'gameModeSelect', 'playerSetup', 'modeSelection', 'multiplayerLobby', 'ready'
let playerName = '';
let raceDistance = 500; // Default 500m
let gameMode = ''; // 'land' or 'underwater'
let playMode = ''; // 'single' or 'multiplayer'

// Multiplayer state
let isMultiplayer = false;
let isHost = false;
let lobbyCode = '';
let connectedPlayers = [];
let currentPlayerId = null;
let multiplayerPlayers = [];
let leaderboard = [];
let finishLineX = 5000; // Default finish line position (500m single player, 1000m+ multiplayer × 10 pixels/meter)

// Race timing
let raceStartTime = 0;
let raceFinished = false;

// Live tracking system
let playerProgress = 0; // Percentage of race completed (0-1)
let currentSegment = 1; // Current segment (1-4)
let actualDistanceTraveled = 0; // Track actual distance independent of speed changes

// Respawn system
let isRespawning = false;
let gamePaused = false;
let respawnCountdown = 3;
let justRespawned = false; // Flag to prevent immediate progress overwrite

// Player object
const player = {
    x: 100,
    y: 200,
    width: 40,
    height: 40,
    velY: 0,
    jumping: false,
    grounded: false,
    image: new Image(),
    // Multiplayer properties
    id: null,
    name: '',
    health: 100,
    maxHealth: 100,
    color: '#FF6B6B'
};

// Load player image
player.image.src = '/sprites/player.png';
player.image.onerror = function() {
    // If image fails to load, we'll draw a rectangle
    console.log('Player image not found, using rectangle placeholder');
};

// Finish line image
const finishLineImage = new Image();
finishLineImage.src = '/sprites/finishLine.png';
finishLineImage.onerror = function() {
    console.log('Finish line image not found, using fallback drawing');
};

// Ground level
const groundY = 240;

// Get actual ground level at specific x position (for curved river bed)
function getGroundLevelAt(x) {
    if (gameMode === 'underwater') {
        const time = Date.now() / 1000;
        const waveAmplitude = 20;
        const waveFrequency = 0.01;
        const waveOffset = Math.sin((x * waveFrequency) + (time * 2)) * waveAmplitude;
        return groundY + waveOffset;
    }
    return groundY;
}

// Obstacles array
let obstacles = [];

// Obstacle generation timer
let obstacleTimer = 0;
const obstacleInterval = 120; // frames between obstacles

// Physics constants
const gravity = 0.8;
const jumpPower = -15;
const superJumpPower = -25;

// Power-up system
let powerUps = [];
let bullets = [];
let powerUpTimer = 0;
const powerUpInterval = 200; // frames between power-ups

// Active power-up state
let activePowerUp = {
    type: null, // null, 'gun', 'car', 'jumper'
    timeLeft: 0,
    maxTime: 600,
    originalSpeed: 4
};

// Car power-up modes
let carMode = 'jump'; // 'jump' or 'shoot'

// Underwater mode state
let isUnderwater = false; // For diver power-up - player is underwater and ignores obstacles

// Bullet shooting system
let lastShotTime = 0;
const shotCooldown = 500; // 0.5 seconds in milliseconds
let shootingAnimation = 0; // For muzzle flash effect

// Power-up images
const powerUpImages = {
    gun: new Image(),
    car: new Image(),
    jumper: new Image(),
    bullet: new Image(),
    boat: new Image(),
    diver: new Image()
};

// Load power-up images
powerUpImages.gun.src = '/sprites/gun.png';
powerUpImages.gun.onerror = () => console.log('Gun image not found, using placeholder');

powerUpImages.car.src = '/sprites/car.png';
powerUpImages.car.onerror = () => console.log('Car image not found, using placeholder');

powerUpImages.jumper.src = '/sprites/jumper.png';
powerUpImages.jumper.onerror = () => console.log('Jumper image not found, using placeholder');

powerUpImages.bullet.src = '/sprites/bullet.png';
powerUpImages.bullet.onerror = () => console.log('Bullet image not found, using placeholder');

powerUpImages.boat.src = '/sprites/boat.png';
powerUpImages.boat.onerror = () => console.log('Boat image not found, using placeholder');

powerUpImages.diver.src = '/sprites/diver.png';
powerUpImages.diver.onerror = () => console.log('Diver image not found, using placeholder');

// Initialize game
function init() {
    gameRunning = true;
    score = 0;
    gameSpeed = 4;
    obstacles = [];
    obstacleTimer = 0;
    
    // Reset power-up system
    powerUps = [];
    bullets = [];
    powerUpTimer = 0;
    activePowerUp = {
        type: null,
        timeLeft: 0,
        maxTime: 600,
        originalSpeed: 4
    };
    carMode = 'jump';
    lastShotTime = 0;
    shootingAnimation = 0;
    
    // Reset player position
    player.x = 100;
    player.y = groundY - player.height;
    player.velY = 0;
    player.jumping = false;
    player.grounded = true;
    
    // Hide game over, show instructions
    gameOverElement.style.display = 'none';
    instructionsElement.style.display = 'block';
    
    // Start game loop
    gameLoop();
}

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    // Update player physics
    updatePlayer();
    
    // Update obstacles
    updateObstacles();
    
    // Update power-ups
    updatePowerUps();
    
    // Update bullets
    updateBullets();
    
    // Update active power-up timers
    updateActivePowerUp();
    
    // Check collisions
    checkCollisions();
    
    // Check power-up collisions
    checkPowerUpCollisions();
    
    // Check bullet collisions
    checkBulletCollisions();
    
    // Check finish line collision
    checkFinishLineCollision();
    
    // Update live tracking system
    updatePlayerProgress();
    
    // Update score and distance (only if not paused)
    if (!gamePaused && !isRespawning) {
        score += 1;
        // Track actual distance traveled based on base game speed, not current speed
        actualDistanceTraveled += 4; // Use base speed of 4 for consistent distance tracking
        scoreElement.textContent = Math.floor(score / 10);
        
        // Increase game speed over time
        if (score % 500 === 0) {
            gameSpeed += 0.2;
        }
    }
}

// Update player movement and physics
function updatePlayer() {
    // Skip physics updates during respawn/pause
    if (gamePaused || isRespawning) return;
    
    // Apply gravity
    if (!player.grounded) {
        player.velY += gravity;
    }
    
    // Update position
    player.y += player.velY;
    
    // Ground collision with curved surface support
    const currentGroundLevel = getGroundLevelAt(player.x + player.width/2);
    if (player.y >= currentGroundLevel - player.height) {
        player.y = currentGroundLevel - player.height;
        player.velY = 0;
        player.jumping = false;
        player.grounded = true;
    } else {
        player.grounded = false;
    }
}

// Update obstacles
function updateObstacles() {
    // Skip obstacle updates during respawn/pause
    if (gamePaused || isRespawning) return;
    
    // Generate new obstacles
    obstacleTimer++;
    if (obstacleTimer >= obstacleInterval) {
        createObstacle();
        obstacleTimer = 0;
    }
    
    // Move obstacles and remove old ones
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;
        
        // Remove obstacles that are off screen
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

// Create new obstacle
function createObstacle() {
    const obstacle = {
        x: canvas.width + 20,
        y: groundY - 30,
        width: 20,
        height: 30,
        color: '#8B4513', // Brown color for cactus/rock
        type: 'obstacle'
    };
    
    obstacles.push(obstacle);
}

// Update power-ups
function updatePowerUps() {
    // Skip power-up updates during respawn/pause
    if (gamePaused || isRespawning) return;
    
    // Generate new power-ups
    powerUpTimer++;
    if (powerUpTimer >= powerUpInterval) {
        createPowerUp();
        powerUpTimer = 0;
    }
    
    // Move power-ups and remove old ones
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].x -= gameSpeed;
        
        // Remove power-ups that are off screen
        if (powerUps[i].x + powerUps[i].width < 0) {
            powerUps.splice(i, 1);
        }
    }
}

// Create new power-up
function createPowerUp() {
    // Different power-ups based on game mode
    let types;
    if (gameMode === 'underwater') {
        types = ['gun', 'boat', 'diver']; // Underwater power-ups
    } else {
        types = ['gun', 'car', 'jumper']; // Land power-ups
    }
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerUp = {
        x: canvas.width + 20,
        y: groundY - 25,
        width: 25,
        height: 25,
        type: type,
        color: getPowerUpColor(type)
    };
    
    powerUps.push(powerUp);
}

// Get power-up color based on type
function getPowerUpColor(type) {
    switch(type) {
        case 'gun': return '#FFD700';
        case 'car': return '#FF4500';
        case 'jumper': return '#00FF00';
        case 'boat': return '#8B4513';
        case 'diver': return '#00BFFF';
        default: return '#FFFFFF';
    }
}

// Update bullets
function updateBullets() {
    // Skip bullet updates during respawn/pause
    if (gamePaused || isRespawning) return;
    
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Update bullet trail
        bullet.trail.push({x: bullet.x, y: bullet.y});
        if (bullet.trail.length > 3) {
            bullet.trail.shift(); // Keep only last 3 positions for trail
        }
        
        bullet.x += bullet.speed;
        
        // Remove bullets that are off screen
        if (bullet.x > canvas.width) {
            bullets.splice(i, 1);
        }
    }
    
    // Update shooting animation
    if (shootingAnimation > 0) {
        shootingAnimation--;
    }
}

// Update active power-up timers
function updateActivePowerUp() {
    if (activePowerUp.type) {
        activePowerUp.timeLeft--;
        
        // Power-up expired
        if (activePowerUp.timeLeft <= 0) {
            deactivatePowerUp();
        }
    }
}

// Activate power-up
function activatePowerUp(type) {
    // Debug log power-up activation
    console.log(`Activating power-up: ${type}, previous: ${activePowerUp.type}`);
    
    // Deactivate current power-up first
    if (activePowerUp.type) {
        deactivatePowerUp();
    }
    
    activePowerUp.type = type;
    
    // All power-ups now last 10 seconds (600 frames at 60fps)
    activePowerUp.timeLeft = 600;
    activePowerUp.maxTime = 600; // Store max time for UI percentage calculation
    
    switch (type) {
        case 'gun':
            // Gun power-up lasts 10 seconds
            break;
        case 'car':
            // Car power-up lasts 10 seconds with speed boost (land mode)
            activePowerUp.originalSpeed = gameSpeed;
            gameSpeed *= 1.5; // Increase speed by 50%
            break;
        case 'jumper':
            // Jumper power-up lasts 10 seconds with super jump (land mode)
            break;
        case 'boat':
            // Boat power-up lasts 10 seconds with speed boost (underwater mode)
            activePowerUp.originalSpeed = gameSpeed;
            gameSpeed *= 1.5; // Increase speed by 50%
            break;
        case 'diver':
            // Diver power-up lasts 10 seconds - go underwater and ignore obstacles
            isUnderwater = true;
            break;
    }
}

// Deactivate power-up
function deactivatePowerUp() {
    // Reset specific power-up effects
    if (activePowerUp.type === 'car' || activePowerUp.type === 'boat') {
        gameSpeed = activePowerUp.originalSpeed;
    }
    if (activePowerUp.type === 'diver') {
        isUnderwater = false; // Surface from underwater
    }
    
    // Reset all power-up state
    activePowerUp.type = null;
    activePowerUp.timeLeft = 0;
    activePowerUp.maxTime = 600;
    
    // Reset mode states
    carMode = 'jump';
    
    // Reset any animation states
    shootingAnimation = 0;
    
    // Store current type before clearing for cleanup
    const currentType = activePowerUp.type;
    
    // Clear any shooting cooldowns when gun power-up expires
    if (currentType === 'gun') {
        lastShotTime = 0;
    }
}

// Check power-up collisions
function checkPowerUpCollisions() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        
        if (player.x < powerUp.x + powerUp.width &&
            player.x + player.width > powerUp.x &&
            player.y < powerUp.y + powerUp.height &&
            player.y + player.height > powerUp.y) {
            
            // Debug log power-up collection
            console.log(`Collecting power-up: ${powerUp.type} at progress ${(playerProgress * 100).toFixed(1)}%`);
            
            // Collect power-up
            activatePowerUp(powerUp.type);
            powerUps.splice(i, 1);
        }
    }
}

// Check bullet collisions with obstacles
function checkBulletCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = obstacles.length - 1; j >= 0; j--) {
            const obstacle = obstacles[j];
            
            if (bullet.x < obstacle.x + obstacle.width &&
                bullet.x + bullet.width > obstacle.x &&
                bullet.y < obstacle.y + obstacle.height &&
                bullet.y + bullet.height > obstacle.y) {
                
                // Bullet hit obstacle - remove both
                bullets.splice(i, 1);
                obstacles.splice(j, 1);
                score += 50; // Bonus points for destroying obstacle
                break;
            }
        }
    }
}

// Check finish line collision
function checkFinishLineCollision() {
    if (raceFinished || !gameInitialized) return;
    
    // Debug: Log when approaching finish line
    if (playerProgress >= 0.95 && Math.floor(Date.now() / 1000) % 2 === 0) {
        console.log(`Approaching finish: ${(playerProgress * 100).toFixed(2)}% progress`);
    }
    
    // Use playerProgress instead of score for more accurate finish line detection
    // Only finish when player has truly reached 100% progress
    if (playerProgress >= 1.0) {
        console.log(`RACE COMPLETED at ${(playerProgress * 100).toFixed(2)}% progress`);
        raceFinished = true;
        completeRace();
    }
}

// Complete the race
function completeRace() {
    gameRunning = false;
    hideTrackingBar();
    
    // Calculate race time
    const raceEndTime = Date.now();
    const raceTimeSeconds = Math.round((raceEndTime - raceStartTime) / 1000);
    
    // Show completion overlay
    showGameFinishedOverlay(raceTimeSeconds);
}

// Show game finished overlay
function showGameFinishedOverlay(raceTime) {
    const overlay = document.getElementById('gameFinishedOverlay');
    
    // Populate completion stats
    document.getElementById('finishedPlayerName').textContent = playerName;
    document.getElementById('finishedRaceDistance').textContent = raceDistance;
    document.getElementById('finishedScore').textContent = Math.floor(score / 10);
    document.getElementById('raceTime').textContent = raceTime;
    
    // Show overlay
    overlay.classList.remove('hidden');
}

// Return to player setup (race selection)
function returnToRaceSelection() {
    // Hide game finished overlay
    document.getElementById('gameFinishedOverlay').classList.add('hidden');
    
    // Hide game container and tracking bar
    document.querySelector('.game-container').classList.add('hidden');
    hideTrackingBar();
    
    // Reset game state
    gameInitialized = false;
    raceFinished = false;
    gameFlowState = 'playerSetup';
    
    // Reset tracking system
    playerProgress = 0;
    currentSegment = 1;
    isRespawning = false;
    gamePaused = false;
    justRespawned = false;
    
    // Clear player name field and show setup panel
    document.getElementById('playerName').value = '';
    document.getElementById('playerSetupPanel').classList.remove('hidden');
    
    // Focus on player name input
    setTimeout(() => {
        document.getElementById('playerName').focus();
    }, 300);
}

// Restart same race
function restartSameRace() {
    // Hide game finished overlay
    document.getElementById('gameFinishedOverlay').classList.add('hidden');
    
    // Reset race state
    raceFinished = false;
    raceStartTime = Date.now();
    
    // Restart the game
    enhancedInit();
}

// === LIVE TRACKING SYSTEM ===

// Update player progress on tracking bar
function updatePlayerProgress() {
    if (!gameInitialized || !gameRunning) return;
    
    // Skip progress calculation if we just respawned (let respawn position settle)
    if (justRespawned) {
        justRespawned = false;
        return;
    }
    
    // Calculate player progress based on actual distance traveled, not speed-affected score
    const calculatedProgress = Math.min(actualDistanceTraveled / finishLineX, 1);
    
    // Always update progress (removed the forward-only restriction for now to debug)
    playerProgress = calculatedProgress;
    
    // Update current segment (1-4)
    if (playerProgress < 0.25) currentSegment = 1;
    else if (playerProgress < 0.5) currentSegment = 2;
    else if (playerProgress < 0.75) currentSegment = 3;
    else currentSegment = 4;
    
    // Update tracking bar visuals
    updateTrackingBarDisplay();
}

// Update tracking bar visual elements
function updateTrackingBarDisplay() {
    const progressBar = document.getElementById('trackingProgress');
    const playerMarker = document.getElementById('playerMarker');
    
    if (progressBar && playerMarker) {
        // Update progress bar width
        progressBar.style.width = `${playerProgress * 100}%`;
        
        // Update player marker position
        playerMarker.style.left = `${playerProgress * 100}%`;
    } else if (gameRunning && Math.floor(Date.now() / 5000) % 2 === 0) {
        // Debug log every 5 seconds if elements not found
        console.log('WARNING: Tracking bar elements not found for update');
    }
}

// Show tracking bar when game starts
function showTrackingBar() {
    console.log(`Showing tracking bar for ${raceDistance}m race, player: ${playerName}`);
    const trackingBar = document.getElementById('raceTrackingBar');
    const playerMarkerName = document.getElementById('playerMarkerName');
    
    if (trackingBar && playerMarkerName) {
        trackingBar.classList.remove('hidden');
        playerMarkerName.textContent = playerName;
        console.log('Tracking bar shown successfully');
    } else {
        console.log('ERROR: Tracking bar elements not found');
    }
}

// Hide tracking bar
function hideTrackingBar() {
    const trackingBar = document.getElementById('raceTrackingBar');
    if (trackingBar) {
        trackingBar.classList.add('hidden');
    }
}

// === SEGMENT-BASED RESPAWN SYSTEM ===

// Trigger respawn sequence
function triggerRespawn() {
    if (isRespawning) return; // Prevent multiple triggers
    
    // Debug log respawn trigger
    console.log(`RESPAWN TRIGGERED at progress ${(playerProgress * 100).toFixed(1)}%, segment ${currentSegment}`);
    
    isRespawning = true;
    gamePaused = true;
    respawnCountdown = 3;
    
    // Show respawn countdown
    showRespawnCountdown();
    
    // Start countdown timer
    startRespawnCountdown();
}

// Show respawn countdown overlay
function showRespawnCountdown() {
    const overlay = document.getElementById('respawnCountdown');
    const countdownNumber = document.getElementById('countdownNumber');
    
    if (overlay && countdownNumber) {
        overlay.classList.remove('hidden');
        countdownNumber.textContent = respawnCountdown;
    }
}

// Hide respawn countdown overlay
function hideRespawnCountdown() {
    const overlay = document.getElementById('respawnCountdown');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Start respawn countdown timer
function startRespawnCountdown() {
    const countdownInterval = setInterval(() => {
        respawnCountdown--;
        const countdownNumber = document.getElementById('countdownNumber');
        
        if (countdownNumber) {
            countdownNumber.textContent = respawnCountdown;
            // Trigger pulse animation
            countdownNumber.style.animation = 'none';
            setTimeout(() => {
                countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
            }, 10);
        }
        
        if (respawnCountdown <= 0) {
            clearInterval(countdownInterval);
            executeRespawn();
        }
    }, 1000);
}

// Execute respawn at segment start
function executeRespawn() {
    // Calculate respawn position based on current segment
    const segmentStartProgress = getSegmentStartProgress(currentSegment);
    
    // Set actual distance traveled to match segment start
    actualDistanceTraveled = segmentStartProgress * finishLineX;
    
    // Update score to match the distance (for display purposes)
    score = Math.round(actualDistanceTraveled / 4); // Divide by base speed
    scoreElement.textContent = Math.floor(score / 10);
    
    // Force update player progress to exact segment start
    playerProgress = segmentStartProgress;
    
    // Update current segment based on progress
    if (playerProgress < 0.25) currentSegment = 1;
    else if (playerProgress < 0.5) currentSegment = 2;
    else if (playerProgress < 0.75) currentSegment = 3;
    else currentSegment = 4;
    
    // Update tracking bar display
    updateTrackingBarDisplay();
    
    // Reset player position
    player.x = 100;
    player.y = groundY - player.height;
    player.velY = 0;
    player.jumping = false;
    player.grounded = true;
    
    // Clear obstacles near respawn point to prevent immediate collision
    clearObstaclesNearPlayer();
    
    // Resume game
    hideRespawnCountdown();
    isRespawning = false;
    gamePaused = false;
    respawnCountdown = 3;
    justRespawned = true; // Prevent immediate progress overwrite
}

// Get segment start progress (0-1)
function getSegmentStartProgress(segment) {
    switch (segment) {
        case 1: return 0;      // Start of race
        case 2: return 0.25;   // 25% mark
        case 3: return 0.5;    // 50% mark
        case 4: return 0.75;   // 75% mark
        default: return 0;
    }
}

// Clear obstacles near player respawn point
function clearObstaclesNearPlayer() {
    const clearRadius = 200; // Clear obstacles within 200 pixels of player
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        const distanceToPlayer = Math.abs(obstacle.x - player.x);
        
        if (distanceToPlayer < clearRadius) {
            obstacles.splice(i, 1);
        }
    }
}

// Shoot bullet with rate limiting
function shoot() {
    const currentTime = Date.now();
    
    // Check if enough time has passed since last shot
    if (currentTime - lastShotTime < shotCooldown) {
        return; // Still in cooldown, can't shoot
    }
    
    if (activePowerUp.type === 'gun' || (activePowerUp.type === 'car' && carMode === 'shoot')) {
        const bullet = {
            x: player.x + player.width,
            y: player.y + player.height / 2 - 2,
            width: 8,
            height: 4,
            speed: 10, // Slightly faster bullets
            color: '#FFFF00',
            trail: [] // For bullet trail effect
        };
        
        bullets.push(bullet);
        lastShotTime = currentTime; // Update last shot time
        shootingAnimation = 10; // Start muzzle flash animation (10 frames)
        
        // Simple shooting sound effect (if browser supports it)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, audioContext.currentTime + 0.15);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
        } catch (e) {
            // Audio not supported, continue silently
            console.log('Audio not supported');
        }
    }
}

// Check collisions between player and obstacles
function checkCollisions() {
    // Skip collision detection during respawn
    if (isRespawning || gamePaused) return;
    
    // Skip collision detection if player is underwater (diver power-up)
    if (isUnderwater) return;
    
    for (let obstacle of obstacles) {
        if (player.x < obstacle.x + obstacle.width &&
            player.x + player.width > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y) {
            
            // Trigger respawn system instead of game over
            triggerRespawn();
            return;
        }
    }
}

// Handle game over
function gameOver() {
    gameRunning = false;
    gameOverElement.style.display = 'block';
    instructionsElement.style.display = 'none';
    hideTrackingBar();
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    drawGround();
    
    // Draw player
    drawPlayer();
    
    // Draw obstacles
    drawObstacles();
    
    // Draw power-ups
    drawPowerUps();
    
    // Draw bullets
    drawBullets();
    
    // Draw clouds (background decoration)
    drawClouds();
    
    // Draw finish line (if game is initialized)
    if (gameInitialized) {
        drawFinishLine();
    }
    
    // Draw power-up effects
    drawPowerUpEffects();
    
    // Debug: Always show progress info on screen (right side)
    if (gameInitialized && gameRunning) {
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Debug - Progress: ${(playerProgress * 100).toFixed(1)}%`, canvas.width - 10, 30);
        ctx.fillText(`Debug - FinishLineX: ${finishLineX} (${isMultiplayer ? 'Multi' : 'Single'})`, canvas.width - 10, 50);
        ctx.fillText(`Debug - ActualDistance: ${actualDistanceTraveled.toFixed(0)}`, canvas.width - 10, 70);
        ctx.fillText(`Debug - GameSpeed: ${gameSpeed.toFixed(1)}`, canvas.width - 10, 90);
        ctx.fillText(`Debug - Player: ${player.x.toFixed(0)}, ${player.y.toFixed(0)}`, canvas.width - 10, 110);
        ctx.fillText(`Debug - Mode: ${gameMode}`, canvas.width - 10, 130);
        
        // Show finish line visibility status
        const finishVisible = playerProgress >= 0.95;
        ctx.fillStyle = finishVisible ? '#00FF00' : '#FF0000';
        ctx.fillText(`Finish Line: ${finishVisible ? 'VISIBLE' : 'HIDDEN'}`, canvas.width - 10, 150);
        ctx.textAlign = 'left'; // Reset alignment
    }
}

// Draw the ground/seafloor
function drawGround() {
    if (gameMode === 'underwater') {
        // Underwater river environment
        ctx.fillStyle = '#1E90FF'; // Deep water blue background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create curved river bed with flowing pattern
        drawCurvedRiverBed();
        
        // Add water effects/bubbles
        drawWaterEffects();
    } else {
        // Land mode ground
        ctx.fillStyle = '#90EE90';
        ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
        
        // Ground line
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(canvas.width, groundY);
        ctx.stroke();
    }
}

// Draw curved river bed with flowing structure
function drawCurvedRiverBed() {
    const time = Date.now() / 1000;
    const waveAmplitude = 20;
    const waveFrequency = 0.01;
    
    // Create gradient from water to riverbed
    const gradient = ctx.createLinearGradient(0, groundY - 30, 0, canvas.height);
    gradient.addColorStop(0, '#4682B4'); // Steel blue (deeper water)
    gradient.addColorStop(0.3, '#5F9EA0'); // Cadet blue
    gradient.addColorStop(0.7, '#8FBC8F'); // Dark sea green
    gradient.addColorStop(1, '#F4A460'); // Sandy brown (riverbed)
    
    // Draw curved river bed using bezier curves
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    
    // Create flowing wave pattern for river bed
    for (let x = 0; x <= canvas.width; x += 10) {
        const waveOffset = Math.sin((x * waveFrequency) + (time * 2)) * waveAmplitude;
        const currentGroundY = groundY + waveOffset;
        ctx.lineTo(x, currentGroundY);
    }
    
    // Complete the riverbed shape
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();
    
    // Add river bed details
    drawRiverBedDetails();
    
    // Draw flowing water surface line
    ctx.strokeStyle = '#00CED1'; // Dark turquoise
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    
    for (let x = 0; x <= canvas.width; x += 5) {
        const waveOffset = Math.sin((x * waveFrequency) + (time * 2)) * waveAmplitude;
        const surfaceWave = Math.sin((x * 0.02) + (time * 3)) * 5; // Surface ripples
        const currentY = groundY + waveOffset + surfaceWave;
        ctx.lineTo(x, currentY);
    }
    ctx.stroke();
}

// Draw river bed details like rocks and sand patterns
function drawRiverBedDetails() {
    const time = Date.now() / 2000;
    
    // Draw moving sand ripples
    ctx.strokeStyle = '#DEB887'; // Burlywood
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    
    for (let i = 0; i < 8; i++) {
        const x = (i * 100 + time * 30) % (canvas.width + 100);
        const baseY = groundY + 30;
        
        ctx.beginPath();
        for (let offset = 0; offset < 80; offset += 5) {
            const rippleY = baseY + Math.sin((offset * 0.1) + time) * 3;
            if (offset === 0) {
                ctx.moveTo(x + offset, rippleY);
            } else {
                ctx.lineTo(x + offset, rippleY);
            }
        }
        ctx.stroke();
    }
    
    // Draw scattered river rocks
    ctx.fillStyle = '#696969'; // Dim gray
    for (let i = 0; i < 6; i++) {
        const rockX = (i * 130 + time * 10) % (canvas.width + 50);
        const rockY = groundY + 25 + Math.sin(time + i) * 8;
        const rockSize = Math.max(2, 4 + Math.sin(time * 2 + i) * 2); // Ensure positive size
        
        ctx.beginPath();
        ctx.ellipse(rockX, rockY, rockSize, rockSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.globalAlpha = 1; // Reset transparency
}

// Draw water effects for underwater mode
function drawWaterEffects() {
    const time = Date.now() / 1000;
    
    // Floating bubbles with varying sizes and speeds
    for (let i = 0; i < 8; i++) {
        const x = (i * 100 + time * (15 + i * 3)) % (canvas.width + 80);
        const y = 30 + Math.sin(time * 1.5 + i) * 40;
        const size = Math.max(1, 2 + Math.sin(time * 2 + i) * 2); // Ensure positive radius
        const alpha = Math.max(0.1, 0.4 + Math.sin(time * 3 + i) * 0.3);
        
        ctx.fillStyle = `rgba(173, 216, 230, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add smaller bubble trails
        if (size > 2) {
            const trailSize = Math.max(0.5, size * 0.4); // Ensure positive radius
            ctx.fillStyle = `rgba(200, 230, 250, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(x - 8, y + 5, trailSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Water current lines (flowing effect)
    ctx.strokeStyle = 'rgba(135, 206, 235, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const yPos = 60 + i * 40;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 15) {
            const waveY = yPos + Math.sin((x * 0.02) + (time * 4) + i) * 8;
            const currentX = x + Math.sin(time * 2 + i) * 20;
            if (x === 0) {
                ctx.moveTo(currentX, waveY);
            } else {
                ctx.lineTo(currentX, waveY);
            }
        }
        ctx.stroke();
    }
}

// Draw the player
function drawPlayer() {
    // Debug: Log player drawing
    if (Math.floor(Date.now() / 2000) % 2 === 0) {
        console.log(`Drawing player at ${player.x}, ${player.y} in ${gameMode} mode`);
    }
    
    // Draw player based on active power-up and game mode
    if (activePowerUp.type === 'car' && gameMode === 'land') {
        drawPlayerInCar();
    } else if (activePowerUp.type === 'boat' && gameMode === 'underwater') {
        drawPlayerInBoat();
    } else {
        drawNormalPlayer();
    }
    
    // Draw gun if gun power-up is active
    if (activePowerUp.type === 'gun') {
        drawGun();
    }
    
    // Draw super jump/diving effect
    if (activePowerUp.type === 'jumper' && gameMode === 'land') {
        drawSuperJumpEffect();
    } else if (activePowerUp.type === 'diver' && gameMode === 'underwater') {
        drawDivingEffect();
    }
}

// Draw normal player
function drawNormalPlayer() {
    ctx.save();
    
    // Debug: Add a bright outline to make player visible
    if (gameMode === 'underwater') {
        ctx.strokeStyle = '#FFFF00'; // Bright yellow outline for debugging
        ctx.lineWidth = 2;
        ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
    }
    
    // Rotate player for swimming in underwater mode
    if (gameMode === 'underwater') {
        // Translate to player center, rotate, then translate back
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        ctx.rotate(-Math.PI / 3); // Rotate -60 degrees for dramatic swimming pose
        ctx.translate(-player.width/2, -player.height/2);
        
        // Try to draw the image first
        if (player.image.complete && player.image.naturalHeight !== 0) {
            ctx.drawImage(player.image, 0, 0, player.width, player.height);
        } else {
            // Fallback: draw swimming stick figure - make it more visible
            ctx.fillStyle = '#FFFF00'; // Bright yellow for visibility
            ctx.fillRect(0, 0, player.width, player.height);
            
            // Swimming features (arms extended)
            ctx.fillStyle = '#FF6600'; // Orange arms
            ctx.fillRect(-5, player.height * 0.3, player.width + 10, 6); // Extended arms
            
            // Add face for visibility
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(5, 5, 8, 8); // Left eye
            ctx.fillRect(25, 5, 8, 8); // Right eye
        }
    } else {
        // Land mode - normal upright position
        if (player.image.complete && player.image.naturalHeight !== 0) {
            ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        } else {
            // Fallback: draw a rectangle with simple character design
            ctx.fillStyle = '#FF6B6B';
            ctx.fillRect(player.x, player.y, player.width, player.height);
            
            // Add simple face
            ctx.fillStyle = 'white';
            ctx.fillRect(player.x + 8, player.y + 8, 6, 6); // Left eye
            ctx.fillRect(player.x + 26, player.y + 8, 6, 6); // Right eye
            
            ctx.fillStyle = 'black';
            ctx.fillRect(player.x + 10, player.y + 10, 2, 2); // Left pupil
            ctx.fillRect(player.x + 28, player.y + 10, 2, 2); // Right pupil
            
            // Simple mouth
            ctx.fillStyle = 'black';
            ctx.fillRect(player.x + 15, player.y + 25, 10, 2);
        }
    }
    
    ctx.restore();
}

// Draw player in car
function drawPlayerInCar() {
    // Try to draw car image first
    if (powerUpImages.car.complete && powerUpImages.car.naturalHeight !== 0) {
        ctx.drawImage(powerUpImages.car, player.x - 10, player.y + 10, player.width + 20, player.height + 10);
    } else {
        // Fallback: draw car as rectangle
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(player.x - 10, player.y + 10, player.width + 20, player.height + 10);
        
        // Car windows
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(player.x - 5, player.y + 15, player.width + 10, player.height / 2);
        
        // Wheels
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(player.x, player.y + player.height + 17, 6, 0, Math.PI * 2);
        ctx.arc(player.x + player.width, player.y + player.height + 17, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player on top of car (positioned above the car body)
    ctx.save();
    ctx.translate(0, -8); // Move player up by 8 pixels to sit on top of car
    drawNormalPlayer();
    ctx.restore();
}

// Draw player in boat (underwater mode equivalent of car)
function drawPlayerInBoat() {
    // Try to draw boat image first
    if (powerUpImages.boat.complete && powerUpImages.boat.naturalHeight !== 0) {
        ctx.drawImage(powerUpImages.boat, player.x - 10, player.y + 5, player.width + 20, player.height + 15);
    } else {
        // Fallback: draw boat as shape
        ctx.fillStyle = '#8B4513'; // Brown boat color
        ctx.fillRect(player.x - 10, player.y + 15, player.width + 20, player.height);
        
        // Boat bottom (curved)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(player.x + player.width/2, player.y + player.height + 15, player.width/2 + 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Mast
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(player.x + player.width/2 - 2, player.y - 10, 4, 25);
    }
    
    // Draw player on boat (positioned above the boat)
    ctx.save();
    ctx.translate(0, -5); // Move player up by 5 pixels to sit on boat
    drawNormalPlayer();
    ctx.restore();
}

// Draw gun in player's hands
function drawGun() {
    // Try to draw gun image first
    if (powerUpImages.gun.complete && powerUpImages.gun.naturalHeight !== 0) {
        ctx.drawImage(powerUpImages.gun, player.x + player.width - 5, player.y + player.height / 2 - 5, 15, 10);
    } else {
        // Fallback: draw gun as rectangle
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(player.x + player.width - 5, player.y + player.height / 2 - 2, 12, 4);
        ctx.fillRect(player.x + player.width + 5, player.y + player.height / 2 - 1, 3, 2);
    }
    
    // Draw muzzle flash when shooting
    if (shootingAnimation > 0) {
        const flashSize = shootingAnimation * 2;
        const gunTipX = player.x + player.width + 8;
        const gunTipY = player.y + player.height / 2;
        
        // Muzzle flash effect
        ctx.fillStyle = `rgba(255, 255, 255, ${shootingAnimation / 10})`;
        ctx.beginPath();
        ctx.arc(gunTipX, gunTipY, flashSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255, 200, 0, ${shootingAnimation / 10})`;
        ctx.beginPath();
        ctx.arc(gunTipX, gunTipY, flashSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // Spark effects
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${shootingAnimation / 15})`;
            const sparkX = gunTipX + Math.random() * 6 - 3;
            const sparkY = gunTipY + Math.random() * 6 - 3;
            ctx.fillRect(sparkX, sparkY, 1, 1);
        }
    }
}

// Draw super jump effect
function drawSuperJumpEffect() {
    const time = Date.now() / 100;
    const glowSize = 5 + Math.sin(time) * 3;
    
    // Glowing effect around player
    ctx.shadowColor = '#00FF00';
    ctx.shadowBlur = glowSize;
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
    
    // Reset shadow
    ctx.shadowBlur = 0;
}

// Draw diving effect for underwater mode
function drawDivingEffect() {
    const time = Date.now() / 150;
    const waveSize = 3 + Math.sin(time) * 2;
    
    // Underwater bubble effect around player
    ctx.shadowColor = '#00BFFF';
    ctx.shadowBlur = waveSize;
    
    // Draw water ripples/bubbles
    for (let i = 0; i < 3; i++) {
        const offset = i * 15;
        const bubbleX = player.x + player.width/2 + Math.sin(time + offset) * 10;
        const bubbleY = player.y - offset - 10;
        
        ctx.fillStyle = `rgba(0, 191, 255, ${0.5 - i * 0.15})`;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, 3 + i, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Underwater glow around player
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
    
    // Reset shadow
    ctx.shadowBlur = 0;
}

// Draw obstacles
function drawObstacles() {
    for (let obstacle of obstacles) {
        // Draw cactus-like obstacle
        ctx.fillStyle = obstacle.color;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Add spikes to make it look more like a cactus
        ctx.fillStyle = '#654321';
        for (let i = 0; i < 3; i++) {
            const spikeY = obstacle.y + (i * 8) + 5;
            ctx.fillRect(obstacle.x - 3, spikeY, 6, 2);
            ctx.fillRect(obstacle.x + obstacle.width - 3, spikeY, 6, 2);
        }
    }
}

// Draw background clouds
function drawClouds() {
    const cloudOffset = (score / 5) % 100;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    // Draw simple clouds
    drawCloud(150 - cloudOffset, 50);
    drawCloud(400 - cloudOffset, 30);
    drawCloud(650 - cloudOffset, 60);
    drawCloud(850 - cloudOffset, 40);
}

// Draw individual cloud
function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 25, y, 25, 0, Math.PI * 2);
    ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 25, y - 15, 15, 0, Math.PI * 2);
    ctx.fill();
}

// Handle player jump
function jump() {
    if (player.grounded && !player.jumping) {
        // Use super jump if jumper power-up is active
        const currentJumpPower = activePowerUp.type === 'jumper' ? superJumpPower : jumpPower;
        player.velY = currentJumpPower;
        player.jumping = true;
        player.grounded = false;
    }
}

// Draw power-ups
function drawPowerUps() {
    for (let powerUp of powerUps) {
        // Try to draw power-up image first
        const img = powerUpImages[powerUp.type];
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        } else {
            // Fallback: draw colored rectangle
            ctx.fillStyle = powerUp.color;
            ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
            
            // Add icon text
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            const iconText = powerUp.type === 'gun' ? 'G' : powerUp.type === 'car' ? 'C' : 'J';
            ctx.fillText(iconText, powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2 + 4);
        }
        
        // Add glow effect
        ctx.strokeStyle = powerUp.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(powerUp.x - 1, powerUp.y - 1, powerUp.width + 2, powerUp.height + 2);
    }
}

// Draw bullets
function drawBullets() {
    for (let bullet of bullets) {
        // Draw bullet trail first
        for (let i = 0; i < bullet.trail.length; i++) {
            const trailPos = bullet.trail[i];
            const alpha = (i + 1) / bullet.trail.length * 0.3; // Fade trail
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.fillRect(trailPos.x - 2, trailPos.y + 1, bullet.width - 2, bullet.height - 2);
        }
        
        // Try to draw bullet image first
        if (powerUpImages.bullet.complete && powerUpImages.bullet.naturalHeight !== 0) {
            ctx.drawImage(powerUpImages.bullet, bullet.x, bullet.y, bullet.width, bullet.height);
        } else {
            // Fallback: enhanced bullet rectangle
            ctx.fillStyle = bullet.color;
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            
            // Add bullet tip
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(bullet.x + bullet.width - 2, bullet.y + 1, 2, bullet.height - 2);
        }
        
        // Add glow effect around bullet
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 3;
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.shadowBlur = 0; // Reset shadow
    }
}

// Draw power-up effects and UI
function drawPowerUpEffects() {
    if (activePowerUp.type) {
        // Enhanced UI box in top-left corner
        const uiWidth = 200;
        const uiHeight = 60;
        const padding = 10;
        
        // Main UI background with rounded corners effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(padding, padding, uiWidth, uiHeight);
        
        // Power-up type specific border color
        let borderColor = '#FFD700';
        switch (activePowerUp.type) {
            case 'gun': borderColor = '#FFD700'; break;
            case 'car': borderColor = '#FF4500'; break;
            case 'jumper': borderColor = '#00FF00'; break;
        }
        
        // Colored border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, padding, uiWidth, uiHeight);
        
        // Power-up icon area
        const iconSize = 24;
        const iconX = padding + 8;
        const iconY = padding + 8;
        
        // Draw power-up icon
        ctx.fillStyle = borderColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        const iconText = activePowerUp.type === 'gun' ? '🔫' : 
                        activePowerUp.type === 'car' ? '🚗' : '⬆️';
        ctx.fillText(iconText, iconX + iconSize/2, iconY + 18);
        
        // Power-up name and info
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        
        let powerUpName = '';
        let powerUpInfo = '';
        
        switch (activePowerUp.type) {
            case 'gun':
                powerUpName = 'GUN';
                const cooldown = Math.max(0, shotCooldown - (Date.now() - lastShotTime));
                powerUpInfo = cooldown > 0 ? `Cooldown: ${(cooldown / 1000).toFixed(1)}s` : 'SPACE to shoot';
                break;
            case 'car':
                powerUpName = 'CAR';
                powerUpInfo = `Mode: ${carMode.toUpperCase()} (E to switch)`;
                break;
            case 'jumper':
                powerUpName = 'SUPER JUMP';
                powerUpInfo = 'SPACE for super jump';
                break;
        }
        
        ctx.fillText(powerUpName, iconX + iconSize + 8, iconY + 12);
        
        ctx.font = '10px Arial';
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(powerUpInfo, iconX + iconSize + 8, iconY + 24);
        
        // Timer bar
        const barWidth = uiWidth - 20;
        const barHeight = 6;
        const barX = padding + 10;
        const barY = padding + uiHeight - 15;
        
        // Timer bar background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Timer bar fill
        const timePercentage = activePowerUp.timeLeft / activePowerUp.maxTime;
        const fillWidth = barWidth * timePercentage;
        
        // Color based on time remaining
        let barColor = borderColor;
        if (timePercentage < 0.3) {
            barColor = '#FF4444'; // Red when low
            // Add pulsing effect when time is critical
            const pulseAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 100);
            ctx.fillStyle = `rgba(255, 68, 68, ${pulseAlpha * 0.3})`;
            ctx.fillRect(padding, padding, uiWidth, uiHeight);
        } else if (timePercentage < 0.6) {
            barColor = '#FFAA00'; // Orange when medium
        }
        
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, fillWidth, barHeight);
        
        // Timer text
        const timeLeftSec = Math.ceil(activePowerUp.timeLeft / 60);
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${timeLeftSec}s`, padding + uiWidth - 10, barY + 4);
        
        // Reset text alignment
        ctx.textAlign = 'left';
    }
}

// Event listeners for controls
document.addEventListener('keydown', function(event) {
    switch(event.code) {
        case 'Space':
            event.preventDefault();
            if (gameRunning) {
                // Check if we should shoot or jump
                if (activePowerUp.type === 'gun') {
                    shoot();
                } else if (activePowerUp.type === 'car' && carMode === 'shoot') {
                    shoot();
                } else if (activePowerUp.type === 'car' && carMode === 'jump') {
                    jump();
                } else {
                    jump();
                }
            }
            break;
        case 'Enter':
            event.preventDefault();
            if (!gameRunning && gameInitialized) {
                enhancedInit();
            }
            break;
        case 'KeyE':
            event.preventDefault();
            if (gameRunning && activePowerUp.type === 'car') {
                // Switch car mode
                carMode = carMode === 'jump' ? 'shoot' : 'jump';
            }
            break;
        case 'KeyJ':
            event.preventDefault();
            if (gameRunning && activePowerUp.type === 'car') {
                carMode = 'jump';
            }
            break;
        case 'KeyS':
            event.preventDefault();
            if (gameRunning && activePowerUp.type === 'car') {
                carMode = 'shoot';
            }
            break;
    }
});

// Mobile touch support
canvas.addEventListener('touchstart', function(event) {
    event.preventDefault();
    if (gameRunning) {
        // Handle touch based on active power-up
        if (activePowerUp.type === 'gun') {
            shoot();
        } else if (activePowerUp.type === 'car' && carMode === 'shoot') {
            shoot();
        } else {
            jump();
        }
    } else if (gameInitialized) {
        enhancedInit();
    }
});

// Prevent context menu on right click
canvas.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

// Pre-game flow functions
function initPreGameFlow() {
    // Hide game container initially
    document.querySelector('.game-container').classList.add('hidden');
    
    // Start with the starting message
    showStartMessage();
}

function showStartMessage() {
    gameFlowState = 'starting';
    const startOverlay = document.getElementById('startOverlay');
    startOverlay.classList.remove('hidden');
    
    // Fade out after 3 seconds
    setTimeout(() => {
        startOverlay.classList.add('hidden');
        setTimeout(() => {
            showGameModeSelection();
        }, 500); // Wait for fade transition
    }, 3000);
}

// Show Single Player vs Multiplayer selection
function showGameModeSelection() {
    gameFlowState = 'gameModeSelect';
    document.getElementById('gameModePanel').classList.remove('hidden');
}

function showPlayerSetupPanel() {
    gameFlowState = 'playerSetup';
    const playerSetupPanel = document.getElementById('playerSetupPanel');
    playerSetupPanel.classList.remove('hidden');
    
    // Focus on player name input
    setTimeout(() => {
        document.getElementById('playerName').focus();
    }, 300);
}

// Show multiplayer lobby selection (create or join)
function showMultiplayerLobbySelection() {
    gameFlowState = 'multiplayerLobby';
    document.getElementById('gameModePanel').classList.add('hidden');
    document.getElementById('lobbyModePanel').classList.remove('hidden');
}

// Show create lobby panel
function showCreateLobbyPanel() {
    document.getElementById('lobbyModePanel').classList.add('hidden');
    document.getElementById('createLobbyPanel').classList.remove('hidden');
    
    // Generate lobby code
    lobbyCode = generateLobbyCode();
    document.getElementById('generatedLobbyCode').textContent = lobbyCode;
    isHost = true;
    isMultiplayer = true;
}

// Show join lobby panel
function showJoinLobbyPanel() {
    document.getElementById('lobbyModePanel').classList.add('hidden');
    document.getElementById('joinLobbyPanel').classList.remove('hidden');
    isMultiplayer = true;
}

// Generate 9-digit lobby code
function generateLobbyCode() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function showModeSelectionPanel() {
    gameFlowState = 'modeSelection';
    const playerSetupPanel = document.getElementById('playerSetupPanel');
    const modeSelectionPanel = document.getElementById('modeSelectionPanel');
    
    playerSetupPanel.classList.add('hidden');
    setTimeout(() => {
        modeSelectionPanel.classList.remove('hidden');
    }, 300);
}

function showConstructionMessage() {
    const modeSelectionPanel = document.getElementById('modeSelectionPanel');
    const constructionOverlay = document.getElementById('constructionOverlay');
    
    modeSelectionPanel.classList.add('hidden');
    constructionOverlay.classList.remove('hidden');
    
    // Return to mode selection after 3 seconds
    setTimeout(() => {
        constructionOverlay.classList.add('hidden');
        setTimeout(() => {
            modeSelectionPanel.classList.remove('hidden');
        }, 500);
    }, 3000);
}

function startMainGame() {
    gameFlowState = 'ready';
    const modeSelectionPanel = document.getElementById('modeSelectionPanel');
    const gameContainer = document.querySelector('.game-container');
    
    modeSelectionPanel.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    // Update player info display
    document.getElementById('playerDisplay').textContent = `Player: ${playerName}`;
    document.getElementById('raceDisplay').textContent = `Race: ${raceDistance}m`;
    
    console.log(`Game setup complete: Player ${playerName}, Race ${raceDistance}m, FinishLineX: ${finishLineX}`);
    
    // Initialize the game
    gameInitialized = true;
    draw(); // Draw initial frame
    
    // Show initial instructions
    gameOverElement.style.display = 'none';
    instructionsElement.style.display = 'block';
    
    // Add event listeners for game start
    const startGameHandler = function(event) {
        if (event.code === 'Space' || event.code === 'Enter') {
            if (!gameRunning) {
                document.removeEventListener('keydown', startGameHandler);
                enhancedInit();
            }
        }
    };
    
    const startGameTouchHandler = function() {
        if (!gameRunning) {
            canvas.removeEventListener('touchstart', startGameTouchHandler);
            enhancedInit();
        }
    };
    
    document.addEventListener('keydown', startGameHandler);
    canvas.addEventListener('touchstart', startGameTouchHandler);
}

function calculateFinishLinePosition(distance) {
    // Calculate finish line X position based on race distance
    // Single Player: 500m = 5000px, 750m = 7500px, 1000m = 10000px
    // Multiplayer: 1000m = 10000px, 1500m = 15000px, 2000m = 20000px (10 pixels per meter)
    return distance * 10;
}

function drawFinishLine() {
    if (!gameInitialized) return;
    
    // Debug: Log progress periodically
    if (Math.floor(Date.now() / 1000) % 2 === 0 && playerProgress > 0.5) {
        console.log(`Progress: ${(playerProgress * 100).toFixed(1)}%, FinishLineX: ${finishLineX}`);
    }
    
    // Show finish line when player is very close to the end (95%+ progress)
    // This ensures players only see it when they're almost at the finish
    if (playerProgress < 0.95) return;
    
    // Debug: Log when finish line becomes visible
    if (Math.floor(Date.now() / 2000) % 2 === 0) {
        console.log(`FINISH LINE VISIBLE at ${(playerProgress * 100).toFixed(1)}% progress`);
    }
    
    // Draw finish line at the calculated position using actual distance
    const finishLineScreenX = finishLineX - actualDistanceTraveled; // Adjust for camera movement
    
    // Only draw if finish line is on or near screen
    if (finishLineScreenX > -50 && finishLineScreenX < canvas.width + 50) {
        // Try to draw finish line image first
        if (finishLineImage.complete && finishLineImage.naturalWidth > 0) {
            // Draw finish line image scaled to fit canvas height
            const imageWidth = 60; // Width for the finish line
            const imageHeight = canvas.height;
            ctx.drawImage(finishLineImage, finishLineScreenX - imageWidth/2, 0, imageWidth, imageHeight);
        } else {
            // Fallback: Draw finish line flag if image not loaded
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(finishLineScreenX, 0, 4, canvas.height);
            
            // Draw checkered pattern
            ctx.fillStyle = '#FFFFFF';
            for (let y = 0; y < canvas.height; y += 20) {
                for (let x = 0; x < 20; x += 10) {
                    if ((Math.floor(y / 10) + Math.floor(x / 10)) % 2 === 0) {
                        ctx.fillRect(finishLineScreenX + x - 10, y, 10, 10);
                    }
                }
            }
            
            // Draw "FINISH" text
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('FINISH', finishLineScreenX + 10, 30);
            ctx.textAlign = 'left'; // Reset alignment
        }
        
        // Add exciting finish line effects when very close
        if (playerProgress >= 0.98) {
            // Add flashing effect
            const flashAlpha = 0.3 + 0.3 * Math.sin(Date.now() / 100);
            ctx.fillStyle = `rgba(255, 215, 0, ${flashAlpha})`;
            ctx.fillRect(finishLineScreenX - 20, 0, 44, canvas.height);
            
            // Add "ALMOST THERE!" text
            if (playerProgress >= 0.99) {
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('ALMOST THERE!', canvas.width / 2, 50);
                ctx.textAlign = 'left';
            }
        }
        
        // Debug information (temporary) - right side
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Progress: ${(playerProgress * 100).toFixed(1)}%`, canvas.width - 10, canvas.height - 55);
        ctx.fillText(`Segment: ${currentSegment}`, canvas.width - 10, canvas.height - 40);
        ctx.fillText(`FinishX: ${finishLineScreenX.toFixed(0)}`, canvas.width - 10, canvas.height - 25);
        ctx.fillText(`ActualDist: ${actualDistanceTraveled.toFixed(0)}`, canvas.width - 10, canvas.height - 10);
    }
}

// Event listeners for pre-game flow
function setupPreGameEventListeners() {
    // Continue button from player setup
    document.getElementById('continueToModeBtn').addEventListener('click', function() {
        const nameInput = document.getElementById('playerName');
        const selectedRace = document.querySelector('input[name="raceType"]:checked');
        
        // Validate player name
        if (!nameInput.value.trim()) {
            alert('Please enter your name!');
            nameInput.focus();
            return;
        }
        
        // Store player data
        playerName = nameInput.value.trim();
        raceDistance = parseInt(selectedRace.value);
        finishLineX = calculateFinishLinePosition(raceDistance);
        
        showModeSelectionPanel();
    });
    
    // === GAME MODE SELECTION EVENT LISTENERS ===
    
    // Single Player button
    document.getElementById('singlePlayerBtn').addEventListener('click', function() {
        playMode = 'single';
        isMultiplayer = false;
        document.getElementById('gameModePanel').classList.add('hidden');
        showPlayerSetupPanel();
    });
    
    // Multiplayer button
    document.getElementById('multiPlayerBtn').addEventListener('click', function() {
        playMode = 'multiplayer';
        showMultiplayerLobbySelection();
    });
    
    // Create Lobby button
    document.getElementById('createLobbyBtn').addEventListener('click', function() {
        showCreateLobbyPanel();
    });
    
    // Join Lobby button
    document.getElementById('joinLobbyBtn').addEventListener('click', function() {
        showJoinLobbyPanel();
    });
    
    // Join Game button
    document.getElementById('joinGameBtn').addEventListener('click', function() {
        const nameInput = document.getElementById('playerNameJoin');
        const codeInput = document.getElementById('lobbyCode');
        
        if (!nameInput.value.trim()) {
            alert('Please enter your name!');
            nameInput.focus();
            return;
        }
        
        if (!codeInput.value.trim() || codeInput.value.length !== 9) {
            alert('Please enter a valid 9-digit lobby code!');
            codeInput.focus();
            return;
        }
        
        // Simulate joining lobby (in real implementation, this would connect to server)
        playerName = nameInput.value.trim();
        player.name = playerName;
        alert(`Joining lobby ${codeInput.value}... (Simulated - not connected to real server)`);
        
        // For demo purposes, proceed directly to mode selection
        document.getElementById('joinLobbyPanel').classList.add('hidden');
        showModeSelectionPanel();
    });
    
    // Start Multiplayer Game button
    document.getElementById('startMultiGameBtn').addEventListener('click', function() {
        const nameInput = document.getElementById('hostPlayerName');
        
        if (!nameInput.value.trim()) {
            alert('Please enter your name!');
            nameInput.focus();
            return;
        }
        
        // Set up host player
        playerName = nameInput.value.trim();
        player.name = playerName;
        player.id = 'host';
        
        // Get selected race distance
        const selectedRace = document.querySelector('input[name="multiRaceType"]:checked');
        raceDistance = parseInt(selectedRace.value);
        finishLineX = calculateFinishLinePosition(raceDistance);
        
        // Initialize multiplayer players array
        multiplayerPlayers = [{
            id: 'host',
            name: playerName,
            x: 100,
            y: 200,
            progress: 0,
            health: 100,
            color: '#FF6B6B',
            finishTime: null
        }];
        
        document.getElementById('createLobbyPanel').classList.add('hidden');
        showModeSelectionPanel();
    });
    
    // Back buttons
    document.getElementById('backToLobbyModeBtn').addEventListener('click', function() {
        document.getElementById('joinLobbyPanel').classList.add('hidden');
        showMultiplayerLobbySelection();
    });
    
    document.getElementById('backToLobbyModeBtn2').addEventListener('click', function() {
        document.getElementById('createLobbyPanel').classList.add('hidden');
        showMultiplayerLobbySelection();
    });

    // Land mode button
    document.getElementById('landModeBtn').addEventListener('click', function() {
        gameMode = 'land';
        startMainGame();
    });
    
    // Underwater mode button
    document.getElementById('underwaterModeBtn').addEventListener('click', function() {
        gameMode = 'underwater';
        startMainGame();
    });
    
    // Allow Enter key to submit player setup
    document.getElementById('playerName').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            document.getElementById('continueToModeBtn').click();
        }
    });
    
    // Game finished overlay buttons
    document.getElementById('playAgainBtn').addEventListener('click', function() {
        restartSameRace();
    });
    
    document.getElementById('newRaceBtn').addEventListener('click', function() {
        returnToRaceSelection();
    });
}


// Modified init function to work with pre-game flow
function enhancedInit() {
    if (!gameInitialized) return;
    
    console.log(`Initializing game: ${raceDistance}m race, finishLineX: ${finishLineX}`);
    gameRunning = true;
    score = 0;
    gameSpeed = 4;
    obstacles = [];
    obstacleTimer = 0;
    
    // Start race timing
    raceStartTime = Date.now();
    raceFinished = false;
    
    // Reset tracking and respawn systems
    playerProgress = 0;
    currentSegment = 1;
    actualDistanceTraveled = 0; // Reset actual distance tracker
    isRespawning = false;
    gamePaused = false;
    respawnCountdown = 3;
    justRespawned = false;
    
    // Reset underwater state
    isUnderwater = false;
    
    // Show tracking bar
    showTrackingBar();
    
    // Reset power-up system
    powerUps = [];
    bullets = [];
    powerUpTimer = 0;
    activePowerUp = {
        type: null,
        timeLeft: 0,
        maxTime: 600,
        originalSpeed: 4
    };
    carMode = 'jump';
    lastShotTime = 0;
    shootingAnimation = 0;
    
    // Reset player position
    player.x = 100;
    player.y = groundY - player.height;
    player.velY = 0;
    player.jumping = false;
    player.grounded = true;
    
    // Hide game over, show instructions
    gameOverElement.style.display = 'none';
    instructionsElement.style.display = 'block';
    
    // Start game loop
    gameLoop();
}

// Start the pre-game flow when page loads
window.addEventListener('load', function() {
    setupPreGameEventListeners();
    initPreGameFlow();
    
    // Initial game start event listeners will be set up after mode selection
});