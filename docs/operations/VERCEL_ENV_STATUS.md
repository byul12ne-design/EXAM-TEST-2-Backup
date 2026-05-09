# Vercel Env Status

## 목적

이 문서는 Vercel 자동배포 환경에서 사용하는 Firebase web client 환경변수 운영 상태를 정리한다. 이후 담당자가 Local, Preview, Production 환경을 같은 기준으로 운영할 수 있게 하는 것이 목적이다.

`VITE_FIREBASE_*` 환경변수는 `src/lib/firebase.ts`에서 Firebase client initialization에 사용된다. 로컬 개발에서는 `.env.local`을 사용하고, Vercel 배포에서는 Vercel Dashboard의 Environment Variables를 사용한다.

실제 값은 Git에 기록하지 않는다. Firebase web client configuration은 서버 민감값은 아니지만 `VITE_*` 값은 브라우저 번들에 포함되므로, 운영값을 문서나 Git history에 남기지 않는다.

## 현재 등록된 env 목록

아래 이름만 운영 문서에 기록한다. 실제 값은 `.env.local` 또는 Vercel Dashboard에서만 관리한다.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## 환경별 정책

현재는 별도 staging Firebase project가 제공되지 않아 Preview와 Production Vercel 환경에 동일한 Firebase web client configuration이 등록되어 있다.

따라서 Preview/Production 모두 env 등록은 완료된 상태지만, Firebase project와 데이터 계층이 분리된 상태는 아니다.

| 환경 | 목적 | Firebase project | 상태 |
|---|---|---|---|
| Local | 개발자 로컬 실행과 build 검증 | `.env.local`에 등록된 Firebase web client 설정 사용 | 구성 완료. Git ignore 확인 완료 |
| Preview | Vercel preview deploy 검증 | Production과 동일한 Firebase web client configuration 사용 중 | env 등록 완료. Preview 테스트가 Production 데이터에 영향을 줄 수 있음 |
| Production | 실제 production deploy | Preview와 동일한 Firebase web client configuration 사용 중 | env 등록 완료. 운영 데이터 보호를 위해 Rules/Auth 검증 필요 |

주의:

- 저장소 코드만으로 Vercel Dashboard의 실제 값, 적용 범위, 배포 로그, production domain 동작은 확정할 수 없다.
- 실제 배포 상태는 Vercel Dashboard와 배포 URL에서 별도 확인해야 한다.
- 향후 권장 상태는 Preview는 staging Firebase project, Production은 production Firebase project로 분리하는 것이다.

## Vercel 등록 위치

Vercel Dashboard에서 다음 경로로 관리한다.

```text
Vercel Dashboard
→ Project
→ Settings
→ Environment Variables
```

등록 시 확인:

| 항목 | 기준 |
|---|---|
| Environment | Preview와 Production에 동일한 Firebase web client configuration이 등록된 상태 |
| 변수명 | `.env.example`과 동일한 `VITE_FIREBASE_*` 이름 사용 |
| 값 | 실제 Firebase web client configuration 값 입력 |
| Redeploy | env 변경 후 새 deployment 또는 redeploy 필요 |

## VITE env 주의

`VITE_*`는 Vite가 browser bundle에 포함하는 client env이다.

| 구분 | 설명 |
|---|---|
| secret 저장소 여부 | 아님 |
| 브라우저 노출 | 노출됨 |
| 넣어도 되는 값 | Firebase web client configuration 같은 client public 설정 |
| 넣으면 안 되는 값 | 관리자 secret, 학생 공통 인증값, service account, private key, server API token |
| 실제 보안 경계 | Firebase Auth, Custom Claims, Firestore Rules, 서버 검증 |

## env 변경 시 운영 절차

1. 로컬 `.env.local`에서 먼저 값 변경 후 실행한다.
2. `npm.cmd run build`로 build가 통과하는지 확인한다.
3. `npm.cmd run dev`로 local runtime이 시작되는지 확인한다.
4. Vercel Dashboard에서 Preview env를 업데이트한다.
5. Preview deploy를 실행하고 배포 URL에서 smoke test를 수행한다.
6. 현재는 Preview와 Production이 동일 Firebase project를 사용하므로 Preview smoke test가 운영 데이터에 영향을 주지 않는지 먼저 확인한다.
7. 문제가 없으면 Production env를 반영한다.
8. Production redeploy를 실행한다.
9. Production smoke test를 수행한다.

## 절대 금지 사항

| 금지 | 이유 |
|---|---|
| 실제 값 Git 커밋 | Git history에 남으면 회수가 어렵다 |
| `.env.local` push | 로컬 실제 값이 공개될 수 있다 |
| `.env.production` push | 운영값 노출 위험 |
| service account client 노출 | Firebase Admin 권한 탈취 위험 |
| `VITE_*`에 관리자 secret 저장 | 브라우저 bundle에 포함된다 |
| `VITE_*`에 학생 공통 인증값 저장 | 브라우저 bundle에 포함된다 |

## Runtime 확인 체크리스트

| 항목 | 현재 확인 상태 | 기준 |
|---|---|---|
| build 성공 | 확인 완료 | `npm.cmd run build` 성공 |
| dev 성공 | 확인 완료 | Vite dev server ready 및 local HTTP 200 |
| Firebase init 성공 | 로컬 env 누락 에러 없음 | `src/lib/firebase.ts`의 required env 통과 |
| 로그인 가능 | 별도 수동 확인 필요 | 실제 Firebase Auth/Firestore 연결 필요 |
| Firestore 접근 가능 | 별도 수동 확인 필요 | Rules와 네트워크 상태 확인 필요 |
| env 누락 시 명확한 에러 | 코드 기준 확인 | `Missing required environment variable: <NAME>` |

## 남은 운영 리스크

| 리스크 | 상태 |
|---|---|
| Firebase Rules 미검증 | 저장소에 Rules 파일 없음 |
| Preview/Production 동일 Firebase 사용 | Preview 테스트가 Production 데이터에 영향을 줄 수 있음 |
| 관리자/학생 인증값 구조 | 아직 client 인증 구조가 남아 있음 |
| 전체 Firestore 구독 | 로그인/역할 전 데이터 영역 구독 구조가 남아 있음 |
| Tailwind CDN 의존 | CDN 실패 시 첫 화면 진입 실패 가능 |
| Vercel Dashboard 실설정 검증 | 저장소만으로 검증 불가 |
| Production domain smoke test | 별도 확인 필요 |
