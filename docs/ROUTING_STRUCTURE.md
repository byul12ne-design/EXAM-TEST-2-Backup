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

# 라우팅 구조 분석

## 현재 구조

React Router가 없다. 모든 화면 전환은 `view` 상태로 처리된다.

```tsx
// src/App.tsx:48
const [view, setView] = useState('home');
```

## 현재 화면 분기

| view/state | 화면 | 코드 위치 |
|---|---|---|
| `home` + `!userProfile` | 로그인/회원가입 | `src/App.tsx:372-391` |
| `home` + `userProfile` | 학생 대시보드 | `src/App.tsx:394-423` |
| `admin-login` | 관리자 로그인 | `src/App.tsx:827-833` |
| `admin-dash` | 관리자 대시보드 | `src/App.tsx:426-583` |
| `admin-create` | 과정 생성/수정 | `src/App.tsx:586-657` |
| `student-entry` | 과정 안내 | `src/App.tsx:708-721` |
| `student-take` | 문제 풀이 | `src/App.tsx:723-775` |
| `student-result` | 학생 결과 | `src/App.tsx:777-824` |
| `selectedResultDetail` truthy | 관리자 결과 상세 overlay | `src/App.tsx:777-824` |

## 현재 방식의 문제

| severity | 문제 | 사용자 영향 |
|---|---|---|
| 높음 | 새로고침 시 `view` 초기화 | 진행/관리 화면에서 홈으로 이동 |
| 높음 | 브라우저 뒤로가기 미연동 | 모바일 사용자가 예상대로 돌아갈 수 없음 |
| 보통 | URL 공유 불가 | 특정 과정/결과 링크 전달 불가 |
| 높음 | 권한 guard 없음 | 관리자 route 보호 불가 |
| 보통 | 화면 전환 테스트 어려움 | 상태 세팅이 복잡 |

## 권장 라우팅

```text
/
/login
/courses
/courses/:examId
/courses/:examId/take
/courses/:examId/result/:resultId
/admin
/admin/exams
/admin/courses/new
/admin/courses/:courseId/edit
/admin/bank
/admin/results
/admin/reports/:reportId
```

## 예시 코드

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth><StudentLayout /></RequireAuth>,
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: 'courses/:examId', element: <StudentEntryPage /> },
      { path: 'courses/:examId/take', element: <StudentTakePage /> },
    ],
  },
  {
    path: '/admin',
    element: <RequireAdmin><AdminLayout /></RequireAdmin>,
    children: [
      { index: true, element: <AdminExamsPage /> },
      { path: 'bank', element: <문제은행 데이터 영역Page /> },
      { path: 'results', element: <ResultsPage /> },
    ],
  },
]);
```

## Before / After

Before:

```tsx
<button onClick={() => { setCurrentExamId(ex.id); setView('student-entry'); }}>
  학습시작
</button>
```

After:

```tsx
<Link to={`/courses/${ex.id}`}>학습시작</Link>
```

효과:

- 새로고침 복구
- 뒤로가기 자연 동작
- URL 기반 테스트 가능
- route-level 권한 guard 가능








