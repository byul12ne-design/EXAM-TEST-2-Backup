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

# 모바일 vs PC 차이 분석

## 기준

- 모바일 기준: 320px viewport까지 고려
- 실제 Tailwind/CSS 클래스 기준으로 분석
- `sm:` breakpoint는 Tailwind 기본 640px 이상으로 해석
- Tailwind는 런타임 CDN으로 로드되므로 CDN 실패 시 모든 반응형 클래스가 적용되지 않을 수 있다

## 모바일/PC 기능 차이 표

| 기능 | PC 동작 | 모바일 동작 | 차이 원인 | 해결 방법 |
|---|---|---|---|---|
| 상단 브랜드 | 로고와 텍스트 표시 | 텍스트 숨김 | `hidden sm:block` (`src/App.tsx:364`) | 모바일에 짧은 텍스트 또는 접근 가능한 label 추가 |
| 로그인 카드 | 넓은 padding으로 안정적 | 320px에서 여백이 큼 | `p-8 sm:p-12` (`src/App.tsx:374`) | `p-5 sm:p-12`로 모바일 최적화 |
| 학생 대시보드 | 2열 카드 | 1열 카드 | `grid sm:grid-cols-2` (`src/App.tsx:397`) | 적절함. 카드 내부 버튼은 더 보완 |
| 학습 카드 | 버튼 가로 정렬 | 버튼이 full width로 분리 | `flex-col sm:flex-row`, `w-full sm:w-auto` (`src/App.tsx:402-406`) | 적절함 |
| 퀴즈 카드 | 제목+버튼 가로 | 긴 제목 압축/넘침 가능 | `flex justify-between items-center` 고정 (`src/App.tsx:415`) | 학습 카드와 동일하게 `flex-col sm:flex-row` |
| 관리자 탭 | 가로 탭 | wrap으로 줄바꿈 | `flex flex-wrap` (`src/App.tsx:433`) | 탭 수가 늘면 select/segmented control 검토 |
| 과정 목록 관리 | 가로 버튼 | 버튼이 한 줄에 밀집 | `flex gap-2 w-full sm:w-auto` (`src/App.tsx:452`) | 모바일에서 `flex-wrap` 또는 2열 버튼 |
| 문제은행 보기 입력 | 2열 입력 | 2열 그대로라 좁음 | `grid grid-cols-2` (`src/App.tsx:485`) | `grid-cols-1 sm:grid-cols-2` |
| 과정 문제 보기 입력 | 1열→2열 | 모바일 1열 | `grid-cols-1 sm:grid-cols-2` (`src/App.tsx:641`) | 적절함 |
| 결과 리스트 카드 | hover로 상세 가능 느낌 | hover 없음, 클릭 가능성 약함 | `cursor-pointer hover:border-blue-400` (`src/App.tsx:566`) | button화, 상세보기 텍스트 추가 |
| 응시 화면 나가기 | `나가기` 클릭 시 즉시 home 이동 | `뒤로` 클릭 시 confirm 후 진행 저장 시도 | `md:hidden` / `hidden md:inline-flex` 분기 (`src/App.tsx:754-757`) | 동일 핸들러를 PC/모바일 공통 적용 |
| 시작 버튼 | 넓고 강조 | 320px에서 과대 | `px-16 py-6 text-2xl` (`src/App.tsx:719`) | `w-full sm:w-auto px-6 sm:px-16 text-lg sm:text-2xl` |
| 결과 상세 모달 | fixed fullscreen | fixed fullscreen | `fixed inset-0 ... overflow-y-auto` (`src/App.tsx:778`) | close focus, safe-area, Escape 추가 |
| 저장고 모달 | 중앙 모달 | 화면 꽉 참 | `max-h-[90vh]` (`src/App.tsx:662`) | 모바일 full-screen modal 패턴 권장 |
| CSV 다운로드 | 파일 다운로드 가능 | 브라우저별 동작 불안정 | Blob link click (`src/App.tsx:345-348`) | 서버 다운로드 URL/공유 대응 |

## 실제 CSS/Tailwind 분석

### 반응형이 잘 적용된 부분

| 코드 | 평가 |
|---|---|
| `p-4 sm:p-8` (`src/App.tsx:369`) | main padding이 모바일/PC 분리됨 |
| `grid sm:grid-cols-2` (`src/App.tsx:397`) | 학생 대시보드가 모바일 1열, PC 2열 |
| `flex flex-col sm:flex-row` (`src/App.tsx:402`) | 학습 목록 카드 대응 양호 |
| `grid grid-cols-1 sm:grid-cols-2` (`src/App.tsx:641`) | 과정 문제 보기 입력 대응 양호 |
| `p-6 sm:p-8` (`src/App.tsx:662`) | 모달 내부 padding 대응 |

### 반응형 문제가 있는 부분

| 코드 | 문제 | severity |
|---|---|---|
| `hidden sm:block` (`src/App.tsx:364`) | 모바일에서 서비스명이 사라짐 | 낮음 |
| `flex justify-between items-center` (`src/App.tsx:415`) | 퀴즈 카드가 모바일에서 압축될 수 있음 | 보통 |
| `grid grid-cols-2` (`src/App.tsx:485`) | 문제은행 보기 입력이 모바일에서 좁음 | 높음 |
| `px-16 text-2xl` (`src/App.tsx:719`) | 작은 화면에서 시작 버튼 과대 | 보통 |
| `text-7xl` (`src/App.tsx:782`) | 320px에서 점수 표시가 과도할 수 있음 | 낮음 |
| `fixed bottom-10 ... px-10` (`src/App.tsx:837`) | 토스트가 작은 화면에서 넓거나 키보드와 겹칠 수 있음 | 보통 |

## Hover 의존

| 위치 | 클래스 | 모바일 문제 |
|---|---|---|
| 로그아웃 | `hover:bg-slate-200` | hover 피드백 없음 |
| 관리자 모드 | `hover:text-slate-500` | 발견 가능성이 낮음 |
| 퀴즈 카드 | `hover:border-purple-300` | 터치에서 상세 가능성 인지 낮음 |
| 탭 | `hover:bg-slate-50` | 선택 가능성은 버튼 구조로 일부 보완 |
| 결과 카드 | `hover:border-blue-400` | 클릭 가능성 인지 낮음 |
| 문제 보기 | `hover:border-blue-400 hover:bg-blue-50` | 모바일에서는 터치 전 피드백 없음 |

해결:

```tsx
<button className="border border-slate-200 bg-white active:bg-blue-50 data-[selected=true]:border-blue-600">
  <span>응시하기</span>
  <span aria-hidden>›</span>
</button>
```

## 터치/키보드 이벤트

실제 코드:

- `onClick` 중심
- `onPointerDown`, `onTouchStart`, `onKeyDown` 없음
- 기본 `<button>`은 키보드 접근 가능하지만 `div onClick`, `h1 onClick`은 문제

문제 위치:

- `src/App.tsx:362` - `h1 onClick`
- `src/App.tsx:566` - 결과 카드 `div onClick`

After:

```tsx
<button type="button" onClick={() => setView('home')} className="...">
  <img src={APP_CONFIG.logoImageUrl} alt="" />
  <span>{APP_CONFIG.logoText}</span>
</button>
```

## 320px viewport 우선 개선

1. 고정 큰 padding/text 축소: 시작 버튼, 로그인 카드, 결과 점수
2. 관리자 문제은행 `grid-cols-2` 제거
3. 모든 목록 카드 내부 액션을 `flex-col sm:flex-row`
4. 토스트 `left-4 right-4 translate-x-0 sm:left-1/2 sm:-translate-x-1/2`
5. 모달을 모바일에서는 full-screen + 하단 고정 액션으로 전환








