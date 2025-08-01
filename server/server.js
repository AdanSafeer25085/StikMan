const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Game state storage (in memory)
const lobbies = new Map();
const players = new Map();

// Game constants
const GAME_CONFIG = {
    PLAYER_HEIGHT: 40,
    GROUND_Y: 240,
    FINISH_LINE_MULTIPLIER: 10, // pixels per meter
    PVP_DAMAGE: 50,
    RESPAWN_TIME: 2000,
    UPDATE_INTERVAL: 16 // ~60 FPS
};

class GameLobby {
    constructor(code, hostId, hostName) {
        this.code = code;
        this.hostId = hostId;
        this.players = new Map();
        this.gameState = 'lobby'; // lobby, racing, finished
        this.raceDistance = 1000;
        this.gameMode = 'land';
        this.raceStartTime = null;
        this.obstacles = [];
        this.powerUps = [];
        this.bullets = [];
        this.playersFinished = 0;
        this.leaderboard = [];
        
        // Add host player
        this.addPlayer(hostId, hostName, true);
    }
    
    addPlayer(playerId, playerName, isHost = false) {
        const playerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFB347', '#98D8C8'];
        const colorIndex = this.players.size % playerColors.length;
        
        const player = {
            id: playerId,
            name: playerName,
            isHost: isHost,
            x: 100,
            y: GAME_CONFIG.GROUND_Y - GAME_CONFIG.PLAYER_HEIGHT,
            velY: 0,
            jumping: false,
            grounded: true,
            health: 100,
            maxHealth: 100,
            color: playerColors[colorIndex],
            progress: 0,
            score: 0,
            finishTime: null,
            activePowerUp: { type: null, timeLeft: 0 },
            lastUpdate: Date.now()
        };
        
        this.players.set(playerId, player);
        return player;
    }
    
    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.hostId === playerId && this.players.size > 0) {
            // Transfer host to another player
            const newHost = this.players.values().next().value;
            newHost.isHost = true;
            this.hostId = newHost.id;
        }
    }
    
    startRace(raceDistance, gameMode) {
        this.raceDistance = raceDistance;
        this.gameMode = gameMode;
        this.gameState = 'racing';
        this.raceStartTime = Date.now();
        this.playersFinished = 0;
        this.leaderboard = [];
        
        // Reset all players
        this.players.forEach(player => {
            player.x = 100;
            player.y = GAME_CONFIG.GROUND_Y - GAME_CONFIG.PLAYER_HEIGHT;
            player.health = 100;
            player.progress = 0;
            player.score = 0;
            player.finishTime = null;
            player.velY = 0;
            player.jumping = false;
            player.grounded = true;
        });
        
        // Clear game objects
        this.obstacles = [];
        this.powerUps = [];
        this.bullets = [];
    }
    
    updatePlayer(playerId, updateData) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // Update player state
        Object.assign(player, updateData);
        player.lastUpdate = Date.now();
        
        // Calculate progress using the same logic as single player
        const finishLineX = this.raceDistance * GAME_CONFIG.FINISH_LINE_MULTIPLIER;
        player.progress = Math.min(player.x / finishLineX, 1);
        
        // Store actual distance traveled for consistency with single player
        player.actualDistanceTraveled = player.x;
        
        // Calculate current segment (1-4) like single player
        if (player.progress < 0.25) player.currentSegment = 1;
        else if (player.progress < 0.5) player.currentSegment = 2;
        else if (player.progress < 0.75) player.currentSegment = 3;
        else player.currentSegment = 4;
        
        // Check if player finished
        if (player.progress >= 1.0 && !player.finishTime) {
            player.finishTime = Date.now();
            this.playersFinished++;
            this.updateLeaderboard();
            
            // Check if all players finished
            if (this.playersFinished >= this.players.size) {
                this.gameState = 'finished';
            }
        }
    }
    
    addBullet(playerId, bulletData) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        const bullet = {
            id: Date.now() + Math.random(),
            playerId: playerId,
            x: bulletData.x,
            y: bulletData.y,
            speed: bulletData.speed || 10,
            width: 8,
            height: 4,
            trail: []
        };
        
        this.bullets.push(bullet);
    }
    
    updateGameObjects() {
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.x += bullet.speed;
            
            // Add trail
            bullet.trail.push({x: bullet.x, y: bullet.y});
            if (bullet.trail.length > 3) {
                bullet.trail.shift();
            }
            
            // Remove bullets that are off screen
            if (bullet.x > 2000) { // Assuming max screen width
                this.bullets.splice(i, 1);
                continue;
            }
            
            // Check bullet collisions with players
            this.players.forEach(player => {
                if (player.id === bullet.playerId) return; // Don't hit yourself
                
                if (this.checkCollision(bullet, player)) {
                    // Hit! Deal damage
                    player.health -= GAME_CONFIG.PVP_DAMAGE;
                    this.bullets.splice(i, 1);
                    
                    if (player.health <= 0) {
                        this.handlePlayerKilled(player);
                    }
                }
            });
        }
        
        // Generate synchronized obstacles and power-ups for all players
        this.generateSynchronizedGameObjects();
    }
    
    generateSynchronizedGameObjects() {
        // Generate obstacles at fixed intervals that all players will encounter
        const currentTime = Date.now();
        if (!this.lastObstacleTime) {
            this.lastObstacleTime = currentTime;
        }
        
        // Spawn obstacles every 2 seconds
        if (currentTime - this.lastObstacleTime > 2000) {
            this.spawnSynchronizedObstacle();
            this.lastObstacleTime = currentTime;
        }
        
        // Generate power-ups less frequently
        if (!this.lastPowerUpTime) {
            this.lastPowerUpTime = currentTime;
        }
        
        if (currentTime - this.lastPowerUpTime > 5000) {
            this.spawnSynchronizedPowerUp();
            this.lastPowerUpTime = currentTime;
        }
    }
    
    spawnSynchronizedObstacle() {
        // Find the furthest player position to spawn obstacles ahead of everyone
        let maxPlayerX = 0;
        this.players.forEach(player => {
            if (player.x > maxPlayerX) {
                maxPlayerX = player.x;
            }
        });
        
        const obstacle = {
            id: Date.now(),
            x: maxPlayerX + 800 + Math.random() * 200, // Spawn ahead of players
            y: GAME_CONFIG.GROUND_Y - 30,
            width: 30,
            height: 30,
            type: Math.random() > 0.5 ? 'rock' : 'spike'
        };
        
        this.obstacles.push(obstacle);
        
        // Remove old obstacles that are far behind all players
        let minPlayerX = Infinity;
        this.players.forEach(player => {
            if (player.x < minPlayerX) {
                minPlayerX = player.x;
            }
        });
        
        this.obstacles = this.obstacles.filter(obs => obs.x > minPlayerX - 500);
    }
    
    spawnSynchronizedPowerUp() {
        // Similar to obstacles but for power-ups
        let maxPlayerX = 0;
        this.players.forEach(player => {
            if (player.x > maxPlayerX) {
                maxPlayerX = player.x;
            }
        });
        
        const powerUpTypes = ['gun', 'car', 'jumper', 'boat', 'diver'];
        const powerUp = {
            id: Date.now(),
            x: maxPlayerX + 600 + Math.random() * 300,
            y: GAME_CONFIG.GROUND_Y - 25,
            width: 25,
            height: 25,
            type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]
        };
        
        this.powerUps.push(powerUp);
        
        // Remove old power-ups
        let minPlayerX = Infinity;
        this.players.forEach(player => {
            if (player.x < minPlayerX) {
                minPlayerX = player.x;
            }
        });
        
        this.powerUps = this.powerUps.filter(pu => pu.x > minPlayerX - 500);
    }
    
    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + 40 &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + 40 &&
               obj1.y + obj1.height > obj2.y;
    }
    
    handlePlayerKilled(player) {
        player.health = 0;
        
        // Respawn after delay
        setTimeout(() => {
            player.health = 100;
            player.x = 100; // Reset to start or current segment
            player.y = GAME_CONFIG.GROUND_Y - GAME_CONFIG.PLAYER_HEIGHT;
        }, GAME_CONFIG.RESPAWN_TIME);
    }
    
    updateLeaderboard() {
        this.leaderboard = Array.from(this.players.values()).sort((a, b) => {
            if (a.finishTime && b.finishTime) {
                return a.finishTime - b.finishTime;
            } else if (a.finishTime && !b.finishTime) {
                return -1;
            } else if (!a.finishTime && b.finishTime) {
                return 1;
            } else {
                return b.progress - a.progress;
            }
        });
    }
    
    getGameState() {
        return {
            code: this.code,
            gameState: this.gameState,
            raceDistance: this.raceDistance,
            gameMode: this.gameMode,
            raceStartTime: this.raceStartTime,
            players: Array.from(this.players.values()),
            bullets: this.bullets,
            obstacles: this.obstacles,
            powerUps: this.powerUps,
            playersFinished: this.playersFinished,
            leaderboard: this.leaderboard
        };
    }
}

// Generate 6-digit lobby code
function generateLobbyCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create lobby
    socket.on('createLobby', (data) => {
        const code = generateLobbyCode();
        const lobby = new GameLobby(code, socket.id, data.playerName);
        lobbies.set(code, lobby);
        players.set(socket.id, { lobbyCode: code, playerId: socket.id });
        
        socket.join(code);
        socket.emit('lobbyCreated', {
            success: true,
            code: code,
            gameState: lobby.getGameState()
        });
        
        console.log(`Lobby created: ${code} by ${data.playerName}`);
    });
    
    // Join lobby
    socket.on('joinLobby', (data) => {
        console.log(`🔄 Join lobby request: Player "${data.playerName}" trying to join lobby "${data.code}"`);
        console.log(`📊 Available lobbies:`, Array.from(lobbies.keys()));
        const lobby = lobbies.get(data.code);
        
        if (!lobby) {
            console.log(`❌ Lobby "${data.code}" not found`);
            console.log(`🗂️ Total lobbies: ${lobbies.size}`);
            socket.emit('lobbyJoined', {
                success: false,
                error: 'Lobby not found'
            });
            return;
        }
        
        if (lobby.gameState !== 'lobby') {
            socket.emit('lobbyJoined', {
                success: false,
                error: 'Game already in progress'
            });
            return;
        }
        
        // Check if name is taken
        const nameExists = Array.from(lobby.players.values()).some(p => p.name === data.playerName);
        if (nameExists) {
            socket.emit('lobbyJoined', {
                success: false,
                error: 'Player name already taken'
            });
            return;
        }
        
        lobby.addPlayer(socket.id, data.playerName);
        players.set(socket.id, { lobbyCode: data.code, playerId: socket.id });
        
        socket.join(data.code);
        socket.emit('lobbyJoined', {
            success: true,
            gameState: lobby.getGameState()
        });
        
        // Notify all players in lobby
        io.to(data.code).emit('playerJoined', {
            gameState: lobby.getGameState()
        });
        
        console.log(`✅ ${data.playerName} successfully joined lobby: ${data.code}`);
    });
    
    // Start race (host only)
    socket.on('startRace', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyCode);
        if (!lobby || lobby.hostId !== socket.id) return;
        
        lobby.startRace(data.raceDistance, data.gameMode);
        
        io.to(playerData.lobbyCode).emit('raceStarted', {
            gameState: lobby.getGameState()
        });
        
        console.log(`Race started in lobby: ${playerData.lobbyCode}`);
    });
    
    // Player movement update
    socket.on('playerUpdate', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyCode);
        if (!lobby || lobby.gameState !== 'racing') return;
        
        lobby.updatePlayer(socket.id, data);
    });
    
    // Player shoots
    socket.on('shoot', (data) => {
        const playerData = players.get(socket.id);
        if (!playerData) return;
        
        const lobby = lobbies.get(playerData.lobbyCode);
        if (!lobby || lobby.gameState !== 'racing') return;
        
        lobby.addBullet(socket.id, data);
    });
    
    // Player disconnects
    socket.on('disconnect', () => {
        const playerData = players.get(socket.id);
        if (playerData) {
            const lobby = lobbies.get(playerData.lobbyCode);
            if (lobby) {
                lobby.removePlayer(socket.id);
                
                // Notify remaining players
                io.to(playerData.lobbyCode).emit('playerLeft', {
                    gameState: lobby.getGameState()
                });
                
                // Remove empty lobbies
                if (lobby.players.size === 0) {
                    lobbies.delete(playerData.lobbyCode);
                    console.log(`Lobby removed: ${playerData.lobbyCode}`);
                }
            }
            players.delete(socket.id);
        }
        
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// Game loop - broadcast updates to all lobbies
setInterval(() => {
    lobbies.forEach(lobby => {
        if (lobby.gameState === 'racing') {
            lobby.updateGameObjects();
            
            // Broadcast game state to all players in lobby
            io.to(lobby.code).emit('gameUpdate', {
                gameState: lobby.getGameState()
            });
        }
    });
}, GAME_CONFIG.UPDATE_INTERVAL);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 StickMan Runner Multiplayer Server running on port ${PORT}`);
    console.log(`📡 Server handling real-time multiplayer with Socket.IO`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down...');
    server.close(() => {
        console.log('Server closed');
    });
});