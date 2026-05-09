# Environment Variables Guide

## 목적

이 문서는 Vite + Vercel 환경에서 어떤 값을 환경변수로 둘 수 있고, 어떤 값은 절대 client 환경변수에 넣으면 안 되는지 정리한다.

실제 값은 기록하지 않는다. `.env.example`에는 placeholder만 사용한다.

## 현재 상태

| 항목 | 실제 상태 |
|---|---|
| `import.meta.env` 사용 | 없음 |
| `VITE_*` 사용 | 없음 |
| `.env` | 없음 |
| `.env.example` | 없음 |
| Firebase client configuration | `src/App.tsx:20-30`에 직접 작성 |
| 관리자 인증값 | `src/App.tsx:184`에서 client 비교 |
| 학생 공통 인증값 | `src/App.tsx:172`, `src/App.tsx:176-178` 로그인 흐름에서 사용 |
| `.gitignore` env 정책 | `*.local`은 제외. `.env`, `.env.production`은 현재 명시 제외 아님 |

## Vite client env 한계

| 원칙 | 설명 |
|---|---|
| `VITE_*`는 공개값이다 | Vite는 `VITE_*` 값을 브라우저 번들에 삽입한다 |
| Vercel env도 예외가 아니다 | Vercel Dashboard에 넣어도 `VITE_*`이면 client에서 확인 가능하다 |
| Firebase client configuration은 민감값이 아니다 | 단, Firestore Rules가 없으면 DB 보호가 되지 않는다 |
| 인증값은 `VITE_*`에 넣지 않는다 | 관리자/학생 인증값을 env로 이동해도 보안 문제는 해결되지 않는다 |
| 서버 민감값은 server runtime에만 둔다 | Vercel Function 또는 backend에서만 접근해야 한다 |

## GitHub에 올려도 되는 것과 안 되는 것

### 올려도 되는 것

| 항목 | 예시 |
|---|---|
| `.env.example` | placeholder만 포함 |
| Firebase client configuration 변수명 | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` 등 |
| Vercel 설정 예시 | rewrite, build/output 설정 |
| public docs | 실제 값과 우회 절차 없는 문서 |

### 올리면 안 되는 것

| 항목 | 처리 |
|---|---|
| 실제 관리자 인증값 | Firebase Auth/Claims 또는 서버로 전환 |
| 실제 학생 공통 인증값 | 공통값 폐기, 개인별 인증으로 전환 |
| service account key | Vercel server env 또는 별도 보안 저장소 |
| private key | GitHub 커밋 금지 |
| server API 민감값 | client env 금지 |
| production DB 접근 민감값 | client env 금지 |
| `.env.local` | 로컬 전용, Git 제외 |
| `.env.production` | 운영 전용, Git 제외 |

## 권장 `.env.example`

아래 파일은 실제 값을 넣지 않고 GitHub에 커밋할 수 있다.

```dotenv
# Firebase web client configuration.
# These values are exposed to the browser when prefixed with VITE_.
# Do not put admin credentials, shared student credentials, service account keys,
# private keys, or server-only tokens here.

VITE_FIREBASE_API_KEY="[REPLACE_WITH_FIREBASE_WEB_API_KEY]"
VITE_FIREBASE_AUTH_DOMAIN="[REPLACE_WITH_FIREBASE_AUTH_DOMAIN]"
VITE_FIREBASE_PROJECT_ID="[REPLACE_WITH_FIREBASE_PROJECT_ID]"
VITE_FIREBASE_STORAGE_BUCKET="[REPLACE_WITH_FIREBASE_STORAGE_BUCKET]"
VITE_FIREBASE_MESSAGING_SENDER_ID="[REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID]"
VITE_FIREBASE_APP_ID="[REPLACE_WITH_FIREBASE_APP_ID]"
VITE_FIREBASE_MEASUREMENT_ID="[OPTIONAL_REPLACE_WITH_FIREBASE_MEASUREMENT_ID]"
```

## 권장 `.gitignore` 정책

현재 `.gitignore`는 `*.local`만 제외한다. 다음 정책을 검토한다.

```gitignore
.env
.env.*
!.env.example
docs/internal/
docs/internal.zip
```

주의:

- 위 정책을 적용하기 전에 이미 추적 중인 env 파일이 있는지 `git ls-files ".env*"`로 확인한다.
- 이미 추적된 파일은 `.gitignore`만으로 제외되지 않는다.

## 코드 변경 방향

Before:

```ts
const firebaseConfig = {
  // Firebase web client configuration values are written directly here.
};
```

After:

```ts
const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const env = {
  FIREBASE_API_KEY: required(import.meta.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: required(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'VITE_FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID: required(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET: required(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, 'VITE_FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID: required(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID: required(import.meta.env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

## 인증값 처리 원칙

| 현재 문제 | 금지되는 임시 조치 | 권장 조치 |
|---|---|---|
| 관리자 인증값이 client에 있음 | `VITE_*` 관리자 인증값으로 이동 | Firebase Auth + Custom Claims |
| 학생 공통 인증값이 client에 있음 | `VITE_*` 학생 공통 인증값으로 이동 | 개인별 Auth 또는 서버 검증 |
| 결과 저장을 client가 신뢰 | client env로 보호 | Rules + 서버 검증 |

## Vercel 환경별 권장 구분

| 환경 | 용도 | 권장 |
|---|---|---|
| Development | 로컬 개발 | `.env.local` 사용, Git 제외 |
| Preview | PR/브랜치 확인 | Vercel Preview env, Firebase staging project 권장 |
| Production | 실제 운영 | Vercel Production env, Firebase production project |

## 검증 명령

```bash
git status
git ls-files ".env*"
git check-ignore -v .env.local .env.production
npm.cmd run build
```

## 결론

Firebase client configuration을 env로 이동하는 것은 유지보수와 환경 분리를 위한 작업이다. 보안의 핵심은 인증값을 client에서 제거하고, Firebase Auth/Custom Claims/Firestore Rules 또는 서버 검증으로 권한 경계를 만드는 것이다.
