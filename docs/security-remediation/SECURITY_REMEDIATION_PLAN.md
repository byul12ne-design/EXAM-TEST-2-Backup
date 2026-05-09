# Security Remediation Plan

## 목적

현재 프로젝트의 최우선 개선 대상은 인증값 노출과 클라이언트 권한 검증 구조이다. 이 문서는 실제 코드 기준으로 확인한 위험을 정리하고, Vercel 자동배포 환경을 고려한 보안 개선 단계를 제안한다.

실제 민감값은 이 문서에 기록하지 않는다. 모든 인증값, Firebase 실제 설정값, 운영 환경 값은 placeholder 또는 역할 중심 표현으로만 설명한다.

## 현재 코드 확인 결과

| 확인 항목 | 실제 위치 | 현재 상태 | 보안 영향 |
|---|---|---|---|
| Firebase client configuration | `src/lib/firebase.ts` | `VITE_FIREBASE_*` 환경변수 기반으로 분리됨 | client 설정값 자체는 서버 민감값은 아니지만, Firestore Rules가 없으면 DB 보호가 되지 않는다 |
| Firebase Auth 초기화 | `src/lib/firebase.ts`, `src/App.tsx:10` | 공통 Firebase 모듈에서 `auth` import | 정상 구조이나 권한 검증은 별도 Rules/Claims 필요 |
| Firestore 초기화 | `src/lib/firebase.ts`, `src/App.tsx:10` | 공통 Firebase 모듈에서 `db` import | client read/write가 Rules에 전적으로 의존 |
| 학생 공통 인증값 | `src/App.tsx:211-219` | pseudo email + 공통 인증값 방식 | 기존 미해결 이슈. 사번을 알면 타인 계정 접근 위험 |
| 사번 실제 직원 검증 | `src/App.tsx:211-221`, `src/App.tsx:450-455` | UI는 숫자 8자리만 제한하고 실제 직원 명부 대조 없음 | 허위 사번 가입, 사번 선점, 사번 도용 위험 |
| 관리자 인증값 | `src/App.tsx:42`, `src/App.tsx:224-226`, `src/App.tsx:899-903` | local state 입력값과 하드코딩 비교 | 관리자 권한이 Firebase Auth/role과 연결되지 않음 |
| 관리자 화면 접근 | `src/App.tsx:224-226`, `src/App.tsx:495`, `src/App.tsx:655`, `src/App.tsx:899` | `view` 상태 전환 기반 | 클라이언트 상태만으로 관리자 화면 접근 제어 |
| Firestore 데이터 구독 | `src/App.tsx:100-154` | 비로그인 구독은 제거됨. 학생은 공개 과정과 본인 결과만, 관리자는 관리자 화면 진입 후 전체 관리 데이터를 구독 | client-side 완화일 뿐이며 Rules/Claims 없이는 최종 보안 경계가 아님 |
| Firestore write | `src/App.tsx:186-188`, `src/App.tsx:218`, `src/App.tsx:275`, `src/App.tsx:314`, `src/App.tsx:356`, `src/App.tsx:363-397`, `src/App.tsx:532`, `src/App.tsx:586`, `src/App.tsx:606` | client에서 직접 생성/수정/삭제 | Rules 미검증 상태에서는 운영 DB 위변조 위험 |
| Firestore Rules 파일 | `firestore.rules`, `firebase.json`, `firestore.indexes.json` | deny-by-default 초안 추가. 실제 Firebase 배포는 하지 않음 | 관리자 claim이 아직 없어 그대로 production 적용 시 관리자 기능 차단 가능 |
| Vercel 설정 | 저장소 전체 검색 | `vercel.json`, `.vercelignore` 없음 | Dashboard 설정에 의존. repo만으로 production 설정 확정 불가 |
| Vercel env 사용 | `src/lib/firebase.ts`, `.env.example`, `docs/operations/VERCEL_ENV_STATUS.md` | Firebase web client 설정을 Vercel env에 등록하는 구조 | Dashboard 실제 값과 배포 로그는 저장소만으로 확정 불가 |
| `.env.example` | `.env.example` | Firebase web client 설정 변수명 placeholder 제공 | 실제 값은 `.env.local`/Vercel Dashboard에서 관리 |
| internal archive | `.gitignore` | `docs/internal/`, `docs/internal.zip` 제외 정책 포함 | 내부 문서 실수 커밋 방지 |

## 핵심 위험 요약

| severity | 위험 | 원인 | 즉시 조치 방향 |
|---|---|---|---|
| 치명 | 관리자 인증값 노출 | client bundle에 비교값 포함 | Firebase Auth + Custom Claims 기반으로 전환 |
| 치명 | 학생 공통 인증값 노출 | 모든 학생이 같은 인증값으로 로그인 | 개인별 인증 정책 또는 서버 검증으로 전환 |
| 치명 | 허위 사번 가입/사번 도용 | 실제 직원 명부 대조 없이 사번 8자리만 확인 | server-side 사번 검증, 관리자 사전 등록, 초대코드 중 하나 적용 |
| 치명 | 권한 없는 write 가능성 | Rules 초안은 Emulator 20개 시나리오를 통과했지만 아직 production 배포 전 | admin claim 정책 확정 후 staging/production 배포 |
| 높음 | 클라이언트 구독 게이트 한계 | 비로그인 구독은 제거됐지만 관리자/학생 판정이 아직 client state/profile 기반 | Firestore Rules와 Auth Claims로 서버 측 권한 강제 |
| 높음 | 결과 저장 위변조 가능성 | client가 점수/답안/결과를 생성 | 서버 검증 또는 Rules 검증 강화 |
| 보통 | Vercel env 미사용 | 환경별 설정 분리 없음 | `.env.example`, Vercel env, preview/prod 분리 |

## env 사용 원칙

### GitHub에 올려도 되는 것

| 항목 | 조건 |
|---|---|
| public docs | 실제 값, 운영 식별자, 우회 절차 없이 작성 |
| `.env.example` | 변수명과 placeholder만 포함 |
| Firebase client configuration 변수명 | 실제 값 없이 변수명만 포함 |
| Vercel 설정 예시 | rewrite, build/output 예시만 포함 |
| 보안상 민감하지 않은 public client 설정 | 브라우저에 노출되어도 권한을 주지 않는 값만 포함 |

### GitHub에 올리면 안 되는 것

| 항목 | 이유 |
|---|---|
| 실제 관리자 인증값 | 관리자 접근 권한 노출 |
| 실제 학생 공통 인증값 | 전체 학생 계정 접근 위험 |
| service account key | Firebase Admin 권한 탈취 위험 |
| private key | 서버 권한 탈취 위험 |
| server API 민감값 | 서버 기능 악용 위험 |
| production DB 접근 민감값 | 운영 데이터 위변조 위험 |
| `.env.local` | 로컬 실제 값 포함 가능 |
| `.env.production` | 운영 실제 값 포함 가능 |

### Vite/Vercel env 주의

- `VITE_*` 환경변수는 브라우저 번들에 포함된다.
- 따라서 `VITE_*`에는 민감값을 넣으면 안 된다.
- Firebase client configuration은 일반적으로 서버 민감값이 아니지만, Firestore Rules가 반드시 필요하다.
- 관리자 인증값이나 학생 공통 인증값을 `VITE_*`로 옮기는 것은 보안 해결책이 아니다.
- Vercel Dashboard에 등록한 `VITE_*` 값도 build 결과물에서는 사용자가 볼 수 있다.

## 보안 개선 옵션 비교

| 옵션 | 보안 수준 | 구현 난이도 | 변경 범위 | Vercel 배포 영향 | GitHub 공개 가능성 | 추천 여부 |
|---|---|---|---|---|---|---|
| Option A: 최소 수정 | 낮음 | 낮음 | Firebase client configuration 분리, `.env.example`, `.gitignore` 정리 | Vercel env 등록 필요. runtime 구조는 거의 동일 | 가능. 실제 값 없이 변수명만 공개 | 임시 완화로만 사용 |
| Option B: 권장 수정 | 높음 | 중간 | Firebase Auth, Custom Claims, role guard, Rules, query 구조 변경 | Vercel client env + Firebase Console/Admin claim 설정 필요 | 가능. 권한 정책과 placeholder만 공개 | 1차 권장 |
| Option C: 운영 수준 | 매우 높음 | 높음 | Vercel Serverless Function 또는 별도 backend, 서버 검증, Admin SDK | Vercel Function env, server runtime, 배포/로그 관리 필요 | 가능. 서버 민감값은 Dashboard에만 저장 | 상용 운영 목표 시 권장 |

## 권장 방향

1차 목표는 Option B이다. 현재 앱은 Firebase client SDK 중심 구조이므로 Firebase Auth + Custom Claims + Firestore Rules로 권한 경계를 먼저 세우는 것이 현실적이다.

학생 UX는 기존 사번 기반 흐름을 유지할 수 있지만, 등록 가능 여부는 client가 아니라 서버 검증 또는 관리자 사전 등록으로 결정해야 한다. 현재 코드에는 실제 직원 명부 대조가 없으므로, 관리자 권한 개선 전에 허위 사번 가입 차단 정책을 먼저 확정해야 한다.

상용 운영 또는 고위험 시험/평가 데이터라면 Option C로 이동해야 한다. 특히 점수 계산, 결과 제출, 관리자 write는 서버 검증으로 보내는 것이 더 안전하다.

## 단계별 수정 플랜

### Phase 1: 즉시 노출 제거

목표:

- 코드에 남아 있는 실제 인증값을 제거한다.
- 단, `.env.local` 이동은 임시 완화일 뿐 보안 해결책이 아님을 명시한다.

수정 대상:

| 대상 | 작업 |
|---|---|
| `src/lib/firebase.ts`, `.env.example` | Firebase client configuration env 분리 상태 유지 및 env 누락 오류 검증 |
| `src/App.tsx` | 관리자/학생 공통 인증값 하드코딩 제거 |
| 사번 검증 정책 | 허위 사번 가입 차단 방식 결정 |
| `.gitignore` | `.env`, `.env.*`, `!.env.example`, `docs/internal.zip` 정책 유지 |
| public docs | 실제 값이 남아 있지 않은지 재검사 |

주의:

- 관리자/학생 인증값을 `.env.local` 또는 Vercel `VITE_*`로 옮기는 것은 임시 노출 완화일 뿐이다.
- 실제 보안 해결은 Phase 2와 Phase 3이 완료되어야 한다.

### Phase 2: Firebase Auth/Roles 설계

목표:

- 클라이언트 임의 상태가 아니라 Firebase Auth token 기반으로 role을 판정한다.

설계 항목:

| 항목 | 방향 |
|---|---|
| 관리자 계정 | Firebase Auth 계정 + Custom Claims `role=admin` |
| 학생 계정 | 개인별 계정 또는 검증된 사번 기반 계정. 공통 인증값 제거 |
| 사번 검증 | client bundle이 아니라 Vercel Function/Firebase Function, 관리자 사전 등록, 또는 일회용 등록코드로 검증 |
| role 상태 | `currentUser.getIdTokenResult()`의 claim 기준 |
| 관리자 화면 guard | claim 확인 전 관리자 route/render 차단 |
| 권한 실패 UX | "권한이 없습니다" 화면과 로그아웃/재로그인 CTA 제공 |

### Phase 3: Firestore Rules

목표:

- Rules를 deny-by-default로 작성하고 역할별 read/write만 허용한다.
- 현재 저장소에는 `firestore.rules` 초안이 추가되어 있으나, Firebase Console/CLI 배포는 아직 하지 않는다.
- 현재 관리자 인증 구조가 client 상태 기반이므로, 초안 Rules를 그대로 production에 적용하면 관리자 기능이 차단될 수 있다.

정책:

| 데이터 범위 | 학생 | 관리자 |
|---|---|---|
| 공개 과정/문제 읽기 | 공개된 데이터만 read | 전체 read |
| 학습/퀴즈 진행 | 본인 데이터만 read/write | 필요 시 read |
| 결과 | 본인 결과만 create/read | 전체 read/delete/export |
| 과정/문제 관리 | 불가 | create/update/delete 가능 |
| 사용자 프로필 | 본인 read, 제한된 create/update | 관리자 관리 가능 |

중요:

- 로그인 전 전체 구독 차단 상태를 유지한다.
- client에서 보낸 role 필드는 신뢰하지 않는다.
- 결과 점수/정답 여부는 Rules만으로 완전 검증하기 어렵다. 운영 수준에서는 서버 검증이 필요하다.
- 관리자 판별은 `request.auth.token.admin == true` placeholder이며, 실제 Custom Claims 정책 확정이 필요하다.

### Phase 4: Client Refactor

목표:

- 인증, 권한, Firestore 접근, UI 상태를 분리한다.

수정 대상:

| 영역 | 작업 |
|---|---|
| Firebase config | `src/lib/firebase.ts` 또는 `src/services/firebase.ts`로 분리 |
| auth service | 로그인/로그아웃/claim refresh 분리 |
| admin guard | 관리자 화면 진입 전 claim 확인 |
| Firestore service | role별 query 함수로 분리 |
| query 최소화 | 전체 컬렉션 구독 제거, 조건/limit/pagination 적용 |
| error/loading UI | 권한 거부, 네트워크 실패, 저장 실패 표시 |

### Phase 5: Production Verification

목표:

- Vercel 자동배포와 Firebase 권한 정책이 실제 production에서 일치하는지 검증한다.

체크리스트:

| 항목 | 검증 |
|---|---|
| Vercel env | preview/prod 각각 등록 |
| Vercel build | production build 성공, chunk warning 기록 |
| Firebase Rules | 초안 파일은 저장소에 추가됐고 Emulator 20개 시나리오 통과. staging project 검증 필요 |
| 관리자 로그인 | admin claim 계정만 접근 |
| 학생 로그인 | 본인 데이터만 접근 |
| 결과 저장 | 권한/스키마 검증 |
| 네트워크 실패 | 저장 실패/권한 실패 UX 확인 |
| production smoke test | 배포 URL에서 첫 진입, 로그인, 제출, 관리자 접근 확인 |

## 다음 실제 코드 수정 순서

1. `.gitignore`에 env/archive ignore 정책 보강.
2. `.env.example` 추가.
3. Firebase client configuration을 `src/lib/firebase.ts`로 이동.
4. 하드코딩 관리자/학생 인증값 제거.
5. Firebase Auth login 흐름 재설계.
6. admin claim 확인 함수 추가.
7. Firestore Rules 초안 emulator 검증 및 Custom Claims 정책 확정.
8. `onSnapshot` 구독이 인증/역할 상태 이후에만 실행되는지 유지하고 service 계층으로 분리.
9. 결과 저장 실패/권한 실패 UI 추가.
10. Vercel preview/prod env 등록 후 smoke test.
