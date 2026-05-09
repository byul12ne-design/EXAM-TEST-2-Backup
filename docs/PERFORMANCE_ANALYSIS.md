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

## Vercel Deployment Impact

| 항목 | 분석 |
|---|---|
| production 위험 | Vercel build 산출 JS가 630.14 kB로 Vite 경고 기준을 초과한다 |
| local build와 production 차이 | local build는 성공하지만 production 모바일 네트워크에서 초기 JS 다운로드와 Firebase 초기화 체감 지연이 커질 수 있다 |
| runtime risk | Tailwind CDN 추가 요청, 외부 로고 요청, Firebase Auth/Firestore 요청이 첫 사용 흐름에 누적된다 |
| env risk | 환경별 Firebase project 분리가 없어 production 데이터와 테스트 데이터가 섞일 위험이 있다 |
| SPA risk | route-level lazy loading이 없고 관리자 코드도 첫 chunk에 포함된다 |
| mobile runtime risk | 저속 네트워크/iOS Safari에서 큰 JS chunk와 Firebase IndexedDB 사용이 체감 성능 문제를 만들 수 있다 |

# 성능 분석

## 핵심 결론

현재 앱은 데이터가 적을 때는 동작할 수 있으나, 컬렉션 전체 실시간 구독, 단일 대형 컴포넌트, 페이지네이션 부재, Tailwind CDN 런타임 의존 때문에 데이터 증가와 모바일 환경에서 성능/비용 문제가 커질 구조다.

## Firestore onSnapshot 범위

실제 코드:

```tsx
// src/App.tsx:109-111
const unsubExams = onSnapshot(collection(db, 'exams'), ...);
const unsubResults = onSnapshot(collection(db, 'results'), ...);
const unsubBank = 문제은행 데이터 영역 전체 실시간 구독;
```

문제:

| severity | 문제 | 영향 |
|---|---|---|
| 치명 | 로그인 전에도 전체 컬렉션 구독 | 보안/비용/초기 로딩 위험 |
| 높음 | 결과 전체 구독 | 결과가 늘수록 모든 사용자의 초기 데이터량 증가 |
| 높음 | 문제은행 전체 구독 | 관리자 외 사용자에게 불필요 |
| 보통 | 구독 에러 콜백 없음 | 실패 시 빈 화면처럼 보임 |

After:

```ts
// 학생: 공개 과정만 제한 조회
query(collection(db, 'exams'), where('isVisible', '==', true), limit(50));

// 관리자 결과: 선택 과정 + 페이지 단위 조회
query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(50));
```

## 불필요한 리렌더링

실제 구조:

- `App.tsx` 하나에서 인증, 학생 화면, 관리자 화면, 모달, 결과 상세를 모두 렌더 조건으로 관리
- 과정 데이터 영역, 결과 데이터 영역, 문제은행 데이터 영역 중 하나가 업데이트되어도 `App` 전체가 다시 평가됨
- 인라인 핸들러가 다수 존재

위험:

| 상황 | 영향 |
|---|---|
| 결과 데이터가 계속 쌓임 | 관리자/학생 화면 모두 렌더 비용 증가 |
| 문제은행 수백~수천 문항 | select/filter/map 비용 증가 |
| 긴 시험 | 모든 문항을 한 화면에 렌더링해 모바일 스크롤/메모리 부담 |

개선:

- 화면 단위 컴포넌트 분리
- React Router lazy loading
- 결과/문제은행 pagination
- `React.memo`는 구조 분리 후 필요한 곳에만 적용

## 대량 데이터 위험성

| 데이터 | 현재 처리 | 위험 | 개선 |
|---|---|---|---|
| 결과 데이터 영역 | 전체 구독 후 클라이언트 필터 | 관리자 결과 수 증가 시 느림 | 서버 query + pagination |
| 문제은행 데이터 영역 | 전체 구독 후 클라이언트 필터 | 문제은행 수 증가 시 느림 | 카테고리별 query |
| 시험 문항 | Exam 문서 안에 배열 저장 | 문항이 많으면 문서 크기 제한 위험 | subcollection 또는 bank reference |
| CSV 업로드 | 한 번에 batch write | 500 write batch 제한/대용량 UI block | chunking + progress |

## 모바일 성능 문제

| 위치 | 문제 |
|---|---|
| 퀴즈 응시 `src/App.tsx:759-773` | 모든 문항을 한 번에 렌더링 |
| 결과 상세 `src/App.tsx:785-817` | 모든 문제/보기/해설을 한 번에 렌더링 |
| 관리자 문제은행 `src/App.tsx:507-520` | 전체 문제 목록 렌더링 |
| 관리자 결과 `src/App.tsx:552-579` | 전체 결과 목록 렌더링 |

개선:

- 긴 퀴즈는 문항 단위 pagination 또는 virtualized list
- 관리자 목록은 `react-window` 또는 페이지네이션
- 결과 상세는 accordion/lazy render

## 번들 구조와 CDN

실제:

- `vite.config.ts:5-7` 기본 설정
- lazy loading 없음
- Tailwind CDN 런타임 로드

문제:

- 관리자 기능도 학생에게 같은 번들로 내려간다.
- Tailwind CDN script 로드 전 앱이 대기한다.
- 네트워크가 느리면 초기 UX가 나빠진다.

After:

```tsx
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));
const StudentDashboard = lazy(() => import('./features/student/StudentDashboard'));
```

## 랜더링 병목

| 병목 | 실제 위치 | 해결 |
|---|---|---|
| map 반복 렌더 | `exams.map`, `filteredBank.map`, `filteredResults.map` | pagination/virtualization |
| 인라인 정렬 | `onSnapshot`마다 sort 실행 `src/App.tsx:109-111` | Firestore `orderBy` |
| 클라이언트 필터 | `useMemo` 필터 `src/App.tsx:334-338` | query 조건 |
| 큰 단일 파일 | `src/App.tsx:41-843` | route-level split |








