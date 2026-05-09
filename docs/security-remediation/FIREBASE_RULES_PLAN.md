# Firebase Rules Plan

## 목적

현재 프로젝트는 Firebase Auth와 Firestore를 client에서 직접 사용한다. 따라서 운영 보안은 client query 제한이 아니라 Firestore Rules와 Auth claim 정책에서 강제되어야 한다.

이번 단계에서는 실제 Firebase 배포를 하지 않고, 현재 collection 이름을 유지한 `firestore.rules` 초안을 저장소에 추가한다. 실제 관리자 uid, 운영 project 값, secret은 문서와 Rules에 기록하지 않는다.

## 현재 추가된 파일

| 파일 | 상태 | 목적 |
|---|---|---|
| `firestore.rules` | 신규 추가 | deny-by-default 기반 Firestore Rules 초안 |
| `firebase.json` | 신규 추가 | Firebase CLI가 rules/indexes 파일을 찾을 수 있게 연결 |
| `firestore.indexes.json` | 신규 추가 | 현재 custom composite index 없음. 빈 indexes 상태 |

## 현재 Firestore 접근 요약

| 범위 | 실제 코드 위치 | 현재 동작 | Rules 초안 방향 |
|---|---|---|---|
| 사용자 프로필 읽기 | `src/App.tsx:92` | Auth 사용자 uid로 `users/{uid}` read | 본인 또는 admin claim만 read |
| 학생 프로필 생성 | `src/App.tsx:218` | client에서 `users/{uid}` create | 본인 uid, `role: student`, 사번 형식, 이름 존재만 허용 |
| 관리자 데이터 구독 | `src/App.tsx:113-123` | 관리자 화면에서 `exams`, `results`, `questionBank` 구독 | admin claim 필요 |
| 학생 과정 구독 | `src/App.tsx:133-139` | `isVisible == true` 과정만 구독 | 로그인 사용자에게 공개 과정만 read 허용 |
| 학생 결과 구독 | `src/App.tsx:135-141` | `studentId == userProfile.employeeId` 결과만 구독 | profile의 employeeId와 결과 studentId가 일치할 때만 read |
| 문제 저장고 일괄 추가 | `src/App.tsx:186-188` | client batch write | admin claim 필요 |
| 진행 데이터 저장/삭제 | `src/App.tsx:233-234`, `src/App.tsx:245-256`, `src/App.tsx:276-278`, `src/App.tsx:304-315`, `src/App.tsx:327-334` | doc id가 `{uid}_{examId}` 형태 | doc id가 현재 auth uid prefix일 때만 get/create/update/delete |
| 결과 저장 | `src/App.tsx:356` | client에서 결과 create | profile employeeId와 request studentId 일치 시 create |
| 과정 관리 | `src/App.tsx:363-389`, `src/App.tsx:532` | client에서 과정 create/update/delete | admin claim 필요 |
| 문제 관리 | `src/App.tsx:393-397`, `src/App.tsx:586` | client에서 문제 create/update/delete | admin claim 필요 |
| 결과 삭제 | `src/App.tsx:606` | client batch delete | admin claim 필요 |

## Rules 설계 원칙

| 원칙 | 설명 |
|---|---|
| deny by default | 명시적으로 허용하지 않은 read/write는 거부 |
| request.auth 필수 | 공개 과정도 로그인 사용자에게만 허용 |
| client role 불신 | `users.role`은 학생 profile 생성 검증용일 뿐 관리자 권한 근거가 아님 |
| admin claim placeholder | 현재는 `request.auth.token.admin == true`를 임시 기준으로 둠 |
| 본인 데이터 제한 | 학생은 uid 또는 employeeId 기준 본인 데이터만 접근 |
| 관리자 write 제한 | 과정/문제/전체 결과 관리는 admin claim 필요 |
| collection rename 없음 | `users`, `exams`, `results`, `questionBank`, `studyProgress`, `testProgress` 유지 |

## Rules 정책 요약

| Collection | 학생 read | 학생 write | 관리자 read/write | 비고 |
|---|---|---|---|---|
| `users` | 본인 doc만 get | 본인 doc 최초 create만 허용 | admin claim 사용자 허용 | 학생 update/delete는 차단 |
| `exams` | `isVisible == true` 문서만 read | 불가 | 전체 read/write/delete | 공개 과정 query와 맞춤 |
| `results` | `studentId`가 본인 profile employeeId와 같은 문서만 read | 본인 결과 create만 허용 | 전체 read/delete | update는 차단 |
| `questionBank` | 불가 | 불가 | 전체 read/write | 학생은 과정 문서에 포함된 문제만 사용 |
| `studyProgress` | 본인 uid prefix doc만 get | 본인 uid prefix doc만 create/update/delete | 현재 초안에서는 별도 admin 접근 없음 | doc id 구조에 의존 |
| `testProgress` | 본인 uid prefix doc만 get | 본인 uid prefix doc만 create/update/delete | 현재 초안에서는 별도 admin 접근 없음 | doc id 구조에 의존 |

## 관리자 판별 TODO

현재 앱의 관리자 로그인은 Firebase Auth claim이 아니라 client local state 기반이다. `firestore.rules` 초안은 아래 placeholder를 사용한다.

```js
return signedIn() && request.auth.token.admin == true;
```

따라서 이 Rules를 그대로 production에 배포하면 현재 관리자 화면의 `exams`, `results`, `questionBank` read/write가 차단될 수 있다. 실제 배포 전에는 다음 중 하나를 확정해야 한다.

| 선택지 | 설명 | 권장 |
|---|---|---|
| Firebase Custom Claims | 관리자 Auth 계정에 admin claim 부여 | 권장 |
| 서버 관리자 API | Vercel/Firebase Function에서 Admin SDK로 write 처리 | 운영 수준 권장 |
| 임시 admin allowlist | 특정 uid allowlist를 Rules에 넣는 방식 | 공개 저장소에 uid 노출 위험이 있어 비추천 |

## 현재 코드와 충돌 가능성

| 영역 | 충돌 가능성 | 이유 | 대응 |
|---|---|---|---|
| 관리자 화면 | 높음 | 현재 관리자 로그인은 Auth claim을 만들지 않는다 | Custom Claims 적용 전 production 배포 금지 |
| CSV 업로드 | 높음 | `questionBank` write는 admin claim 필요 | admin claim 또는 서버 업로드 API 필요 |
| 과정 생성/수정/삭제 | 높음 | `exams` write는 admin claim 필요 | admin claim 적용 후 검증 |
| 결과 전체 조회/삭제 | 높음 | `results` 전체 read/delete는 admin claim 필요 | admin claim 적용 후 검증 |
| 학생 결과 저장 | 보통 | Rules는 `studentId`와 profile employeeId만 비교한다 | 점수/정답 무결성은 서버 검증 필요 |
| 진행 데이터 | 보통 | doc id prefix `{uid}_` 구조에 의존한다 | 향후 `{uid}/{examId}` 하위 collection 구조 검토 |
| 사용자 profile 생성 | 보통 | 사번이 실제 직원인지 검증하지 않는다 | 사번 검증은 외부 정책 확정 후 구현 |

## firestore.indexes.json 필요 여부

현재 client query는 다음 단일 필드 조건만 사용한다.

| Query | 위치 | Custom composite index 필요 여부 |
|---|---|---|
| `exams` where `isVisible == true` | `src/App.tsx:134` | 필요 없음 |
| `results` where `studentId == employeeId` | `src/App.tsx:135` | 필요 없음 |

정렬은 client에서 `createdAt` 기준으로 수행하므로 현재 단계에서는 custom composite index가 필요하지 않다. Firebase CLI 구성을 위해 `firestore.indexes.json`은 빈 파일로 추가했다.

## Rules로 충분하지 않은 영역

| 영역 | 이유 | 권장 |
|---|---|---|
| 점수 계산 | Rules에서 정답 계산과 문제 세트 무결성 검증이 어렵다 | Vercel Function 또는 backend에서 채점 |
| 랜덤 문항 선택 | client에서 선택하면 조작 가능성 존재 | 서버에서 문항 세트 발급 |
| 결과 제출 중복 방지 | Rules만으로 복잡한 idempotency 관리가 어렵다 | 서버 endpoint 또는 transaction 설계 |
| CSV 업로드 검증 | Rules는 파일 파싱/검증을 담당하지 않음 | 관리자 전용 서버 검증 |
| 사번 실제 직원 검증 | Rules는 신뢰 가능한 직원 명부를 갖고 있지 않음 | 외부 정책/명부/초대코드/서버 검증 필요 |

## 검증 계획

| 단계 | 검증 |
|---|---|
| Local build | `npm.cmd run build` 성공 여부 확인 |
| Rules syntax | Firebase Emulator 실행 성공 |
| Emulator | 학생/관리자/비로그인 20개 read/write 시나리오 통과 |
| Preview | Vercel preview URL에서 로그인/제출/관리자 접근 확인 |
| Production | Custom Claims와 Rules 배포 후 smoke test |

현재 Emulator 검증 결과와 재실행 방법은 `docs/security-remediation/FIRESTORE_RULES_EMULATOR_TEST.md`에 기록한다.

## 최소 테스트 케이스

| 사용자 | 기대 결과 |
|---|---|
| 비로그인 | 모든 collection read/write 거부 |
| 학생 A | 공개 과정 read 가능 |
| 학생 A | 학생 A 결과 create/read 가능 |
| 학생 A | 학생 B 결과 read 거부 |
| 학생 A | 문제 저장고 read/write 거부 |
| 학생 A | 과정 create/update/delete 거부 |
| 관리자 claim 없음 | 관리자 화면 Firestore read/write 거부 |
| 관리자 claim 있음 | 과정/문제/결과 관리 가능 |

## 결론

`firestore.rules` 초안은 client query 제한 다음 단계의 방어선이다. 단, 현재 관리자 인증 구조가 아직 client state 기반이므로 이 Rules를 바로 production에 배포하면 관리자 기능이 차단될 수 있다.

Rules 배포 전 반드시 관리자 Custom Claims 정책, 사번 검증 정책, Rules emulator 테스트를 확정해야 한다.
