// 카드 속성 타입
export enum AttributeType {
  NONE = 'none',
  FIRE = 'fire',
  WATER = 'water',
  LIGHT = 'light',
  DARK = 'dark',
  EARTH = 'earth'
}

// 카드 타입
export enum CardType {
  WEAPON = 'weapon',
  MIRACLE = 'miracle',
  FIELD_MAGIC = 'field_magic'
}

// 기본 카드 인터페이스
export interface Card {
  id: string;
  name: string;
  type: CardType;
  attribute: AttributeType;
  description: string;
  image?: string;
}

// 필드 마법 효과
export interface FieldMagicEffect {
  probability: number;
  action: string;
  effect: string;
}

// 필드 마법 카드
export interface FieldMagicCard extends Card {
  effects: FieldMagicEffect[];
}

// 무기 카드
export interface WeaponCard extends Card {
  attack: number;
  plusLevel?: number;
  specialEffects?: string[];
}

// 기적(마법) 카드
export interface MiracleCard extends Card {
  attack?: number;
  mpCost: number;
  specialEffects?: string[];
  isRepeatable: boolean;
}

// 플레이어 상태
export interface PlayerState {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  mentalPower: number;
  maxMentalPower: number;
  cards: Card[];
  debuffs: string[];
  isAlive: boolean;
  isReady: boolean;
  attribute: AttributeType;
}

// 게임 페이즈
export enum GamePhase {
  WAITING = 'waiting',
  DRAW = 'draw',
  ATTACK = 'attack',
  DEFENSE = 'defense',
  CHAIN_REACTION = 'chain_reaction',
  FIELD_MAGIC = 'field_magic',
  END_TURN = 'end_turn'
}

// 게임 상태
export interface GameState {
  players: PlayerState[];
  currentTurn: number;
  currentPlayer: string;
  activeFieldMagic?: FieldMagicCard;
  turnCount: number;
  phase: GamePhase;
}