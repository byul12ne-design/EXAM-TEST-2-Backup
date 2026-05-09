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

# 접근성(a11y) 분석

## 요약

기본 `<button>`, `<input>`, `<select>`를 사용한 부분은 브라우저 기본 접근성을 일부 얻고 있다. 그러나 label 연결, live region, modal focus, semantic navigation, keyboard-only 흐름에서 중요한 결함이 있다.

## 항목별 분석

| 항목 | 실제 상태 | severity | 근거 | 개선 |
|---|---|---|---|---|
| label 연결 | 대부분 없음 | 높음 | 로그인/관리자/문제 입력 placeholder 중심 | `<label htmlFor>` 추가 |
| placeholder 의존 | 높음 | 보통 | `placeholder="사번 8자리"` 등 | label + help text |
| aria-live | 없음 | 보통 | 토스트 `src/App.tsx:836-839` | `role="status" aria-live="polite"` |
| button/div misuse | 있음 | 높음 | `h1 onClick`, 결과 `div onClick` | button/a로 변경 |
| keyboard navigation | 부분 가능 | 보통 | button은 가능, div/h1은 불가 | focusable semantic controls |
| focus 처리 | 없음 | 높음 | 화면 전환/모달 열림 후 focus 이동 없음 | focus management |
| modal 접근성 | 낮음 | 높음 | 저장고 모달 focus trap 없음 | dialog role, aria-modal, Escape |
| 색상 의존 | 일부 있음 | 보통 | 정답/오답 색상 중심 | 텍스트/아이콘 함께 제공 |
| screen reader | 낮음 | 높음 | label/live/modal 부족 | semantic 구조 |
| semantic HTML | 부분적 | 보통 | nav/main은 있음, form/fieldset 부족 | form, fieldset, legend |

## label 연결 문제

Before:

```tsx
// src/App.tsx:383
<input
  type="text"
  value={empIdInput}
  placeholder="사번 8자리"
/>
```

After:

```tsx
<label htmlFor="employeeId" className="sr-only">사번 8자리</label>
<input
  id="employeeId"
  type="text"
  inputMode="numeric"
  autoComplete="username"
  aria-describedby="employeeIdHelp"
/>
<p id="employeeIdHelp">WN을 제외한 숫자 8자리를 입력하세요.</p>
```

## Toast 접근성

Before:

```tsx
// src/App.tsx:836-839
{toastMessage && (
  <div className="fixed bottom-10 ...">
    <span>●</span> {toastMessage}
  </div>
)}
```

After:

```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {toastMessage}
</div>
```

## Clickable non-button

문제 위치:

- `src/App.tsx:362` - `<h1 onClick={() => setView('home')}>`
- `src/App.tsx:566` - `<div ... onClick={() => setSelectedResultDetail(r)}>`

문제:

- 키보드 Tab으로 접근하기 어렵다.
- 스크린리더가 버튼 역할로 인식하지 않는다.
- Enter/Space 활성화가 보장되지 않는다.

After:

```tsx
<button type="button" onClick={() => setSelectedResultDetail(r)}>
  <span>{r.examTitle}</span>
  <span>상세보기</span>
</button>
```

## Modal 접근성

문제 위치:

- 저장고 모달: `src/App.tsx:661-705`
- 결과 상세 overlay: `src/App.tsx:778-824`

현재 문제:

- `role="dialog"` 없음
- `aria-modal="true"` 없음
- 제목과 `aria-labelledby` 연결 없음
- Escape 닫기 없음
- focus trap 없음
- 닫은 뒤 원래 버튼으로 focus 복귀 없음

권장:

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="bankModalTitle">
  <h3 id="bankModalTitle">저장고에서 불러오기</h3>
  ...
</div>
```

추천 라이브러리:

- `@radix-ui/react-dialog`
- `react-aria`
- `focus-trap-react`

## 색상 의존

정답/오답은 색상과 텍스트가 함께 있어 일부 보완되어 있다.

근거:

- 정답: `✅ 정답` (`src/App.tsx:802`)
- 내 답안: `❌ 내 답안` (`src/App.tsx:803`)

그러나 학습 중 보기 선택 상태는 색상 중심이다.

```tsx
// src/App.tsx:745
border-emerald-500 bg-emerald-50
border-red-500 bg-red-50
opacity-30
```

개선:

- 선택 보기 옆에 `선택됨`, `정답`, `오답` 텍스트를 항상 제공
- `aria-pressed` 또는 radio group 의미 부여

## Keyboard-only 기준 문제

| 흐름 | 현재 가능성 | 문제 |
|---|---|---|
| 로그인 입력→제출 | Tab으로 가능 | Enter 제출 없음 |
| 관리자 모드 진입 | 버튼이라 가능 | 버튼 텍스트가 작고 흐림 |
| 결과 상세 열기 | 어려움 | 카드가 div |
| 모달 닫기 | 버튼으로 가능 | Escape 불가, focus trap 없음 |
| 탭 이동 | 버튼이라 가능 | `aria-selected` 없음 |

## 권장 구조

```tsx
<form onSubmit={handleLoginSubmit}>
  <fieldset>
    <legend>교육 센터 로그인</legend>
    ...
  </fieldset>
</form>
```








