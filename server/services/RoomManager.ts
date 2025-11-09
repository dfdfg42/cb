import { Room, Player, PlayerState } from '../types';

/**
 * Room management service
 * Handles all room-related operations including creation, joining, player management
 */
export class RoomManager {
    private rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    /**
     * Generate unique room ID
     */
    generateRoomId(): string {
        try {
            const crypto = require('crypto');
            if (typeof crypto.randomUUID === 'function') {
                return `room_${crypto.randomUUID()}`;
            }
        } catch (e) {
            // ignore and fallback
        }
        // fallback to timestamp+random
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a new room
     */
    createRoom(
        playerName: string,
        socketId: string,
        gameType: 'normal' | 'ranked'
    ): { roomId: string; room: Room; player: Player } {
        const roomId = this.generateRoomId();
        const player: Player = {
            id: `player_${Date.now()}`,
            socketId: socketId,
            name: playerName,
            isReady: false
        };

        const room: Room = {
            id: roomId,
            name: `${playerName}의 방`,
            players: [player],
            maxPlayers: 4,
            gameType: gameType,
            isPlaying: false,
            hostId: player.id
        };

        this.rooms.set(roomId, room);
        return { roomId, room, player };
    }

    /**
     * Get room by ID
     */
    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Add player to room
     */
    joinRoom(roomId: string, playerName: string, socketId: string): {
        success: boolean;
        error?: string;
        player?: Player;
        room?: Room;
    } {
        const room = this.rooms.get(roomId);

        if (!room) {
            return { success: false, error: '방을 찾을 수 없습니다.' };
        }

        if (room.players.length >= room.maxPlayers) {
            return { success: false, error: '방이 가득 찼습니다.' };
        }

        if (room.isPlaying) {
            return { success: false, error: '게임이 이미 시작되었습니다.' };
        }

        const player: Player = {
            id: `player_${Date.now()}`,
            socketId: socketId,
            name: playerName,
            isReady: false
        };

        room.players.push(player);
        return { success: true, player, room };
    }

    /**
     * Set player ready status
     */
    setPlayerReady(roomId: string, playerId: string, ready: boolean): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return null;

        player.isReady = ready;
        return room;
    }

    /**
     * Check if all players are ready
     */
    areAllPlayersReady(room: Room): boolean {
        return room.players.every(p => p.isReady);
    }

    /**
     * Start game in room
     */
    startGame(roomId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        room.isPlaying = true;
        room.currentPlayerIndex = 0;
        room.currentTurn = 1;

        // Initialize player states
        room.playerStates = {};
        for (const player of room.players) {
            room.playerStates[player.id] = {
                health: 100,
                mentalPower: 100,
                alive: true,
                debuffs: []
            };
        }

        return room;
    }

    /**
     * Get available rooms (not playing, not full)
     */
    getAvailableRooms(gameType?: 'normal' | 'ranked'): Room[] {
        let availableRooms = Array.from(this.rooms.values())
            .filter(room => !room.isPlaying && room.players.length < room.maxPlayers);

        if (gameType) {
            availableRooms = availableRooms.filter(r => r.gameType === gameType);
        }

        return availableRooms;
    }

    /**
     * Remove player from room
     */
    removePlayer(socketId: string): {
        roomId?: string;
        room?: Room;
        player?: Player;
        wasHost: boolean;
        isEmpty: boolean;
    } {
        for (const [roomId, room] of this.rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.socketId === socketId);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                const wasHost = room.hostId === player.id;
                
                room.players.splice(playerIndex, 1);

                // Remove authoritative player state if present
                if (room.playerStates && player && player.id) {
                    delete room.playerStates[player.id];
                }

                // If room is empty, delete it
                if (room.players.length === 0) {
                    this.rooms.delete(roomId);
                    return { roomId, player, wasHost, isEmpty: true };
                }

                // If host left, assign new host
                if (wasHost) {
                    room.hostId = room.players[0].id;
                }

                return { roomId, room, player, wasHost, isEmpty: false };
            }
        }

        return { wasHost: false, isEmpty: false };
    }

    /**
     * End game in room
     */
    endGame(roomId: string): Room | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        room.isPlaying = false;
        return room;
    }

    /**
     * Get all rooms (for debugging/admin)
     */
    getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Delete room
     */
    deleteRoom(roomId: string): boolean {
        return this.rooms.delete(roomId);
    }
}
