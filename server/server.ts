import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// Import services
import { CombatService } from './services/CombatService';
import { DamageCalculator } from './services/DamageCalculator';
import { EffectProcessor } from './services/EffectProcessor';
import { RoomManager } from './services/RoomManager';

// Import handlers
import {
    ConnectionHandler,
    RoomEventHandler,
    GameEventHandler,
    CombatEventHandler
} from './handlers';

// Import utilities
import { ErrorHandler } from './utils/ErrorHandler';

// Import constants
import {
    DEFAULT_PORT,
    CORS_ORIGIN,
    PROCESSED_REQUEST_TTL,
    CLEANUP_INTERVAL
} from './constants/GameConstants';

/**
 * Game Server
 * 
 * Main server orchestrator that initializes services and handlers,
 * then delegates all socket events to appropriate handlers.
 */

// Initialize Express app
const app = express();
app.use(cors());

// Create HTTP server and Socket.IO instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Initialize services
const combatService = new CombatService();
const damageCalculator = new DamageCalculator();
const effectProcessor = new EffectProcessor();
const roomManager = new RoomManager();
const errorHandler = new ErrorHandler();

// Initialize handlers
const connectionHandler = new ConnectionHandler(io, roomManager, errorHandler);
const roomEventHandler = new RoomEventHandler(io, roomManager, errorHandler);
const gameEventHandler = new GameEventHandler(io, roomManager, errorHandler);
const combatEventHandler = new CombatEventHandler(
    io,
    roomManager,
    combatService,
    damageCalculator,
    errorHandler
);

// Socket.IO connection handling
io.on('connection', (socket: Socket) => {
    // Setup all event handlers for this socket
    connectionHandler.setupListeners(socket);
    roomEventHandler.setupListeners(socket);
    gameEventHandler.setupListeners(socket);
    combatEventHandler.setupListeners(socket);
});

// Cleanup old processed requests periodically to prevent memory leaks
setInterval(() => {
    const cutoff = Date.now() - PROCESSED_REQUEST_TTL;
    for (const room of roomManager.getAllRooms()) {
        if (!room.processedRequests) continue;
        
        for (const [reqId, entry] of Object.entries(room.processedRequests)) {
            if (entry.timestamp < cutoff) {
                delete room.processedRequests[reqId];
            }
        }
        
        // Free memory if processedRequests is empty
        if (Object.keys(room.processedRequests).length === 0) {
            delete room.processedRequests;
        }
    }
}, CLEANUP_INTERVAL);

// Start server
const PORT = process.env.PORT || DEFAULT_PORT;

httpServer.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready for connections`);
    console.log(`🎮 Game handlers initialized`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
