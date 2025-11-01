# Testing Guide

## 테스트 설정

이 프로젝트는 **Vitest**를 사용하여 유닛 테스트를 수행합니다.

### 설치

```bash
npm install
```

## 테스트 실행

### 모든 테스트 실행
```bash
npm test
```

### UI 모드로 테스트 실행
```bash
npm run test:ui
```

### 커버리지 리포트와 함께 테스트
```bash
npm run test:coverage
```

### Watch 모드 (개발 중)
```bash
npm test -- --watch
```

## 테스트 구조

```
project/
├── src/__tests__/              # 클라이언트 테스트
│   ├── CombatManager.test.ts
│   └── ...
├── server/__tests__/           # 서버 테스트
│   ├── DamageCalculator.test.ts
│   └── ...
└── shared/__tests__/           # 공유 모듈 테스트
    ├── CardValidator.test.ts
    └── ...
```

## 작성된 테스트

### Shared 모듈
- **CardValidator.test.ts** (19 tests)
  - 카드 검증 규칙
  - + 접두사 카드 검증
  - 정신력 소비 계산

### Client 모듈
- **CombatManager.test.ts** (7 tests)
  - 공격 카드 선택
  - 방어 카드 선택
  - 데미지 적용
  - 플레이어 사망 처리

### Server 모듈
- **DamageCalculator.test.ts** (11 tests)
  - 데미지 계산
  - 방어력 계산
  - 필드 마법 효과 적용
  - Reflect/Bounce 효과 감지

## 테스트 작성 가이드

### 기본 구조
```typescript
import { describe, it, expect } from 'vitest';

describe('MyClass', () => {
  describe('myMethod', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = myMethod(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Mock 사용
```typescript
import { vi, beforeEach } from 'vitest';

let mockUIManager: IUIManager;

beforeEach(() => {
  mockUIManager = {
    showAlert: vi.fn(),
    addLogMessage: vi.fn(),
    // ... other methods
  };
});
```

## 커버리지 목표

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## 추가할 테스트

### 우선순위 높음
- [ ] GameManager 테스트
- [ ] EffectProcessor 테스트
- [ ] RoomManager 테스트
- [ ] CombatService 테스트

### 우선순위 중간
- [ ] EventEmitter 테스트
- [ ] TurnManager 테스트
- [ ] UIManager 테스트

### 통합 테스트
- [ ] 전체 전투 시나리오
- [ ] Reflect/Bounce 연쇄 반응
- [ ] 특수 이벤트 (악마/천사)
- [ ] 멀티플레이어 동기화

## 참고

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
