# Naming Review

## 목적

현재 프로젝트의 변수명, 함수명, 타입명, 상태명, 파일명, Firestore 컬렉션/필드명을 실제 코드 기준으로 분석한다. 목표는 사내용 웹을 이후 다른 담당자가 안전하게 인수인계하고, 보안 개선과 Firebase Rules 적용을 혼동 없이 진행할 수 있는 네이밍 기준을 만드는 것이다.

실제 인증값이나 운영 설정값은 이 문서에 기록하지 않는다.

## 분석 대상

| 대상 | 확인 결과 |
|---|---|
| `src/App.tsx` | 핵심 구현이 집중된 단일 파일. 874 lines, `useState` 37회, Firestore read/write 관련 호출 29회 |
| `src/main.tsx` | `App` 렌더링만 수행. 네이밍 이슈 낮음 |
| `src/**/*.ts`, `src/**/*.tsx` | `main.tsx`, `App.tsx` 외 도메인 코드 없음 |
| `package.json` | package name `quiz-master`. 실제 도메인인 교육/과정/평가 시스템과 다소 불일치 |
| Firebase 관련 설정 | Firebase 초기화와 client configuration이 `src/App.tsx:20-32`에 직접 존재 |
| docs 제안 구조 | `services`, `hooks`, `features`, `lib` 분리안은 현재 코드보다 명확한 이름을 요구 |

## 네이밍 품질 총평

현재 네이밍은 개인 개발 또는 빠른 프로토타입에는 이해 가능하지만, 사내용 운영 웹의 인수인계 기준으로는 부족하다. 가장 큰 문제는 `exam`이 과정, 학습 묶음, 퀴즈, 시험을 모두 대표하고, `test`와 `quiz`가 UI 문구/코드 의미에서 섞이며, `role` 필드가 실제 보안 권한처럼 오해될 수 있다는 점이다.

## 분석 기준별 평가

| 항목 | 현재 상태 | 평가 |
|---|---|---|
| 의미 명확성 | `view`, `mode`, `resultData`, `examData`, `q`, `r`, `ex` 등 포괄적 이름 다수 | 보통 이하 |
| 도메인 일관성 | `exam`, `test`, `quiz`, `study`, `course` 성격이 혼재 | 낮음 |
| 축약어 남용 | `q`, `r`, `ex`, `oi`, `spDoc`, `tpDoc`, `PWD` 등 존재 | 낮음 |
| 상태명 일관성 | `view`, `authMode`, `newExamMode`, `adminTab`의 의미 범위가 다름 | 보통 |
| Boolean 이름 | `isAnswerChecked`, `isBankModalOpen`, `isStyleLoaded`, `isVisible`은 대체로 양호 | 양호 |
| 함수명 | `handle*` 중심. 일부는 부작용이 많아 이름보다 실제 동작이 큼 | 보통 |
| 이벤트 핸들러 | `handleSaveExam`, `submitExam`, `startExam`이 저장/채점/화면 이동을 함께 수행 | 낮음 |
| Firestore 필드명 | `role`, `studentId`, `mode`, `activeQuestions`가 Rules 설계와 충돌 가능 | 낮음 |
| 타입명 | `Exam`, `ExamResult`, `UserProfile`은 일부 도메인 오해 가능 | 보통 이하 |
| 파일명 | `App.tsx`에 모든 도메인 포함. 서비스/훅/컴포넌트 파일 없음 | 낮음 |

## 주요 네이밍 이슈

### `exam`이 과정/시험/학습 묶음을 모두 의미함

근거:

- 타입: `src/App.tsx:37`의 `interface Exam`
- 컬렉션: `src/App.tsx:109`, `src/App.tsx:334-341`의 `exams`
- UI: 학습 목록과 퀴즈 목록이 모두 `exams` 배열에서 `mode`로 필터링됨

문제:

- 일반 사용자 관점의 "교육 과정"과 "시험"이 코드에서 모두 `exam`이다.
- 관리자 입장에서는 과정 생성인데 코드상 `handleSaveExam`이다.
- Rules 설계에서 공개 과정 read와 평가 결과 write를 구분하기 어렵다.

권장:

- 과정/묶음: `course`
- 학습형 진행: `studySession`
- 평가형 응시: `quizAttempt`
- 최종 결과: `quizResult` 또는 `attemptResult`

### `test`와 `quiz`가 혼용됨

근거:

- 코드 값: `mode: 'study' | 'test'`
- 상태명: `testAnswers`, `testProgress`
- UI 문구: 퀴즈, 실전 퀴즈

문제:

- 코드에서는 `test`, 사용자 화면에서는 `quiz`에 가깝다.
- `test`는 테스트 코드/테스트 환경과도 충돌할 수 있다.

권장:

- 사용자 평가형 응시는 `quiz`로 통일한다.
- 내부 mode 값은 `activityType: 'study' | 'quiz'` 또는 `courseMode: 'study' | 'quiz'`로 통일한다.

### `role` 필드가 권한 근거처럼 보임

근거:

- `UserProfile` 타입: `src/App.tsx:39`
- 학생 profile 생성: `src/App.tsx:177`

문제:

- Firestore 문서의 `role`은 클라이언트가 쓸 수 있는 데이터 필드처럼 보인다.
- 보안상 실제 관리자 권한은 Firebase Auth token custom claim에서 확인해야 한다.
- `role`이라는 이름은 Rules 작성자에게 권한 근거로 오해될 수 있다.

권장:

- 문서 필드는 `profileRole`, `displayRole`, `accountType`처럼 비권한성 이름으로 제한하거나 제거한다.
- 실제 권한은 `authRole` 또는 `claims.role`로 문서화한다.
- 반드시 "클라이언트 문서 필드 role은 권한 근거가 아니다"를 규칙으로 둔다.

### `studentId`와 `uid`/`employeeId`가 혼재함

근거:

- `UserProfile.uid`
- `UserProfile.employeeId`
- `ExamResult.studentId`
- 진행 문서 id: `${userProfile.uid}_${currentExamId}`

문제:

- `studentId`가 Firebase uid인지 사번인지 이름만으로 알 수 없다.
- Rules는 uid 기준으로 쓰는 것이 안전하지만 결과 데이터에는 사번이 들어간다.

권장:

- Firebase Auth uid: `studentUid`
- 사번: `studentEmployeeId`
- 사용자 표시명: `studentName`
- Rules path나 owner check는 `studentUid` 기준

### `questionBank`와 과정 내 `questions` 경계가 불명확함

근거:

- 저장고 타입: `BankQuestion`
- 과정 타입 필드: `questions: Question[]`
- 저장고 컬렉션: `questionBank`

문제:

- 저장고의 원본 문제와 과정에 복사된 문제의 생명주기가 다르다.
- `Question`만 보면 원본인지 과정 포함 문제인지 알기 어렵다.

권장:

- 저장고 원본: `questionBankItem`
- 과정에 포함된 문제 snapshot: `courseQuestion`
- 공통 베이스: `QuestionDraft` 또는 `BaseQuestion`

### `result`가 저장 결과인지 응시 결과인지 혼동됨

근거:

- `results`, `ExamResult`, `resultData`, `lastResult`, `selectedResultDetail`

문제:

- `result`는 Firestore write 결과, 시험 결과, 화면 상세 결과를 모두 떠올리게 한다.
- `docRef`와 `resultData`가 함께 쓰일 때 의미 경계가 약하다.

권장:

- 최종 응시 결과: `quizResult` 또는 `attemptResult`
- 저장 요청 payload: `resultPayload`
- 저장 반환값: `savedResult`
- 관리자 상세 선택: `selectedAttemptResult`

## 변수명 변경 우선순위

| 현재 이름 | 위치 | 문제 | 권장 이름 | 우선순위 | 변경 영향 |
|---|---|---|---|---|---|
| `role` | `src/App.tsx:39`, `src/App.tsx:177` | 클라이언트 문서 필드가 실제 권한처럼 오해됨 | `profileRole` 또는 제거, 실제 권한은 `authRole`/claim | P0 | Firestore Rules/Auth 설계 영향 |
| `adminPasswordInput` | `src/App.tsx:56`, `src/App.tsx:861` | client 인증값 입력 상태로 보안 구조 오해 유발 | `adminCredentialInput` 임시, 최종적으로 제거 | P0 | 관리자 인증 리팩토링 영향 |
| `PWD` | `src/App.tsx:172` | 의미가 축약되어 있고 공통 인증값 구조를 숨김 | 제거, 임시라면 `sharedStudentCredential` | P0 | 학생 인증 리팩토링 영향 |
| `studentId` | `src/App.tsx:38`, `src/App.tsx:313` | uid인지 사번인지 불명확 | `studentEmployeeId` | P0 | 결과 데이터 migration 가능 |
| `Exam` | `src/App.tsx:37` | 과정/학습/퀴즈 묶음을 모두 시험처럼 표현 | `Course` | P1 | 타입/서비스/컬렉션 전반 영향 |
| `exams` | `src/App.tsx:44`, `src/App.tsx:109` | 실제 사용자 기능은 과정 목록 | `courses` | P1 | UI/서비스/Firestore 명칭 영향 |
| `mode: 'study' | 'test'` | `src/App.tsx:37`, `src/App.tsx:73` | `test`와 UI의 quiz가 혼재 | `activityType: 'study' | 'quiz'` | P1 | Firestore field migration 가능 |
| `testAnswers` | `src/App.tsx:66` | quiz 응시 답안인데 test로 표현 | `quizAttemptAnswers` | P1 | 학생 응시 로직 영향 |
| `testProgress` | `src/App.tsx:193`, `215`, `274`, `292`, `317` | 퀴즈 임시저장/응시 진행 의미가 약함 | `quizAttemptDrafts` 또는 `quizAttempts` | P1 | Firestore collection migration |
| `studyProgress` | `src/App.tsx:192`, `204`, `235`, `263`, `265`, `286` | session인지 progress인지 불명확 | `studySessions` | P1 | Firestore collection migration |
| `ExamResult` | `src/App.tsx:38` | 학습 완료 결과와 퀴즈 결과가 섞임 | `AttemptResult` 또는 `QuizResult` | P1 | 결과 조회/저장 영향 |
| `results` | `src/App.tsx:45`, `110` | 관리자 결과 목록인지 저장 결과인지 포괄적 | `attemptResults` | P1 | 관리자 결과 UI 영향 |
| `questionBank` | `src/App.tsx:46`, `111` | collection과 상태명이 같고 item 경계 약함 | `questionBankItems` | P1 | 문제 저장고 서비스 영향 |
| `BankQuestion` | `src/App.tsx:36` | 원본 문제인지 복사본인지 표현 부족 | `QuestionBankItem` | P1 | 타입명 변경 |
| `Question` | `src/App.tsx:35` | 저장고/과정/응시 문제 모두 표현 | `BaseQuestion`, `CourseQuestion` | P1 | 타입 분리 영향 |
| `view` | `src/App.tsx:48` | 임시 UI 상태인지 route인지 불명확 | `uiView` 또는 Router route | P2 | Router 도입 전 안전 변경 |
| `adminTab` | `src/App.tsx:49` | dashboard section 의미가 더 적절 | `adminSection` | P2 | 관리자 UI 영향 |
| `currentExamId` | `src/App.tsx:52` | 현재 과정 id에 가까움 | `currentCourseId` | P1 | 학생/관리자 흐름 전반 영향 |
| `customExamId` | `src/App.tsx:70` | 관리자가 입력하는 과정 코드 | `customCourseCode` | P1 | 관리자 과정 폼 영향 |
| `newExamTitle` | `src/App.tsx:71` | 과정 제목 | `courseTitleDraft` | P2 | 폼 상태 영향 |
| `newExamMode` | `src/App.tsx:73` | 과정 activity type | `courseActivityTypeDraft` | P2 | 폼 상태 영향 |
| `displayCount` | `src/App.tsx:74` | 출제 문항 수 | `questionDisplayCount` | P2 | 폼 상태/검증 영향 |
| `activeQuestions` | `src/App.tsx:58`, `313` | 현재 응시 세트인지 과정 문제인지 불명확 | `attemptQuestions` | P1 | 결과 저장/응시 흐름 영향 |
| `questionQueue` | `src/App.tsx:63` | 학습 오답 반복 큐 | `studyQuestionQueue` | P2 | 학습 모드 영향 |
| `q`, `r`, `ex`, `oi` | 다수 map/reduce | 축약어로 문맥 의존 | `question`, `result`, `course`, `optionIndex` | P2 | 국소 변경 |
| `spDoc`, `tpDoc` | `src/App.tsx:204`, `215` | 축약어 이해 어려움 | `studySessionSnapshot`, `quizAttemptSnapshot` | P2 | 국소 변경 |
| `resultData` | `src/App.tsx:313` | payload인지 저장 결과인지 불명확 | `resultPayload` | P2 | 국소 변경 |
| `examData` | `src/App.tsx:329` | 저장 payload 의미 | `coursePayload` | P2 | 국소 변경 |
| `quiz-master` | `package.json:2` | 실제 앱 도메인과 조직 맥락 부족 | `training-assessment-app` 등 | P3 | package metadata |

## Firestore/Rules 네이밍 정합성

현재 컬렉션 이름:

```text
users
exams
results
questionBank
studyProgress
testProgress
```

권장 체계:

| 현재 | 권장 | 이유 |
|---|---|---|
| `users` | `studentProfiles` 또는 `userProfiles` | Auth uid 기반 profile임을 명확히 함 |
| `exams` | `courses` | 학습/퀴즈를 포함하는 과정 묶음 |
| `questionBank` | `questionBankItems` | collection item 단위 명확화 |
| `studyProgress` | `studySessions` | 학습 모드 진행 세션 |
| `testProgress` | `quizAttempts` | 평가형 응시 시도 |
| `results` | `attemptResults` 또는 `quizResults` | 응시 결과와 일반 write 결과 구분 |

권장 필드:

| 현재 필드 | 권장 필드 | 이유 |
|---|---|---|
| `uid` | `studentUid` 또는 document id `{uid}` | owner check 명확화 |
| `employeeId` | `studentEmployeeId` | 사번 의미 명확화 |
| `studentId` | `studentEmployeeId` | uid와 혼동 방지 |
| `examId` | `courseId` | 과정 참조 명확화 |
| `examTitle` | `courseTitle` | 과정명 snapshot |
| `mode` | `activityType` | study/quiz 활동 유형 |
| `isVisible` | `visibilityStatus` 또는 `isPublished` | 공개/출시 상태 의미 명확화 |
| `activeQuestions` | `attemptQuestions` | 응시 시점 문항 snapshot |
| `answers` | `selectedOptionByQuestionIndex` | 답안 구조 명확화 |
| `createdAt` | `createdAt`, `updatedAt`, `submittedAt` | 이벤트 시간 구분 |
| `role` | `profileRole` 또는 제거 | 권한 claim과 혼동 방지 |

Rules 원칙:

- 클라이언트 문서 필드 `role`은 권한 근거가 아니다.
- 관리자 권한은 Firebase Auth custom claim의 `authRole` 또는 `claims.role` 기준으로만 판단한다.
- 학생 데이터 owner check는 `request.auth.uid`와 `studentUid` 또는 path uid를 비교한다.
- 사번은 표시/업무 식별자이지 Rules owner key가 아니다.

## 리팩토링 시 네이밍 변경 전략

### 당장 바꿔야 하는 이름

| 이름 | 이유 |
|---|---|
| `role` | 보안 권한 오해 방지 |
| `studentId` | uid/employeeId 혼동 방지 |
| `adminPasswordInput` | client 인증 구조 제거 과정에서 함께 제거 |
| `PWD` | 공통 인증값 구조 제거 |

### 서비스 분리 시 같이 바꿀 이름

| 이름 | 변경 |
|---|---|
| `Exam` / `exams` | `Course` / `courses` |
| `ExamResult` / `results` | `AttemptResult` / `attemptResults` |
| `BankQuestion` | `QuestionBankItem` |
| `currentExamId` | `currentCourseId` |
| `handleSaveExam` | `saveCourseDraft` 또는 `handleSaveCourse` |
| `submitExam` | `submitQuizAttempt` |

### React Router 도입 시 바꿀 이름

| 이름 | 변경 |
|---|---|
| `view` | `uiView`로 임시 명확화 후 route로 제거 |
| `adminTab` | `adminSection` 또는 nested route |
| `student-entry`, `student-take`, `student-result` | `/student/courses/:courseId`, `/student/attempts/:attemptId`, `/student/results/:resultId` |

### Firestore migration이 필요한 이름

| 이름 | 이유 |
|---|---|
| `exams` collection | `courses`로 바꾸려면 데이터 migration 필요 |
| `results` collection | `attemptResults`/`quizResults` migration 필요 |
| `studyProgress` / `testProgress` | path와 document id 정책 변경 필요 |
| `mode` field | 기존 값 `'test'`를 `'quiz'`로 migration 필요 |
| `studentId` field | `studentEmployeeId`로 migration 필요 |

### 지금은 유지해야 하는 이름

| 이름 | 이유 |
|---|---|
| 기존 Firestore collection 이름 | Rules/서비스 분리 전 먼저 바꾸면 런타임 장애 위험 |
| 기존 `mode` 값 | UI와 저장 데이터가 모두 의존 중 |
| `App.tsx` 파일명 | 첫 리팩토링에서는 orchestration 파일로 남겨 변경량 제한 |

## 인수인계 관점 평가

현재 네이밍은 신규 담당자가 다음 질문에서 자주 막힐 가능성이 높다.

| 질문 | 막히는 이유 |
|---|---|
| exam은 과정인가 시험인가 | 학습/퀴즈 모두 포함 |
| test와 quiz는 같은가 | 코드와 UI 표현이 다름 |
| studentId는 uid인가 사번인가 | 결과 필드명만으로 알 수 없음 |
| role은 실제 권한인가 | profile field와 auth claim 경계 없음 |
| questionBank 문제와 course questions는 연결되는가 | snapshot/원본 경계가 이름에 없음 |

따라서 보안 리팩토링 전 네이밍 기준을 정하고, Firestore migration이 필요한 이름과 code-only rename이 가능한 이름을 분리해야 한다.

