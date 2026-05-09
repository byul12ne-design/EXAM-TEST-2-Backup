# Firestore Rules Emulator Test

## 목적

현재 저장소의 `firestore.rules` 초안이 실제 client 흐름과 충돌하는지 Firebase Emulator에서 검증한 결과를 기록한다.

이번 검증은 로컬 Emulator에서만 수행했다. production Firebase에 Rules를 배포하지 않았고, 실제 운영 데이터에 접근하지 않았다.

## 현재 파일 상태

| 파일 | 상태 | 비고 |
|---|---|---|
| `firebase.json` | 존재 | Firestore rules/indexes 파일 연결 |
| `firestore.rules` | 존재 | deny-by-default Rules 초안 |
| `firestore.indexes.json` | 존재 | 현재 custom composite index 없음 |
| `scripts/firestore-rules-emulator-test.mjs` | 존재 | Emulator 전용 rules 시나리오 helper |

## 로컬 환경 확인 결과

| 항목 | 결과 | 영향 |
|---|---|---|
| Firebase CLI | 전역 `firebase` 명령 없음 | `npx firebase-tools`로 임시 실행 |
| Firebase CLI version | `15.17.0` | Emulator 실행 가능 |
| 기본 `java` PATH | Java 8 | 기본 PATH로는 Emulator 실행 불가 |
| Temurin JDK | `21.0.11` | 명령 안에서 `JAVA_HOME`/`PATH`를 지정해 Emulator 실행 성공 |
| rules-unit-testing | `@firebase/rules-unit-testing@3.0.4` | `node_modules`에 임시 설치됨. package 파일은 변경하지 않음 |

## 실행 명령

현재 기본 PATH는 Java 8을 먼저 잡기 때문에, 테스트 명령 안에서만 Temurin JDK 21 경로를 지정했다.

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
npx.cmd firebase-tools emulators:exec --project demo-exam-test-rules --only firestore "node scripts/firestore-rules-emulator-test.mjs"
```

## Emulator 실행 결과

| 항목 | 결과 |
|---|---|
| Firestore Emulator 시작 | 성공 |
| Rules 시나리오 실행 | 성공 |
| 테스트 시나리오 수 | 20 |
| 통과 | 20 |
| 실패 | 0 |
| production deploy | 수행하지 않음 |
| production data 접근 | 수행하지 않음 |

## 통과한 테스트 시나리오

| 사용자 | 시나리오 | 기대 결과 | 결과 |
|---|---|---|---|
| 비로그인 | 공개 과정 query | 거부 | PASS |
| 비로그인 | `results` read | 거부 | PASS |
| 비로그인 | `questionBank` read | 거부 | PASS |
| 학생 A | 공개 과정 query | 허용 | PASS |
| 학생 A | 숨김 과정 직접 get | 거부 | PASS |
| 학생 A | 본인 `studentId` 결과 query | 허용 | PASS |
| 학생 A | 다른 학생 결과 직접 get | 거부 | PASS |
| 학생 A | 과정 write | 거부 | PASS |
| 학생 A | `questionBank` read | 거부 | PASS |
| 학생 A | 본인 결과 create | 허용 | PASS |
| 학생 A | 다른 사번 결과 create | 거부 | PASS |
| 학생 A | 본인 uid prefix 진행 문서 write | 허용 | PASS |
| 학생 B | 학생 A 진행 문서 read | 거부 | PASS |
| 관리자 claim 없음 | 관리자식 `exams` 전체 read | 거부 | PASS |
| 관리자 claim 없음 | `questionBank` read | 거부 | PASS |
| 관리자 claim 없음 | `results` 전체 read | 거부 | PASS |
| 관리자 claim 있음 | `exams` 전체 read | 허용 | PASS |
| 관리자 claim 있음 | `questionBank` read | 허용 | PASS |
| 관리자 claim 있음 | 결과 delete | 허용 | PASS |
| 관리자 claim 있음 | 과정 update | 허용 | PASS |

## 테스트 중 보강한 Rules

초기 실행에서는 admin claim이 없는 사용자에서 `request.auth.token.admin` 접근 시 Emulator가 verbose warning을 크게 출력했다. 테스트는 통과했지만 Rules 품질을 위해 `isAdmin()` 함수에 claim key 존재 여부를 먼저 확인하도록 보강했다.

현재 형태:

```js
return signedIn()
  && request.auth.token.keys().hasAny(['admin'])
  && request.auth.token.admin == true;
```

이 변경 후에도 20개 시나리오가 모두 통과했다.

## 현재 구조와 충돌하는 부분

| 충돌 지점 | 원인 | 영향 |
|---|---|---|
| 관리자 화면 전체 | 현재 관리자 로그인은 Firebase Auth Custom Claims를 만들지 않음 | Rules를 production에 배포하면 관리자 `exams`, `results`, `questionBank` read/write가 차단될 수 있음 |
| `questionBank` | Rules 초안은 admin claim만 허용 | 현재 client state 관리자에게는 접근 권한이 없음 |
| `results` 전체 조회/삭제 | Rules 초안은 admin claim만 허용 | 관리자 통계/CSV 다운로드/삭제가 차단될 수 있음 |
| 과정 create/update/delete | Rules 초안은 admin claim만 허용 | 과정 관리 기능이 차단될 수 있음 |
| `studentId` vs `uid` | 결과는 사번 기반 `studentId`, 진행 문서는 uid prefix 기반 | profile 누락/불일치 시 학생 결과 접근이 막힐 수 있음 |
| 점수/정답 무결성 | 결과 payload는 client가 계산해서 제출 | Rules만으로 점수 계산의 진위를 보장하지 못함 |

## App에서 Emulator를 임시 연결하는 방법

현재 앱은 production Firebase config를 사용한다. 실제 앱 화면으로 Emulator를 붙여 테스트하려면 `src/lib/firebase.ts`에 개발 전용 분기를 추가해야 한다.

예시 방향:

```ts
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
```

이 변경은 이번 단계에서 적용하지 않았다. 실제 앱 연결 테스트 전에는 `.env.local`에 별도 flag를 두고 production 환경에서 절대 활성화되지 않도록 해야 한다.

## Build 검증

최근 `npm.cmd run build` 결과:

| 항목 | 결과 |
|---|---|
| sandbox 실행 | Vite config 접근 권한 문제로 실패 |
| 로컬 권한 실행 | 성공 |
| TypeScript compile | 성공 |
| Vite production build | 성공 |
| 남은 경고 | JS chunk가 500kB 초과 |

`scripts/firestore-rules-emulator-test.mjs`는 `node --check` 기준 문법 오류가 없다.

## Production 적용 전 반드시 필요한 작업

1. 관리자 Firebase Auth 계정과 Custom Claims 정책 확정.
2. 현재 client state 기반 관리자 로그인 제거 또는 admin claim guard 추가.
3. 앱을 Emulator에 연결하는 개발 전용 flag 추가 후 UI smoke test.
4. `studentId`와 `uid` 기준을 문서/Rules/client service에서 명확히 분리.
5. staging Firebase project가 있다면 staging에 먼저 Rules 적용.
6. production Rules 배포 후 학생/관리자 smoke test.

## 결론

Temurin JDK 21을 명령 범위에서 지정한 뒤 Firestore Emulator 테스트가 정상 실행됐고, 준비한 20개 Rules 시나리오는 모두 통과했다.

다만 현재 앱의 관리자 인증 구조가 client state 기반인 한, 이 Rules를 production에 바로 적용하면 관리자 기능이 차단될 수 있다. production 적용 전에는 관리자 Custom Claims와 client guard 전환이 반드시 필요하다.
