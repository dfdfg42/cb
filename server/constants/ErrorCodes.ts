/**
 * Error Codes
 * 
 * Standardized error codes for the game server.
 * Each error has a unique code for easier debugging and client-side handling.
 */

export enum ErrorCode {
    // Room errors (1xxx)
    ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
    ROOM_FULL = 'ROOM_FULL',
    ROOM_ALREADY_PLAYING = 'ROOM_ALREADY_PLAYING',
    
    // Player errors (2xxx)
    PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
    PLAYER_NOT_HOST = 'PLAYER_NOT_HOST',
    PLAYER_NOT_IN_ROOM = 'PLAYER_NOT_IN_ROOM',
    PLAYER_NOT_TURN = 'PLAYER_NOT_TURN',
    PLAYER_INSUFFICIENT_MANA = 'PLAYER_INSUFFICIENT_MANA',
    
    // Game errors (3xxx)
    GAME_NOT_STARTED = 'GAME_NOT_STARTED',
    GAME_INSUFFICIENT_PLAYERS = 'GAME_INSUFFICIENT_PLAYERS',
    GAME_INVALID_ACTION = 'GAME_INVALID_ACTION',
    
    // Attack errors (4xxx)
    ATTACK_INVALID = 'ATTACK_INVALID',
    ATTACK_QUEUE_NOT_INITIALIZED = 'ATTACK_QUEUE_NOT_INITIALIZED',
    ATTACK_NOT_FOUND = 'ATTACK_NOT_FOUND',
    ATTACK_TARGET_NOT_FOUND = 'ATTACK_TARGET_NOT_FOUND',
    
    // Defense errors (5xxx)
    DEFENSE_INVALID = 'DEFENSE_INVALID',
    DEFENSE_NOT_YOUR_TURN = 'DEFENSE_NOT_YOUR_TURN',
    DEFENSE_REQUEST_NOT_FOUND = 'DEFENSE_REQUEST_NOT_FOUND',
    
    // Card errors (6xxx)
    CARD_INVALID = 'CARD_INVALID',
    CARD_INSUFFICIENT_COST = 'CARD_INSUFFICIENT_COST',
    
    // Network errors (7xxx)
    NETWORK_DISCONNECTED = 'NETWORK_DISCONNECTED',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    
    // Generic errors (9xxx)
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * Error messages mapped to error codes
 */
export const ErrorMessages: Record<ErrorCode, string> = {
    // Room errors
    [ErrorCode.ROOM_NOT_FOUND]: '방을 찾을 수 없습니다.',
    [ErrorCode.ROOM_FULL]: '방이 가득 찼습니다.',
    [ErrorCode.ROOM_ALREADY_PLAYING]: '게임이 이미 시작되었습니다.',
    
    // Player errors
    [ErrorCode.PLAYER_NOT_FOUND]: '플레이어를 찾을 수 없습니다.',
    [ErrorCode.PLAYER_NOT_HOST]: '호스트만 게임을 시작할 수 있습니다.',
    [ErrorCode.PLAYER_NOT_IN_ROOM]: '플레이어가 방에 없습니다.',
    [ErrorCode.PLAYER_NOT_TURN]: '현재 차례가 아닙니다.',
    [ErrorCode.PLAYER_INSUFFICIENT_MANA]: '마나가 부족합니다!',
    
    // Game errors
    [ErrorCode.GAME_NOT_STARTED]: '게임 중이 아닌 방입니다.',
    [ErrorCode.GAME_INSUFFICIENT_PLAYERS]: '게임을 시작하려면 최소 2명 이상의 플레이어가 필요합니다.',
    [ErrorCode.GAME_INVALID_ACTION]: '유효하지 않은 게임 액션입니다.',
    
    // Attack errors
    [ErrorCode.ATTACK_INVALID]: '유효하지 않은 공격입니다.',
    [ErrorCode.ATTACK_QUEUE_NOT_INITIALIZED]: '공격 큐가 초기화되지 않았습니다.',
    [ErrorCode.ATTACK_NOT_FOUND]: '공격을 찾을 수 없습니다.',
    [ErrorCode.ATTACK_TARGET_NOT_FOUND]: '타겟을 찾을 수 없습니다.',
    
    // Defense errors
    [ErrorCode.DEFENSE_INVALID]: '유효하지 않은 방어입니다.',
    [ErrorCode.DEFENSE_NOT_YOUR_TURN]: '당신이 방어할 공격이 아닙니다.',
    [ErrorCode.DEFENSE_REQUEST_NOT_FOUND]: '해당 방어 요청을 찾을 수 없습니다.',
    
    // Card errors
    [ErrorCode.CARD_INVALID]: '유효하지 않은 카드입니다.',
    [ErrorCode.CARD_INSUFFICIENT_COST]: '카드 비용이 부족합니다.',
    
    // Network errors
    [ErrorCode.NETWORK_DISCONNECTED]: '연결이 끊어졌습니다.',
    [ErrorCode.NETWORK_TIMEOUT]: '응답 시간이 초과되었습니다.',
    
    // Generic errors
    [ErrorCode.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.',
    [ErrorCode.INTERNAL_SERVER_ERROR]: '서버 내부 오류가 발생했습니다.',
};

/**
 * Error details for debugging
 */
export interface GameError {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp?: number;
}

/**
 * Create a standardized error object
 */
export function createError(
    code: ErrorCode,
    details?: any,
    customMessage?: string
): GameError {
    return {
        code,
        message: customMessage || ErrorMessages[code],
        details,
        timestamp: Date.now(),
    };
}
