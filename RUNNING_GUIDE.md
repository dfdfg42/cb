# 프로젝트 실행 가이드

## 🚀 빠른 시작

### 1. 의존성 설치

```powershell
npm install
```

### 2. 서버 실행

#### 개발 모드 (자동 재시작)
```powershell
npm run server
```

서버가 `http://localhost:3001`에서 실행됩니다.

#### 프로덕션 빌드
```powershell
npm run server:build
node dist/server.js
```

### 3. 클라이언트 실행

#### 개발 모드 (Hot Reload)
```powershell
npm run dev
```

브라우저가 자동으로 열리고 `http://localhost:8080`에서 실행됩니다.

#### 프로덕션 빌드
```powershell
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

---

## 📋 전체 실행 순서

### Step 1: 프로젝트 클론 (이미 완료)
```powershell
# 현재 위치: c:\Users\dfdfg\source\cb
```

### Step 2: 의존성 설치
```powershell
npm install
```

이 명령은 다음을 설치합니다:
- 프로젝트 의존성 (socket.io, express 등)
- 개발 도구 (webpack, typescript 등)
- **테스트 도구 (vitest)** - 새로 추가됨

### Step 3: 두 개의 터미널 열기

#### 터미널 1 - 서버
```powershell
npm run server
```

출력 예시:
```
[nodemon] starting `ts-node server/server.ts`
🚀 서버가 포트 3001에서 실행 중입니다
```

#### 터미널 2 - 클라이언트
```powershell
npm run dev
```

출력 예시:
```
<i> [webpack-dev-server] Project is running at:
<i> [webpack-dev-server] Loopback: http://localhost:8080/
```

### Step 4: 브라우저에서 접속
```
http://localhost:8080
```

---

## 🧪 테스트 실행

리팩토링 후 테스트를 실행할 수 있습니다:

### 모든 테스트 실행
```powershell
npm test
```

### UI 모드로 테스트 (추천!)
```powershell
npm run test:ui
```

### 커버리지 리포트
```powershell
npm run test:coverage
```

---

## 🛠️ 개발 스크립트

```powershell
# TypeScript 타입 체크
npm run type-check

# 클라이언트 빌드 (프로덕션)
npm run build

# 클라이언트 개발 모드
npm run dev

# 서버 개발 모드
npm run server

# 서버 빌드
npm run server:build

# 테스트
npm test
npm run test:ui
npm run test:coverage

# 통합 테스트 (기존)
npm run test:integration
```

---

## 📁 프로젝트 구조

```
cb/
├── server/              # 서버 코드
│   ├── server.ts       # 메인 서버 (127줄로 축소!)
│   ├── handlers/       # 이벤트 핸들러 (Phase 2)
│   ├── services/       # 비즈니스 로직
│   ├── constants/      # 서버 상수
│   └── __tests__/      # 서버 테스트
│
├── src/                # 클라이언트 코드
│   ├── main.ts         # 엔트리 포인트
│   ├── game/           # 게임 로직
│   │   ├── GameManager.ts (376줄로 축소!)
│   │   ├── CombatManager.ts (새로 생성)
│   │   └── CardValidator.ts (새로 생성)
│   ├── ui/             # UI 관리
│   ├── network/        # 네트워크 (Socket.IO)
│   └── __tests__/      # 클라이언트 테스트
│
├── shared/             # 공유 모듈 (Phase 4)
│   ├── constants/      # 공유 상수
│   ├── types/          # 공유 타입
│   ├── validators/     # 공유 검증 로직
│   └── __tests__/      # 공유 모듈 테스트
│
└── dist/               # 빌드 출력
```

---

## 🐛 문제 해결

### 포트가 이미 사용 중
```powershell
# 포트 3001 사용 프로세스 찾기
netstat -ano | findstr :3001

# 프로세스 종료 (PID 확인 후)
taskkill /PID [PID번호] /F
```

### npm install 오류
```powershell
# 캐시 정리
npm cache clean --force

# node_modules 삭제 후 재설치
Remove-Item -Recurse -Force node_modules
npm install
```

### TypeScript 오류
```powershell
# 타입 체크
npm run type-check

# 서버 빌드 테스트
npm run server:build
```

### 테스트 실패
```powershell
# vitest가 설치되지 않은 경우
npm install --save-dev vitest @vitest/ui

# 테스트 재실행
npm test
```

---

## 🎮 게임 플레이 방법

### 1. 로컬 테스트 모드
- 메인 화면에서 "혼자 플레이" 선택
- 4명의 AI 플레이어와 테스트

### 2. 멀티플레이어 모드
1. 서버 실행 확인
2. 브라우저에서 사용자 이름 입력
3. "방 만들기" 또는 "방 참가"
4. 모든 플레이어가 준비되면 게임 시작

---

## 📝 추가 정보

- **리팩토링 문서**: `REFACTORING_CHECKLIST.md`
- **테스트 가이드**: `TESTING.md`
- **게임 설명**: `README.md`

---

## ✨ 리팩토링 후 개선사항

### 성능
- ✅ 서버 코드 85% 감소
- ✅ 클라이언트 코드 37% 감소
- ✅ 모듈화로 빠른 로딩

### 유지보수
- ✅ 명확한 책임 분리
- ✅ 테스트 가능한 구조
- ✅ 타입 안전성 강화

### 개발 경험
- ✅ 37개 테스트 케이스
- ✅ Hot Reload 지원
- ✅ TypeScript 엄격 모드

---

## 🆘 도움이 필요하신가요?

문제가 발생하면:
1. `npm run type-check`로 TypeScript 오류 확인
2. `npm test`로 테스트 실행
3. 서버/클라이언트 로그 확인
4. Git 이력 확인: `git log --oneline`

**Happy Coding! 🎉**
