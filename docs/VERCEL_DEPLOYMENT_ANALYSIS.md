## Current Analysis Metadata

- Current Analysis Snapshot: Current repository snapshot
- Analysis Basis: Latest repository code, local production build output, Vite/Firebase/Vercel-related repository settings
- Build Result: npm.cmd install 성공, npm.cmd run build 성공. npm.cmd run lint와 npm.cmd run test는 script 없음으로 실행 불가.
- Vercel Scope: 이 프로젝트는 Vercel 자동배포 환경일 수 있으나, 저장소 코드만으로는 Vercel Dashboard의 실제 설정, 환경 변수, 배포 로그, production domain 동작을 확정할 수 없다. 따라서 본 분석은 저장소 코드와 로컬 production build 기준이며, 실제 배포 상태는 Vercel Dashboard와 배포 URL에서 별도 확인해야 한다.

## Current Operations Snapshot

| 항목 | 현재 상태 |
|---|---|
| 실제 코드 구조 | React + Vite + Firebase 단일 SPA. 핵심 로직은 `src/App.tsx`에 집중되어 있음 |
| 현재 빌드 결과 | `.env.local` 구성 후 production build 성공. JS chunk 약 `630.72 kB`로 Vite 500 kB 경고 발생 |
| Vercel 자동배포 위험 | `vercel.json`, `.vercelignore` 없음. Vercel env는 Preview/Production 모두 등록 완료지만 동일 Firebase web client configuration 사용 중 |
| Production blocking issue | Tailwind CDN 런타임 의존, Firebase Rules 미검증, 관리자/학생 인증값 bundle 노출, Firestore 전체 구독, 결과 저장 실패 처리 미흡 |
| 현재 보안 문제 | 클라이언트 관리자 인증, 고정 학생 인증값, production DB 직접 read/write, 결과 위변조 가능성 |
| 현재 UX 문제 | 로딩/에러 상태 부족, 새로고침/뒤로가기 복구 부족, 모바일/PC 나가기 동작 차이, 미응답 제출 가능 |
| 현재 성능 문제 | 전체 컬렉션 실시간 구독, pagination/lazy loading 부재, Firebase SDK 포함 단일 대형 chunk |
| 현재 수정 우선순위 | 1. Firebase Rules/권한 2. Tailwind CDN 제거 3. 인증 재설계 4. 결과 저장/임시저장 수정 5. Router/rewrite/운영 설정 정리 |

# Vercel Deployment Analysis

## Current Env Operations Status

| 항목 | 현재 상태 |
|---|---|
| Firebase config 위치 | `src/lib/firebase.ts`에서 `import.meta.env.VITE_FIREBASE_*`로 로드 |
| `.env.example` | 존재. 실제 값 없이 변수명과 placeholder만 포함 |
| `.env.local` | 로컬 구성 완료. `.gitignore`에 의해 Git 추적 제외 |
| local build | 권한 승인 환경에서 `npm.cmd run build` 성공 |
| local dev | Vite dev server ready 및 `http://127.0.0.1:5173/` HTTP 200 확인 |
| Vercel env | Preview/Production 모두 등록 완료. 현재는 동일 Firebase web client configuration 사용 중 |
| Firebase project 분리 | 별도 staging Firebase project가 없어 아직 분리되지 않음 |
| 운영 문서 | `docs/operations/VERCEL_ENV_STATUS.md` |
| 남은 risk | Firebase Rules 미검증, client 인증 구조, Tailwind CDN, 전체 Firestore 구독 |

## 1. Vercel 설정 분석

| 항목 | 실제 상태 | Vercel production 영향 |
|---|---|---|
| `vercel.json` | 없음 | repo 기준 build/output/rewrite/headers 설정 없음 |
| framework preset | repo에 명시 없음 | Vercel dashboard 자동 감지/수동 설정에 의존. 저장소만으로 preset 검증 불가 |
| build command | `package.json:8`에 `tsc && vite build` | Vercel이 package build를 사용하면 production build 가능 |
| output directory | `vite.config.ts` 기본값, 실제 build 산출물 `dist/` | Vite 기본 output인 `dist`가 생성됨 |
| install command | repo에 명시 없음 | Vercel 기본 npm install에 의존 |
| Node.js version 설정 | `package.json`에 `engines` 없음, `.nvmrc` 없음 | Vercel 기본 Node 버전에 의존 |
| SPA rewrite 설정 | 없음 | 현재는 URL 라우팅이 없지만, `/admin` 등 직접 접근 URL은 Vercel에서 404 가능 |
| static export | 없음 | Vite SPA build |
| environment variable 설정 | `.env.example` 있음. Firebase client config는 `VITE_FIREBASE_*` 사용. Local은 `.env.local`, Vercel은 Dashboard env 사용 | Vercel env 누락 시 Firebase 초기화에서 명확한 runtime error 발생 |
| `.vercelignore` | 없음 | Vercel 기본 ignore 및 `.gitignore`에 의존 |

## 2. 실제 build 산출물

`npm.cmd run build` 결과:

```text
dist/index.html                  0.48 kB
dist/assets/index-C-dvAIOk.css   1.80 kB
dist/assets/index-ni4J7uDq.js  630.72 kB │ gzip: 161.89 kB
```

Vite warning:

```text
Some chunks are larger than 500 kB after minification.
```

산출물 구조:

```text
dist/
├── index.html
├── favicon.svg
├── icons.svg
└── assets/
    ├── index-C-dvAIOk.css
    └── index-ni4J7uDq.js
```

## 3. 환경 변수 분석

| 항목 | 실제 상태 |
|---|---|
| `.env` | 없음. Git ignore 대상 |
| `.env.example` | 있음. placeholder만 포함 |
| `.env.local` | 있음. 로컬 실제 값 포함, Git ignore 대상 |
| `.gitignore` env 제외 | `.env`, `.env.*`, `!.env.example`, `*.local` 적용 |
| `import.meta.env` 사용 | `src/lib/firebase.ts`에서 사용 |
| `VITE_*` prefix 사용 | Firebase web client configuration 7개 변수 사용 |
| Firebase client configuration | `src/lib/firebase.ts`에서 env 기반 로드 |
| production env 누락 위험 | Vercel Dashboard env 누락 시 `Missing required environment variable` error 발생 |
| sensitive value 노출 가능성 | 학생/관리자 인증값이 bundle에 포함됨 |

현재 bundle 관련 확인:

- Firebase client configuration은 더 이상 `src/App.tsx`에 하드코딩되어 있지 않다.
- `VITE_*` 값은 browser bundle에 포함될 수 있는 client env이다.
- 학생/관리자 인증 구조는 아직 다음 보안 단계로 남아 있다.
- Tailwind CDN runtime 의존은 아직 남아 있다.

### Production env 차이

현재 코드는 Firebase client configuration을 Local/Vercel env로 분리했다. 현재는 별도 staging Firebase project가 제공되지 않아 Preview와 Production Vercel 환경에 동일한 Firebase web client configuration이 등록되어 있다.

| 구분 | 개발 | production |
|---|---|---|
| Firebase project | `.env.local` 값 | Vercel Production env 값 |
| Tailwind | CDN runtime script | 동일 |
| Auth credential | 기존 client 인증 구조 유지 | 기존 client 인증 구조 유지 |
| Admin credential | 기존 client 인증 구조 유지 | 기존 client 인증 구조 유지 |

Preview 테스트는 Production과 동일 Firebase project에 영향을 줄 수 있다. 향후 권장 상태는 Preview는 staging Firebase project, Production은 production Firebase project로 분리하는 것이다.

## 4. SPA 라우팅 분석

실제 구현:

- React Router 없음
- `src/App.tsx:48`의 `view` 상태로 화면 분기
- URL path를 사용하지 않음
- `src/App.tsx:851`에서 `window.history.replaceState`를 호출하지만 path는 현재 pathname 그대로 유지

| 항목 | 실제 상태 | Vercel 영향 |
|---|---|---|
| `/` 직접 접근 | 가능 | `dist/index.html` 제공 |
| `/admin` 직접 접근 | 앱 route 아님 | rewrite 없으면 Vercel 404 가능 |
| 새로고침 | `/`에서는 가능 | 앱 내부 `view`는 초기화 |
| deep link | 없음 | URL 공유 불가 |
| 브라우저 뒤로가기 | 앱 상태와 미연동 | 모바일 UX 위험 |

React Router 도입 시 필요한 설정:

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

현재도 향후 route 추가를 고려하면 `vercel.json`을 추가하는 편이 안전하다.

## 5. Production Runtime 분석

| 항목 | severity | 실제 원인 | Vercel production 위험 |
|---|---|---|---|
| Tailwind CDN 의존 | 치명 | `src/App.tsx:87-99` runtime script 삽입 | CDN 실패/차단 시 앱이 "디자인 로딩중..."에 멈춤 |
| Firebase SDK runtime 실패 | 높음 | 모든 데이터가 Firebase 직접 호출 | 네트워크/권한 실패 시 구체 UI 없음 |
| Firestore Rules 미검증 | 치명 | rules 파일 없음 | production DB 직접 read/write 노출 위험 |
| production DB 직접 접근 | 치명 | 클라이언트에서 `addDoc`, `updateDoc`, `deleteDoc` 호출 | 결과/문제/과정 위변조 가능 |
| 브라우저 콘솔 에러 | 높음 | `onSnapshot` 에러 콜백 없음 | Rules 거부 시 사용자에게 빈 상태처럼 보일 수 있음 |
| 모바일 브라우저 차이 | 보통 | Blob CSV 다운로드, file input, confirm 사용 | iOS/Safari 다운로드/파일 선택 UX 불안정 가능 |
| 외부 로고 의존 | 낮음 | Wuerth 로고 URL 외부 참조 | 로고 깨짐 가능 |

## 6. Build/Bundle 분석

| 항목 | 실제 상태 |
|---|---|
| build | 성공 |
| TypeScript compile | 성공 |
| source map | `vite.config.ts`에 `build.sourcemap` 없음. 기본 false |
| minify | Vite production 기본 minify 적용 |
| chunk warning | 있음. `index-ChkbJhwA.js` 630.14 kB |
| Firebase SDK 영향 | bundle 안에 Auth/Firestore SDK 코드 포함 |
| tree shaking | Vite/Rollup 기본 적용. 단 Firebase Auth+Firestore 자체가 큼 |
| lazy loading | 없음 |
| dynamic import | 없음 |
| manualChunks | 없음 |

500kB 이상 chunk 원인:

- 학생/관리자 전체 UI가 하나의 `App.tsx`에 포함
- Firebase Auth/Firestore SDK가 단일 entry chunk에 포함
- route-level code splitting 없음
- 관리자 기능도 첫 진입 bundle에 포함

권장:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
```

## 7. Vercel Deployment Impact

| 항목 | 영향 |
|---|---|
| production 위험 | build는 가능하지만 runtime에서 CDN/Firebase/Rules 문제가 production blocker |
| local build와 production 차이 | 로컬 build는 JS 생성만 보장. Vercel runtime network, domain, Firestore Rules, CDN 가용성은 보장하지 않음 |
| runtime risk | Tailwind CDN 실패 시 앱 미표시, Firebase 실패 시 오류 UI 부족 |
| env risk | env 누락은 없지만 config/인증값가 bundle 노출 |
| SPA risk | 현재 root만 안전. URL 라우팅 도입 시 rewrite 필수 |
| mobile runtime risk | iOS/Safari CSV 다운로드, file input, confirm UX 차이 |

## 8. Vercel 배포 가능 여부

| 판정 | 설명 |
|---|---|
| Build 배포 | 가능. `dist/` 생성됨 |
| Production 운영 | 불가 |
| 제한적 내부 테스트 배포 | 가능하지만 Firestore Rules와 데이터 보호 확인 전 위험 |

Vercel에 올릴 수는 있지만, production 정상 운영 판정은 할 수 없다.










