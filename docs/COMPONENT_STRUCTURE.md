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

# 컴포넌트 구조 분석

## 현재 상태

실제 컴포넌트는 `App` 하나다.

```tsx
// src/App.tsx:41
export default function App() {
  ...
}
```

`main.tsx`는 App만 렌더링한다.

```tsx
// src/main.tsx:6-9
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

## 문제

| severity | 문제 | 영향 |
|---|---|---|
| 높음 | 화면/도메인/서비스 로직 혼합 | 수정 난이도 증가 |
| 높음 | 공통 UI 컴포넌트 없음 | 버튼/카드/입력 스타일 중복 |
| 높음 | 모달/토스트가 App에 직접 구현 | 접근성 개선 어려움 |
| 보통 | 테스트 단위 없음 | 기능별 검증 어려움 |
| 보통 | 관리자 코드가 학생 번들에 포함 | 초기 번들 증가 |

## 권장 컴포넌트 분리

```text
components/ui/
├── Button.tsx
├── Field.tsx
├── Modal.tsx
├── Toast.tsx
├── SegmentedControl.tsx
├── ConfirmDialog.tsx
└── EmptyState.tsx

features/auth/
├── LoginPage.tsx
├── RegisterForm.tsx
└── useAuthProfile.ts

features/student/
├── StudentDashboard.tsx
├── StudentEntryPage.tsx
├── StudentTakePage.tsx
├── StudyQuestionCard.tsx
├── TestQuestionList.tsx
└── ResultPage.tsx

features/admin/
├── AdminLayout.tsx
├── ExamListPage.tsx
├── ExamEditorPage.tsx
├── 문제은행 데이터 영역Page.tsx
├── ResultsPage.tsx
└── ResultDetailDialog.tsx
```

## 공통 UI Before / After

Before:

```tsx
<button className="w-full bg-slate-900 text-white py-5 rounded-[1.25rem] shadow-xl text-xl hover:bg-blue-600">
  교육장 입장하기
</button>
```

After:

```tsx
<Button variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
  교육장 입장하기
</Button>
```

## Hook 분리 예시

```ts
export function useVisibleExams() {
  const [state, setState] = useState<AsyncState<Exam[]>>({ status: 'loading' });

  useEffect(() => {
    const q = query(collection(db, 'exams'), where('isVisible', '==', true));
    return onSnapshot(q, snap => {
      setState({ status: 'success', data: snap.docs.map(parseExamDoc) });
    }, error => {
      setState({ status: 'error', error });
    });
  }, []);

  return state;
}
```

## 컴포넌트 분리 우선순위

| 우선순위 | 컴포넌트 | 이유 |
|---|---|---|
| P0 | Auth/Login | 보안/UX 변경이 많음 |
| P0 | StudentTake | 임시저장/제출 버그 핵심 |
| P0 | Admin auth/layout | 권한 구조 핵심 |
| P1 | ExamEditor | 가장 복잡한 폼 |
| P1 | 문제은행 데이터 영역 | CSV/검증/모바일 문제 |
| P1 | Results | 페이지네이션/다운로드 |
| P2 | UI primitives | 일관성과 접근성 |








