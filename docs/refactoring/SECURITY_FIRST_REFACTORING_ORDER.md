# Security First Refactoring Order

## 목적

보안 개선을 먼저 적용하기 위한 실제 작업 순서를 정의한다. 이 순서는 코드 수정 착수 전 계획이며, 현재 문서는 실제 인증값이나 운영 설정값을 포함하지 않는다.

## 전체 순서 요약

```text
1. Git/env 안전장치
2. 도메인 네이밍 기준 고정
3. Firebase config 분리
4. 사번 검증 정책 고정
5. Auth service 분리
6. Firestore service 분리
7. Firestore Rules 초안 검증
8. Admin/student guard 설계
9. 전체 구독 제거
10. 화면 분리
11. UX 안정성 보강
12. 테스트 가능 함수 분리
13. Vercel/Firebase production 검증
```

## Step 0: 작업 전 안전 확인

| 확인 | 이유 |
|---|---|
| `git status` | 의도하지 않은 파일이 섞이지 않게 확인 |
| `docs/internal/` ignore 확인 | 내부 보안 문서 push 방지 |
| archive 파일 ignore 또는 제거 검토 | 내부 압축본 실수 커밋 방지 |
| 민감값 검색 | 코드/문서 내 실제 인증값 잔존 확인 |
| `npm.cmd run build` | baseline build 상태 확보 |

## Step 1: Git/env 안전장치

목표:

- 실제 환경값과 내부 문서가 GitHub에 올라가지 않도록 한다.

작업:

| 작업 | 파일 |
|---|---|
| `.env`, `.env.*`, `!.env.example` 정책 추가 | `.gitignore` |
| 내부 문서 archive 제외 검토 | `.gitignore` |
| `.env.example` 추가 | `.env.example` |
| public docs 민감값 검사 유지 | `docs/**` |

주의:

- `.env.example`에는 placeholder만 둔다.
- `VITE_*`에는 민감값을 넣지 않는다.

## Step 2: 도메인 네이밍 기준 고정

목표:

- 보안 수정 전에 `exam`, `test`, `result`, `role`, `studentId`처럼 혼동되는 이름의 권장 대체어를 확정한다.
- Firestore migration이 필요한 이름과 code-only rename 가능한 이름을 분리한다.

예상 파일:

```text
src/types/domain.ts
docs/refactoring/NAMING_REVIEW.md
docs/refactoring/DOMAIN_TERMINOLOGY.md
```

우선 기준:

| 현재 용어 | 권장 용어 | 처리 |
|---|---|---|
| `exam` | `course` | service/type에서 먼저 mapping |
| `test` | `quiz` | 새 코드부터 `quiz` 사용 |
| `result` | `attemptResult` | 저장 payload와 최종 결과 구분 |
| `studentId` | `studentEmployeeId` | uid와 사번 혼동 방지 |
| `role` | `authRole` 또는 `profileRole` | claim 권한과 profile field 분리 |

주의:

- 기존 Firestore collection/field 이름은 이 단계에서 바로 바꾸지 않는다.
- 클라이언트 문서 필드 `role`은 권한 근거가 아니다.

## Step 3: Firebase config 분리

목표:

- Firebase 초기화가 `src/lib/firebase.ts`로 분리된 상태를 유지하고, 후속 보안 작업에서 `App.tsx`가 Firebase 설정값을 직접 다루지 않게 한다.

예상 파일:

```text
src/lib/firebase.ts
src/App.tsx
.env.example
```

최소 결과:

- `App.tsx`가 `initializeApp`, `getAuth`, `getFirestore`를 직접 호출하지 않는다.
- env 누락 시 명확한 오류가 발생한다.
- Firebase client configuration은 `VITE_FIREBASE_*`로 읽는다.

주의:

- Firebase client configuration은 공개 client 설정이다.
- 이 단계만으로 관리자/학생 인증값 보안이 해결되지 않는다.

## Step 3.5: 사번 검증 정책 고정

목표:

- 관리자 권한 개편 전에 허위 사번 가입과 사번 도용을 막을 검증 방식을 결정한다.
- 기존 사번 기반 UX는 유지하되, 등록 가능 여부를 client가 직접 판단하지 않도록 한다.

현재 근거:

| 항목 | 위치 | 현재 상태 |
|---|---|---|
| 사번 형식 제한 | `src/App.tsx:452` | UI에서 숫자만 남기고 최대 8자리 입력 |
| 사번 최종 검증 | `src/App.tsx:211-213` | 함수 내부에서는 길이 8자리만 확인 |
| 이름 검증 | `src/App.tsx:215-218` | 빈값만 검사하고 사번과 이름 매칭 없음 |
| 직원 명부 대조 | `src/App.tsx:211-221` | 구현 없음 |
| 회원가입 profile | `src/App.tsx:218` | client가 `role: 'student'`를 포함한 `users` 문서를 생성 |

정책 선택지:

| 선택지 | 판단 |
|---|---|
| client allowlist | 직원 명부가 bundle에 노출되므로 보안 대책으로 부적합 |
| 관리자 사전 등록 | 사내용 1차 운영에 현실적이며 허위 가입 차단 가능 |
| 일회용 등록코드 | 사번 UX를 유지하면서 최초 등록만 제한 가능 |
| Vercel/Firebase Function 검증 | client에 직원 명부를 노출하지 않아 권장 |

최소 결과:

- `verifyEmployeeForRegistration` 같은 검증 단계가 Auth 생성 전에 정의된다.
- 학생 등록 검증과 관리자 권한 판정은 분리된다.
- 공통 인증값 제거 작업의 전제 조건이 명확해진다.

## Step 4: Auth service 분리

목표:

- 학생 등록/로그인, 로그아웃, token claim 확인을 UI에서 분리한다.

예상 파일:

```text
src/services/authService.ts
src/hooks/useAuth.ts
src/App.tsx
```

작업:

| 작업 | 현재 근거 | 변경 방향 |
|---|---|---|
| 학생 등록/로그인 분리 | `src/App.tsx:211-221` | `registerStudent(...)`, `loginStudent(...)` |
| 사번 검증 분리 | `src/App.tsx:211-218` | `verifyEmployeeForRegistration(...)` |
| 관리자 권한 확인 분리 | `src/App.tsx:224-226` | `getCurrentUserClaims()` |
| profile 조회 분리 | `src/App.tsx:87-94` | `loadUserProfile(uid)` |
| role 판정 변경 | client profile role | Auth token claim |
| 용어 변경 | `role`, `adminPasswordInput`, 학생 공통 인증값 | `authRole` 기준, local credential 구조 제거 |

최소 결과:

- 관리자 인증값 비교가 UI 컴포넌트에서 사라진다.
- 학생 공통 인증값 의존을 제거할 준비가 된다.
- admin/student guard가 service 결과를 사용한다.

## Step 5: Firestore service 분리

목표:

- Firestore read/write를 역할별 service API로 분리한다.

예상 파일:

```text
src/services/examService.ts
src/services/resultService.ts
src/services/questionBankService.ts
src/services/progressService.ts
```

작업:

| 현재 코드 | 분리 방향 |
|---|---|
| `src/App.tsx:112-123` 관리자 데이터 구독 | 관리자 service로 이동 |
| `src/App.tsx:132-140` 학생 공개 과정/본인 결과 구독 | 학생 service로 이동 |
| `src/App.tsx:356` 결과 저장 | `saveStudentResult(...)` |
| `src/App.tsx:363-389`, `src/App.tsx:532` 과정 관리 | `createExam`, `updateExam`, `deleteExam`, `toggleCourseVisibility` |
| `src/App.tsx:393-397`, `src/App.tsx:586` 문제 관리 | `saveQuestion`, `deleteQuestion` |

네이밍 mapping:

| 기존 Firestore 이름 | service/domain 이름 |
|---|---|
| `exams` | `courses` |
| `results` | `attemptResults` |
| `questionBank` | `questionBankItems` |
| `studyProgress` | `studySessions` |
| `testProgress` | `quizAttempts` |

최소 결과:

- App은 service 함수만 호출한다.
- Rules 강화 후 실패 위치가 service 단위로 추적된다.
- role별 query 전환이 가능해진다.

## Step 6.5: Firestore Rules 초안 검증

목표:

- 저장소에 추가된 `firestore.rules` 초안을 Firebase Emulator 또는 staging project에서 검증한다.
- Rules 배포 전에 현재 client 코드와 충돌하는 지점을 확인한다.

현재 파일:

| 파일 | 상태 |
|---|---|
| `firestore.rules` | deny-by-default 초안 추가, Emulator 20개 시나리오 통과 |
| `firebase.json` | Firestore rules/indexes 연결 |
| `firestore.indexes.json` | 현재 custom composite index 없음 |
| `scripts/firestore-rules-emulator-test.mjs` | Rules 시나리오 helper 추가 |

검증 포인트:

| 항목 | 예상 |
|---|---|
| 비로그인 | 모든 collection read/write 거부 |
| 학생 | 공개 과정 read, 본인 결과/progress 접근 |
| 학생 | `questionBank`, 전체 `results`, `exams` write 거부 |
| 관리자 claim 없음 | 관리자 Firestore read/write 거부 |
| 관리자 claim 있음 | 과정/문제/결과 관리 가능 |

주의:

- 현재 앱의 관리자 로그인은 client state 기반이므로, Custom Claims 없이 Rules를 production에 배포하면 관리자 기능이 차단된다.
- Rules는 점수 계산, 정답 검증, 사번 실제 직원 검증을 완전히 보장하지 않는다.

## Step 7: Guard 적용

목표:

- 화면 렌더링과 Firestore query가 권한 확인 이후에만 실행되도록 한다.

예상 파일:

```text
src/features/admin/AdminGuard.tsx
src/features/student/StudentGuard.tsx
src/hooks/useAuth.ts
src/App.tsx
```

정책:

| guard | 허용 |
|---|---|
| AdminGuard | admin claim 사용자 |
| StudentGuard | student claim 또는 학생 정책 통과 사용자 |
| PublicRoute | 로그인/등록 화면 |

주의:

- client guard는 UX 장치이다.
- 실제 보안은 Firestore Rules 또는 서버 검증에서 보장해야 한다.

## Step 8: 전체 구독 제거

목표:

- 로그인 전 데이터 구독 차단 상태를 유지하고, 현재 `App.tsx` 내부 구독 로직을 service/hook 계층으로 분리한다.

현재 상태:

- `src/App.tsx:100-154`에서 비로그인 상태의 민감 collection state를 비우고 구독하지 않는다.
- 학생 profile이 있으면 공개 과정과 본인 결과만 구독한다.
- 관리자 화면에 진입한 경우에만 관리용 과정/결과/문제 저장고 데이터를 구독한다.
- 이 처리는 client-side 완화이며, Firestore Rules/Claims가 실제 권한 경계가 되어야 한다.

변경 방향:

| 사용자 | query |
|---|---|
| 비로그인 | 데이터 구독 없음 |
| 학생 | 공개 과정, 본인 진행/결과 |
| 관리자 | 관리자 화면 진입 후 필요한 관리 데이터 |

최소 결과:

- Firestore Rules가 강화되어도 비로그인 첫 화면이 권한 오류를 만들지 않는다.
- 학생이 관리자 데이터 영역을 요청하지 않는다.

## Step 9: 학생/관리자 화면 분리

목표:

- 보안 수정 후 화면 regression을 줄인다.

순서:

1. `StudentDashboard`
2. `StudentEntry`
3. `StudentTake`
4. `StudentResult`
5. `AdminDashboard`
6. `ExamManager`
7. `QuestionBankManager`
8. `ResultAnalytics`

주의:

- 화면 분리와 디자인 변경을 동시에 하지 않는다.
- JSX 이동 후 기능 동작을 먼저 맞춘다.

## Step 10: UX/안정성 보강

| 항목 | 이유 |
|---|---|
| 저장 실패 처리 | 결과 저장 실패 후 완료 화면 이동 방지 |
| 미응답 제출 방지 | 시험 제출 데이터 품질 보장 |
| loading/error 분리 | Rules/네트워크 실패를 사용자에게 설명 |
| Toast 접근성 | screen reader 알림 보장 |
| 모바일 뒤로가기 | 학생/관리자 이탈 정책 일관화 |

## Step 11: 테스트 가능 함수 분리

분리 후보:

| 함수 | 테스트 목적 |
|---|---|
| `parseCsvQuestions` | CSV 입력 검증 |
| `validateExamDraft` | 관리자 과정 저장 검증 |
| `selectExamQuestions` | 랜덤/출제 수 로직 검증 |
| `calculateResult` | 점수 계산 검증 |
| `buildResultPayload` | Firestore 저장 스키마 검증 |
| `parseAuthClaims` | role guard 검증 |

## Step 12: Production verification

| 검증 | 기준 |
|---|---|
| local build | `npm.cmd run build` 성공 |
| Vercel env | Preview/Production 값 분리 |
| Firebase Rules | Emulator 20개 시나리오 통과, staging 검증 필요 |
| student smoke | 로그인, 학습, 퀴즈, 저장 |
| admin smoke | claim 계정만 접근, 과정/문제/결과 관리 |
| failure smoke | 권한 실패/네트워크 실패 UI |

## 리팩토링 없이 바로 보안 수정할 경우 예상 문제

| 문제 | 설명 |
|---|---|
| 변경 범위 폭증 | `App.tsx`에서 인증, query, UI, toast를 동시에 수정해야 함 |
| 권한 오류 추적 어려움 | 어떤 Firestore 호출이 Rules에 막혔는지 UI와 섞여 파악 어려움 |
| 학생 흐름 회귀 | 관리자 guard 수정 중 학생 `view` 전환과 상태가 영향 받을 수 있음 |
| 관리자 흐름 회귀 | 결과/문제 query 변경이 관리자 탭 렌더링에 영향 가능 |
| production runtime 오류 | env 누락/권한 실패/loading 부재가 첫 화면 장애로 보일 수 있음 |
| 테스트 부재 | CSV/채점/결과 저장 회귀를 자동 검증하기 어려움 |

## 코드 수정 착수 전 체크리스트

```bash
git status
git grep --untracked -n "[SENSITIVE_PATTERN]" .
npm.cmd run build
```

확인:

- 실제 인증값이 코드/문서에 남아 있지 않다.
- `docs/internal/`과 내부 archive가 커밋 대상이 아니다.
- 보안 리팩토링은 작은 PR 또는 작은 commit 단위로 나눈다.
- 첫 commit은 env/config/service 분리까지만 포함하는 것을 권장한다.
