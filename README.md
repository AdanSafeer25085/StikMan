# 🎮 StickMan Runner - Real-Time Multiplayer

A real-time multiplayer runner game built with Node.js, Socket.IO, and HTML5 Canvas.

## 📁 Project Structure

```
2ndGame/
├── client/                 # Client-side code (HTML5 Canvas game)
│   ├── index.html         # Game UI and lobby system
│   ├── script.js          # Main game logic
│   ├── multiplayer-client.js # Socket.IO client integration
│   ├── style.css          # Game styling
│   ├── sprites/           # Game assets (optional)
│   └── README.md          # Client documentation
├── server/                # Server-side code (Node.js + Socket.IO)
│   ├── server.js          # Multiplayer server
│   ├── package.json       # Dependencies
│   └── README.md          # Server documentation
└── README.md              # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Start Server
```bash
npm start
```

### 3. Open Game
Navigate to `http://localhost:3000` in your web browser

### 4. Play!
- **Single Player**: Click "Single Player" and race solo
- **Multiplayer**: Click "Multiplayer" → "Create Lobby" → Share 6-digit code with friends

## 🎯 Game Features

### 🏃 Single Player Mode
- **Two environments**: Land running, underwater swimming
- **Power-ups**: Gun, Car, Jumper, Boat, Diver
- **Obstacle collision**: Segment-based respawn system
- **Multiple distances**: 500m, 750m, 1000m races
- **Live progress tracking**: Real-time progress bar

### 👥 Multiplayer Mode
- **Real-time racing**: Up to 4 players simultaneously
- **6-digit lobby codes**: Easy room joining
- **Host-controlled**: Only host selects mode and starts race
- **PvP combat**: Shoot other players (50% damage per shot)
- **Synchronized world**: Same obstacles and power-ups for all
- **2-second respawn**: Quick return to action when killed
- **Live leaderboard**: Final rankings with host controls

## 🛠️ Technology Stack

### Server (Node.js)
- **Express.js**: Web server and static file serving
- **Socket.IO**: Real-time WebSocket communication
- **In-memory storage**: Fast temporary game state
- **60 FPS updates**: Smooth multiplayer synchronization

### Client (Browser)
- **HTML5 Canvas**: High-performance 2D rendering
- **Socket.IO Client**: Real-time server communication
- **Responsive Design**: Desktop and mobile support
- **Vanilla JavaScript**: No heavy frameworks

## 🌐 Multiplayer Architecture

```
Client 1 ←→ Server ←→ Client 2
              │
         Game State
    (Players, Bullets, 
     Obstacles, etc.)
```

### Server Authority:
- **Collision detection**: Server validates all hits
- **Game object spawning**: Synchronized obstacles/power-ups
- **Player positions**: Real-time position updates
- **Lobby management**: Create, join, and cleanup rooms

### Client Responsibility:
- **Input handling**: Smooth local controls
- **Rendering**: 60 FPS Canvas drawing
- **UI management**: Lobby and game interface
- **Sound effects**: Local audio feedback

## 🎮 Game Modes

### 🏃 Land Mode
- Classic runner with jumping mechanics
- Ground-based obstacles (rocks, spikes)
- Car power-up for speed boost
- Gun and Jumper power-ups

### 🏊 Underwater Mode
- Swimming with rotated player graphics
- Water-based obstacles
- Boat power-up (water vehicle)
- Diver power-up (underwater invincibility)

## 📊 Performance

- **Real-time**: 16ms server updates (60 FPS)
- **Optimized networking**: Throttled client updates
- **Memory efficient**: Auto-cleanup of old game objects
- **Scalable**: Multiple concurrent lobbies supported

## 🔧 Configuration

### Server Settings:
```javascript
const GAME_CONFIG = {
    PVP_DAMAGE: 50,        // 50% damage per shot
    RESPAWN_TIME: 2000,    // 2 second respawn
    UPDATE_INTERVAL: 16    // 60 FPS updates
};
```

### Client Settings:
```javascript
const raceDistances = {
    single: [500, 750, 1000],      // Single player
    multi: [1000, 1500, 2000]     // Multiplayer
};
```

## 🚀 Deployment

### Local Network (LAN Party):
1. Start server: `npm start`
2. Share your IP: `http://[YOUR-IP]:3000`
3. Friends connect from same network

### Internet Deployment:
1. Deploy server to cloud (Heroku, DigitalOcean, etc.)
2. Update client connection URL if needed
3. Share public URL with players

## 🤝 Contributing

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to race? Start the server and challenge your friends to some real-time multiplayer action!** 🏁