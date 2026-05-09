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

# 개선 우선순위 로드맵

## Phase 1 - 치명 문제 해결

| 항목 | 내용 |
|---|---|
| 목표 | 사용 불가/보안/데이터 유실 가능성 제거 |
| 수정 대상 파일 | `src/App.tsx`, `package.json`, `src/index.css`, `index.html`, Firebase Rules 신규 |
| 예상 영향 범위 | 전체 앱 |
| 위험도 | 높음 |
| 우선순위 | P0 |
| 추천 라이브러리 | `tailwindcss`, `zod`, Firebase Custom Claims/Rules |

작업:

1. Tailwind CDN 제거 및 빌드 타임 Tailwind 적용
2. 관리자 인증값 제거
3. Firestore Rules 작성 및 테스트
4. 로그인 후 역할별 구독으로 변경
5. 결과 저장 실패 시 화면 이동 차단
6. 퀴즈 임시저장 복원 버그 수정
7. 미응답 제출 검증

Before:

```tsx
if (!isStyleLoaded) return <div>디자인 로딩중...</div>;
```

After:

```tsx
// Tailwind는 빌드 산출물에 포함. 런타임 style-loading gate 제거.
return <AppRoutes />;
```

## Phase 2 - 구조 개선

| 항목 | 내용 |
|---|---|
| 목표 | 유지보수 가능한 폴더/라우팅/API 구조로 분리 |
| 수정 대상 파일 | `src/App.tsx` 분해, `src/lib`, `src/services`, `src/features` 신규 |
| 예상 영향 범위 | 높음 |
| 위험도 | 중간~높음 |
| 우선순위 | P1 |
| 추천 라이브러리 | `react-router-dom`, `@tanstack/react-query`, `zod` |

작업:

- React Router 도입
- Firebase 초기화 분리
- 인증 Provider 분리
- 학생/관리자 route 분리
- Firestore service 계층 생성
- 타입과 schema 분리

목표 구조:

```text
src/
├── app/App.tsx
├── app/router.tsx
├── lib/firebase.ts
├── services/
├── features/auth/
├── features/student/
├── features/admin/
└── components/ui/
```

## Phase 3 - UX 개선

| 항목 | 내용 |
|---|---|
| 목표 | 일반 사용자 흐름과 관리자 운영 흐름 안정화 |
| 수정 대상 파일 | 학생/관리자 feature 컴포넌트, UI 컴포넌트 |
| 예상 영향 범위 | 중간 |
| 위험도 | 중간 |
| 우선순위 | P1 |
| 추천 라이브러리 | `@radix-ui/react-dialog`, `react-hook-form` |

작업:

- 로딩/빈 상태/에러 상태 분리
- 제출 확인 모달
- 저장 중 disabled/loading
- CSV 업로드 preview/검증
- 결과 저장 재시도
- 뒤로가기/새로고침 복구
- 관리자 모바일 화면 개선

## Phase 4 - 성능 개선

| 항목 | 내용 |
|---|---|
| 목표 | 데이터 증가와 모바일 렌더링 대응 |
| 수정 대상 파일 | Firestore query service, 목록 컴포넌트 |
| 예상 영향 범위 | 중간 |
| 위험도 | 중간 |
| 우선순위 | P2 |
| 추천 라이브러리 | `react-window`, `@tanstack/react-query` |

작업:

- Firestore `orderBy`, `where`, `limit` 적용
- 결과/문제은행 pagination
- 긴 퀴즈/결과 lazy render
- 관리자 route lazy loading
- CSV batch chunking

## Phase 5 - 운영 준비

| 항목 | 내용 |
|---|---|
| 목표 | 사내 운영/상용 수준 품질 확보 |
| 수정 대상 파일 | 전체, 문서, CI |
| 예상 영향 범위 | 전체 |
| 위험도 | 중간 |
| 우선순위 | P2-P3 |
| 추천 라이브러리 | `vitest`, `@testing-library/react`, `playwright`, Firebase Emulator |

작업:

- 테스트 추가
- Firebase Emulator 기반 rules 테스트
- CI build/lint/test
- README 운영 문서화
- 장애/로그/모니터링
- 개인정보 보존/삭제 정책

## 추천 리팩토링 순서

1. 빌드 복구: `npm install`, Tailwind 로컬 설치, `npm run build` 성공
2. `src/lib/firebase.ts` 분리
3. Firestore service 추출
4. 학생 응시 상태 reducer화
5. 관리자 권한 구조 교체
6. Router 도입
7. 컴포넌트 분리
8. 테스트 작성








