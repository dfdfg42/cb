import { Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ErrorCode } from '../constants/ErrorCodes';
import { MIN_PLAYERS_TO_START } from '../constants/GameConstants';
import { AttackQueue } from '../models/AttackQueue';
import {
    StartGameEvent,
    GameActionEvent,
    TurnEndEvent,
    SpecialEventEvent,
    PlayerStateUpdateEvent,
    GameOverEvent,
    ForceSetHealthEvent,
    SocketEvents
} from '../types/events';
import { Player } from '../types';

/**
 * Game Event Handler
 * 
 * Handles game lifecycle events:
 * - start-game
 * - game-action
 * - turn-end
 * - special-event
 * - player-state-update
 * - game-over
 * - force-set-health (test only)
 */
export class GameEventHandler {
    private io: any;
    private roomManager: RoomManager;
    private errorHandler: ErrorHandler;

    constructor(io: any, roomManager: RoomManager, errorHandler: ErrorHandler) {
        this.io = io;
        this.roomManager = roomManager;
        this.errorHandler = errorHandler;
    }

    /**
     * Handle start-game event
     */
    handleStartGame(socket: Socket, data: StartGameEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room) {
            this.errorHandler.handleRoomNotFound(socket, data.roomId);
            return;
        }

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player || player.id !== room.hostId) {
            this.errorHandler.handlePlayerNotHost(socket, player?.id || '', room.hostId);
            return;
        }

        // Check minimum players
        if (room.players.length < MIN_PLAYERS_TO_START) {
            this.errorHandler.handleInsufficientPlayers(
                socket, 
                room.players.length, 
                MIN_PLAYERS_TO_START
            );
            return;
        }

        // Start game using RoomManager
        this.roomManager.startGame(data.roomId);

        // Initialize attack queue
        room.attackQueue = new AttackQueue();
        console.log(`[AttackQueue] Initialized for room ${data.roomId}`);

        // Broadcast authoritative game start and initial turn
        this.io.to(data.roomId).emit(SocketEvents.GAME_STARTING, { room });
        this.io.to(data.roomId).emit(SocketEvents.TURN_START, { 
            roomId: data.roomId, 
            currentPlayerId: room.players[0].id, 
            currentTurn: room.currentTurn 
        });

        console.log(`🎮 게임 시작: ${data.roomId} (turn=${room.currentTurn}, player=${room.players[0].name})`);
    }

    /**
     * Handle game-action event
     */
    handleGameAction(socket: Socket, data: GameActionEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            this.errorHandler.handleGameNotStarted(socket, data.roomId);
            return;
        }

        // Broadcast action to all players in room
        socket.to(data.roomId).emit(SocketEvents.GAME_ACTION, data.action);
    }

    /**
     * Handle turn-end event
     */
    handleTurnEnd(socket: Socket, data: TurnEndEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            return;
        }

        console.log(`🔄 턴 종료: ${data.playerId} -> ${data.nextPlayerId}`);
        this.io.to(data.roomId).emit(SocketEvents.TURN_END, data);
    }

    /**
     * Handle special-event
     */
    handleSpecialEvent(socket: Socket, data: SpecialEventEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            return;
        }

        console.log(`✨ 특수 이벤트: ${data.eventType}`);
        this.io.to(data.roomId).emit(SocketEvents.SPECIAL_EVENT, data);
    }

    /**
     * Handle player-state-update event
     */
    handlePlayerStateUpdate(socket: Socket, data: PlayerStateUpdateEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            return;
        }

        this.io.to(data.roomId).emit(SocketEvents.PLAYER_STATE_UPDATE, data);
    }

    /**
     * Handle game-over event
     */
    handleGameOver(socket: Socket, data: GameOverEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room) {
            return;
        }

        room.isPlaying = false;
        console.log(`🏆 게임 종료: ${data.roomId}, 승자: ${data.winnerId}`);
        this.io.to(data.roomId).emit(SocketEvents.GAME_OVER, data);
    }

    /**
     * Handle force-set-health event (TEST ONLY)
     */
    handleForceSetHealth(socket: Socket, data: ForceSetHealthEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room || !room.isPlaying) {
            return;
        }

        room.playerStates = room.playerStates || {};
        room.playerStates[data.playerId] = room.playerStates[data.playerId] || { 
            health: 100, 
            mentalPower: 100, 
            alive: true 
        };
        room.playerStates[data.playerId].health = Math.max(0, Math.min(100, data.health));
        
        console.log(`TEST-HOOK: set health for ${data.playerId} = ${room.playerStates[data.playerId].health}`);
        
        this.io.to(data.roomId).emit(SocketEvents.PLAYER_STATE_UPDATE, { 
            roomId: data.roomId, 
            playerId: data.playerId, 
            health: room.playerStates[data.playerId].health 
        });
    }

    /**
     * Setup game event listeners for a socket
     */
    setupListeners(socket: Socket): void {
        socket.on(SocketEvents.START_GAME, (data: StartGameEvent) => {
            this.handleStartGame(socket, data);
        });

        socket.on(SocketEvents.GAME_ACTION, (data: GameActionEvent) => {
            this.handleGameAction(socket, data);
        });

        socket.on(SocketEvents.TURN_END, (data: TurnEndEvent) => {
            this.handleTurnEnd(socket, data);
        });

        socket.on(SocketEvents.SPECIAL_EVENT, (data: SpecialEventEvent) => {
            this.handleSpecialEvent(socket, data);
        });

        socket.on(SocketEvents.PLAYER_STATE_UPDATE, (data: PlayerStateUpdateEvent) => {
            this.handlePlayerStateUpdate(socket, data);
        });

        socket.on(SocketEvents.GAME_OVER, (data: GameOverEvent) => {
            this.handleGameOver(socket, data);
        });

        socket.on(SocketEvents.FORCE_SET_HEALTH, (data: ForceSetHealthEvent) => {
            this.handleForceSetHealth(socket, data);
        });
    }
}
