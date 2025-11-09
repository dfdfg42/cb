/**
 * Game Constants (Client-side)
 * 
 * Client-side game constants. Should be kept in sync with server constants
 * for consistent game behavior.
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
 * Devil event damage ranges and probabilities
 */
export const DEVIL_DAMAGE_LOW = 10;
export const DEVIL_DAMAGE_MEDIUM = 20;
export const DEVIL_DAMAGE_HIGH = 30;
export const DEVIL_CARD_REMOVAL_COUNT = 2;
export const DEVIL_EFFECT_PROBABILITY_LOW = 0.3; // 30% chance for low damage
export const DEVIL_EFFECT_PROBABILITY_MEDIUM = 0.6; // 60% cumulative for medium
export const DEVIL_EFFECT_PROBABILITY_HIGH = 0.9; // 90% cumulative for high

/**
 * Angel event healing amounts
 */
export const ANGEL_HEAL_AMOUNT = 10;
export const ANGEL_MENTAL_RESTORE_AMOUNT = 10;
export const ANGEL_EFFECT_PROBABILITY = 0.5; // 50% mental, 50% health

/**
 * UI settings
 */
export const MAX_LOG_MESSAGES = 20;
export const LOG_AUTO_SCROLL = true;

/**
 * Network settings
 */
export const SERVER_URL = "http://localhost:3001";
export const RECONNECT_MAX_ATTEMPTS = 5;
export const RECONNECT_BASE_DELAY = 1000; // Base delay in ms (exponential backoff)

/**
 * Card validation
 */
export const MAX_MAGIC_CARDS_PER_TURN = 1;
export const FIELD_MAGIC_MUST_BE_ALONE = true;

/**
 * Game constants as a single object (for importing all at once)
 */
export const GameConstants = {
    // Player stats
    PLAYER_INITIAL_HEALTH,
    PLAYER_INITIAL_MENTAL_POWER,
    PLAYER_MAX_HEALTH,
    PLAYER_MAX_MENTAL_POWER,
    
    // Game setup
    INITIAL_CARD_COUNT,
    MIN_PLAYERS_TO_START,
    MAX_PLAYERS_PER_ROOM,
    
    // Combat
    DEFEND_TIMEOUT_MS,
    MAX_CHAIN_DEPTH,
    
    // Events
    SPECIAL_EVENT_TURN_THRESHOLD,
    DEVIL_EVENT_PROBABILITY,
    ANGEL_EVENT_PROBABILITY,
    DEVIL_DAMAGE_LOW,
    DEVIL_DAMAGE_MEDIUM,
    DEVIL_DAMAGE_HIGH,
    DEVIL_CARD_REMOVAL_COUNT,
    DEVIL_EFFECT_PROBABILITY_LOW,
    DEVIL_EFFECT_PROBABILITY_MEDIUM,
    DEVIL_EFFECT_PROBABILITY_HIGH,
    ANGEL_HEAL_AMOUNT,
    ANGEL_MENTAL_RESTORE_AMOUNT,
    ANGEL_EFFECT_PROBABILITY,
    
    // UI
    MAX_LOG_MESSAGES,
    LOG_AUTO_SCROLL,
    
    // Network
    SERVER_URL,
    RECONNECT_MAX_ATTEMPTS,
    RECONNECT_BASE_DELAY,
    
    // Card validation
    MAX_MAGIC_CARDS_PER_TURN,
    FIELD_MAGIC_MUST_BE_ALONE,
} as const;
