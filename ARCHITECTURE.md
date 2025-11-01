# 🏗️ 프로젝트 아키텍처 가이드

## 📋 목차
1. [전체 구조](#전체-구조)
2. [서버 아키텍처](#서버-아키텍처)
3. [클라이언트 아키텍처](#클라이언트-아키텍처)
4. [공유 모듈](#공유-모듈)
5. [데이터 흐름](#데이터-흐름)
6. [설계 패턴](#설계-패턴)

---

## 전체 구조

```
cb/
├── server/              # 백엔드 (Node.js + Express + Socket.IO)
│   ├── server.ts       # 서버 진입점 (127줄)
│   ├── handlers/       # 이벤트 핸들러 (Handler Pattern)
│   ├── services/       # 비즈니스 로직
│   ├── models/         # 데이터 모델
│   ├── constants/      # 서버 상수
│   ├── utils/          # 유틸리티
│   ├── types/          # 타입 정의
│   └── __tests__/      # 서버 테스트
│
├── src/                # 프론트엔드 (TypeScript + Webpack)
│   ├── main.ts         # 클라이언트 진입점
│   ├── game/           # 게임 로직 레이어
│   │   ├── GameManager.ts      # 게임 상태 관리 (376줄)
│   │   ├── CombatManager.ts    # 전투 로직 (329줄)
│   │   ├── CardValidator.ts    # 카드 검증 (165줄)
│   │   ├── EventEmitter.ts     # 이벤트 시스템 (76줄)
│   │   ├── DamageCalculator.ts # 데미지 계산
│   │   ├── DebuffManager.ts    # 디버프 관리
│   │   ├── FieldEffectProcessor.ts # 필드 효과
│   │   ├── FieldMagicManager.ts    # 필드 마법
│   │   └── TurnManager.ts      # 턴 관리
│   │
│   ├── ui/             # UI 레이어 (Dependency Inversion)
│   │   ├── IUIManager.ts       # UI 인터페이스
│   │   ├── UIManager.ts        # UI 구현체
│   │   ├── CardComponent.ts    # 카드 컴포넌트
│   │   ├── PlayerComponent.ts  # 플레이어 컴포넌트
│   │   └── CombatUI.ts         # 전투 UI
│   │
│   ├── network/        # 네트워크 레이어
│   │   └── SocketClient.ts     # Socket.IO 클라이언트
│   │
│   ├── data/           # 데이터
│   │   └── cards.ts            # 카드 데이터베이스
│   │
│   ├── audio/          # 오디오 시스템
│   │   └── SoundManager.ts
│   │
│   └── __tests__/      # 클라이언트 테스트
│
├── shared/             # 클라이언트-서버 공유 모듈
│   ├── constants/      # 공유 상수
│   ├── types/          # 공유 타입 정의
│   ├── validators/     # 공유 검증 로직
│   ├── index.ts        # 통합 export
│   └── __tests__/      # 공유 모듈 테스트
│
└── scripts/            # 빌드/테스트 스크립트
```

---

## 서버 아키텍처

### 계층 구조

```
┌─────────────────────────────────────┐
│     server.ts (Orchestrator)       │ ← 127줄로 축소
│  - Express 설정                     │
│  - Socket.IO 설정                   │
│  - 핸들러 등록                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Handlers Layer              │ ← Handler Pattern
│  - ConnectionHandler                │
│  - RoomEventHandler                 │
│  - GameEventHandler                 │
│  - CombatEventHandler               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Services Layer               │ ← 비즈니스 로직
│  - RoomManager                      │
│  - CombatService                    │
│  - DamageCalculator                 │
│  - EffectProcessor                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Models Layer                │ ← 데이터 모델
│  - AttackQueue                      │
│  - Room, Player, Card               │
└─────────────────────────────────────┘
```

### 주요 컴포넌트

#### 1. server.ts (진입점)
- **책임**: 서버 초기화 및 핸들러 등록
- **패턴**: Facade Pattern
- **코드 감소**: 830줄 → 127줄 (85% 감소)

```typescript
// 예시 구조
class Server {
  private io: SocketIO.Server;
  private handlers: Handler[];
  
  constructor() {
    this.setupExpress();
    this.setupSocketIO();
    this.registerHandlers();
  }
}
```

#### 2. Handlers (이벤트 처리)
각 핸들러는 **단일 책임 원칙(SRP)** 을 따릅니다:

**ConnectionHandler** (92줄)
- Socket 연결/해제
- 플레이어 생성/제거

**RoomEventHandler** (246줄)
- 방 생성/입장/퇴장
- 플레이어 준비 상태

**GameEventHandler** (268줄)
- 게임 시작/종료
- 턴 진행

**CombatEventHandler** (353줄)
- 카드 사용
- 전투 로직 처리
- 반사/바운스 체인

#### 3. Services (비즈니스 로직)

**RoomManager**
- 방 관리 (생성, 삭제, 조회)
- 플레이어 입장/퇴장
- 게임 상태 동기화

**CombatService**
- 전투 시퀀스 처리
- 공격 큐 관리
- 데미지 적용

**DamageCalculator**
- 데미지 계산 로직
- 반사/바운스 처리
- 디버프 효과 적용

**EffectProcessor**
- 카드 효과 처리
- 버프/디버프 적용
- 필드 마법 효과

---

## 클라이언트 아키텍처

### 계층 구조 (MVC + Event-Driven)

```
┌─────────────────────────────────────┐
│          main.ts (Entry)            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      GameManager (Controller)       │ ← 376줄로 축소
│  - 게임 상태 관리                    │
│  - 이벤트 조율                       │
│  - 의존성 주입                       │
└─────────────────────────────────────┘
       ↓              ↓              ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ CombatManager│ │EventEmitter  │ │CardValidator │
│   (329줄)    │ │   (76줄)     │ │   (165줄)    │
└──────────────┘ └──────────────┘ └──────────────┘
       ↓
┌─────────────────────────────────────┐
│      UIManager (View) - DIP         │
│  - IUIManager 인터페이스            │
│  - 구현체: UIManager                │
└─────────────────────────────────────┘
       ↓
┌─────────────────────────────────────┐
│         UI Components               │
│  - CardComponent                    │
│  - PlayerComponent                  │
│  - CombatUI                         │
└─────────────────────────────────────┘
```

### 주요 컴포넌트

#### 1. GameManager (게임 상태 관리)
**리팩토링 전**: 597줄 (모든 로직 포함)  
**리팩토링 후**: 376줄 (37% 감소)

**책임**:
- 게임 상태 관리
- 네트워크 이벤트 처리
- 의존성 주입 및 조율

**위임된 책임**:
- 전투 로직 → `CombatManager`
- 카드 검증 → `CardValidator`
- 이벤트 발행 → `EventEmitter`

```typescript
class GameManager {
  private combatManager: CombatManager;
  private cardValidator: CardValidator;
  private eventEmitter: EventEmitter;
  private uiManager: IUIManager; // DIP!
  
  constructor(uiManager: IUIManager) {
    this.uiManager = uiManager;
    this.combatManager = new CombatManager(this);
    this.cardValidator = new CardValidator();
    this.eventEmitter = new EventEmitter();
  }
}
```

#### 2. CombatManager (전투 로직 - 329줄)
**책임**:
- 공격 시퀀스 처리
- 반사(Reflect) 체인
- 바운스(Bounce) 체인
- 멘탈 파워 관리

**핵심 메서드**:
```typescript
class CombatManager {
  // 공격 시퀀스 시작
  startAttackSequence(attackData: AttackData): void
  
  // 반사 처리
  handleReflectDamage(reflectData: ReflectData): void
  
  // 바운스 처리
  handleBounceDamage(bounceData: BounceData): void
  
  // 멘탈 파워 전이
  transferMentalPower(from: Player, to: Player, amount: number): void
}
```

#### 3. CardValidator (카드 검증 - 165줄)
**책임**:
- 카드 사용 가능 여부 검증
- 타겟 유효성 검증
- 비용 검증

**검증 규칙**:
- 멘탈 파워 충분 여부
- 타겟 생존 여부
- 카드 타입별 조건

#### 4. EventEmitter (이벤트 시스템 - 76줄)
**패턴**: Pub/Sub Pattern

```typescript
class EventEmitter {
  on(event: string, callback: Function): void
  off(event: string, callback: Function): void
  emit(event: string, data: any): void
}

// 사용 예시
eventEmitter.on('damageDealt', (data) => {
  console.log(`${data.target} took ${data.damage} damage`);
});
```

#### 5. UIManager (UI 추상화 - DIP)
**패턴**: Dependency Inversion Principle

```typescript
// 인터페이스 정의
interface IUIManager {
  updatePlayerInfo(playerId: number, data: PlayerInfo): void;
  showCombatLog(message: string): void;
  highlightCard(cardId: string): void;
}

// 구현체
class UIManager implements IUIManager {
  // 실제 DOM 조작
}

// 의존성 주입
const uiManager = new UIManager();
const gameManager = new GameManager(uiManager);
```

---

## 공유 모듈

### shared/ 디렉토리 구조

```
shared/
├── constants/
│   └── GameConstants.ts    # 게임 상수 (클라이언트-서버 공유)
│
├── types/
│   └── index.ts            # 타입 정의
│       - CardType, CardEffect
│       - DebuffType
│       - Card, Player, GameState
│
├── validators/
│   └── CardValidator.ts    # 공유 검증 로직
│
├── index.ts                # 통합 export
└── __tests__/              # 공유 모듈 테스트
```

### 공유 원칙

**DRY (Don't Repeat Yourself)**
```typescript
// ❌ 이전: 클라이언트/서버에 중복 코드
// client: const MAX_PLAYERS = 4;
// server: const MAX_PLAYERS = 4;

// ✅ 이후: 공유 상수
// shared/constants/GameConstants.ts
export const MAX_PLAYERS = 4;
```

**Type Safety**
```typescript
// shared/types/index.ts
export enum CardType {
  ATTACK = 'attack',
  DEFENSE = 'defense',
  MAGIC = 'magic'
}

// 클라이언트와 서버 모두 동일한 타입 사용
```

---

## 데이터 흐름

### 1. 게임 시작 흐름

```
Client                Server
  │                     │
  ├─ createRoom() ────→ │
  │                     ├─ RoomEventHandler
  │                     ├─ RoomManager.createRoom()
  │ ←──── roomInfo ──── │
  │                     │
  ├─ joinRoom() ───────→ │
  │                     ├─ RoomEventHandler
  │                     ├─ RoomManager.addPlayer()
  │ ←── playerJoined ── │
  │                     │
  ├─ playerReady() ────→ │
  │                     ├─ GameEventHandler
  │ ←── gameStart ───── │ (모든 플레이어 준비 시)
```

### 2. 전투 흐름

```
Client                          Server
  │                               │
  ├─ useCard(cardId, target) ───→ │
  │                               ├─ CombatEventHandler
  │                               ├─ CardValidator.validate()
  │                               ├─ CombatService.processAttack()
  │                               │
  │ ←───────── attackStart ───────┤
  │                               │
  │ ←───────── damageDealt ───────┤
  │                               │
  │                (반사 발생)    │
  │ ←───────── reflectDamage ─────┤
  │                               │
  │                (바운스 발생)  │
  │ ←───────── bounceDamage ──────┤
  │                               │
  │ ←───────── attackComplete ────┤
  │                               │
  │ ←───────── turnEnd ───────────┤
```

### 3. 상태 동기화

```
Server State Change
       ↓
  Emit to Room
       ↓
All Clients Receive
       ↓
Update Local State
       ↓
Re-render UI
```

---

## 설계 패턴

### 1. Handler Pattern (서버)
**목적**: 이벤트 처리 로직 분리

```typescript
interface IHandler {
  register(io: SocketIO.Server): void;
}

class ConnectionHandler implements IHandler {
  register(io: SocketIO.Server): void {
    io.on('connection', (socket) => {
      // 연결 처리
    });
  }
}
```

**장점**:
- 단일 책임 원칙 (SRP)
- 확장 용이
- 테스트 가능

### 2. Dependency Inversion (클라이언트)
**목적**: UI 레이어 추상화

```typescript
// High-level module
class GameManager {
  constructor(private uiManager: IUIManager) {} // 인터페이스 의존
}

// Low-level module
class UIManager implements IUIManager {
  // 구체적인 구현
}
```

**장점**:
- UI 교체 가능 (DOM → Canvas)
- 테스트 용이 (Mock UI)
- 결합도 감소

### 3. Pub/Sub Pattern (이벤트)
**목적**: 컴포넌트 간 느슨한 결합

```typescript
// 발행
eventEmitter.emit('damageDealt', { target: 1, damage: 30 });

// 구독
eventEmitter.on('damageDealt', (data) => {
  combatUI.showDamage(data);
});
```

**장점**:
- 컴포넌트 독립성
- 확장 용이
- 디버깅 용이

### 4. Facade Pattern (서버 진입점)
**목적**: 복잡한 시스템 단순화

```typescript
class Server {
  // 복잡한 초기화 로직을 간단한 인터페이스로 제공
  start(): void {
    this.setupExpress();
    this.setupSocketIO();
    this.registerHandlers();
    this.listen();
  }
}
```

### 5. Wrapper Pattern (공유 모듈)
**목적**: 클라이언트와 서버 로직 조화

```typescript
// shared/validators/CardValidator.ts (공통 로직)
export class SharedCardValidator {
  validateCost(card: Card, mentalPower: number): boolean {
    return mentalPower >= card.cost;
  }
}

// src/game/CardValidator.ts (클라이언트 확장)
export class CardValidator {
  private shared = new SharedCardValidator();
  
  validate(card: Card, gameState: GameState): boolean {
    // 공유 검증
    if (!this.shared.validateCost(card, gameState.mentalPower)) {
      return false;
    }
    
    // 클라이언트 전용 검증
    return this.validateUI(card);
  }
}
```

---

## 리팩토링 결과

### 코드 품질 지표

| 지표 | 리팩토링 전 | 리팩토링 후 | 개선율 |
|------|------------|------------|--------|
| **서버 진입점** | 830줄 | 127줄 | 85% ↓ |
| **클라이언트 관리자** | 597줄 | 376줄 | 37% ↓ |
| **테스트 커버리지** | 0% | 37개 케이스 | ∞ |
| **모듈 수** | 2개 | 14개 | 600% ↑ |
| **순환 의존성** | 3개 | 0개 | 100% ↓ |

### OOP 원칙 적용

✅ **SRP (Single Responsibility Principle)**
- 각 클래스는 하나의 책임만 가짐

✅ **DIP (Dependency Inversion Principle)**
- 추상화(인터페이스)에 의존

✅ **DRY (Don't Repeat Yourself)**
- 공유 모듈로 중복 제거

✅ **Open/Closed Principle**
- 확장에 열려있고 수정에 닫혀있음

---

## 다음 단계

### Phase 7: 성능 최적화 (선택사항)
- [ ] 메모리 프로파일링
- [ ] 네트워크 최적화
- [ ] 렌더링 최적화

### 추가 개선사항
- [ ] E2E 테스트 추가
- [ ] CI/CD 파이프라인
- [ ] 모니터링 시스템
- [ ] 문서화 자동화

---

**작성일**: 2025-11-01  
**작성자**: GitHub Copilot  
**버전**: 1.0.0
