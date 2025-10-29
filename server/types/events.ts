import { Card } from './index';

/**
 * Server Event Types
 * 
 * Type definitions for all socket.io events used in the game.
 * This ensures type safety for event data across client and server.
 */

// ============================================================================
// Room Events
// ============================================================================

export interface CreateRoomEvent {
    playerName: string;
    gameType: 'normal' | 'ranked';
}

export interface JoinRoomEvent {
    roomId: string;
    playerName: string;
}

export interface LeaveRoomEvent {
    roomId: string;
}

export interface ToggleReadyEvent {
    roomId: string;
}

export interface StartGameEvent {
    roomId: string;
}

export interface GetRoomsEvent {
    gameType?: 'normal' | 'ranked';
}

// ============================================================================
// Combat Events
// ============================================================================

export interface PlayerAttackEvent {
    roomId: string;
    attackerId: string;
    targetId: string;
    cards: Card[];
    damage: number;
    requestId?: string;
    force?: boolean; // For testing only
}

export interface PlayerDefendEvent {
    roomId: string;
    requestId: string;
    defenderId: string;
    cards: Card[];
    defense?: number;
}

export interface AttackAnnouncedEvent {
    requestId: string;
    attackerId: string;
    attackerName: string;
    targetId: string;
    damage: number;
    mentalDamage: number;
    attackAttribute: string | null;
    cardsUsed: Card[];
    cardsUsedIds: string[];
    chainSource?: string;
}

export interface DefendRequestEvent {
    requestId: string;
    attackerId: string;
    attackerName: string;
    defenderId: string;
    defenderName: string;
    damage: number;
    mentalDamage: number;
    attackAttribute: string | null;
    roomId: string;
    expiresAt: number;
    chainSource?: string;
}

export interface AttackResolvedEvent {
    attackerId: string;
    attackerName: string;
    targetId: string;
    targetName: string;
    damageApplied: number;
    mentalDamageApplied: number;
    healApplied: number;
    targetPrevHealth: number;
    targetHealth: number;
    targetPrevMentalPower: number;
    targetMentalPower: number;
    attackerMentalPower: number;
    eliminated: boolean;
    cardsUsed: Card[];
    cardsUsedIds: string[];
    defenseCards: Card[];
    defenseCardIds: string[];
    defenseApplied: number;
    appliedDebuffs: any[];
    nextPlayerId: string | null;
    currentTurn: number;
    timestamp: number;
    requestId: string;
    chainSource?: string;
    isReflected?: boolean;
    isBounced?: boolean;
    originalDamage?: number;
    originalMentalDamage?: number;
}

// ============================================================================
// Turn Events
// ============================================================================

export interface TurnStartEvent {
    roomId: string;
    currentPlayerId: string;
    currentTurn: number;
}

export interface TurnEndEvent {
    roomId: string;
    playerId: string;
    nextPlayerId: string;
}

// ============================================================================
// Player State Events
// ============================================================================

export interface PlayerStateUpdateEvent {
    roomId: string;
    playerId: string;
    health: number;
    mentalPower: number;
    cards: Card[];
}

export interface ForceSetHealthEvent {
    roomId: string;
    playerId: string;
    health: number;
}

// ============================================================================
// Game Events
// ============================================================================

export interface GameActionEvent {
    roomId: string;
    action: unknown; // Generic action, type depends on game logic
}

export interface SpecialEventEvent {
    roomId: string;
    eventType: string;
    eventData: unknown;
}

export interface GameOverEvent {
    roomId: string;
    winnerId: string;
    stats: unknown;
}

// ============================================================================
// Response Events
// ============================================================================

export interface RoomCreatedResponse {
    roomId: string;
    room: any; // Room type from server types
}

export interface RoomJoinedResponse {
    roomId: string;
    room: any;
}

export interface RoomUpdatedResponse {
    room: any;
}

export interface RoomsListResponse {
    rooms: any[];
}

export interface ErrorResponse {
    code?: string;
    message: string;
    details?: any;
    timestamp?: number;
}

export interface PlayerDisconnectedEvent {
    playerName: string;
}

// ============================================================================
// Event Name Constants
// ============================================================================

export const SocketEvents = {
    // Client -> Server
    CREATE_ROOM: 'create-room',
    JOIN_ROOM: 'join-room',
    LEAVE_ROOM: 'leave-room',
    TOGGLE_READY: 'toggle-ready',
    START_GAME: 'start-game',
    GET_ROOMS: 'get-rooms',
    PLAYER_ATTACK: 'player-attack',
    PLAYER_DEFEND: 'player-defend',
    TURN_END: 'turn-end',
    GAME_ACTION: 'game-action',
    SPECIAL_EVENT: 'special-event',
    PLAYER_STATE_UPDATE: 'player-state-update',
    GAME_OVER: 'game-over',
    FORCE_SET_HEALTH: 'force-set-health',
    
    // Server -> Client
    ROOM_CREATED: 'room-created',
    ROOM_JOINED: 'room-joined',
    ROOM_UPDATED: 'room-updated',
    ROOMS_LIST: 'rooms-list',
    GAME_STARTING: 'game-starting',
    TURN_START: 'turn-start',
    ATTACK_ANNOUNCED: 'attack-announced',
    DEFEND_REQUEST: 'defend-request',
    ATTACK_RESOLVED: 'attack-resolved',
    PLAYER_DISCONNECTED: 'player-disconnected',
    ERROR: 'error',
    
    // Connection
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
} as const;

export type SocketEventName = typeof SocketEvents[keyof typeof SocketEvents];
