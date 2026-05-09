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

# 관리자 기능 분석

## 관리자 기능 표

| 기능 | 실제 동작 여부 | 모바일 | PC | 문제점 | 개선 우선순위 |
|---|---|---|---|---|---|
| 관리자 로그인 | 화면 전환만 동작 | 가능 | 가능 | 인증값 `[MASKED_ADMIN_PASSWORD]`이 클라이언트 코드에 노출. Auth/role 검증 없음 | 반드시 |
| 권한 검증 방식 | 사실상 없음 | 위험 | 위험 | `UserProfile.role` 타입은 있으나 관리자 접근에 사용하지 않음 | 반드시 |
| 과정 생성 | 동작 | 제한적 | 가능 | 문항 검증 부족, 저장 중 상태 없음, 실패 이유 불명확 | 반드시 |
| 과정 수정 | 동작 | 제한적 | 가능 | ID 변경 시 기존 문서 삭제 후 새 문서 생성. 결과/진행 참조 깨질 수 있음 | 반드시 |
| 과정 삭제 | 동작 | 가능 | 가능 | 관련 결과/진행 데이터 정리 없음 | 반드시 |
| 문제은행 관리 | 동작 | 제한적 | 가능 | 모바일 2열 입력 고정, 검증 부족 | 권장 |
| CSV 업로드 | 조건부 동작 | 제한적 | 가능 | `.csv`만 허용하지만 UI는 엑셀. 파싱 취약 | 반드시 |
| CSV 다운로드 | 조건부 동작 | 브라우저별 불안정 | 가능 | Blob 다운로드 UX, URL revoke 없음 | 권장 |
| 결과 조회 | 동작 | 제한적 | 가능 | 전체 결과를 실시간 구독. 페이지네이션 없음 | 반드시 |
| 결과 필터링 | 과정별 필터 동작 | 가능 | 가능 | 학생/점수/기간 검색 없음 | 권장 |
| 통계 기능 | 이름만 통계. 실제 차트/집계 없음 | 가능 | 가능 | 결과 리스트와 CSV만 존재 | 장기 |
| 실시간 반영 | 동작 | 가능 | 가능 | 모든 관리자 데이터 전체 구독 | 반드시 |
| 데이터 무결성 | 낮음 | 낮음 | 낮음 | 클라이언트 write 중심, 스키마 검증 없음 | 반드시 |
| 보안 문제 | 높음 | 높음 | 높음 | 관리자 우회 가능성, rules 미검증 | 반드시 |
| 모바일 관리 가능 여부 | 부분 가능 | 낮음 | 양호 | 버튼/입력 밀도 높고 긴 목록 관리 어려움 | 권장 |
| Firestore read/write 위험성 | 높음 | 높음 | 높음 | 로그인 전 전체 컬렉션 구독, 클라이언트 삭제/수정 | 반드시 |

## 관리자 로그인

실제 구현: 클라이언트 상태 전환 기반의 관리자 진입 로직이 존재하며, 인증값은 문서에서 마스킹한다.

실제와 추정:

| 구분 | 내용 |
|---|---|
| 실제 구현 | 클라이언트 상태 `view`를 `admin-dash`로 바꾸는 로컬 인증값 |
| 추정 | 간단한 내부 관리자 진입 장치 |

문제:

| severity | 원인 | 위험 |
|---|---|---|
| 치명 | 인증값가 JS 번들에 포함 | 클라이언트 번들 노출 위험 |
| 치명 | `userProfile.role` 미사용 | 학생 로그인 여부와 무관하게 관리자 진입 가능 |
| 치명 | Firestore Rules 미검증 | rules가 열려 있으면 직접 write 가능 |

개선 예시:

```ts
// 서버 또는 Firebase Custom Claims 기준
const token = await auth.currentUser?.getIdTokenResult();
if (token?.claims.role !== 'admin') {
  throw new Error('관리자 권한이 없습니다.');
}
```

## 과정 생성

실제 구현:

- 새 과정 버튼: `src/App.tsx:441-444`
- 생성/수정 화면: `src/App.tsx:586-657`
- 저장 함수: `src/App.tsx:294-317`

저장 데이터:

```tsx
// src/App.tsx:301
const examData = {
  title: newExamTitle,
  notice: newExamNotice,
  mode: newExamMode,
  questions: cleaned,
  displayCount: parseInt(displayCount) || cleaned.length,
  isVisible: false,
  createdAt: Date.now()
};
```

문제:

- `displayCount`가 문항 수보다 커도 그대로 저장될 수 있다.
- 각 문제의 보기 4개가 비어 있어도 저장 가능하다.
- `answerIndex` 범위 검증이 없다.
- `createdAt`이 수정 시에도 갱신되어 최초 생성일이 사라진다.
- 서버 시간 대신 클라이언트 `Date.now()` 사용.

After 예시:

```ts
function validateExamDraft(draft: ExamDraft): ValidationError[] {
  const errors = [];
  if (!draft.title.trim()) errors.push({ field: 'title', message: '제목을 입력하세요.' });
  if (draft.questions.some(q => q.options.some(o => !o.trim()))) {
    errors.push({ field: 'questions', message: '모든 보기를 입력하세요.' });
  }
  if (draft.displayCount > draft.questions.length) {
    errors.push({ field: 'displayCount', message: '출제 수는 전체 문항 수보다 클 수 없습니다.' });
  }
  return errors;
}
```

## 과정 수정

실제 구현:

- 수정 버튼: `src/App.tsx:456-462`
- ID 변경 시 삭제 후 새 문서 생성: `src/App.tsx:305-307`

문제:

| severity | 문제 |
|---|---|
| 높음 | `examId`가 바뀌면 기존 결과 데이터 영역, 학습 진행 데이터 영역, 퀴즈 진행 데이터 영역가 이전 ID를 참조 |
| 높음 | 삭제 후 setDoc 중간 실패 시 과정이 사라질 수 있음 |
| 보통 | 수정 중 다른 관리자가 변경한 내용과 충돌 가능 |

개선:

- 문서 ID 변경을 금지하거나 `slug` 필드로 분리
- ID 변경이 필요하면 batch/transaction으로 참조 데이터 migration

## 과정 삭제

실제 구현:

```tsx
// src/App.tsx:463
if(window.confirm('정말 삭제하시겠습니까?')) await deleteDoc(doc(db, 'exams', ex.id));
```

문제:

- 관련 결과/진행 데이터 삭제 또는 보존 정책이 없다.
- 삭제 버튼이 모바일에서 작고, 되돌리기 기능이 없다.
- `window.confirm`은 접근성/커스텀 설명이 부족하다.

## 문제은행 관리

실제 구현:

- 등록/수정 폼: `src/App.tsx:474-497`
- 목록/수정/삭제: `src/App.tsx:500-520`

문제:

- `grid grid-cols-2` 고정이라 모바일 입력칸이 좁다. `src/App.tsx:485`
- 문제/보기/정답/카테고리 검증이 약하다.
- 삭제 시 관련 과정에 복사된 문제는 영향을 받지 않아 데이터 일관성 이해가 어렵다.

개선:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

## CSV 업로드

실제 구현:

- 문제은행 CSV 업로드: `src/App.tsx:139-154`
- 과정 문제 CSV 업로드: `src/App.tsx:156-168`
- 파서: `src/App.tsx:118-137`

문제:

| severity | 문제 | 설명 |
|---|---|---|
| 높음 | 단순 CSV 파서 | 따옴표 이스케이프, 줄바꿈 필드, 쉼표 포함 데이터 취약 |
| 보통 | UI는 "엑셀"이나 accept는 `.csv` | 사용자는 `.xlsx` 업로드가 된다고 오해 |
| 보통 | 업로드 중 상태 없음 | 대량 업로드 때 중복 클릭/불안감 |
| 높음 | 데이터 검증 부족 | 정답 인덱스 0~3 범위 보장 없음 |

추천:

- `papaparse` 사용
- 업로드 전 preview/검증 단계
- 관리자 업로드 로그 저장

## 결과 조회/필터/다운로드

실제 구현:

- 결과 탭: `src/App.tsx:526-581`
- 과정 필터: `src/App.tsx:544-550`
- CSV 다운로드: `src/App.tsx:340-349`
- 선택 삭제: `src/App.tsx:533-540`

문제:

- 결과 전체를 `onSnapshot(collection(db, 'results'))`로 실시간 구독한다. `src/App.tsx:110`
- 페이지네이션 없음.
- 학생명/사번/날짜/점수 검색 없음.
- CSV에 상세 문항/정오답은 빠져 있다.
- 다운로드 후 `URL.revokeObjectURL` 호출 없음.

After 예시:

```ts
const q = query(
  collection(db, 'results'),
  where('examId', '==', selectedExamId),
  orderBy('createdAt', 'desc'),
  limit(50)
);
```

## 관리자 모바일 사용성

| 화면 | 모바일 상태 | 문제 |
|---|---|---|
| 관리자 탭 | `flex-wrap`로 줄바꿈 가능 | 탭이 많아지면 높이 증가 |
| 과정 목록 | `flex-col sm:flex-row` 적용 | 버튼 3개가 한 줄이라 320px에서 촘촘함 |
| 문제은행 폼 | 일부 반응형 부족 | 보기 입력 `grid-cols-2` 고정 |
| 결과 목록 | 카드 구조 | 점수/긴 과정명 겹침 가능 |
| CSV 업로드 | label 클릭 | 모바일 파일 선택 가능하지만 CSV 파일 접근 UX는 브라우저 의존 |









