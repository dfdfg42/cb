import { Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ErrorCode } from '../constants/ErrorCodes';
import { MIN_PLAYERS_TO_START } from '../constants/GameConstants';
import {
    CreateRoomEvent,
    JoinRoomEvent,
    LeaveRoomEvent,
    ToggleReadyEvent,
    GetRoomsEvent,
    SocketEvents
} from '../types/events';
import { Player } from '../types';

/**
 * Room Event Handler
 * 
 * Handles all room-related socket events:
 * - create-room
 * - join-room
 * - leave-room
 * - toggle-ready
 * - get-rooms
 */
export class RoomEventHandler {
    private io: any;
    private roomManager: RoomManager;
    private errorHandler: ErrorHandler;

    constructor(io: any, roomManager: RoomManager, errorHandler: ErrorHandler) {
        this.io = io;
        this.roomManager = roomManager;
        this.errorHandler = errorHandler;
    }

    /**
     * Handle create-room event
     */
    handleCreateRoom(socket: Socket, data: CreateRoomEvent): void {
        const { roomId, room } = this.roomManager.createRoom(
            data.playerName, 
            socket.id, 
            data.gameType
        );
        
        socket.join(roomId);

        socket.emit(SocketEvents.ROOM_CREATED, {
            roomId,
            room
        });

        console.log(`🏠 방 생성: ${roomId} by ${data.playerName}`);
    }

    /**
     * Handle join-room event
     */
    handleJoinRoom(socket: Socket, data: JoinRoomEvent): void {
        const result = this.roomManager.joinRoom(
            data.roomId, 
            data.playerName, 
            socket.id
        );

        if (!result.success) {
            this.errorHandler.sendError(
                socket,
                result.error?.includes('가득') ? ErrorCode.ROOM_FULL :
                result.error?.includes('시작') ? ErrorCode.ROOM_ALREADY_PLAYING :
                ErrorCode.ROOM_NOT_FOUND,
                { roomId: data.roomId }
            );
            return;
        }

        socket.join(data.roomId);

        // Broadcast room update to all players in the room
        this.io.to(data.roomId).emit(SocketEvents.ROOM_UPDATED, { 
            room: result.room 
        });

        socket.emit(SocketEvents.ROOM_JOINED, {
            roomId: data.roomId,
            room: result.room
        });

        console.log(`👤 ${data.playerName} 참가: ${data.roomId}`);
    }

    /**
     * Handle leave-room event
     */
    handleLeaveRoom(socket: Socket, data: LeaveRoomEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room) {
            this.errorHandler.handleRoomNotFound(socket, data.roomId);
            return;
        }

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player) {
            this.errorHandler.handlePlayerNotFound(socket, socket.id);
            return;
        }

        const result = this.roomManager.removePlayer(socket.id);
        socket.leave(data.roomId);

        if (result.isEmpty) {
            console.log(`🗑️ 방 삭제: ${data.roomId}`);
        } else if (result.room) {
            this.io.to(data.roomId).emit(SocketEvents.ROOM_UPDATED, { 
                room: result.room 
            });
        }

        console.log(`🚪 ${player.name} 퇴장: ${data.roomId}`);
    }

    /**
     * Handle toggle-ready event
     */
    handleToggleReady(socket: Socket, data: ToggleReadyEvent): void {
        const room = this.roomManager.getRoom(data.roomId);
        if (!room) {
            this.errorHandler.handleRoomNotFound(socket, data.roomId);
            return;
        }

        const player = room.players.find((p: Player) => p.socketId === socket.id);
        if (!player) {
            this.errorHandler.handlePlayerNotFound(socket, socket.id);
            return;
        }

        this.roomManager.setPlayerReady(data.roomId, player.id, !player.isReady);

        this.io.to(data.roomId).emit(SocketEvents.ROOM_UPDATED, { room });

        console.log(`✋ ${player.name} 준비: ${player.isReady}`);
    }

    /**
     * Handle get-rooms event
     */
    handleGetRooms(socket: Socket, data?: GetRoomsEvent): void {
        const availableRooms = this.roomManager.getAvailableRooms(data?.gameType);
        socket.emit(SocketEvents.ROOMS_LIST, { rooms: availableRooms });
    }

    /**
     * Setup room event listeners for a socket
     */
    setupListeners(socket: Socket): void {
        socket.on(SocketEvents.CREATE_ROOM, (data: CreateRoomEvent) => {
            this.handleCreateRoom(socket, data);
        });

        socket.on(SocketEvents.JOIN_ROOM, (data: JoinRoomEvent) => {
            this.handleJoinRoom(socket, data);
        });

        socket.on(SocketEvents.LEAVE_ROOM, (data: LeaveRoomEvent) => {
            this.handleLeaveRoom(socket, data);
        });

        socket.on(SocketEvents.TOGGLE_READY, (data: ToggleReadyEvent) => {
            this.handleToggleReady(socket, data);
        });

        socket.on(SocketEvents.GET_ROOMS, (data?: GetRoomsEvent) => {
            this.handleGetRooms(socket, data);
        });
    }
}
