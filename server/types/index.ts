/**
 * Server-side type definitions
 */

export interface AttackQueueItem {
    id: string;
    requestId: string;
    attackerId: string;
    attackerName: string;
    targetId: string;
    targetName: string;
    damage: number;
    mentalDamage?: number;
    heal?: number;
    cardsUsed: Card[];
    cardsUsedIds: string[];
    attackAttribute: string | null;
    chainDepth: number;
    parentAttackId?: string;
    chainSource?: 'reflect' | 'bounce';
    originalTurnIndex?: number; // Preserve the turn index from initial attack
    status: 'pending' | 'defending' | 'resolved';
    timeoutId?: NodeJS.Timeout;
    timestamp: number;
    roomId: string;
}

export interface Card {
    id: string;
    name: string;
    type: string;
    healthDamage?: number;
    mentalDamage?: number;
    defense?: number;
    cost?: number;
    mentalCost?: number;
    effect?: CardEffect;
    attribute?: string;
    description?: string;
    // Legacy fields
    damage?: number;
    phys_atk?: number;
    mental_atk?: number;
}

export type CardEffect = 'reflect' | 'bounce' | 'heal' | 'burn' | 'poison' | 'stun' | 'none';

export interface Player {
    id: string;
    socketId: string;
    name: string;
    isReady: boolean;
}

export interface PlayerState {
    health: number;
    mentalPower: number;
    alive: boolean;
    debuffs?: string[];
    drawCost: number; // Cost for drawing a card (increases each time: 5, 10, 15...)
}

export interface Room {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    gameType: 'normal' | 'ranked';
    isPlaying: boolean;
    hostId: string;
    currentPlayerIndex?: number;
    currentTurn?: number;
    playerStates?: Record<string, PlayerState>;
    processedRequests?: Record<string, { resolved: any; timestamp: number }>;
    attackQueue?: AttackQueue;
    // Deprecated
    pendingAttacks?: Record<string, any>;
}

export interface AttackRequest {
    roomId: string;
    attackerId: string;
    targetId: string;
    cards: Card[];
    damage: number;
    requestId?: string;
    force?: boolean;
}

export interface DefendRequest {
    roomId: string;
    requestId: string;
    defenderId: string;
    cards: Card[];
    defense?: number;
}

export interface DrawCardEvent {
    roomId: string;
    playerId: string;
}

export interface DrawCardResult {
    success: boolean;
    playerId: string;
    playerName: string;
    cardDrawn?: Card;
    costPaid: number;
    newDrawCost: number;
    remainingMentalPower: number;
    nextPlayerId: string;
    currentTurn: number;
    message?: string;
}

export interface AttackResult {
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
    appliedDebuffs: string[];
    nextPlayerId: string | null;
    currentTurn: number;
    timestamp: number;
    requestId: string;
    chainSource?: 'reflect' | 'bounce';
    isReflected?: boolean;
    isBounced?: boolean;
    originalDamage?: number;
    originalMentalDamage?: number;
}

// Import AttackQueue class (will be defined separately)
import { AttackQueue } from '../models/AttackQueue';
export { AttackQueue };
