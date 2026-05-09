# Employee ID Auth Review

## 목적

현재 앱의 사번 기반 로그인/최초 등록 흐름이 실제 직원 검증을 수행하는지 확인하고, 허위 사번 입력 시 발생하는 동작과 보안 위험을 실제 코드 기준으로 정리한다.

이 문서는 공개 저장소에 포함될 수 있도록 실제 관리자 인증값, 학생 공통 인증값, Firebase 실제 설정값을 기록하지 않는다. 인증값은 `[MASKED_*]` 형태로만 표현한다.

## 분석 기준

| 항목 | 실제 코드 위치 | 확인 결과 |
|---|---|---|
| 사용자 profile 타입 | `src/App.tsx:25` | `uid`, `employeeId`, `name`, `role`만 정의되어 있으며 별도 `profileRole`은 없다 |
| 학생 인증 상태 | `src/App.tsx:39-41` | `authMode`, `empIdInput`, `nameInput` local state로 관리 |
| 관리자 인증 상태 | `src/App.tsx:42` | `adminPasswordInput` local state로 관리 |
| Auth/profile 로딩 | `src/App.tsx:87-94` | Firebase Auth 사용자 발생 시 `users/{uid}` 문서를 1회 조회 |
| Firestore 구독 | `src/App.tsx:100-154` | 비로그인 상태의 전체 구독은 제거됨. 학생은 공개 과정/본인 결과, 관리자는 관리자 화면 진입 후 관리 데이터 구독 |
| 회원가입/로그인 함수 | `src/App.tsx:211-221` | 사번 8자리 확인 후 pseudo email과 공통 인증값으로 Auth 처리 |
| 관리자 로그인 함수 | `src/App.tsx:224-226` | Firebase Auth/claim 없이 local 입력값과 하드코딩 값 비교 |
| 사번 입력 UI | `src/App.tsx:450-455` | UI 입력 단계에서 숫자만 남기고 최대 8자리 입력 |
| Firestore Rules 파일 | `firestore.rules`, `firebase.json` | deny-by-default 초안은 추가됐지만 실제 Firebase 배포/Emulator 검증 전 |

## 현재 학생 인증 흐름

### 최초 등록

1. 사용자가 로그인 카드에서 `최초 등록` 모드를 선택한다.
2. UI는 사번 입력값에서 숫자가 아닌 문자를 제거하고, 최대 8자리까지 입력받는다.
3. 사용자가 이름을 입력한다.
4. `handleStudentAuth`는 `empIdInput.length !== 8`만 검사한다.
5. 최종 사번은 화면 prefix와 입력값을 조합한 형태로 만든다.
6. pseudo email을 만든 뒤, 모든 학생에게 동일한 공통 인증값 `[MASKED_STUDENT_SHARED_CREDENTIAL]`로 `createUserWithEmailAndPassword`를 호출한다.
7. 성공하면 `users/{uid}` 문서에 `uid`, `employeeId`, `name`, `role: 'student'`를 저장한다.

### 로그인

1. 사용자가 `로그인` 모드를 선택한다.
2. 사번 8자리를 입력한다.
3. `handleStudentAuth`는 같은 pseudo email과 같은 공통 인증값으로 `signInWithEmailAndPassword`를 호출한다.
4. 로그인 성공 후 `onAuthStateChanged`에서 `users/{uid}` 문서를 조회하고, 문서가 있으면 `userProfile`로 설정한다.

## 반드시 확인할 질문

| 질문 | 실제 코드 기준 답변 | 근거 |
|---|---|---|
| 1. 사번은 몇 자리/어떤 형식만 검증하는가? | 일반 UI에서는 숫자 8자리만 입력된다. 함수 내부 검증은 길이 8자리만 확인한다. | `src/App.tsx:211-213`, `src/App.tsx:452` |
| 2. 실제 직원 목록과 대조하는가? | 대조하지 않는다. 저장소 코드에 직원 allowlist, 사번 검증 API, 사번/이름 매칭 로직이 없다. | `src/App.tsx:211-221` |
| 3. 이름과 사번이 매칭되는지 확인하는가? | 확인하지 않는다. 등록 모드에서 이름 빈값만 검사하고 그대로 저장한다. | `src/App.tsx:215-218` |
| 4. 허위 8자리 사번으로 회원가입 가능한가? | 가능성이 높다. Firebase Auth 중복이나 Rules/네트워크 오류가 없다면 새 계정과 `users` 문서가 생성된다. | `src/App.tsx:211-218` |
| 5. 이미 존재하는 사번이면 어떻게 되는가? | pseudo email이 같으므로 Auth 계정 생성은 Firebase 중복 오류로 실패한다. 앱은 구체 오류 대신 일반 안내만 보여준다. | `src/App.tsx:213-221` |
| 6. 다른 사람 사번으로 로그인 가능한가? | 해당 사번의 Auth 계정이 이미 있으면 가능하다. 로그인에 개인별 인증값이 필요하지 않기 때문이다. | `src/App.tsx:213-219` |
| 7. 고정 인증값 구조 때문에 계정 탈취 가능성이 있는가? | 있다. 사번을 알거나 추측할 수 있으면 같은 공통 인증값으로 로그인할 수 있는 구조다. | `src/App.tsx:213-219` |
| 8. users 문서의 role을 사용자가 조작할 수 있는가? | Rules 초안은 학생 profile create를 제한하지만, 실제 배포/검증 전이다. client가 `role` 필드를 쓰는 구조는 계속 주의가 필요하다. | `src/App.tsx:218`, `firestore.rules` |
| 9. 회원가입 직후 어떤 Firestore 권한이 생기는가? | 코드상 Firebase Auth 사용자와 `users` profile 문서가 생긴다. 실제 운영 권한은 배포된 Firestore Rules에 달려 있으며, 현재 Rules는 초안 단계다. | `src/App.tsx:217-218`, `firestore.rules` |
| 10. 비로그인 상태에서도 어떤 데이터를 읽는가? | 현재 코드에서는 비로그인 상태에서 `exams`, `results`, `questionBank` 구독을 시작하지 않는다. 단, Firestore Rules가 없으면 client 수정/직접 호출에 대한 최종 방어는 불가능하다. | `src/App.tsx:100-154` |

## 시나리오별 동작 분석

| 시나리오 | 예상 코드 흐름 | 실제 결과 | 위험도 |
|---|---|---|---|
| 실제 직원 사번 입력 | 숫자 8자리 입력 후 pseudo email 생성, Auth 생성/로그인 | 직원 여부 검증 없이 Auth 기준으로만 처리된다 | 높음 |
| 허위 8자리 사번 입력 | 형식 통과 후 신규 Auth 계정 생성 시도 | 중복이 없으면 허위 학생 계정 생성 가능성이 높다 | 치명 |
| 이미 등록된 사번 입력 | 같은 pseudo email로 계정 생성 시도 | 등록 모드는 Firebase 중복 오류. 로그인 모드는 공통 인증값으로 성공 가능 | 치명 |
| 다른 사람 사번 입력 | 다른 사람 사번으로 pseudo email 생성 | 이미 등록된 사번이면 로그인 가능. 미등록이면 선점 등록 가능 | 치명 |
| 이름만 다르게 입력 | 이름 빈값 검사만 통과 | 사번과 이름 매칭 없이 임의 이름이 `users` 문서에 저장된다 | 높음 |
| 관리자 사번 추측 입력 | 학생 로그인 함수로만 처리 | 사번만으로 관리자 화면에 들어가지는 않지만, 학생 계정 위장은 가능하다 | 보통 |
| 비로그인 상태 진입 | Auth/profile이 없으면 민감 collection state를 비우고 구독하지 않음 | 앱 UI 기준 로그인 전 전체 구독은 제거됨. Rules 부재 위험은 남아 있다 | 보통 |
| Firebase Auth 계정은 있으나 users 문서가 없는 경우 | Auth 상태는 성공, `users/{uid}` 조회는 실패 | `userProfile`이 설정되지 않아 로그인 카드가 남을 수 있다. Auth 사용자와 UI 상태가 어긋난다 | 높음 |

## 보안 위험 분석

| 위험 | Severity | 원인 | 영향 | 권장 조치 |
|---|---|---|---|---|
| 허위 계정 생성 | 치명 | 사번이 실제 직원인지 검증하지 않음 | 외부인 또는 내부 임의 사용자가 교육/시험 데이터 접근 가능 | 서버 측 allowlist 또는 관리자 사전 등록 도입 |
| 사번 도용 | 치명 | 사번만 알면 같은 인증 흐름 사용 가능 | 타인의 학습/응시 기록 생성 또는 조회 가능 | 개인별 인증 또는 일회용 등록코드 적용 |
| 고정 인증값 기반 로그인 | 치명 | 모든 학생 로그인에 같은 client-side 인증값 사용 | 사번 추측만으로 계정 접근 가능 | 공통 인증값 제거, Auth 계정별 인증 또는 서버 발급 토큰 사용 |
| 이름 검증 부재 | 높음 | 이름 빈값만 검사 | 허위 이름, 사번/이름 불일치 profile 생성 | 사번+이름 allowlist 검증 또는 관리자 승인 |
| role/profile role 조작 가능성 | 치명 | client가 `role` 필드를 저장하고 Rules 파일이 없음 | Rules가 약하면 권한 상승 또는 데이터 조작 가능 | Custom Claims와 deny-by-default Rules 적용 |
| Firestore Rules 없는 client-side 제한 | 치명 | 구독 시작 시점은 완화됐지만 권한 자체는 서버에서 강제되지 않음 | client 변조나 직접 SDK 호출에 취약 | Firestore Rules와 Auth claim 적용 |
| 관리자 사번 추측 가능성 | 보통 | 관리자 권한은 사번이 아니라 별도 local 인증값으로 분리되어 있음 | 직접 admin 진입과는 별개이나 학생 계정 위장 위험은 남음 | 관리자 Auth/claim 분리와 학생 검증을 별도 설계 |

## 개선 옵션 비교

| 옵션 | 보안 수준 | 구현 난이도 | 현재 UX 유지 여부 | Firebase/Vercel 적용 난이도 | 추천 여부 |
|---|---|---|---|---|---|
| Option A: 직원 allowlist JSON/CSV | 낮음-중간 | 낮음 | 높음 | 저장 위치에 따라 다름 | 단독 적용 비추천 |
| Option B: 관리자 사전 등록 방식 | 높음 | 중간 | 중간 | Firebase Auth/profile 관리 도구 필요 | 1차 운영안으로 추천 |
| Option C: 초대코드/일회용 등록코드 | 높음 | 중간 | 높음 | 코드 발급/만료 저장소와 Rules 필요 | 사번 UX 유지 시 추천 |
| Option D: 회사 이메일/SSO | 매우 높음 | 높음 | 낮음-중간 | 조직 IdP 또는 이메일 정책 필요 | 장기 권장 |
| Option E: Vercel Function/Firebase Function 검증 | 높음-매우 높음 | 중간-높음 | 높음 | 서버 env, 배포, 로그, rate limit 필요 | 권장 |

### Option A 상세 판단

| 저장 위치 | 판단 |
|---|---|
| client bundle JSON/CSV | 직원 명부가 사용자에게 노출되므로 보안 장치가 아니다 |
| public Firestore/Storage | 읽기 권한이 열려 있으면 직원 명부 노출 위험이 있다 |
| 보호된 Firestore | Rules를 먼저 정확히 구성해야 하며, client 단독 검증으로는 부족하다 |
| Vercel Function/Firebase Function 내부 | client가 명부를 직접 보지 않으므로 가장 안전하다 |

## 추천안

사내용 교육 웹의 현실적인 1차 개선안은 사번 기반 UX를 유지하되, 등록 검증을 client가 아니라 서버 또는 관리자 승인 흐름으로 이동하는 것이다.

권장 조합:

| 구성 | 방향 |
|---|---|
| 학생 UX | 기존처럼 사번과 이름을 입력한다 |
| 검증 위치 | Vercel Function 또는 Firebase Function에서 사번/이름/초대코드를 검증한다 |
| 직원 명부 | client bundle에 넣지 않는다. 서버 환경 또는 보호된 관리 데이터로 둔다 |
| 최초 등록 | 검증 성공 시에만 Firebase Auth 계정 또는 custom token/profile을 생성한다 |
| 로그인 | 공통 인증값을 제거하고 개인별 Auth 또는 서버 발급 세션 구조로 바꾼다 |
| 관리자 권한 | 학생 가입 검증과 분리하고 Custom Claims로만 판정한다 |
| Firestore Rules | `request.auth.uid`와 claim 기준으로 본인 데이터만 허용한다 |

## 관리자 권한 개선 전 선행 작업

| 선행 작업 | 이유 | 우선순위 |
|---|---|---|
| 사번 검증 정책 결정 | 학생 계정이 허위로 늘어나면 admin claim을 도입해도 데이터 신뢰성이 깨진다 | P0 |
| 공통 인증값 제거 전략 결정 | 사번 도용 위험을 먼저 줄여야 한다 | P0 |
| 직원 allowlist 저장 위치 결정 | client 공개 저장소/번들에 직원 명부를 넣으면 안 된다 | P0 |
| `users` profile과 Auth claim 역할 분리 | profile `role`은 권한 근거가 아니어야 한다 | P0 |
| 로그인 후 Firestore 구독 정책 유지 | 비로그인/미검증 사용자의 데이터 접근 시도를 계속 막아야 한다 | P1 |

## 다음 코드 수정 권장 순서

1. `src/services/authService.ts`를 만들고 현재 `handleStudentAuth` 흐름을 함수 단위로 분리한다.
2. `src/services/employeeVerificationService.ts` 또는 Vercel Function 호출 layer를 설계한다.
3. 학생 최초 등록 전에 `verifyEmployeeForRegistration` 단계를 추가한다.
4. 공통 인증값 사용을 중단할 Auth 정책을 확정한다.
5. `users` 문서의 `role`은 profile 표시용으로 낮추고, 권한은 Auth claim으로 분리한다.
6. `onSnapshot(collection(db, ...))` 호출을 로그인/역할 확인 이후로 이동한다.
7. Firestore Rules를 deny-by-default로 작성하고 emulator 또는 staging에서 검증한다.

## 결론

현재 앱은 사번 기반 UX를 제공하지만, 실제 직원 검증 시스템은 구현되어 있지 않다. 일반 UI 기준으로 숫자 8자리 형식은 제한하지만, 허위 사번과 임의 이름을 실제 직원 데이터와 대조하지 않는다.

따라서 관리자 권한 개편 전에 학생 가입 검증을 먼저 설계해야 한다. 사번 기반 UX는 유지하되, 등록 가능 여부는 server-side 검증 또는 관리자 사전 등록/초대코드 방식으로 제한하는 것이 현실적인 1차 개선안이다.
