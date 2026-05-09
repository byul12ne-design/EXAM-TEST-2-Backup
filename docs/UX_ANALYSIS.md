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

## Vercel Deployment Impact

| 항목 | 분석 |
|---|---|
| production 위험 | Vercel 첫 진입은 가능할 수 있으나 Tailwind CDN 실패 시 사용자는 앱을 전혀 사용할 수 없다 |
| local build와 production 차이 | build 성공은 실제 Firebase 연결 실패, CDN 실패, 모바일 브라우저 파일 다운로드 문제를 검증하지 않는다 |
| runtime risk | Firebase 권한/네트워크 실패가 빈 목록처럼 보일 수 있고, 결과 저장 실패 후 완료 화면으로 이동한다 |
| env risk | production/staging 문구나 Firebase project 분리가 없어 운영 환경 혼동 가능성이 있다 |
| SPA risk | 새로고침 시 `view` 상태가 초기화되고, 직접 URL/deep link를 제공할 수 없다 |
| mobile runtime risk | 모바일은 `뒤로`, PC는 `나가기`로 동작이 다르며 iOS/Safari CSV 다운로드 UX가 불안정할 수 있다 |

# UX 분석

## Severity 기준

| severity | 기준 |
|---|---|
| 치명 | 사용 불가, 데이터 노출/유실, 잘못된 제출 가능성이 큰 문제 |
| 높음 | 주요 흐름을 방해하거나 신뢰를 해치는 문제 |
| 보통 | 반복 사용 시 불편하거나 접근성이 낮은 문제 |
| 낮음 | polish, 문구, 시각적 명확성 개선 |

## 치명

| 문제 | 실제 원인 | 발생 행동 | 사용자 영향 | 개선 |
|---|---|---|---|---|
| Tailwind CDN 실패 시 앱 진입 불가 | `src/App.tsx:87-99`, `src/App.tsx:351` | 앱 접속 | "디자인 로딩중..."에서 멈춤 | Tailwind 빌드 타임 적용, CDN 게이트 제거 |
| 관리자 우회 가능 | `src/App.tsx:183-186` | 관리자 모드 클릭 후 관리자 인증값 입력 | 권한 없는 관리자 접근 위험 | Firebase Custom Claims/Rules 적용 |
| 퀴즈 임시저장 복원 실패 | `src/App.tsx:214-230` | 퀴즈 중 나갔다가 재진입 | 저장된 답안이 사라지거나 문항과 불일치 | `activeQuestions`와 `answers` 함께 저장/복원 |
| 결과 저장 실패 후 완료 화면 이동 | `src/App.tsx:286-291` | 제출 시 네트워크 오류 | 제출됐다고 오해 | 저장 성공 후에만 결과 화면 이동 |
| 로그인 전 전체 데이터 구독 | `src/App.tsx:101-113` | 앱 접속 | 권한 오류/개인정보 노출/성능 저하 | 인증 후 역할별 query 구독 |

## 높음

| 문제 | 실제 원인 | 발생 행동 | 사용자 영향 | 개선 |
|---|---|---|---|---|
| 미응답 제출 가능 | `src/App.tsx:771`이 바로 `submitExam(testAnswers)` 호출 | 시험 제출 | 빈 답안이 오답 처리 | 미응답 목록 표시/확인 모달 |
| 새로고침 시 화면 상태 초기화 | `src/App.tsx:48`의 메모리 상태 라우팅 | 진행 중 새로고침 | 목록으로 돌아가 혼란 | React Router + 진행 상태 URL |
| 뒤로가기 UX 없음 | History API 미연동 | 모바일 뒤로가기 | 앱 이전 화면으로 못 감 | 라우팅 도입 |
| 로딩/오류 상태 부재 | Firestore 구독 에러 콜백 없음 | 느린 네트워크/권한 오류 | 등록 없음처럼 보임 | `loading/error/success` 상태 |
| 과정 수정 ID 변경 위험 | `src/App.tsx:305-307` | 과정 코드 수정 저장 | 기존 결과/진행 참조 깨짐 | ID 변경 금지 또는 migration |

## 보통

| 문제 | 실제 원인 | 발생 행동 | 사용자 영향 | 개선 |
|---|---|---|---|---|
| 입력 label 부족 | placeholder 중심 UI | 스크린리더/자동완성 | 필드 목적 파악 어려움 | `<label htmlFor>` 추가 |
| Toast 접근성 부족 | `role/status`, `aria-live` 없음 | 오류 발생 | 스크린리더가 알림을 못 읽음 | `role="status"` 추가 |
| 클릭 가능한 `div/h1` | `src/App.tsx:362`, `src/App.tsx:566` | 키보드-only 사용 | 접근 불가 또는 역할 불명확 | button/a 사용 |
| Modal focus 관리 없음 | `src/App.tsx:661-705` | 저장고 모달 열림 | 포커스가 배경으로 이동 가능 | focus trap/Escape |
| Hover 의존 피드백 | `hover:*` 클래스 다수 | 터치 디바이스 | 가능 상태 인지 약함 | 항상 보이는 affordance |

## 낮음

| 문제 | 근거 | 개선 |
|---|---|---|
| HTML 언어가 영어 | `index.html:2` | `lang="ko"` |
| 문서 title이 템플릿 | `index.html:7` | 실제 서비스명으로 변경 |
| README 불일치 | `README.md:1` | 운영/개발 문서로 교체 |
| 미사용 CSS/asset | `src/App.css`, `src/assets/*` | 삭제 또는 정리 |

## 학생 UX 흐름 문제

### 현재 흐름

```text
사번 입력 → 교육장 입장 → 학습/퀴즈 선택 → 안내 확인 → 시작 → 풀이 → 결과
```

### 단절

- 첫 진입에서 데이터 로딩 중인지 공개 과정이 없는지 구분되지 않는다.
- 시험 제출 전에 "몇 개 미응답"인지 알려주지 않는다.
- 저장 실패를 결과 화면에서 알 수 없다.
- 새로고침/뒤로가기 시 사용자가 예상하는 흐름과 다르다.

## 관리자 UX 흐름 문제

```text
관리자 모드 → 인증값 → 세트 관리/문제 저장고/통계
```

문제:

- 관리자 모드 버튼이 로그인 카드 하단에 흐린 텍스트로만 있어 발견 가능성이 낮다.
- 관리자 인증이 실제 권한과 연결되지 않아 운영자가 신뢰하기 어렵다.
- 과정 생성 폼이 길지만 단계 구분, 저장 상태, 검증 요약이 없다.
- 문제 수가 많을수록 한 화면 관리가 매우 느려진다.

## 저장 실패 처리

Before:

```tsx
// src/App.tsx:286-291
try {
  const docRef = await addDoc(collection(db, 'results'), resultData);
  setLastResult({ id: docRef.id, ...resultData });
} catch(e) { console.error("결과 저장 오류"); }
setView('student-result');
```

After:

```tsx
setSubmitting(true);
try {
  const saved = await saveExamResult(resultData);
  setLastResult(saved);
  setView('student-result');
} catch {
  showToast('결과 저장에 실패했습니다. 다시 제출해주세요.');
} finally {
  setSubmitting(false);
}
```

## 폼 검증

현재:

- 사번 8자리만 확인
- 과정 제목과 문제 텍스트만 일부 확인
- 보기/정답/문항수/CSV 데이터 검증 부족

권장:

| 폼 | 필수 검증 |
|---|---|
| 로그인 | 사번 길이, 숫자, 등록 여부, 네트워크 오류 |
| 과정 | 제목, 모드, 문항 수, 보기 공백, 정답 범위 |
| CSV | 헤더, 컬럼 수, 정답 범위, 중복 문항, preview |
| 제출 | 미응답 수, 제출 확인, 중복 제출 방지 |








