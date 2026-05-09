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

# Production Runtime Checklist

## Vercel Production 체크리스트

| 항목 | 현재 판정 | 근거 | Production 위험 | 필요 조치 |
|---|---|---|---|---|
| 첫 진입 | 위험 | Tailwind CDN 로딩 게이트 `src/App.tsx:351` | CDN 실패 시 앱 멈춤 | Tailwind 빌드 타임 적용 |
| 새로고침 | 제한적 | root `/`만 안전 | 내부 view 상태 초기화 | Router/상태 복구 |
| URL 직접 접근 | 위험 | `vercel.json` rewrite 없음 | `/admin` 등 404 가능 | rewrite 추가 |
| 로그인 | 위험 | 고정 인증값 `src/App.tsx:172` | 본인 확인이 약한 접근 | 인증 재설계 |
| 로그아웃 | 부분 가능 | `signOut(auth)` | 실패 처리 없음 | catch/토스트 |
| 모바일 접속 | 부분 가능 | 반응형 일부 적용 | PC와 나가기 동작 다름 | 공통 핸들러 |
| 학습 시작 | 부분 가능 | `startExam` | Firestore 실패 처리 약함 | 로딩/에러 상태 |
| 퀴즈 응시 | 위험 | 임시저장 복원 버그 | 저장됐다고 믿어도 복원 실패 | `activeQuestions` 저장 |
| 임시저장 | 위험 | 퀴즈 진행 데이터 영역가 `answers`만 저장 | 랜덤 문항과 답안 불일치 | session 모델 수정 |
| 결과 저장 | 위험 | 저장 실패 후 결과 화면 이동 | 제출 유실 | 저장 성공 후 이동 |
| 관리자 접근 | 치명 | `[MASKED_ADMIN_PASSWORD]` 형태의 하드코딩 | 권한 없는 접근 위험 | Custom Claims |
| CSV 업로드 | 위험 | 단순 parser | 대량/비정상 데이터 | 검증/preview |
| CSV 다운로드 | 부분 가능 | Blob link click | iOS/Safari UX 불안정 | 서버/Storage 다운로드 |
| Firestore read/write | 치명 | 전체 구독/클라이언트 write | 개인정보/위변조 | Rules/서버 검증 |
| 네트워크 실패 | 위험 | 에러 UI 부족 | 빈 화면/오해 | error boundary/state |
| CDN 실패 | 치명 | Tailwind CDN 필수 | 앱 미표시 | CDN 제거 |
| Firebase 실패 | 위험 | `onSnapshot` error callback 없음 | 사용자 원인 파악 불가 | 에러 콜백 |

## Vercel 설정 체크

| 항목 | 상태 |
|---|---|
| `vercel.json` | 없음 |
| `.vercelignore` | 없음 |
| `.env` | 없음 |
| `.env.example` | 없음 |
| Node version pin | 없음 |
| output dir | Vite 기본 `dist` |
| install command | Vercel 기본에 의존 |
| build command | `npm run build` 사용 가능 |
| SPA rewrite | 없음 |

## 필요한 environment variable 목록

현재 코드 기준으로 Vercel에 반드시 등록해야 하는 env는 없다. 실제 코드가 Firebase client configuration를 하드코딩하기 때문이다.

그러나 production 운영을 위해서는 다음처럼 env로 분리하는 것이 필요하다.

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

주의:

- Firebase client config는 sensitive value은 아니지만 production/staging 분리를 위해 env가 필요하다.
- 관리자 인증값와 학생 고정 인증값는 env로 옮기는 것만으로는 충분하지 않다. 클라이언트 env도 bundle에 노출된다.

## 필요한 `vercel.json`

현재 앱은 URL 라우팅을 쓰지 않으므로 root `/`만 쓰면 필수는 아니다. 하지만 SPA route를 도입하거나 `/admin`, `/courses/:id` 같은 URL을 만들면 필수다.

권장 예시:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

## Runtime 위험 TOP 10

| 순위 | 위험 | severity |
|---|---|---|
| 1 | Tailwind CDN 실패 시 앱 진입 불가 | 치명 |
| 2 | Firestore Rules 미검증 상태의 production DB 접근 | 치명 |
| 3 | 관리자 인증값 bundle 노출 | 치명 |
| 4 | 학생 고정 인증값 bundle 노출 | 치명 |
| 5 | 결과/문제은행 전체 구독으로 개인정보 노출 가능 | 치명 |
| 6 | 클라이언트 점수/결과 위변조 가능 | 치명 |
| 7 | Firebase network/permission error UI 부재 | 높음 |
| 8 | 퀴즈 임시저장 복원 실패 | 높음 |
| 9 | `/admin` 등 직접 접근 시 rewrite 없는 404 가능 | 보통 |
| 10 | iOS/Safari CSV 다운로드/업로드 UX 불안정 | 보통 |

## Production readiness 재평가

| 수준 | 판정 |
|---|---|
| Vercel build deploy | 가능 |
| Vercel preview 테스트 | 제한적으로 가능 |
| 내부 운영 | 미달 |
| production 운영 | 불가 |
| 상용 운영 | 불가 |

결론: 로컬 build와 Vercel static deploy 자체는 가능하지만, runtime blocker가 많아 production 운영 가능 상태가 아니다.









