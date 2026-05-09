# Vercel Env Setup

## 목적

이 문서는 Vercel 자동배포 환경에서 필요한 환경변수와 production 검증 절차를 정리한다. 저장소 코드만으로는 Vercel Dashboard의 실제 설정, 등록된 환경변수, 배포 로그, production domain 동작을 확정할 수 없다.

실제 값은 이 문서에 기록하지 않는다.

## 현재 저장소 기준 Vercel 상태

| 항목 | 실제 상태 |
|---|---|
| `vercel.json` | 없음 |
| `.vercelignore` | 없음 |
| `package.json` build | `tsc && vite build` |
| output directory | Vite 기본 `dist` |
| Node.js version pin | 없음 |
| Vercel env 사용 | Firebase web client configuration을 `VITE_FIREBASE_*`로 사용 |
| SPA rewrite | 없음 |
| Firebase client configuration | `src/lib/firebase.ts`에서 env 기반 로드 |
| `.env.example` | 존재. placeholder만 포함 |
| `.env.local` | 로컬 구성 완료, Git 추적 제외 |
| Vercel Preview env | 등록 완료. Production과 동일한 Firebase web client configuration 사용 중 |
| Vercel Production env | 등록 완료. Preview와 동일한 Firebase web client configuration 사용 중 |
| staging Firebase project | 아직 없음 |

## 필요한 Vercel env 목록

아래 값은 Firebase web client configuration이다. `VITE_*` prefix 때문에 브라우저에 포함된다. 민감값을 넣지 않는다.

| 이름 | 환경 | 민감값 여부 | 설명 |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Preview, Production | client 공개값 | Firebase web app key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Preview, Production | client 공개값 | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Preview, Production | client 공개값 | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Preview, Production | client 공개값 | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Preview, Production | client 공개값 | Firebase sender id |
| `VITE_FIREBASE_APP_ID` | Preview, Production | client 공개값 | Firebase app id |
| `VITE_FIREBASE_MEASUREMENT_ID` | Preview, Production | client 공개값, optional | Analytics measurement id |

서버 기능을 추가하는 경우에만 아래 유형의 값을 Vercel server env에 둔다.

| 이름 예시 | 환경 | 민감값 여부 | 주의 |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server only | 민감값 | `VITE_` prefix 금지 |
| `SERVER_API_TOKEN` | Server only | 민감값 | client import 금지 |
| `ADMIN_CLAIM_SETUP_TOKEN` | Server only | 민감값 | 일회성 운영 도구에만 사용 |

## Vercel Dashboard 설정 절차

현재는 별도 staging Firebase project가 제공되지 않아 Preview와 Production Vercel 환경에 동일한 Firebase web client configuration이 등록되어 있다.

현재 Preview/Production env는 모두 등록 완료 상태지만 Firebase project 분리는 아직 완료되지 않았다. 이후 변경 시 절차는 다음과 같다.

1. Vercel Project Settings로 이동한다.
2. Environment Variables에서 Firebase web client configuration 값을 변경한다.
3. 현재는 Preview와 Production에 동일 값을 등록한다.
4. 향후에는 Production에는 production Firebase project 값을 넣고, Preview에는 staging Firebase project 값을 넣는 것을 권장한다.
5. 서버 기능이 생기면 server-only 값에는 절대 `VITE_` prefix를 붙이지 않는다.
6. env 변경 후 Vercel redeploy를 실행한다.
7. 배포 URL에서 smoke test를 실행한다.

## 권장 `vercel.json`

현재 앱은 URL path 기반 React Router를 사용하지 않는다. 그러나 향후 route 도입 또는 직접 URL 접근을 고려하면 SPA rewrite를 명시하는 편이 안전하다.

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

주의:

- rewrite는 인증/권한을 해결하지 않는다.
- 관리자 route가 생겨도 client route 숨김은 보안이 아니다.
- 권한은 Firebase Auth/Custom Claims/Firestore Rules 또는 서버에서 검증해야 한다.

## Preview / Production 현재 상태와 권장 분리

| 항목 | Preview | Production |
|---|---|---|
| 현재 Firebase project | Production과 동일한 Firebase web client configuration 사용 | Preview와 동일한 Firebase web client configuration 사용 |
| 현재 데이터 영향 | Preview 테스트가 Production 데이터에 영향을 줄 수 있음 | 운영 데이터 |
| 권장 Firebase project | staging Firebase project | production Firebase project |
| 권장 Firestore Rules | production과 동일 정책을 staging에서 사전 검증 | 검증 완료 Rules |
| 권장 관리자 계정 | 테스트 관리자 claim | 실제 관리자 claim |
| 권장 학생 계정 | 테스트 학생 | 실제 학생 |
| 권장 데이터 | 샘플/가명 데이터 | 운영 데이터 |

## 자동배포 전 체크리스트

| 항목 | 상태 기준 |
|---|---|
| `.env.example` | placeholder만 포함 |
| `.env.local` | Git 제외 확인 완료 |
| `.env.production` | Git 제외 확인 |
| Vercel env | Dashboard에 Preview/Production 모두 등록 완료. 단, 현재는 동일 Firebase web client configuration 사용 |
| Firebase Rules | deny-by-default, role별 허용 |
| build | `npm.cmd run build` 성공 |
| local runtime | Vite dev server ready 및 HTTP 200 확인 |
| production runtime | 배포 URL에서 첫 진입/로그인/제출/관리자 접근 별도 확인 필요 |
| mobile | iOS/Safari/Chrome Android에서 로그인/제출/CSV 흐름 확인 |
| monitoring | Vercel Functions 사용 시 logs 확인 |

## Production smoke test

| 흐름 | 기대 결과 |
|---|---|
| 첫 진입 | 앱 로딩 완료, CDN 의존 제거 후 UI 표시 |
| 학생 로그인 | 개인 계정 또는 허용된 학생만 로그인 |
| 학습 진행 저장 | 본인 진행 데이터만 저장 |
| 퀴즈 제출 | 저장 성공 후 결과 화면 이동 |
| 저장 실패 | 결과 완료로 오인하지 않는 오류 UI 표시 |
| 관리자 접근 | admin claim 계정만 접근 |
| 관리자 write | Firestore Rules 또는 server 검증 통과 시에만 성공 |
| 비로그인 접근 | private 데이터 read/write 거부 |

## 현재 build 기준

현재 로컬 production build와 dev server 시작은 성공한다. Vercel Preview/Production env는 모두 등록 완료 상태다. 현재는 별도 staging Firebase project가 제공되지 않아 Preview와 Production Vercel 환경에 동일한 Firebase web client configuration이 등록되어 있다. 따라서 build/dev 성공은 Vercel runtime 안정성, Firebase Rules 안전성, production domain 동작, Preview와 Production 데이터 분리를 보장하지 않는다.

현재 남아 있는 production blocking issue:

| 항목 | 이유 |
|---|---|
| client 인증값 구조 | 인증값이 client에서 처리됨 |
| Firestore Rules 미검증 | 저장소에 Rules 파일 없음 |
| Preview/Production 동일 Firebase 사용 | Preview 테스트가 Production 데이터에 영향을 줄 수 있음 |
| 전체 실시간 구독 | 로그인/역할 전 데이터 접근 위험 |
| Tailwind CDN runtime 의존 | CDN 실패 시 앱 진입 불가 |
| 서버 검증 부재 | 결과/점수 무결성 보장 부족 |

## 다음 작업 순서

1. Vercel preview deploy 후 smoke test.
2. staging Firebase project를 마련해 Preview와 Production Firebase project를 분리.
3. Firebase Auth/Custom Claims 도입.
4. Firestore Rules 작성 및 emulator 검증.
5. Tailwind CDN 제거.
6. production deploy 전 운영 계정/권한 재검증.
