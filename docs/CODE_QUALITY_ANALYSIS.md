## Current Analysis Metadata

- Current Analysis Snapshot: Current repository snapshot
- Analysis Basis: Latest repository code, local production build output, Vite/Firebase/Vercel-related repository settings
- Build Result: npm.cmd install 성공, npm.cmd run build 성공. npm.cmd run lint와 npm.cmd run test는 script 없음으로 실행 불가.
- Vercel Scope: 이 프로젝트는 Vercel 자동배포 환경일 수 있으나, 저장소 코드만으로는 Vercel Dashboard의 실제 설정, 환경 변수, 배포 로그, production domain 동작을 확정할 수 없다. 따라서 본 분석은 저장소 코드와 로컬 production build 기준이며, 실제 배포 상태는 Vercel Dashboard와 배포 URL에서 별도 확인해야 한다.

## Current Operations Snapshot

| 항목 | 현재 상태 |
|---|---|
| 실제 코드 구조 | React + Vite + Firebase 단일 SPA. 핵심 로직은 `src/App.tsx`에 집중되어 있음 |
| 현재 빌드 결과 | production build 성공. JS chunk `630.14 kB`로 Vite 500 kB 경고 발생 |
| Vercel 자동배포 위험 | `vercel.json`, .vercelignore, .env, .env.example 없음. 실제 Dashboard 설정은 저장소만으로 확정 불가 |
| Production blocking issue | Tailwind CDN 런타임 의존, Firebase Rules 미검증, 관리자/학생 인증값 bundle 노출, Firestore 전체 구독, 결과 저장 실패 처리 미흡 |
| 현재 보안 문제 | 클라이언트 관리자 인증, 고정 학생 인증값, production DB 직접 read/write, 결과 위변조 가능성 |
| 현재 UX 문제 | 로딩/에러 상태 부족, 새로고침/뒤로가기 복구 부족, 모바일/PC 나가기 동작 차이, 미응답 제출 가능 |
| 현재 성능 문제 | 전체 컬렉션 실시간 구독, pagination/lazy loading 부재, Firebase SDK 포함 단일 대형 chunk |
| 현재 수정 우선순위 | 1. Firebase Rules/권한 2. Tailwind CDN 제거 3. 인증 재설계 4. 결과 저장/임시저장 수정 5. Router/rewrite/운영 설정 정리 |

# 코드 품질 분석

## 정량 요약

| 항목 | 실제 값 |
|---|---|
| `src/App.tsx` 라인 수 | 874 |
| `src/App.tsx` 크기 | 61,668 bytes |
| 주요 화면 수 | 약 8개 |
| `useState` 수 | 30개 이상 |
| 테스트 파일 | 없음 |
| 테스트 스크립트 | 없음 |
| TypeScript `strict` | 미설정 |
| 라우터 | 없음 |
| API/service 계층 | 없음 |

## 파일 크기와 컴포넌트 분리

문제:

- `App.tsx`에 Firebase 초기화, 타입, 상태, 유틸, 인증, 학생 UI, 관리자 UI, 모달, 결과 UI가 모두 들어 있다.
- 화면별 독립 테스트가 어렵다.
- 작은 수정도 전체 파일 conflict 가능성이 높다.

권장 분리:

```text
src/
├── app/
│   ├── App.tsx
│   └── routes.tsx
├── lib/
│   └── firebase.ts
├── services/
│   ├── exams.ts
│   ├── results.ts
│   └── 문제은행 데이터 영역.ts
├── features/
│   ├── auth/
│   ├── student/
│   └── admin/
└── components/
    └── ui/
```

## 상태관리 문제

실제:

```tsx
// src/App.tsx:42-85
const [user, setUser] = useState<User | null>(null);
...
const [isStyleLoaded, setIsStyleLoaded] = useState(false);
```

문제:

| severity | 문제 | 영향 |
|---|---|---|
| 높음 | 화면 상태와 데이터 상태가 한 컴포넌트에 혼재 | 변경 추적 어려움 |
| 높음 | 응시 상태가 여러 state로 분산 | 임시저장/복원 버그 발생 |
| 보통 | 관리자 편집 상태와 문제은행 상태 공존 | 취소/전환 시 누수 가능 |

개선:

- `useReducer`로 exam-taking state를 묶기
- 서버 상태는 TanStack Query 또는 구독 hook으로 분리
- route별 component local state 사용

## 함수 책임 분리

예: `startExam` (`src/App.tsx:199-240`)

현재 책임:

- 현재 과정 찾기
- 진행 문서 조회
- 학습/퀴즈 분기
- 랜덤 문항 추출
- Firestore 진행 저장
- UI 상태 설정
- 화면 이동
- 토스트 출력

개선:

```ts
async function prepareExamSession(params): Promise<ExamSession> {
  // 데이터 준비만
}

function StudentEntryPage() {
  // UI 상태 전환만
}
```

## 타입 안정성

실제 타입:

```ts
interface Exam {
  id: string;
  title: string;
  questions: Question[];
  displayCount: number;
  mode: 'study' | 'test';
  isVisible: boolean;
}
```

문제:

- Firestore `d.data()`를 곧바로 타입 캐스팅한다. `src/App.tsx:109-111`
- 런타임 schema validation 없음
- `tsconfig.app.json`에 `strict` 없음

After:

```ts
import { z } from 'zod';

const ExamSchema = z.object({
  title: z.string().min(1),
  mode: z.enum(['study', 'test']),
  questions: z.array(QuestionSchema),
});
```

## 에러 처리 일관성

| 위치 | 현재 처리 | 문제 |
|---|---|---|
| 학생 인증 | catch 후 일반 메시지 | 원인 구분 없음 |
| 결과 저장 | console.error만 | 사용자 알림 없음 |
| 과정 저장 | "저장 실패" | 상세 없음 |
| onSnapshot | 에러 콜백 없음 | 권한/네트워크 실패 감지 안 됨 |
| signOut | 실패 처리 없음 | 로그아웃 실패 알림 없음 |

## 랜덤 로직 문제

실제:

```tsx
// src/App.tsx:224
const selected = [...pool].sort(() => Math.random() - 0.5).slice(0, displayCnt);
```

문제:

- `sort(() => Math.random() - 0.5)`는 균등 셔플이 아니다.
- 재현 가능한 seed가 없어 문제 이의제기/감사에 불리하다.
- 퀴즈 임시저장 복원과 충돌한다.

개선:

```ts
function shuffle<T>(items: T[], random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
```

## async 처리 문제

| 위치 | 문제 |
|---|---|
| `src/App.tsx:265` | 진행 저장 `setDoc`을 await하지 않음 |
| `src/App.tsx:287-291` | 결과 저장 실패 후에도 결과 화면 이동 |
| `src/App.tsx:533-540` | 삭제 중 로딩/실패 상태 없음 |
| `src/App.tsx:319-321` | 공개 토글 중 중복 클릭 방지 없음 |

## 의존성 구조

`package.json`에는 최소 의존성만 있다.

| 누락/추천 | 목적 |
|---|---|
| `react-router-dom` | URL 기반 라우팅 |
| `@tanstack/react-query` | 서버 상태/캐싱 |
| `zod` | Firestore/CSV schema validation |
| `papaparse` | CSV 파싱 |
| `tailwindcss` | 빌드 타임 스타일 |
| `vitest`, `@testing-library/react` | 단위/컴포넌트 테스트 |
| `playwright` | 모바일/PC E2E |








