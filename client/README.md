# 🎮 StickMan Runner - Client

HTML5 Canvas client for real-time multiplayer racing game.

## 🚀 Features

- **Single & Multiplayer modes**: Play solo or with friends
- **Real-time multiplayer**: Socket.IO powered live racing
- **Two game modes**: Land running and underwater swimming
- **Power-up system**: Gun, Car, Jumper, Boat, Diver power-ups
- **PvP combat**: Shoot other players in multiplayer
- **Live tracking**: Progress bar showing all players' positions
- **Responsive design**: Works on desktop and mobile

## 📁 Client Architecture

### Core Files:
- **index.html**: Game UI and lobby system
- **script.js**: Main game logic and single player
- **multiplayer-client.js**: Socket.IO integration
- **style.css**: Game styling and animations
- **sprites/**: Game assets and images

### Game Modes:
- **Single Player**: Local racing with obstacles and power-ups
- **Multiplayer**: Real-time racing with up to 4 players

## 🎯 Game Controls

### Basic Controls:
- **Spacebar**: Jump / Shoot (with gun power-up)
- **Enter**: Restart game (single player)

### Car Power-up Controls:
- **E**: Switch between Jump/Shoot modes
- **J**: Jump mode (in car)
- **S**: Shoot mode (in car)

### Mobile:
- **Tap screen**: Jump/Shoot

## 🎮 How to Play

### Single Player:
1. Enter your name
2. Select race distance (500m, 750m, 1000m)
3. Choose Land or Underwater mode
4. Race to the finish!

### Multiplayer:
1. **Host**: Create Lobby → Get 6-digit code → Share with friends
2. **Players**: Join Lobby → Enter code → Wait for host to start
3. **Racing**: All players race on same map with PvP combat
4. **Finish**: Wait for all players → View leaderboard

## 🏁 Game Mechanics

### Single Player Features:
- **Collision system**: Hit obstacles = respawn at segment start
- **Power-up collection**: Walk over power-ups to activate
- **Progress tracking**: Live progress bar with segments
- **Finish line**: Appears at 95% progress

### Multiplayer Features:
- **Real-time synchronization**: All players see same game world
- **PvP shooting**: 50% damage per shot, 2-second respawn
- **Shared obstacles**: Same obstacles spawn for all players
- **Live leaderboard**: Track all players' progress in real-time

## 🎨 Visual Effects

### Power-up Effects:
- **Gun**: Muzzle flash, bullet trails
- **Car**: Speed boost glow, wheel animations  
- **Jumper**: Super jump with green glow effect
- **Boat**: Water splash effects (underwater mode)
- **Diver**: Underwater bubble trail

### Multiplayer Visuals:
- **Player colors**: Each player has unique color
- **Name tags**: Player names above characters
- **Health bars**: Visual health indication
- **Progress tracking**: Multi-player progress bar

## 🌐 Multiplayer Connection

The client automatically connects to the server using:
```javascript
const serverUrl = window.location.origin; // Auto-detects server URL
this.socket = io(serverUrl);
```

### Connection Events:
- **Connect**: Establishes Socket.IO connection
- **Lobby events**: Create, join, player updates
- **Game updates**: 60 FPS real-time synchronization
- **Error handling**: Connection failure management

## 📱 Responsive Design

### Desktop:
- **Full canvas**: 800x300 pixel game area
- **Keyboard controls**: Spacebar, Enter, E, J, S
- **Mouse interaction**: Click UI buttons

### Mobile:
- **Responsive canvas**: Scales to fit screen
- **Touch controls**: Tap to jump/shoot
- **Mobile-optimized UI**: Touch-friendly buttons

## 🎯 Performance

- **60 FPS rendering**: Smooth HTML5 Canvas animation
- **Optimized multiplayer**: Throttled updates to prevent spam
- **Efficient rendering**: Only draws visible elements
- **Memory management**: Proper cleanup of game objects

## 🔧 Configuration

### Race Settings:
```javascript
// Single Player Distances
const races = [500, 750, 1000]; // meters

// Multiplayer Distances  
const multiRaces = [1000, 1500, 2000]; // meters
```

### Power-up Timers:
```javascript
const powerUpDurations = {
    gun: 15000,      // 15 seconds
    car: 10000,      // 10 seconds  
    jumper: 10000,   // 10 seconds
    boat: 15000,     // 15 seconds
    diver: 8000      // 8 seconds
};
```