import { Socket } from 'socket.io';
import { ErrorCode, ErrorMessages, GameError, createError } from '../constants/ErrorCodes';

/**
 * Error Handler Utility
 * 
 * Provides standardized error handling and logging functionality
 * for the game server.
 */
export class ErrorHandler {
    private enableLogging: boolean;

    constructor(enableLogging = true) {
        this.enableLogging = enableLogging;
    }

    /**
     * Send error to client via socket
     */
    sendError(socket: Socket, code: ErrorCode, details?: any, customMessage?: string): void {
        const error = createError(code, details, customMessage);
        socket.emit('error', error);
        this.log('ERROR_SENT', { socketId: socket.id, error });
    }

    /**
     * Broadcast error to room
     */
    broadcastError(io: any, roomId: string, code: ErrorCode, details?: any, customMessage?: string): void {
        const error = createError(code, details, customMessage);
        io.to(roomId).emit('error', error);
        this.log('ERROR_BROADCAST', { roomId, error });
    }

    /**
     * Handle room not found error
     */
    handleRoomNotFound(socket: Socket, roomId: string): void {
        this.sendError(socket, ErrorCode.ROOM_NOT_FOUND, { roomId });
    }

    /**
     * Handle player not found error
     */
    handlePlayerNotFound(socket: Socket, playerId: string): void {
        this.sendError(socket, ErrorCode.PLAYER_NOT_FOUND, { playerId });
    }

    /**
     * Handle insufficient mana error
     */
    handleInsufficientMana(socket: Socket, required: number, available: number): void {
        this.sendError(socket, ErrorCode.PLAYER_INSUFFICIENT_MANA, { required, available });
    }

    /**
     * Handle invalid turn error
     */
    handleInvalidTurn(socket: Socket, currentPlayerId: string, attemptedPlayerId: string): void {
        this.sendError(socket, ErrorCode.PLAYER_NOT_TURN, { currentPlayerId, attemptedPlayerId });
    }

    /**
     * Handle attack not found error
     */
    handleAttackNotFound(socket: Socket, requestId: string): void {
        this.sendError(socket, ErrorCode.ATTACK_NOT_FOUND, { requestId });
    }

    /**
     * Handle defense request not found error
     */
    handleDefenseRequestNotFound(socket: Socket, requestId: string): void {
        this.sendError(socket, ErrorCode.DEFENSE_REQUEST_NOT_FOUND, { requestId });
    }

    /**
     * Handle room full error
     */
    handleRoomFull(socket: Socket, roomId: string, maxPlayers: number): void {
        this.sendError(socket, ErrorCode.ROOM_FULL, { roomId, maxPlayers });
    }

    /**
     * Handle game not started error
     */
    handleGameNotStarted(socket: Socket, roomId: string): void {
        this.sendError(socket, ErrorCode.GAME_NOT_STARTED, { roomId });
    }

    /**
     * Handle insufficient players error
     */
    handleInsufficientPlayers(socket: Socket, currentPlayers: number, requiredPlayers: number): void {
        this.sendError(socket, ErrorCode.GAME_INSUFFICIENT_PLAYERS, { currentPlayers, requiredPlayers });
    }

    /**
     * Handle player not host error
     */
    handlePlayerNotHost(socket: Socket, playerId: string, hostId: string): void {
        this.sendError(socket, ErrorCode.PLAYER_NOT_HOST, { playerId, hostId });
    }

    /**
     * Handle room already playing error
     */
    handleRoomAlreadyPlaying(socket: Socket, roomId: string): void {
        this.sendError(socket, ErrorCode.ROOM_ALREADY_PLAYING, { roomId });
    }

    /**
     * Handle attack queue not initialized error
     */
    handleAttackQueueNotInitialized(socket: Socket, roomId: string): void {
        this.sendError(socket, ErrorCode.ATTACK_QUEUE_NOT_INITIALIZED, { roomId });
    }

    /**
     * Handle invalid defense error
     */
    handleInvalidDefense(socket: Socket, defenderId: string, attackTargetId: string): void {
        this.sendError(socket, ErrorCode.DEFENSE_NOT_YOUR_TURN, { defenderId, attackTargetId });
    }

    /**
     * Handle target not found error
     */
    handleTargetNotFound(socket: Socket, targetId: string): void {
        this.sendError(socket, ErrorCode.ATTACK_TARGET_NOT_FOUND, { targetId });
    }

    /**
     * Generic error handler
     */
    handleUnknownError(socket: Socket, error: any): void {
        this.sendError(socket, ErrorCode.UNKNOWN_ERROR, { error: error.message || error });
        this.logError('UNKNOWN_ERROR', error);
    }

    /**
     * Log information message
     */
    log(type: string, data: any): void {
        if (this.enableLogging) {
            console.log(`[${type}]`, JSON.stringify(data, null, 2));
        }
    }

    /**
     * Log error message
     */
    logError(type: string, error: any): void {
        if (this.enableLogging) {
            console.error(`[${type}]`, error);
        }
    }

    /**
     * Log warning message
     */
    logWarning(type: string, data: any): void {
        if (this.enableLogging) {
            console.warn(`[${type}]`, JSON.stringify(data, null, 2));
        }
    }

    /**
     * Create a game error object without sending it
     */
    createError(code: ErrorCode, details?: any, customMessage?: string): GameError {
        return createError(code, details, customMessage);
    }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
