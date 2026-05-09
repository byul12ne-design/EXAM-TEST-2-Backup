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

# 일반 사용자(학생) 기능 분석

## 분석 범위

학생 관점에서 실제로 사용할 수 있는 기능만 분석했다. 추정 가능한 의도는 별도 표기했다.

## 학생 기능 표

| 기능 | 실제 동작 여부 | 모바일 | PC | 문제점 | 개선 우선순위 |
|---|---|---|---|---|---|
| 회원가입 | 조건부 동작. 사번 8자리와 이름으로 Firebase Auth 계정 생성 | 가능 | 가능 | 모든 학생이 동일한 하드코딩 인증값를 사용. 실제 사번 검증 없음 | 반드시 |
| 로그인 | 조건부 동작. 사번으로 pseudo email 생성 후 로그인 | 가능 | 가능 | 인증값 입력 없이 고정 인증값 사용. 에러 메시지 모호 | 반드시 |
| 로그아웃 | 동작. `signOut(auth)` 호출 | 가능 | 가능 | 로그아웃 후 진행 중 상태 처리 안내 없음 | 권장 |
| 학습 목록 | 공개된 `study` 과정 표시 | 가능 | 가능 | Firestore 로딩/오류와 "등록 없음" 구분 불가 | 반드시 |
| 학습 진행 | 동작. 오답 문항을 큐 뒤로 보내 반복 | 가능 | 가능 | 선택 즉시 정답 공개. 시험/학습 UX 구분은 있으나 안내 부족 | 권장 |
| 문제 풀이 | 버튼 클릭으로 답 선택 | 가능 | 가능 | 키보드 접근성은 기본 버튼 덕분에 일부 가능하나 라디오 그룹 의미 없음 | 권장 |
| 퀴즈 응시 | 동작. 모든 문항을 한 화면에 표시 후 제출 | 가능 | 가능 | 미응답 제출 가능. 제출 확인 없음 | 반드시 |
| 임시저장 | 코드상 의도 있음. 실제 복원은 결함 | 가능하지만 불완전 | 가능하지만 불완전 | 저장된 답안을 불러온 뒤 `setTestAnswers({})`로 초기화 | 반드시 |
| 결과 확인 | 동작. 점수/정답/해설 표시 | 가능 | 가능 | 결과 저장 실패해도 결과 화면 이동 | 반드시 |
| 이어하기 | 학습 모드는 가능. 퀴즈는 불완전 | 가능 | 가능 | 퀴즈는 activeQuestions 저장/복원 구조가 없음 | 반드시 |
| 오답 처리 | 학습 모드에서 오답은 큐 뒤로 이동 | 가능 | 가능 | 최초 답안 기준 점수 산정은 구현되어 있으나 설명 부족 | 권장 |
| 토스트/알림 | 동작. 3초 후 사라짐 | 가능 | 가능 | `aria-live` 없음. 실패 사유가 일반적 | 권장 |
| 모바일 사용성 | 주요 학습/퀴즈 사용 가능 | 제한적 | 양호 | 긴 제목/큰 버튼/결과 카드에서 320px 대응 부족 | 반드시 |
| 뒤로가기 | 미지원 | 미지원 | 미지원 | 브라우저 뒤로가기와 앱 상태가 연결되지 않음 | 반드시 |
| 새로고침 | 인증은 Firebase가 복원 가능하나 화면 상태는 초기화 | 불완전 | 불완전 | 진행 화면에서 새로고침하면 목록으로 돌아감 | 반드시 |
| 접근성 | 부분 지원 | 낮음 | 낮음 | label 부족, clickable div/h1, 토스트/모달 접근성 부족 | 반드시 |
| 에러 처리 | 일부 토스트만 있음 | 낮음 | 낮음 | 네트워크/권한/저장 실패 구분 없음 | 반드시 |
| 네트워크 장애 대응 | 미흡 | 낮음 | 낮음 | Tailwind/Firebase 오류 시 사용자 안내 없음 | 반드시 |

## 기능별 실제 근거

### 회원가입

실제 구현:

- `src/App.tsx:170-180`
- 사번 입력값이 8자리인지 확인
- `WN${empIdInput}`로 사번 생성
- `${finalEmpId.toLowerCase()}@wuerth.exam` pseudo email 생성
- 고정 인증값 `[MASKED_STUDENT_SHARED_PASSWORD]` 사용
- 사용자 프로필 영역에 학생 역할 정보 저장

Before:

```tsx
// src/App.tsx:172
const PWD = "[MASKED_STUDENT_SHARED_PASSWORD]";
```

문제:

| severity | 문제 | 사용자 영향 |
|---|---|---|
| 치명 | 사용자별 인증값/본인 인증 없음 | 본인 확인이 약한 계정 접근 위험 |
| 높음 | 이미 등록된 사번/잘못된 사번의 구체 안내 없음 | 사용자가 원인을 알기 어려움 |
| 보통 | Enter 키 제출 처리 없음 | 모바일/키보드 사용성이 떨어짐 |

After 예시:

```tsx
<input
  id="employeeId"
  inputMode="numeric"
  autoComplete="username"
  aria-describedby="employeeId-help employeeId-error"
/>
```

### 로그인

실제 구현:

- `src/App.tsx:178`
- 회원가입과 같은 pseudo email/credential 방식

실제와 추정 구분:

| 구분 | 내용 |
|---|---|
| 실제 구현 | Firebase Auth email/credential 로그인 |
| 추정 | 사번만으로 간단 입장을 만들려는 내부 교육용 UX |

위험:

- 보안상 로그인이라고 보기 어렵다.
- Firebase Auth를 쓰지만 사용자별 비밀값이 없다.

### 로그아웃

실제 구현:

- `src/App.tsx:366`

```tsx
{userProfile && <button onClick={() => signOut(auth)}>로그아웃</button>}
```

문제:

- 응시 중 로그아웃 시 현재 화면/진행 상태가 어떤 식으로 보존되는지 안내가 없다.
- `signOut` 실패 처리가 없다.

### 학습 목록

실제 구현:

- `src/App.tsx:397-410`
- `exams.filter(e => e.mode === 'study' && e.isVisible)` 사용

문제:

- Firestore 로딩 중에도 과정 데이터 영역 초기값 `[]`라서 "등록된 학습이 없습니다"가 표시될 수 있다.
- 권한 오류가 발생해도 별도 에러 UI가 없다.

After 예시:

```tsx
if (examState.status === 'loading') return <CourseSkeleton />;
if (examState.status === 'error') return <ErrorPanel message={examState.error.message} />;
```

### 학습 진행

실제 구현:

- 시작: `src/App.tsx:199-240`
- 답안 처리: `src/App.tsx:242-269`
- UI: `src/App.tsx:740-756`

동작:

1. 공개 과정 선택
2. 안내 화면
3. 랜덤 문항 추출
4. 보기 클릭 즉시 정답/오답 표시
5. 오답이면 같은 문항을 큐 뒤로 보냄
6. 큐가 비면 결과 저장

문제:

- `setDoc` 저장 실패 시 사용자 안내가 없다.
- `handleStudyNextQuestion` 내부의 `setDoc`은 `await`하지 않는다. `src/App.tsx:265`
- 오답 반복 정책은 구현되어 있지만 시작 전 사용자에게 명확히 안내되지 않는다.

### 퀴즈 응시와 임시저장

실제 구현:

- 답안 저장: `src/App.tsx:271-275`
- 제출: `src/App.tsx:771`

치명 결함:

```tsx
// src/App.tsx:216-218
setTestAnswers(tpDoc.data().answers);

// src/App.tsx:229-230
if (exam.mode === 'test') { 
  setTestAnswers({}); 
}
```

복원한 답안을 즉시 초기화한다. 또한 저장된 `activeQuestions`를 보존하지 않아 새 랜덤 문항과 기존 답안 인덱스가 어긋날 수 있다.

After 예시:

```ts
type 퀴즈 진행 데이터 영역 = {
  activeQuestions: Question[];
  answers: Record<number, number>;
  updatedAt: Timestamp;
};

if (tpDoc.exists()) {
  const progress = tpDoc.data() as 퀴즈 진행 데이터 영역;
  setActiveQuestions(progress.activeQuestions);
  setTestAnswers(progress.answers ?? {});
  setView('student-take');
  return;
}
```

### 결과 확인

실제 구현:

- 점수 계산: `src/App.tsx:281-283`
- 결과 저장: `src/App.tsx:285-289`
- 결과 화면 이동: `src/App.tsx:291`

문제:

```tsx
try {
  await addDoc(collection(db, 'results'), resultData);
} catch(e) {
  console.error("결과 저장 오류");
}
setView('student-result');
```

저장 실패 후에도 결과 화면으로 이동한다. 사용자는 결과가 관리자에게 제출된 것으로 오해할 수 있다.

개선:

```tsx
try {
  await saveResult(resultData);
  setView('student-result');
} catch (error) {
  showToast('결과 저장에 실패했습니다. 네트워크를 확인한 뒤 다시 제출해주세요.');
}
```

## 학생 User Flow

### 실제 흐름

```text
로그인/최초 등록
→ 학생 대시보드
→ 학습 또는 퀴즈 선택
→ 안내사항 확인
→ 시작
→ 문제 풀이
→ 제출/완료
→ 결과 확인
→ 목록으로 돌아가기
```

### 단절 지점

| severity | 지점 | 원인 |
|---|---|---|
| 치명 | Tailwind CDN 실패 시 첫 화면 진입 불가 | `src/App.tsx:87-99`, `src/App.tsx:351` |
| 높음 | 진행 중 새로고침 시 화면 복구 불가 | `view` 상태 라우팅 |
| 높음 | 퀴즈 이어하기 실패 | `testAnswers` 초기화 |
| 높음 | 미응답 제출 | 제출 전 검증 없음 |
| 보통 | 뒤로가기 미지원 | React Router/history 미사용 |

## 모바일 320px 기준 평가

| 화면 | 상태 | 문제 |
|---|---|---|
| 로그인 | 대체로 가능 | 카드 padding이 커서 좁은 화면에서 답답함 |
| 학생 대시보드 | 가능 | 퀴즈 카드가 `flex justify-between` 고정이라 긴 제목 압축 위험 |
| 학습 문제 | 가능 | 보기 버튼 `p-6`, 굵은 글씨로 긴 보기 줄바꿈 시 높이 급증 |
| 퀴즈 전체 문항 | 가능하지만 길어짐 | 긴 시험에서 스크롤 부담 큼. 제출 버튼까지 멀다 |
| 결과 | 가능 | 결과 상세 카드가 길고 sticky 목차 없음 |








