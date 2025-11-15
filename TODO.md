# cards.csv 기반 우선 TODO

cards.csv에 포함된 새로운 카드 타입/툴팁 정보를 기준으로 현재 코드베이스(`src/types/index.ts`, `shared/types/index.ts`, `server/types/index.ts`, `src/data/cards.ts`, `src/game`, `server/services`)를 점검했다. 아래 체크리스트는 **새 CSV와 맞추기 위해 반드시 선행해야 할 작업**을 우선순위대로 정리한 것이다.

## 1. 카드 데이터 파이프라인 및 타입 정비
- [ ] `scripts/generate_cards.js`가 `card.csv`를 읽도록 하드코딩되어 있어 실제 파일(`cards.csv`)을 반영하지 못함 → 경로 수정 + CSV → TS 생성 스크립트 리팩터링.
- [ ] `src/data/cards.ts`에 수작업 `CARD_DATABASE`와 auto-generated 블록이 공존하여 중복·구버전 데이터가 함께 노출됨 → 자동 생성 파일(`src/data/cards.generated.ts`)을 단일 소스로 사용하고, 덱 생성/드로우 로직이 RawCard를 파싱해 런타임 카드 구조를 만들도록 통합.
- [ ] 클라이언트(`src/types/index.ts`), 서버(`server/types/index.ts`), 공유(`shared/types/index.ts`)의 `CardType`, `CardEffect`, `Card` 정의를 CSV에 나온 12개 타입(ATTACK, DEFENSE, MAGIC, BOOST, FIELD, STATUS, REACTION, COUNTER, BOUNCE, MIRACLE, SYSTEM, SYSTEM_EVENT)과 새 필드(`attribute`, `tags`, `chainable`, `chain_value`, `target`, `mp_cost`, `phys_atk`, `mind_atk`)에 맞춰 확장.
- [ ] CSV `tags`를 구조화할 파서/타입을 추가하고(`multi_hit`, `stackable`, `apply_status=...`, `resist_*`, `lifesteal`, `on_damage`, `one_time_use`, `aoe`, `hit_chance`, `AddSpeedBonus`, `magic_resist=50%`, `limit_defense=1` 등 70여 개 키 지원), 클라이언트·서버 양쪽에서 동일한 해석을 사용하도록 shared 모듈로 추출.
- [ ] `phys_atk`, `mind_atk`, `mp_cost`만 숫자 컬럼으로 존재하고 방어/치유/버프 값은 툴팁에만 서술되어 있음 → CSV 스키마를 확장(예: `defense`, `heal`, `buff_value`)하거나 파서가 규칙적으로 수치를 추출하도록 정의서와 함께 확정.

## 2. 카드별 런타임 속성 매핑
- [ ] BOOST 카드(`stackable;applies_to=attack_step/mp_step/speed_step`)의 버프 타입·지속 방식·적용 타이밍을 정의하고, 한 스텝 종료 시 초기화되는 로직을 양쪽(GameManager, CombatService)에 추가.
- [ ] `chainable`, `chain_value` 필드를 사용해 연속 사용/연쇄 공격 한계를 추적하는 규칙을 정의하고 CardValidator(`shared/validators/CardValidator.ts`, `src/game/CardValidator.ts`)가 이를 검증하도록 업데이트.
- [ ] `target` 필드(`적 1명`, `자신`, `무작위 플레이어`, `모든 적`, `자유 선택` 등)와 `tags`의 `random_target`, `self_targetable`, `retarget=random_1of4`를 활용해 UI 선택 옵션과 서버 검증을 동기화.
- [ ] `one_time_use`, `unique`, `replaces_existing`, `stackable` 등 덱/손패/필드에 남거나 제거되는 방식을 명확히 규정하고, 카드 사용 후 처리(`CombatManager.removeUsedCards`, `server/services/CombatService.deductManaCost`)를 일관되게 적용.

## 3. 전투/효과 로직 구현
- [ ] 공격: `multi_hit`, `aoe`, `hit_chance`/`accuracy`, `force_hit`, `lifesteal`, `self_damage`, `self_damage_on_turn_end`, `target_bonus=99` 등 태그별 효과를 `src/game/CombatManager.ts`와 `server/services/DamageCalculator.ts`/`EffectProcessor.ts`에 구현하고, 방어 계산(멀티 히트 시 누적 방어 처리 등)도 텍스트(예: "2회 타격. 방어는 누적으로 계산")에 맞게 보강.
- [ ] 방어/리액션: `REA-THORNS`, `REA-BOUNCE`, `REA-M_DEFENSE` 등은 `type`이 DEFENSE가 아닌 REACTION/COUNTER/BOUNCE로 들어오므로, `CardValidator.validateDefenseCards`, `CombatManager.resolveAttack`, 서버 `CombatService.checkSpecialEffects`가 새 타입과 태그(`on_damage`, `on_magic_damage`, `limit_defense=1`)를 처리하도록 개편.
- [ ] 속성 저항: `resist_fire`, `resist_light_simple`, `magic_resist=50%`, `resist_critical=50%` 등 방어 카드의 저항 수치를 데이터 기반으로 계산하도록 `DamageCalculator.isDefenseEffective`/`applyDefenseReduction`을 확장하고 도중에 하드코딩된 속성 비교를 제거.
- [ ] 마법/상태 이상: `MAG-*-T` 카드의 `apply_status=STT-*`, `mp_condition=0`, `effect=hp_drain` 등 특수 효과를 상태 시스템과 연결하고, 광역·정신력 드레인 등도 구현.
- [ ] 필드 카드: 새로운 FIELD 카드(tags `unique;replaces_existing`)는 현재 하드코딩된 5종(`GameManager.applyFieldMagicEffect`)과 전혀 다름. CSV의 툴팁/태그(예: `aoe`, `effect=card_randomize`, 25% 확률로 득/실) 기반으로 효과/확률 표를 작성하고 데이터 주도형 처리기로 교체.
- [ ] MIRACLE/ART 카드: `ART-MP_EX`처럼 강력하지만 cost/대상 제약이 있는 카드를 서버/클라이언트 모두에 정의하고 사용 시 별도 이펙트(예: 상대 MP 감소) 처리가 필요.

## 4. 상태 이상·시스템 이벤트
- [ ] CSV 상단 `DEB-*` STATUS 카드(`trigger=atTurnStart`, `applyWhen=mp==0`)를 현재 정신력 0 디버프 시스템(`GameManager.applyMentalBreakDebuff`)과 연결: 어떤 조건에서 부여/해제되는지, 중복 방지, `applyWhen` 조건 충족 시 자동 발동을 구현.
- [ ] 50턴 이후 천사/악마 이벤트를 데이터 기반으로 재구성: `SYS-001`, `EVT-ANGEL-*`, `EVT-DEMON-*`의 `tags`(`turn_limit`, `roll=angel/demon`, `effect=*`)를 읽어 확률·효과를 결정하고, 서버(`server/services/RoomManager` 혹은 Turn 관리)에서도 동일한 규칙이 실행되도록 이벤트 파이프라인 추가.

## 5. 검증/선택 UI 보강
- [ ] `CardValidator`(shared + client)와 서버 방어 검증이 새 타입/효과를 인지하도록 전면 재작성: BOOST/MIRACLE/REACTION 구분, `single_magic_per_step` vs `applies_to=magic_step`, `chainable` 한계 등 규칙화.
- [ ] UI(`src/ui/CardComponent.ts`, `src/ui/CombatUI.ts`)에서 신규 속성/태그(속성 색상, 스택 가능 여부, 체인 가능 여부, 타겟 정보, 1회용 경고, 상태 이상 설명)를 시각적으로 노출하고, 선택 모달이 대상 제한을 적용하도록 개선.
- [ ] 손패/필드와 네트워크 메시지(`src/network/SocketClient.ts`, `server/handlers/CombatEventHandler.ts`)에서 `tags`/`chainable` 등 새 필드가 빠짐없이 직렬화되도록 DTO 갱신.

## 6. 테스트 및 문서화
- [ ] shared/server/client에 존재하는 기존 테스트(`shared/__tests__/CardValidator.test.ts`, `src/__tests__/CombatManager.test.ts`, `server/healIntegrationTest.js` 등)를 새 카드 스키마 기준 케이스로 교체 및 확대(AoE, multi-hit, status, reaction 등).
- [ ] `GAME_MECHANICS.md`, `README.md`, `RUNNING_GUIDE.md`에 새 카드 타입/태그/이펙트 명세를 추가하고, cards.csv → 코드 자동 생성 흐름을 문서화.

## 7. (Backlog) 이전 TODO 중 계속 필요한 항목
- [ ] 메인 화면 닉네임을 로컬 스토리지에 저장 (이전 TODO 2.1 미완).
- [ ] 멀티플레이 대기실에서 "모든 플레이어 준비 시 게임 시작" 서버 로직 구현.
- [ ] 튕기기/되받아치기 체인 처리 개선(`src/game/TurnManager.ts`, `src/game/GameManager.ts`, `server/server.ts`) — 기존 TODO 세부 항목 유지.
- [ ] 데미지 계산 결과를 UI에 시각화(공격·방어·회복 로그 강화, `src/ui/CombatUI.ts`, `src/ui/PlayerComponent.ts`).
- [ ] 필드 마법 기본 시스템 구축 및 이펙트 시각화 (기존 TODO 3.5의 범용 작업).

> 위 항목들은 새 CSV 대응 작업이 어느 정도 마무리된 뒤에 병행한다.
