/**
 * Shared Types
 * 
 * Common type definitions used across client and server.
 */

/**
 * Card types
 */
export enum CardType {
    ATTACK = 'ATTACK',
    DEFENSE = 'DEFENSE',
    MAGIC = 'MAGIC',
    FIELD_MAGIC = 'FIELD_MAGIC'
}

/**
 * Card effects
 */
export enum CardEffect {
    NONE = 'NONE',
    HEAL = 'HEAL',
    REFLECT = 'REFLECT',
    BOUNCE = 'BOUNCE',
    MENTAL_RESTORE = 'MENTAL_RESTORE',
    DAMAGE_INCREASE = 'DAMAGE_INCREASE'
}

/**
 * Debuff types
 */
export enum DebuffType {
    CARD_DECAY = 'CARD_DECAY',
    RANDOM_TARGET = 'RANDOM_TARGET',
    MENTAL_DRAIN = 'MENTAL_DRAIN',
    DAMAGE_INCREASE = 'DAMAGE_INCREASE'
}

/**
 * Game states
 */
export enum GameState {
    WAITING = 'WAITING',
    STARTING = 'STARTING',
    PLAYING = 'PLAYING',
    ATTACKING = 'ATTACKING',
    DEFENDING = 'DEFENDING',
    ENDED = 'ENDED'
}

/**
 * Card interface
 */
export interface ICard {
    id: string;
    name: string;
    type: CardType;
    cost?: number;
    mentalCost: number;
    plusLevel?: number;
    attribute?: string;
    defense?: number;
    damage?: number;
    healthDamage?: number;
    mentalDamage?: number;
    effect?: CardEffect;
    description?: string;
}

/**
 * Debuff interface
 */
export interface IDebuff {
    type: DebuffType;
    duration: number; // -1 for permanent
    value?: number; // Optional value for effects like damage increase %
}

/**
 * Player interface (minimal shared definition)
 */
export interface IPlayerState {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    mentalPower: number;
    maxMentalPower: number;
    isAlive: boolean;
    isReady: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
