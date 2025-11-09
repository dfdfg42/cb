import { Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Connection Handler
 * 
 * Handles socket connection and disconnection events
 */
export class ConnectionHandler {
    private roomManager: RoomManager;
    private errorHandler: ErrorHandler;
    private io: any;

    constructor(io: any, roomManager: RoomManager, errorHandler: ErrorHandler) {
        this.io = io;
        this.roomManager = roomManager;
        this.errorHandler = errorHandler;
    }

    /**
     * Handle new socket connection
     */
    handleConnection(socket: Socket): void {
        console.log(`✅ 클라이언트 연결: ${socket.id}`);
        
        // Send connection confirmation
        socket.emit('connected', { 
            socketId: socket.id,
            timestamp: Date.now()
        });
    }

    /**
     * Handle socket disconnection
     */
    handleDisconnection(socket: Socket): void {
        console.log(`❌ 클라이언트 연결 해제: ${socket.id}`);

        const result = this.roomManager.removePlayer(socket.id);
        
        if (result.roomId) {
            if (result.isEmpty) {
                console.log(`🗑️ 방 삭제: ${result.roomId}`);
            } else if (result.room && result.player) {
                this.io.to(result.roomId).emit('room-updated', { room: result.room });
                this.io.to(result.roomId).emit('player-disconnected', { 
                    playerName: result.player.name 
                });
                console.log(`📤 플레이어 ${result.player.name} 퇴장 알림 전송`);
            }
        }
    }

    /**
     * Setup connection event listeners for a socket
     */
    setupListeners(socket: Socket): void {
        // Handle connection (already connected at this point)
        this.handleConnection(socket);

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }
}
