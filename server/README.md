# 🎮 StickMan Runner - Server

Node.js + Socket.IO multiplayer server for real-time multiplayer racing.

## 🚀 Features

- **Real-time multiplayer**: 60 FPS game state synchronization
- **Lobby system**: 6-digit codes for easy room joining
- **PvP mechanics**: Bullet collision detection and player health
- **Synchronized game world**: Same obstacles and power-ups for all players
- **Host-controlled lobbies**: Only host can start races and control settings
- **Auto-cleanup**: Empty lobbies are automatically removed

## 📁 Server Architecture

### Core Components:
- **GameLobby class**: Manages individual game rooms
- **Player management**: Real-time position and health tracking  
- **Game object synchronization**: Obstacles, power-ups, bullets
- **Socket.IO events**: Real-time communication with clients

### Game State Management:
```javascript
// In-memory storage (resets on server restart)
const lobbies = new Map();    // All active game lobbies
const players = new Map();    // Player session data
```

## 🛠️ Setup

### Prerequisites
- Node.js (v14+)
- npm

### Installation
```bash
cd server
npm install
```

### Run Server
```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

Server will start on port 3000 (or PORT environment variable).

## 🌐 API Events

### Client → Server
- `createLobby`: Create new game lobby
- `joinLobby`: Join existing lobby by code
- `startRace`: Start race (host only)
- `playerUpdate`: Send player position/state
- `shoot`: Fire bullet

### Server → Client  
- `lobbyCreated`: Lobby creation success
- `lobbyJoined`: Successfully joined lobby
- `playerJoined`: New player joined lobby
- `raceStarted`: Race began
- `gameUpdate`: Real-time game state (60 FPS)

## 🎯 Game Loop

```javascript
// 60 FPS game updates
setInterval(() => {
    lobbies.forEach(lobby => {
        if (lobby.gameState === 'racing') {
            lobby.updateGameObjects();        // Update bullets, collisions
            lobby.generateSynchronizedGameObjects(); // Spawn obstacles/power-ups
            
            // Broadcast to all players in lobby
            io.to(lobby.code).emit('gameUpdate', {
                gameState: lobby.getGameState()
            });
        }
    });
}, 16); // ~60 FPS
```

## 🏗️ Scaling

- **Multiple lobbies**: Server handles concurrent game rooms
- **Memory efficient**: Auto-cleanup prevents memory leaks
- **Network optimized**: Only sends necessary game state changes
- **Collision detection**: Server-side authority prevents cheating

## 🔧 Configuration

```javascript
const GAME_CONFIG = {
    PLAYER_HEIGHT: 40,
    GROUND_Y: 240,
    FINISH_LINE_MULTIPLIER: 10, // pixels per meter
    PVP_DAMAGE: 50,             // 50% damage per shot
    RESPAWN_TIME: 2000,         // 2 second respawn
    UPDATE_INTERVAL: 16         // ~60 FPS
};
```

## 📊 Performance

- **Real-time**: 16ms update intervals (60 FPS)
- **Optimized**: Only broadcasts when game state changes
- **Scalable**: Handles multiple concurrent lobbies
- **Memory managed**: Auto-cleanup of old game objects