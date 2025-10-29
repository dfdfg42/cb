/**
 * Game Constants
 * 
 * All game-related constants should be defined here for easy configuration
 * and consistency across the server codebase.
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

/**
 * Angel event healing amounts
 */
export const ANGEL_HEAL_AMOUNT = 10;
export const ANGEL_MENTAL_RESTORE_AMOUNT = 10;

/**
 * Request processing
 */
export const PROCESSED_REQUEST_TTL = 60 * 60 * 1000; // 1 hour
export const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

/**
 * Server configuration
 */
export const DEFAULT_PORT = 3001;
export const CORS_ORIGIN = "http://localhost:3000";

/**
 * ID generation prefixes
 */
export const ROOM_ID_PREFIX = "room_";
export const PLAYER_ID_PREFIX = "player_";
export const ATTACK_ID_PREFIX = "atk_";
export const REQUEST_ID_PREFIX = "srvreq_";

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
    ANGEL_HEAL_AMOUNT,
    ANGEL_MENTAL_RESTORE_AMOUNT,
    
    // Request processing
    PROCESSED_REQUEST_TTL,
    CLEANUP_INTERVAL,
    
    // Server
    DEFAULT_PORT,
    CORS_ORIGIN,
    
    // IDs
    ROOM_ID_PREFIX,
    PLAYER_ID_PREFIX,
    ATTACK_ID_PREFIX,
    REQUEST_ID_PREFIX,
} as const;
