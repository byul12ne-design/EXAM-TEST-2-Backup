# Minimum Refactoring Plan

## 목표

전면 개편이 아니라 보안 개선을 가능하게 하는 최소 리팩토링 범위를 정의한다. 우선순위는 하드코딩 인증값 제거, Firebase Auth/Custom Claims 적용, Firestore Rules 적용, Vercel 운영 안정성 확보이다.

## 원칙

| 원칙 | 설명 |
|---|---|
| 작은 단위로 이동 | 기능을 새로 만들기보다 기존 코드를 역할별 파일로 옮긴다 |
| 보안 경계 우선 | UI polish보다 auth, role, data access 경계를 먼저 만든다 |
| 동작 보존 | 첫 리팩토링 단계에서는 기존 화면 동작을 최대한 유지한다 |
| Rules 친화 query | 전체 구독 대신 역할별 query로 갈 수 있는 service API를 만든다 |
| client env 한계 반영 | `VITE_*`에 민감값을 넣지 않는다 |
| 네이밍 기준 선확정 | `course`, `quizAttempt`, `studySession`, `authRole` 등 권장 용어를 먼저 정하고 migration 대상과 code-only rename을 구분한다 |

## 최소 분리 후보

| 파일/폴더 | 목적 | 최소 포함 범위 | 우선순위 |
|---|---|---|---|
| `src/types/domain.ts` | 도메인 타입 | `Course`, `QuestionBankItem`, `AttemptResult`, `StudentProfile` | 반드시 |
| `src/lib/firebase.ts` | Firebase 초기화 | env 기반 client config, `auth`, `db` export | 반드시 |
| `src/services/authService.ts` | Auth API | 학생 로그인, 로그아웃, token/claim 확인 | 반드시 |
| `src/services/examService.ts` | 과정 데이터 | 공개 과정 조회, 관리자 과정 생성/수정/삭제 | 반드시 |
| `src/services/resultService.ts` | 결과 데이터 | 결과 저장, 본인 결과 조회, 관리자 결과 조회/삭제 | 반드시 |
| `src/services/questionBankService.ts` | 문제 저장고 | 관리자 문제 조회/생성/수정/삭제, CSV import 대상 | 높음 |
| `src/hooks/useAuth.ts` | Auth state | user, profile, role, loading, error | 반드시 |
| `src/hooks/useToast.ts` | Toast 상태 | showToast, clearToast | 보통 |
| `src/components/ui/Button.tsx` | 공통 버튼 | semantic button, loading/disabled | 보통 |
| `src/components/ui/Input.tsx` | 공통 입력 | label, error, help text | 보통 |
| `src/components/ui/Toast.tsx` | 알림 | `role=status`, `aria-live` | 보통 |
| `src/features/student/*` | 학생 흐름 | 대시보드, 안내, 응시, 결과 | 높음 |
| `src/features/admin/*` | 관리자 흐름 | 대시보드, 과정 관리, 문제 저장고, 결과 | 높음 |

## 권장 폴더 구조

```text
src/
├── types/
│   └── domain.ts
├── lib/
│   └── firebase.ts
├── services/
│   ├── authService.ts
│   ├── examService.ts
│   ├── resultService.ts
│   └── questionBankService.ts
├── hooks/
│   ├── useAuth.ts
│   └── useToast.ts
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Toast.tsx
├── features/
│   ├── student/
│   └── admin/
├── App.tsx
└── main.tsx
```

## Phase 1: 보안 수정 준비용 구조 분리

목표:

- Firebase config를 `App.tsx`에서 분리한다.
- Auth와 Firestore 호출을 service 함수로 감싼다.
- 하드코딩 인증값 제거를 위한 진입점을 만든다.
- `exam/test/result/role`처럼 혼동되는 이름을 바로 migration하지 않고 service boundary에서 새 도메인 타입으로 mapping할 준비를 한다.

작업:

| 순서 | 작업 | 예상 파일 |
|---|---|---|
| 1 | `src/types/domain.ts` 생성 및 권장 타입명 확정 | `src/types/domain.ts`, `src/App.tsx` |
| 2 | `src/lib/firebase.ts` 생성 | `src/lib/firebase.ts`, `src/App.tsx` |
| 3 | Firebase client config를 `import.meta.env.VITE_*`로 이동 | `.env.example`, `src/lib/firebase.ts` |
| 4 | auth API 함수 분리 | `src/services/authService.ts`, `src/App.tsx` |
| 5 | Firestore read/write 함수 분리 | `src/services/*.ts`, `src/App.tsx` |
| 6 | toast hook 분리 | `src/hooks/useToast.ts`, `src/components/ui/Toast.tsx` |

최소 성공 기준:

- `App.tsx`가 Firebase SDK를 직접 import하지 않는다.
- 하드코딩 인증값이 `App.tsx`에 남아 있지 않다.
- 기존 학생/관리자 주요 흐름이 동일하게 동작한다.
- Firestore 기존 이름은 service mapping으로 흡수하고, collection/field migration은 별도 단계로 미룬다.

## Phase 2: 권한 구조 개선

목표:

- `view` 상태 전환만으로 관리자 화면에 진입하지 않도록 한다.
- Firebase Auth token claim 기반으로 admin/student 권한을 확인한다.

작업:

| 순서 | 작업 | 예상 파일 |
|---|---|---|
| 1 | `useAuth`에서 `getIdTokenResult()` 기반 role 계산 | `src/hooks/useAuth.ts` |
| 2 | `isAdmin`, `isStudent` helper 추가 | `src/services/authService.ts` |
| 3 | Admin guard 컴포넌트 또는 함수 추가 | `src/features/admin/AdminGuard.tsx` |
| 4 | 학생 로그인 후에만 학생 데이터 query 실행 | `src/hooks/useAuth.ts`, `src/services/*` |
| 5 | 권한 실패 UI 추가 | `src/components/ui/*`, `src/features/*` |

최소 성공 기준:

- admin claim이 없으면 관리자 UI가 렌더링되지 않는다.
- 학생은 본인 데이터 query만 호출한다.
- 권한 실패가 빈 화면이 아니라 명시적 오류로 표시된다.

## Phase 3: 학생/관리자 화면 분리

목표:

- 보안 변경과 운영 변경이 학생/관리자 화면에 각각 독립적으로 적용되도록 한다.

작업:

| 영역 | 분리 후보 |
|---|---|
| 학생 | `StudentDashboard`, `StudentEntry`, `StudentTake`, `StudentResult` |
| 관리자 | `AdminDashboard`, `ExamManager`, `QuestionBankManager`, `ResultAnalytics` |
| 공통 | `Layout`, `Button`, `Input`, `Modal`, `Toast` |

최소 성공 기준:

- `App.tsx`는 route/view orchestration 중심으로 축소된다.
- 학생 기능 수정이 관리자 기능 JSX를 건드리지 않는다.
- 관리자 기능 수정이 학생 응시 state를 건드리지 않는다.

## Phase 4: UX/안정성 개선

목표:

- Rules 강화와 Vercel runtime 실패가 사용자에게 명확히 보이도록 한다.

작업:

| 항목 | 개선 |
|---|---|
| loading | auth/data별 loading 상태 분리 |
| error | Firestore 권한/네트워크 오류 표시 |
| 저장 실패 | 결과 저장 성공 후에만 완료 화면 이동 |
| 미응답 제출 | 미응답 count와 확인 모달 |
| 모바일 뒤로가기 | 학생/관리자 공통 navigation 정책 |
| Tailwind CDN | build-time Tailwind로 전환 |

## Phase 5: 테스트 가능 구조

목표:

- 보안/채점/CSV/결과 제출이 UI 없이 테스트 가능해야 한다.

분리 대상:

| 대상 | 이유 |
|---|---|
| CSV parsing | 업로드 보안과 데이터 품질 검증 |
| exam validation | 관리자 과정 저장 전 스키마 검증 |
| result calculation | 점수 계산 regression 방지 |
| result payload builder | 결과 저장 스키마 안정화 |
| auth claim parser | admin/student guard 검증 |

## 최소 변경 범위

첫 PR 또는 첫 작업 묶음은 다음만 포함하는 것이 안전하다.

1. `src/types/domain.ts`
2. `src/lib/firebase.ts`
3. `.env.example`
4. `.gitignore` env/archive 보강
5. `src/services/authService.ts`
6. `src/services/examService.ts`
7. `src/services/resultService.ts`
8. `src/services/questionBankService.ts`
9. `src/hooks/useToast.ts`
10. `src/components/ui/Toast.tsx`
11. `App.tsx`에서 직접 Firebase SDK 호출 제거

학생/관리자 화면 컴포넌트 분리는 두 번째 묶음으로 진행한다.

## 지금 당장 하지 않아도 되는 리팩토링

| 항목 | 이유 |
|---|---|
| 전체 디자인 시스템 구축 | 보안 개선과 직접 관련이 낮음 |
| 모든 화면 컴포넌트 완전 분리 | 초기 변경량이 커져 regression 위험 증가 |
| React Router 전면 도입 | 중요하지만 Auth/Rules 경계 이후가 더 안전 |
| 상태관리 라이브러리 도입 | 현재는 service/hook 분리만으로 충분 |
| 모든 CSS/Tailwind 정리 | Tailwind CDN 제거는 필요하지만 UI 재설계는 후순위 |
| Firestore collection/field 즉시 rename | 기존 운영 데이터와 Rules가 동시에 깨질 수 있으므로 service mapping 이후 migration |

## 리팩토링 완료 판단 기준

| 기준 | 통과 조건 |
|---|---|
| 보안 준비 | `App.tsx`에 Firebase config/인증값/직접 Firestore write가 없음 |
| 권한 준비 | admin/student role이 token claim 또는 service 결과로 계산됨 |
| Rules 준비 | service 함수가 역할별 query로 나뉘어 있음 |
| Vercel 준비 | `.env.example`과 Dashboard env 목록이 일치 |
| 테스트 준비 | CSV/채점/결과 payload가 순수 함수로 분리됨 |
| 네이밍 준비 | `course`, `quizAttempt`, `studySession`, `questionBankItem`, `authRole` 기준이 타입/service에 반영됨 |

## 네이밍 적용 메모

자세한 기준은 `docs/refactoring/NAMING_REVIEW.md`와 `docs/refactoring/DOMAIN_TERMINOLOGY.md`를 따른다.

초기 리팩토링에서는 DB collection 이름을 바로 바꾸지 않는다. 대신 service 레이어에서 기존 `exams`, `results`, `studyProgress`, `testProgress`, `questionBank`를 새 도메인 타입인 `Course`, `AttemptResult`, `StudySession`, `QuizAttempt`, `QuestionBankItem`으로 mapping한다.
