# Refactoring Necessity Review

## 결론

현재 구조는 보안 개선, Firebase Rules 적용, Vercel 운영, 장기 유지보수에 적합하지 않다. 단, 전면 재작성보다 보안 수정이 가능한 최소 구조 분리가 먼저 필요하다.

가장 큰 이유는 `src/App.tsx` 하나가 Firebase 초기화, 인증, 권한 분기, Firestore read/write, 학생 응시, 관리자 관리, CSV 처리, toast, 화면 라우팅, 대형 UI 렌더링을 모두 담당하기 때문이다.

## 현재 구조 확인

| 항목 | 실제 코드 기준 현재 상태 | 영향 |
|---|---|---|
| `src/App.tsx` 크기 | 874 lines, 약 61 KB | 단일 파일에 기능과 UI가 과도하게 집중 |
| 상태 수 | `useState` 37회, `useEffect` 2회 | 상태 간 의존성이 화면/권한/데이터 로직에 섞여 있음 |
| Firestore 호출 수 | read/write 관련 호출 29회 | Rules 적용 시 변경 영향 범위가 넓음 |
| 화면 전환 | `setView(...)` 17회, `view === ...` 조건 렌더링 | URL/route/guard 없이 메모리 상태로 화면 제어 |
| Firebase 초기화 | `src/App.tsx:20-32` | env 전환과 테스트 mocking이 어려움 |
| Auth 로직 | `src/App.tsx:170-184` | 학생/관리자 인증 방식이 같은 컴포넌트 안에 혼재 |
| Firestore read | `src/App.tsx:105`, `src/App.tsx:109-111` | 앱 시작 시 주요 데이터 영역 전체 구독 |
| Firestore write | `src/App.tsx:147`, `177`, `192-193`, `235`, `263-274`, `286-317`, `334-356`, `491`, `545`, `565` | 관리자/학생 write 경계가 코드 구조상 분리되어 있지 않음 |
| 관리자 로직 | `src/App.tsx:183-184`, `454-614`, `614-705` | 인증, 탭, 과정/문제/결과 관리가 App에 직접 포함 |
| 학생 응시 로직 | `src/App.tsx:188-319`, `736-856` | 학습/퀴즈/결과 저장이 App state에 직접 의존 |
| CSV 업로드 | `src/App.tsx:118-168` | 파싱, 검증, Firestore write가 한 함수 흐름에 결합 |
| CSV 다운로드 | `src/App.tsx:368-377` | 결과 데이터 변환/Blob download가 UI 컴포넌트에 포함 |
| Toast/loading/error | `src/App.tsx:50`, `85`, `116`, `379`, `867-871` | 공통 상태는 있으나 hook/component 분리 없음 |
| routing 방식 | React Router 없음. `view` 문자열 기반 | guard, deep link, refresh 복구, Vercel rewrite 설계 어려움 |
| reusable component | `src/App.tsx` 외 component 없음 | Button/Input/Card/Toast 재사용 불가 |
| services/hooks 분리 | 없음 | Auth/Firestore/CSV 로직 테스트와 권한 변경이 어려움 |

## 파일 구조

현재 `src/`는 다음처럼 사실상 단일 앱 파일 구조다.

```text
src/
├── App.tsx
├── App.css
├── index.css
├── main.tsx
└── assets/
```

`src/components`, `src/services`, `src/hooks`, `src/features`, `src/lib` 디렉터리는 없다.

## 리팩토링 필요성 평가

| 항목 | 현재 상태 | 문제 | 리팩토링 필요 여부 | 우선순위 |
|---|---|---|---|---|
| 보안 수정 가능성 | 인증/권한/write가 `App.tsx`에 혼재 | 하드코딩 인증값 제거 시 학생/관리자 흐름 동시 영향 | 필요 | 반드시 |
| Firebase config env 전환 난이도 | config가 `src/App.tsx:20-32`에 직접 존재 | env 검증/초기화 실패 처리를 UI와 분리하기 어려움 | 필요 | 반드시 |
| Auth/role guard 적용 가능성 | `view` 상태와 local 인증 흐름 | admin claim guard 삽입 위치가 명확하지 않음 | 필요 | 반드시 |
| Firestore Rules 적용 가능성 | 전체 구독과 client write가 산재 | Rules 강화 시 빈 화면/저장 실패가 여러 흐름에서 발생 가능 | 필요 | 반드시 |
| 전체 구독 제거 가능성 | `src/App.tsx:109-111`에서 앱 시작 시 전체 구독 | 로그인/role 기반 query로 바꾸려면 auth 상태와 service 분리 필요 | 필요 | 반드시 |
| 테스트 가능성 | 순수 함수와 IO 함수가 혼재 | CSV 파서, 채점, 제출 데이터 생성 테스트가 어려움 | 필요 | 높음 |
| 모바일 UI 유지보수성 | Tailwind class가 JSX 내부에 대량 포함 | 모바일/PC 차이 수정 시 App 전체를 건드림 | 필요 | 보통 |
| 관리자/학생 기능 분리 | 같은 App state와 렌더 트리에 존재 | 관리자 수정이 학생 응시 흐름 regression을 만들 수 있음 | 필요 | 높음 |
| Vercel 운영 안정성 | env, runtime failure, route 설정이 구조화되지 않음 | preview/prod 설정 및 오류 화면 적용이 어려움 | 필요 | 높음 |
| 신규 담당자 인수인계 | 874 lines 단일 파일 | 기능 경계 파악과 변경 영향 추적이 어렵다 | 필요 | 높음 |

## 보안 개선 관점에서 가장 큰 구조 문제

### 1. Auth와 권한이 분리되어 있지 않음

- 학생 인증 로직: `src/App.tsx:170-180`
- 관리자 진입 로직: `src/App.tsx:183-184`
- 화면 접근: `view` 상태 조건 렌더링

현재는 관리자 권한을 Firebase Auth token 또는 Custom Claims로 검증할 구조가 없다. admin guard를 도입하려면 먼저 auth 상태와 role 확인을 App 바깥으로 분리해야 한다.

### 2. Firestore 접근이 역할별로 분리되어 있지 않음

- 과정/결과/문제 데이터가 `src/App.tsx:109-111`에서 전체 구독된다.
- 학생 진행 저장, 결과 저장, 관리자 과정/문제 관리가 같은 파일에 직접 구현되어 있다.

Firestore Rules를 강화하면 기존 전체 구독이 실패할 수 있다. 서비스 레이어 없이 바로 수정하면 어느 query가 어떤 역할에서 실패하는지 추적하기 어렵다.

### 3. UI와 데이터 mutation이 결합되어 있음

예시:

- CSV 업로드 함수가 파일 읽기, 파싱, batch write를 모두 수행한다.
- 과정 저장 함수가 폼 상태 정리, 문항 정리, Firestore write, 화면 이동, toast를 모두 수행한다.
- 결과 제출 함수가 점수 계산, 결과 데이터 구성, Firestore write, 진행 삭제, 화면 이동을 모두 수행한다.

이 구조는 보안 수정 중 regression 가능성을 높인다.

## 리팩토링하지 않고 바로 보안 수정할 경우 위험

| 위험 | 설명 | 영향 |
|---|---|---|
| 관리자/학생 regression | 같은 `App.tsx` state를 공유하므로 admin guard 수정이 학생 흐름에 영향 가능 | 주요 기능 장애 |
| query 누락 | 전체 구독을 role별 query로 바꾸는 과정에서 필요한 데이터가 로드되지 않을 수 있음 | 빈 목록/진행 불가 |
| 권한 실패 UX 누락 | Rules 강화 후 `onSnapshot`/write 실패를 UI가 충분히 처리하지 못함 | 사용자는 데이터가 없는 것으로 오해 |
| env 초기화 오류 | Firebase config env 누락 시 앱 전체가 깨질 수 있음 | Vercel runtime 장애 |
| 저장 실패 오판 | 결과 저장 실패 후 화면 이동 같은 기존 흐름이 남을 수 있음 | 운영 데이터 누락 |
| 테스트 불가 | 변경 후 검증 포인트가 UI 전체 수동 테스트에 의존 | 배포 후 오류 가능성 증가 |

## 최소 리팩토링 판단

필요하다. 다만 첫 단계는 화면을 모두 갈아엎는 것이 아니라 다음 네 경계만 먼저 만든다.

1. Firebase initialization boundary
2. Auth/role boundary
3. Firestore service boundary
4. Student/Admin feature boundary

이 네 경계가 생겨야 하드코딩 인증값 제거, Custom Claims, Firestore Rules, Vercel env 분리를 안전하게 적용할 수 있다.

