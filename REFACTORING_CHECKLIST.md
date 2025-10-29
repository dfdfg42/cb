# 🔧 리팩토링 체크리스트

## 진행 상태
- 📝 TODO: 작업 대기
- 🚧 IN PROGRESS: 작업 중
- ✅ DONE: 완료
- ⏭️ SKIP: 건너뛰기

---

## Phase 1: 기반 작업 (Foundation)

### 1.1 상수 및 설정 파일 생성
- [x] ✅ `server/constants/GameConstants.ts` 생성
  - [x] ✅ 게임 기본 설정 (체력, 정신력, 초기 카드 수 등)
  - [x] ✅ 타임아웃 설정 (방어 응답 시간 등)
  - [x] ✅ 확률 설정 (이벤트 발생 확률 등)
  - [x] ✅ 턴 임계값 설정
- [x] ✅ `src/constants/GameConstants.ts` 생성 (클라이언트용)
  - [x] ✅ 서버 상수와 동기화

### 1.2 에러 코드 표준화
- [x] ✅ `server/constants/ErrorCodes.ts` 생성
  - [x] ✅ 에러 코드 enum 정의
  - [x] ✅ 에러 메시지 매핑
- [x] ✅ `server/utils/ErrorHandler.ts` 생성
  - [x] ✅ 에러 핸들링 유틸리티 클래스
  - [x] ✅ 로깅 메서드
  - [x] ✅ 에러 응답 포맷팅

### 1.3 타입 정의 개선
- [x] ✅ 서버 이벤트 타입 정의 (`server/types/events.ts`)
  - [x] ✅ PlayerAttackEvent
  - [x] ✅ PlayerDefendEvent
  - [x] ✅ RoomEvent
  - [x] ✅ GameActionEvent
  - [x] ✅ 모든 소켓 이벤트 타입 정의
- [ ] 📝 공유 타입 검증 (`shared/validators/`)
  - [ ] CardValidator
  - [ ] AttackValidator
  - [ ] DefenseValidator

---

## Phase 2: Server 리팩토링 (최우선)

### 2.1 Socket 핸들러 분리
- [ ] 📝 `server/handlers/` 디렉토리 생성
- [ ] 📝 `server/handlers/ConnectionHandler.ts`
  - [ ] connection 이벤트
  - [ ] disconnect 이벤트
  - [ ] 재연결 로직
- [ ] 📝 `server/handlers/RoomEventHandler.ts`
  - [ ] create-room
  - [ ] join-room
  - [ ] leave-room
  - [ ] toggle-ready
- [ ] 📝 `server/handlers/GameEventHandler.ts`
  - [ ] start-game
  - [ ] game-action
  - [ ] turn-start
  - [ ] turn-end
- [ ] 📝 `server/handlers/CombatEventHandler.ts`
  - [ ] player-attack
  - [ ] player-defend
  - [ ] attack-resolved
  - [ ] defend-request

### 2.2 비즈니스 로직 분리
- [ ] 📝 `server/services/AttackResolver.ts` 생성
  - [ ] resolveAttack() - 공격 해결 로직
  - [ ] calculateFinalDamage() - 최종 데미지 계산
  - [ ] applySpecialEffects() - 특수 효과 적용
- [ ] 📝 `server/services/PlayerStateManager.ts` 생성
  - [ ] ensurePlayerStates()
  - [ ] initializePlayerStates()
  - [ ] updatePlayerState()
  - [ ] getPlayerState()
- [ ] 📝 `server/services/TurnManager.ts` 생성 (서버용)
  - [ ] advanceTurn()
  - [ ] getCurrentPlayer()
  - [ ] validatePlayerTurn()
- [ ] 📝 `server/models/AttackQueue.ts` 개선
  - [ ] 타입 안정성 강화
  - [ ] 메서드 추가 (필요시)

### 2.3 Server.ts 리팩토링
- [ ] 📝 기존 `server.ts` 백업 생성
- [ ] 🚧 핸들러들을 새로운 클래스로 이동
  - [ ] ConnectionHandler 통합
  - [ ] RoomEventHandler 통합
  - [ ] GameEventHandler 통합
  - [ ] CombatEventHandler 통합
- [ ] 🚧 비즈니스 로직을 서비스로 이동
  - [ ] processNextAttack() → AttackResolver
  - [ ] resolveAttackFromQueue() → AttackResolver
- [ ] 🚧 중복 코드 제거
  - [ ] playerStates 초기화 로직 통합
  - [ ] 에러 처리 표준화
- [ ] 🚧 Server.ts를 orchestrator로 재구성
  - [ ] 각 핸들러 인스턴스 생성
  - [ ] 라우팅만 담당

---

## Phase 3: Client 리팩토링

### 3.1 GameManager 책임 분리
- [ ] 📝 `src/game/CombatManager.ts` 생성
  - [ ] selectAttackCards()
  - [ ] selectDefenseCards()
  - [ ] applyDamage()
  - [ ] resolveAttack()
- [ ] 📝 `src/game/CardValidator.ts` 생성
  - [ ] canPlayCards()
  - [ ] validateAttackCards()
  - [ ] validateDefenseCards()
  - [ ] validateManaCost()
- [ ] 📝 `src/game/EventEmitter.ts` 생성
  - [ ] 이벤트 발행 시스템
  - [ ] 구독/구독 해제
- [ ] 🚧 GameManager.ts 리팩토링
  - [ ] 전투 로직 → CombatManager로 이동
  - [ ] 검증 로직 → CardValidator로 이동
  - [ ] 게임 흐름 제어만 담당하도록 축소

### 3.2 UIManager 의존성 주입
- [ ] 📝 `src/ui/IUIManager.ts` 인터페이스 생성
- [ ] 🚧 GameManager에 UIManager 주입
  - [ ] 생성자에서 주입받도록 변경
  - [ ] 전역 싱글톤 제거
- [ ] 🚧 TurnManager에 UIManager 주입
- [ ] 🚧 CombatManager에 UIManager 주입

### 3.3 NetworkManager 개선
- [ ] 📝 Socket.IO 클라이언트로 전환 검토
  - [ ] WebSocket vs Socket.IO 호환성 확인
  - [ ] 필요시 Socket.IO 클라이언트로 마이그레이션
- [ ] 📝 타입 안정성 강화
  - [ ] 이벤트 타입 정의
  - [ ] Type guard 추가

---

## Phase 4: 공유 로직 및 검증

### 4.1 공유 디렉토리 생성
- [ ] 📝 `shared/` 디렉토리 생성
- [ ] 📝 `shared/validators/CardValidator.ts`
  - [ ] 카드 사용 규칙 검증
  - [ ] 클라이언트/서버 공통 사용
- [ ] 📝 `shared/validators/CombatValidator.ts`
  - [ ] 공격/방어 규칙 검증
- [ ] 📝 `shared/types/` 공통 타입 정의
- [ ] 📝 `shared/constants/` 공통 상수

### 4.2 검증 로직 통합
- [ ] 🚧 서버에서 공유 validator 사용
- [ ] 🚧 클라이언트에서 공유 validator 사용
- [ ] 🚧 중복 검증 코드 제거

---

## Phase 5: 테스트 작성

### 5.1 유닛 테스트 인프라
- [ ] 📝 Jest 또는 Vitest 설정
- [ ] 📝 테스트 디렉토리 구조 생성
  - [ ] `server/__tests__/`
  - [ ] `src/__tests__/`

### 5.2 서버 테스트
- [ ] 📝 CombatService 테스트
- [ ] 📝 DamageCalculator 테스트
- [ ] 📝 EffectProcessor 테스트
- [ ] 📝 RoomManager 테스트
- [ ] 📝 AttackResolver 테스트
- [ ] 📝 PlayerStateManager 테스트

### 5.3 클라이언트 테스트
- [ ] 📝 CardValidator 테스트
- [ ] 📝 CombatManager 테스트
- [ ] 📝 TurnManager 테스트

### 5.4 통합 테스트
- [ ] 📝 Socket 통신 테스트
- [ ] 📝 전투 시나리오 테스트
- [ ] 📝 특수 효과 테스트 (reflect, bounce)

---

## Phase 6: 문서화 및 정리

### 6.1 코드 문서화
- [ ] 📝 각 서비스 클래스에 JSDoc 추가
- [ ] 📝 복잡한 로직에 주석 추가
- [ ] 📝 API 문서 작성

### 6.2 README 업데이트
- [ ] 📝 프로젝트 구조 설명
- [ ] 📝 아키텍처 다이어그램
- [ ] 📝 개발 가이드

### 6.3 정리 작업
- [ ] 📝 사용하지 않는 파일 제거
- [ ] 📝 백업 파일 제거 (server.ts.backup 등)
- [ ] 📝 TODO 주석 정리
- [ ] 📝 콘솔 로그 정리

---

## Phase 7: 성능 및 최적화

### 7.1 성능 개선
- [ ] 📝 불필요한 emit 최소화
- [ ] 📝 중복 계산 제거
- [ ] 📝 메모이제이션 적용 (필요시)

### 7.2 보안 강화
- [ ] 📝 입력 검증 강화
- [ ] 📝 클라이언트 데이터 신뢰하지 않기
- [ ] 📝 Rate limiting 추가

---

## 진행 방법

1. **한 번에 하나씩**: 각 체크박스를 순서대로 진행
2. **커밋 단위**: 각 섹션(예: 1.1, 2.1) 완료 시 커밋
3. **테스트**: 각 Phase 완료 시 기존 기능 동작 확인
4. **리뷰**: 각 Phase 완료 시 코드 리뷰

## 시작하기

다음 명령으로 체크리스트를 확인하세요:
```bash
# 파일 열기
code REFACTORING_CHECKLIST.md
```

**다음 작업**: Phase 1.1부터 시작하시겠습니까?
