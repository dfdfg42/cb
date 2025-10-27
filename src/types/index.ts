// 카드 타입
export enum CardType {
    ATTACK = 'attack',
    DEFENSE = 'defense',
    MAGIC = 'magic',
    FIELD_MAGIC = 'field-magic'
}

// 카드 특수 효과
export enum CardEffect {
    NONE = 'none',
    REFLECT = 'reflect',      // 되받아치기
    BOUNCE = 'bounce',        // 튕기기
    ON_DAMAGE = 'on-damage',  // 피해 시 발동
    HEAL = 'heal',            // 회복
    BUFF = 'buff',            // 버프
    DEBUFF = 'debuff'         // 디버프
}

// 카드 인터페이스
export interface Card {
    id: string;
    name: string;
    type: CardType;
    healthDamage: number;      // 체력 공격력
    mentalDamage: number;      // 정신 공격력
    defense: number;           // 방어력
    mentalCost: number;        // 정신력 소모량 (마법 카드)
    plusLevel: number;         // + 접두사 레벨 (0이면 없음)
    effect: CardEffect;
    description: string;
    image?: string;
}

// 플레이어 인터페이스
export interface Player {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    mentalPower: number;
    maxMentalPower: number;
    cards: Card[];
    isAlive: boolean;
    isReady: boolean;
    debuffs: Debuff[];
}

// 디버프 타입
export enum DebuffType {
    CARD_DECAY = 'card-decay',           // 매 턴 카드 1장 소멸
    RANDOM_TARGET = 'random-target',     // 공격 대상 랜덤 지정
    MENTAL_DRAIN = 'mental-drain',       // 정신력 회복량 감소 / MP 고갈 관련 디버프
    DAMAGE_INCREASE = 'damage-increase'  // 받는 데미지 증가
}

// 디버프 인터페이스
export interface Debuff {
    type: DebuffType;
    duration: number;  // -1이면 영구
    value?: number;
}

// 필드 마법 인터페이스
export interface FieldMagic {
    id: string;
    name: string;
    casterId: string;  // 시전자 ID
    effect: string;
    duration: number;  // 턴 수
}

// 게임 상태
export enum GameState {
    WAITING = 'waiting',
    STARTING = 'starting',
    PLAYING = 'playing',
    ATTACKING = 'attacking',
    DEFENDING = 'defending',
    ENDED = 'ended'
}

// 게임 타입
export enum GameType {
    NORMAL = 'normal',
    RANKED = 'ranked'
}

// 게임 세션 인터페이스
export interface GameSession {
    id: string;
    type: GameType;
    players: Player[];
    currentTurn: number;
    currentPlayerId: string;
    attackerId?: string;
    defenderId?: string;
    attackCards: Card[];
    defenseCards: Card[];
    fieldMagic?: FieldMagic;
    state: GameState;
    deck: Card[];
}

// 이벤트 타입
export enum EventType {
    DEVIL = 'devil',
    ANGEL = 'angel'
}

// 특수 이벤트 인터페이스
export interface SpecialEvent {
    type: EventType;
    targetPlayerId: string;
    effect: string;
    value: number;
}

// 액션 타입
export enum ActionType {
    PLAY_CARD = 'play-card',
    SELECT_TARGET = 'select-target',
    CONFIRM_ACTION = 'confirm-action',
    END_TURN = 'end-turn',
    READY = 'ready',
    JOIN_ROOM = 'join-room',
    LEAVE_ROOM = 'leave-room'
}

// 액션 인터페이스
export interface GameAction {
    type: ActionType;
    playerId: string;
    cardIds?: string[];
    targetId?: string;
    data?: any;
}

// 로그 메시지 타입
export enum LogType {
    INFO = 'info',
    ATTACK = 'attack',
    DEFENSE = 'defense',
    DAMAGE = 'damage',
    HEAL = 'heal',
    EVENT = 'event',
    DEATH = 'death'
}

// 로그 메시지 인터페이스
export interface LogMessage {
    type: LogType;
    message: string;
    timestamp: number;
}

// 서버-클라이언트 통신 메시지
export interface ServerMessage {
    event: string;
    data: any;
}

export interface ClientMessage {
    action: string;
    data: any;
}

// 화면 타입
export enum Screen {
    MAIN = 'main-screen',
    LOBBY = 'lobby-screen',
    WAITING = 'waiting-screen',
    GAME = 'game-screen',
    HELP = 'help-screen',
    GAME_OVER = 'game-over-screen'
}
