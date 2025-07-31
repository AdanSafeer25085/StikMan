// Real-time multiplayer client using Socket.IO
class MultiplayerClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.lobbyCode = null;
        this.playerId = null;
        this.isHost = false;
        this.gameState = null;
        this.serverPlayers = new Map();
        this.lastUpdate = 0;
        
        // Initialize connection
        this.connect();
    }
    
    connect() {
        console.log('🔄 Attempting to connect to multiplayer server...');
        
        // Connect to Socket.IO server - automatically detects the server URL
        const serverUrl = window.location.origin; // Uses current page's origin (protocol + host + port)
        console.log('🌐 Connecting to:', serverUrl);
        this.socket = io(serverUrl);
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to multiplayer server:', serverUrl);
            console.log('🆔 Socket ID:', this.socket.id);
            this.connected = true;
            this.playerId = this.socket.id;
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            console.log('💡 Make sure the server is running and accessible');
            this.connected = false;
        });
        
        this.socket.on('disconnect', () => {
            console.log('📡 Disconnected from multiplayer server');
            this.connected = false;
        });
        
        // Lobby events
        this.socket.on('lobbyCreated', (data) => {
            if (data.success) {
                this.lobbyCode = data.code;
                this.isHost = true;
                this.gameState = data.gameState;
                this.onLobbyCreated(data);
            } else {
                this.onError(data.error);
            }
        });
        
        this.socket.on('lobbyJoined', (data) => {
            if (data.success) {
                this.lobbyCode = data.code;
                this.isHost = false;
                this.gameState = data.gameState;
                this.onLobbyJoined(data);
            } else {
                this.onError(data.error);
            }
        });
        
        this.socket.on('playerJoined', (data) => {
            this.gameState = data.gameState;
            this.onPlayerJoined(data);
        });
        
        this.socket.on('playerLeft', (data) => {
            this.gameState = data.gameState;
            this.onPlayerLeft(data);
        });
        
        this.socket.on('raceStarted', (data) => {
            this.gameState = data.gameState;
            this.onRaceStarted(data);
        });
        
        this.socket.on('gameUpdate', (data) => {
            this.gameState = data.gameState;
            this.updateServerPlayers(data.gameState.players);
            this.onGameUpdate(data);
        });
    }
    
    // API Methods
    createLobby(playerName) {
        console.log('🎮 Attempting to create lobby for:', playerName);
        console.log('🔗 Connection status:', this.connected);
        
        if (!this.connected) {
            console.error('❌ Not connected to server');
            this.onError('Not connected to server');
            return;
        }
        
        console.log('📤 Sending createLobby event to server...');
        this.socket.emit('createLobby', {
            playerName: playerName
        });
    }
    
    joinLobby(code, playerName) {
        if (!this.connected) {
            this.onError('Not connected to server');
            return;
        }
        
        this.socket.emit('joinLobby', {
            code: code,
            playerName: playerName
        });
    }
    
    startRace(raceDistance, gameMode) {
        if (!this.connected || !this.isHost) {
            this.onError('Cannot start race - not host or not connected');
            return;
        }
        
        this.socket.emit('startRace', {
            raceDistance: raceDistance,
            gameMode: gameMode
        });
    }
    
    updatePlayer(playerData) {
        if (!this.connected || !this.lobbyCode) return;
        
        // Throttle updates (60 FPS max)
        const now = Date.now();
        if (now - this.lastUpdate < 16) return;
        this.lastUpdate = now;
        
        this.socket.emit('playerUpdate', playerData);
    }
    
    shoot(bulletData) {
        if (!this.connected || !this.lobbyCode) return;
        
        this.socket.emit('shoot', bulletData);
    }
    
    updateServerPlayers(players) {
        this.serverPlayers.clear();
        players.forEach(player => {
            this.serverPlayers.set(player.id, player);
        });
    }
    
    getOtherPlayers() {
        const others = [];
        this.serverPlayers.forEach(player => {
            if (player.id !== this.playerId) {
                others.push(player);
            }
        });
        return others;
    }
    
    getCurrentPlayer() {
        return this.serverPlayers.get(this.playerId);
    }
    
    // Event handlers (to be overridden)
    onLobbyCreated(data) {
        console.log('🎮 Lobby created successfully! Code:', data.code);
        console.log('Full lobby data:', data);
        
        // Update UI with lobby code
        const codeElement = document.getElementById('generatedLobbyCode');
        if (codeElement) {
            codeElement.textContent = data.code;
            console.log('✅ Lobby code displayed:', data.code);
        } else {
            console.error('❌ Could not find generatedLobbyCode element');
        }
        
        // Show lobby panel and update display
        this.updateLobbyDisplay(data.gameState);
        
        // Enable the "Start Game" button now that lobby is ready
        const startButton = document.getElementById('startMultiGameBtn');
        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = 'Start Game';
            console.log('✅ Start Game button updated');
        } else {
            console.error('❌ Could not find startMultiGameBtn element');
        }
        
        // Show alert with lobby code for extra visibility
        alert(`🎮 Lobby Created!\n\nLobby Code: ${data.code}\n\nShare this code with your friends so they can join!`);
    }
    
    onLobbyJoined(data) {
        console.log('Joined lobby:', data.gameState.code);
        // Show waiting screen
        this.showPlayerWaitingScreen(data.gameState);
    }
    
    onPlayerJoined(data) {
        console.log('Player joined lobby');
        this.updateLobbyDisplay(data.gameState);
    }
    
    onPlayerLeft(data) {
        console.log('Player left lobby');
        this.updateLobbyDisplay(data.gameState);
    }
    
    onRaceStarted(data) {
        console.log('Race started!');
        // Hide all lobby panels and start game
        this.hideAllPanels();
        
        // Initialize multiplayer game state
        isMultiplayer = true;
        multiplayerPlayers = data.gameState.players;
        raceDistance = data.gameState.raceDistance;
        gameMode = data.gameState.gameMode;
        finishLineX = calculateFinishLinePosition(raceDistance);
        
        // Start the game
        startMainGame();
    }
    
    onGameUpdate(data) {
        // Update multiplayer players array with server data
        if (typeof multiplayerPlayers !== 'undefined') {
            multiplayerPlayers = data.gameState.players;
        }
        
        // Update bullets with server data
        if (typeof bullets !== 'undefined') {
            bullets = data.gameState.bullets;
        }
        
        // Update obstacles with server data (synchronized for all players)
        if (typeof obstacles !== 'undefined') {
            obstacles = data.gameState.obstacles;
        }
        
        // Update power-ups with server data (synchronized for all players)
        if (typeof powerUps !== 'undefined') {
            powerUps = data.gameState.powerUps;
        }
    }
    
    onError(error) {
        console.error('Multiplayer error:', error);
        alert(`Multiplayer Error: ${error}`);
    }
    
    updateLobbyDisplay(gameState) {
        const playerList = document.getElementById('playerList');
        const playerCount = document.getElementById('playerCount');
        const hostNameSpan = document.getElementById('hostName');
        
        if (playerList && playerCount) {
            playerCount.textContent = gameState.players.length;
            playerList.innerHTML = '';
            
            gameState.players.forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = `player-item ${player.isHost ? 'host' : ''}`;
                playerDiv.innerHTML = `${player.isHost ? '👑' : '👤'} <span>${player.name}</span> ${player.isHost ? '(Host)' : ''}`;
                playerList.appendChild(playerDiv);
            });
            
            // Update host name display
            if (hostNameSpan) {
                const hostPlayer = gameState.players.find(p => p.isHost);
                if (hostPlayer) {
                    hostNameSpan.textContent = hostPlayer.name;
                }
            }
        }
    }
    
    showPlayerWaitingScreen(gameState) {
        // Remove existing waiting screen
        const existingScreen = document.getElementById('serverWaitingScreen');
        if (existingScreen) {
            existingScreen.remove();
        }
        
        // Create waiting screen
        const waitingDiv = document.createElement('div');
        waitingDiv.id = 'serverWaitingScreen';
        waitingDiv.className = 'overlay-panel';
        waitingDiv.innerHTML = `
            <div class="panel-content">
                <h2>🎮 Joined Lobby!</h2>
                <div class="lobby-info">
                    <h3>Lobby Code: <span>${gameState.code}</span></h3>
                    <p>Connected to server - Real-time multiplayer!</p>
                </div>
                <div class="waiting-message">
                    <p><strong>Waiting for host to start the game...</strong></p>
                    <div class="loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </div>
                </div>
                <div id="serverWaitingPlayerList" class="connected-players">
                    <h4>Players in Lobby:</h4>
                    <div id="serverWaitingPlayers"></div>
                </div>
            </div>
        `;
        document.body.appendChild(waitingDiv);
        
        // Update player list
        this.updateWaitingPlayersList(gameState);
    }
    
    updateWaitingPlayersList(gameState) {
        const waitingPlayersDiv = document.getElementById('serverWaitingPlayers');
        if (!waitingPlayersDiv) return;
        
        waitingPlayersDiv.innerHTML = '';
        gameState.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-item ${player.isHost ? 'host' : ''}`;
            playerDiv.innerHTML = `${player.isHost ? '👑' : '👤'} <span>${player.name}</span> ${player.isHost ? '(Host)' : ''}`;
            waitingPlayersDiv.appendChild(playerDiv);
        });
    }
    
    hideAllPanels() {
        // Hide all multiplayer panels
        const panels = [
            'gameModePanel',
            'lobbyModePanel', 
            'createLobbyPanel',
            'joinLobbyPanel',
            'playerSetupPanel',
            'modeSelectionPanel'
        ];
        
        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('hidden');
            }
        });
        
        // Remove waiting screens
        const waitingScreen = document.getElementById('serverWaitingScreen');
        if (waitingScreen) {
            waitingScreen.remove();
        }
    }
}

// Initialize multiplayer client when DOM is loaded
let multiplayerClient = null;

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're in a browser environment
    if (typeof io !== 'undefined') {
        multiplayerClient = new MultiplayerClient();
        console.log('🎮 Real-time multiplayer client initialized');
    } else {
        console.warn('Socket.IO not loaded - multiplayer features disabled');
    }
});