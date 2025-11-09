/**
 * Shared Game Constants
 * 
 * Game constants used by both client and server.
 * This ensures consistency across the entire application.
 */

/**
 * Player initial stats
 */
export const PLAYER_INITIAL_HEALTH = 100;
export const PLAYER_INITIAL_MENTAL_POWER = 100;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_MENTAL_POWER = 100;

/**
 * Game setup
 */
export const INITIAL_CARD_COUNT = 9;
export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS_PER_ROOM = 4;

/**
 * Combat settings
 */
export const DEFEND_TIMEOUT_MS = 20000; // 20 seconds to respond to attack
export const MAX_CHAIN_DEPTH = 6; // Maximum reflect/bounce chain depth

/**
 * Turn and event thresholds
 */
export const SPECIAL_EVENT_TURN_THRESHOLD = 50; // Turn when special events start
export const DEVIL_EVENT_PROBABILITY = 0.1; // 10% chance per turn after threshold
export const ANGEL_EVENT_PROBABILITY = 0.05; // 5% chance per turn

/**
 * Devil event damage ranges
 */
export const DEVIL_DAMAGE_LOW = 10;
export const DEVIL_DAMAGE_MEDIUM = 20;
export const DEVIL_DAMAGE_HIGH = 30;
export const DEVIL_CARD_REMOVAL_COUNT = 2;
export const DEVIL_EFFECT_PROBABILITY_LOW = 0.33; // 33% chance for low damage
export const DEVIL_EFFECT_PROBABILITY_MEDIUM = 0.66; // 66% cumulative for medium
export const DEVIL_EFFECT_PROBABILITY_HIGH = 0.9; // 90% cumulative for high

/**
 * Angel event healing amounts
 */
export const ANGEL_HEAL_AMOUNT = 10;
export const ANGEL_MENTAL_RESTORE_AMOUNT = 10;

/**
 * Field magic durations
 */
export const FIELD_MAGIC_DURATION = 3; // Number of turns a field magic lasts

/**
 * Card validation constants
 */
export const MAX_MAGIC_CARDS_PER_PLAY = 1; // Only 1 magic card can be played at once
export const MAX_NORMAL_ATTACK_CARDS = 1; // Normal attacks can only be 1 card
