# Domain Terminology

## 목적

사내용 교육/평가 웹을 장기 유지보수하기 위한 권장 도메인 용어집이다. 이 용어집은 코드, Firestore Rules, 문서, UI copy의 기준이 된다.

## 권장 용어표

| 권장 용어 | 사용 위치 | 의미 | 피해야 할 용어 |
|---|---|---|---|
| `course` | 타입, service, Firestore collection | 학습/퀴즈를 포함하는 교육 과정 또는 세트 | `exam`을 과정 의미로 사용 |
| `courseId` | URL, Firestore field, state | 과정 문서 id | `examId` |
| `courseTitle` | UI, result snapshot | 과정명 | `examTitle` |
| `activityType` | course field | 과정의 활동 유형. `study` 또는 `quiz` | `mode`, `test` |
| `study` | activity value | 학습형 진행 | `course`와 혼용 |
| `quiz` | activity value | 평가형 응시 | `test` |
| `studySession` | service, Firestore | 학습 모드 진행 상태 | `studyProgress` |
| `quizAttempt` | service, Firestore | 퀴즈 응시 시도. 제출 전/후 lifecycle 포함 가능 | `testProgress`, `exam` |
| `attemptResult` | result service, admin result UI | 제출 완료된 응시 결과 | `result` 단독 사용 |
| `questionBankItem` | 문제 저장고 | 문제 저장고의 원본 문제 | `BankQuestion`, `questionBank` 단수 혼용 |
| `courseQuestion` | course field | 과정에 포함된 문제 snapshot | `Question` 단독 사용 |
| `attemptQuestion` | quiz/study attempt | 응시 시점에 선택된 문항 snapshot | `activeQuestions` |
| `studentProfile` | auth/profile service | 학생 사용자 정보 | `user` 단독 사용 |
| `studentUid` | Rules, owner field | Firebase Auth uid | `studentId` |
| `studentEmployeeId` | profile/result display | 사번 | `studentId`, `empId` |
| `authRole` | Auth claim parsing | Firebase claim 기반 권한 | Firestore 문서 `role` |
| `profileRole` | profile display only | 표시/분류용 role. 권한 근거 아님 | `role` |
| `adminSection` | admin UI | 관리자 화면 내부 탭/섹션 | `adminTab` |
| `uiView` | Router 도입 전 임시 state | URL route가 아닌 화면 상태 | `view` |
| `isPublished` | course visibility | 학생에게 공개된 과정 여부 | `isVisible`이 운영 상태와 혼동될 때 |
| `visibilityStatus` | course visibility | `draft`, `published`, `archived` 같은 공개 상태 | Boolean 하나로 모든 상태 표현 |
| `resultPayload` | result service | 저장 요청 데이터 | `resultData` |
| `savedResult` | result service | Firestore 저장 후 id 포함 결과 | `docRef`와 혼용 |

## 권장 타입명

| 현재 타입 | 권장 타입 | 설명 |
|---|---|---|
| `Question` | `BaseQuestion` | 문제 공통 필드 |
| `BankQuestion` | `QuestionBankItem` | 저장고 원본 문제 |
| `Exam` | `Course` | 교육 과정/세트 |
| `ExamResult` | `AttemptResult` 또는 `QuizResult` | 제출 결과 |
| `UserProfile` | `StudentProfile` 또는 `UserProfile` + `authRole` 분리 | profile과 권한 분리 |

## 권장 상태명

| 현재 상태명 | 권장 상태명 | 이유 |
|---|---|---|
| `view` | `uiView` | Router 도입 전 임시 상태임을 명확히 함 |
| `adminTab` | `adminSection` | UI section 의미 |
| `currentExamId` | `currentCourseId` | 과정 id 의미 |
| `newExamTitle` | `courseTitleDraft` | 관리자 폼 draft |
| `newExamNotice` | `courseNoticeDraft` | 관리자 폼 draft |
| `newExamMode` | `courseActivityTypeDraft` | study/quiz 구분 |
| `displayCount` | `questionDisplayCount` | 출제 문항 수 |
| `activeQuestions` | `attemptQuestions` | 응시 시점 문항 |
| `testAnswers` | `quizAttemptAnswers` | 퀴즈 응시 답안 |
| `firstAttemptAnswers` | `studyFirstAttemptAnswers` | 학습 첫 응답 |
| `selectedResultDetail` | `selectedAttemptResult` | 결과 상세 선택 |

## 권장 함수명

| 현재 함수명 | 권장 함수명 | 이유 |
|---|---|---|
| `handleStudentAuth` | `handleStudentSignIn` 또는 `handleStudentRegistration` | login/register 분기 명확화 |
| `handleAdminLogin` | 제거 또는 `verifyAdminAccess` | local admin credential 구조 제거 |
| `startExam` | `startCourseActivity` | study/quiz 모두 시작 |
| `submitExam` | `submitQuizAttempt` 또는 `completeStudySession` 분리 | 학습/퀴즈 완료 의미 분리 |
| `handleSaveExam` | `handleSaveCourse` | 과정 저장 |
| `toggleVisibility` | `toggleCoursePublishedState` | 무엇의 공개 상태인지 명확화 |
| `handleSaveBankQuestion` | `handleSaveQuestionBankItem` | 저장고 item 단위 |
| `handleExportCSV` | `exportAttemptResultsCsv` | 결과 export 대상 명확화 |
| `parseCSV` | `parseQuestionCsv` | 파싱 대상 명확화 |

## Firestore 네이밍 체계

### 권장 collection 이름

| 권장 collection | 의미 | Rules 기준 |
|---|---|---|
| `studentProfiles` | 학생 profile | `{uid}` path 또는 `studentUid` field가 owner |
| `courses` | 과정/세트 | 공개 read와 admin write 분리 |
| `questionBankItems` | 관리자 문제 저장고 | admin only |
| `studySessions` | 학습 진행 | student owner only |
| `quizAttempts` | 퀴즈 응시 시도 | student owner + submitted 상태 |
| `attemptResults` | 제출 완료 결과 | student owner read, admin read/delete |

### document id 원칙

| 데이터 | 권장 id | 이유 |
|---|---|---|
| student profile | Firebase Auth uid | Rules owner check 단순화 |
| course | course code 또는 auto id | 사람이 쓰는 course code와 DB id 역할 분리 권장 |
| question bank item | auto id | 원본 문제는 독립 item |
| study session | `{studentUid}_{courseId}` 또는 nested path | 학생/과정별 진행 고유성 |
| quiz attempt | auto id + `studentUid`, `courseId` fields | 다회 응시 가능성 |
| attempt result | attempt id 또는 auto id | 제출 결과 추적 |

### field 이름 원칙

| 필드 | 의미 |
|---|---|
| `studentUid` | Firebase Auth uid. Rules owner 기준 |
| `studentEmployeeId` | 사번. 표시/업무 식별용 |
| `courseId` | 과정 참조 id |
| `courseTitle` | 결과 저장 시점의 과정명 snapshot |
| `activityType` | `study` 또는 `quiz` |
| `attemptQuestions` | 응시 시점 문제 snapshot |
| `selectedOptionByQuestionIndex` | 선택 답안 map |
| `correctCount` | 정답 수 |
| `totalQuestionCount` | 전체 문항 수 |
| `scorePercent` | 0~100 점수 |
| `createdAt` | 생성 시각 |
| `updatedAt` | 수정 시각 |
| `submittedAt` | 제출 시각 |

## 권한 용어 규칙

클라이언트 문서 필드 `role`은 권한 근거가 아니다.

| 용어 | 사용 가능 위치 | 권한 근거 여부 |
|---|---|---|
| `authRole` | Firebase token claim parsing | 예 |
| `claims.role` | Firestore Rules / server 검증 | 예 |
| `profileRole` | UI 표시/분류 | 아니오 |
| `accountType` | profile 표시/운영 분류 | 아니오 |
| `isAdmin` | claim 기반 helper 결과 | 예, helper 구현이 claim 기반일 때만 |

## migration 전략

| 단계 | 이름 변경 범위 | 설명 |
|---|---|---|
| 1 | code-only rename | `q`, `r`, `ex`, `resultData`, `examData` 등 DB 영향 없는 이름 |
| 2 | service boundary rename | `Exam` to `Course`, `BankQuestion` to `QuestionBankItem` |
| 3 | compatibility mapping | 기존 Firestore field를 service에서 새 도메인 타입으로 map |
| 4 | Firestore migration | collection/field 이름 변경, Rules와 함께 진행 |
| 5 | Router naming | `uiView` 제거, URL route 이름으로 전환 |

## 유지해야 할 이름

Firestore에 이미 저장된 collection/field 이름은 service mapping이 생기기 전까지 바로 바꾸지 않는다. 특히 `exams`, `results`, `studyProgress`, `testProgress`, `mode`는 migration 없이 변경하면 운영 데이터 로딩이 깨질 수 있다.

