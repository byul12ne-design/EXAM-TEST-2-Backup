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
| production 위험 | `vercel.json` 없음, Tailwind CDN runtime 의존, Firebase Rules 미검증, 클라이언트 관리자/학생 인증값 노출 |
| local build와 production 차이 | `npm.cmd run build` 성공은 `dist/` 생성만 보장한다. Vercel runtime의 CDN/Firebase/network/domain 문제는 보장하지 않는다 |
| runtime risk | `src/App.tsx:87-99`에서 Tailwind CDN을 동적으로 삽입하고, 실패 시 `src/App.tsx:351` 로딩 화면에 머문다 |
| env risk | `.env`, `.env.example` 없음. `import.meta.env` 미사용. Firebase client configuration와 인증값가 production bundle에 포함된다 |
| SPA risk | React Router 없음. 현재 root `/`만 자연스럽고, `/admin` 같은 직접 URL은 Vercel rewrite 없으면 404 가능 |
| mobile runtime risk | 모바일 전용 뒤로가기와 PC 나가기 동작이 다르고, iOS/Safari에서 Blob CSV 다운로드 UX가 불안정할 수 있다 |

# 프로젝트 전체 구조 분석

## 분석 기준

- 분석 기준: 최신 로컬 저장소 스냅샷
- 기준: 현재 워크스페이스의 실제 소스코드만 사용
- Firebase Rules: 저장소 안에 rules 파일이 없어 **미검증**
- 빌드 검증: `npm.cmd install` 후 `npm.cmd run build` 성공. 산출물은 `dist/`에 생성됨
- build 출력: `dist/assets/index-ChkbJhwA.js` 630.14 kB, gzip 161.63 kB. Vite chunk size 경고 발생

## 프로젝트 목적

| 구분 | 내용 |
|---|---|
| 실제 구현 | Firebase 기반 교육/시험 앱. 학생은 사번으로 등록/로그인하고, 공개된 학습/퀴즈를 진행하며 결과를 확인한다. 관리자는 과정, 문제은행, 제출 결과를 관리한다. |
| 추정 | `APP_CONFIG.logoText`가 "뷔르트 교육 센터"이고 로고 URL이 Wuerth 도메인이라 내부 임직원 교육/제품 시험용 앱으로 보인다. |

근거:

- `src/App.tsx:15-18` - 앱명과 외부 로고 URL
- `src/App.tsx:34-39` - `Question`, `Exam`, `ExamResult`, `UserProfile` 타입
- `src/App.tsx:170-180` - 사번 기반 학생 인증
- `src/App.tsx:425-583` - 관리자 대시보드

## 실제 구현 기능

| 영역 | 실제 기능 | 주요 코드 위치 |
|---|---|---|
| 인증 | 사번 8자리 기반 회원가입/로그인, 로그아웃 | `src/App.tsx:170-180`, `src/App.tsx:366` |
| 학생 | 공개 학습/퀴즈 목록, 학습 진행, 퀴즈 응시, 결과 확인 | `src/App.tsx:393-423`, `src/App.tsx:707-824` |
| 관리자 | 관리자 화면 진입, 과정 CRUD, 공개/숨김 토글 | `src/App.tsx:183-186`, `src/App.tsx:425-469` |
| 문제은행 | 문제 수동 등록/수정/삭제, CSV 업로드, 과정으로 불러오기 | `src/App.tsx:139-168`, `src/App.tsx:471-524`, `src/App.tsx:659-705` |
| 결과 | 결과 목록, 과정 필터, 상세 결과, CSV 다운로드, 선택 삭제 | `src/App.tsx:340-349`, `src/App.tsx:526-581` |
| 실시간 | Firestore `onSnapshot` 전체 구독 | `src/App.tsx:101-113` |

## 기술 스택

| 항목 | 실제 상태 |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | 별도 서버 없음. 클라이언트에서 Firebase 직접 접근 |
| Auth | Firebase Auth |
| DB | Firestore |
| Styling | Tailwind CDN 런타임 주입 + 일부 `index.css` |
| Routing | React Router 없음. `view` 문자열 상태로 화면 전환 |
| Test | 테스트 스크립트/테스트 파일 없음 |
| Build | `tsc && vite build`; 현재 의존성 설치 후 성공. 단, 630.14 kB JS chunk 경고 |

근거:

- `package.json:6-21`
- `vite.config.ts:1-7`
- `src/App.tsx:87-99`
- `src/App.tsx:48`

## 디렉토리 구조

```text
.
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── package-lock.json
├── tsconfig*.json
└── vite.config.ts
```

## 화면 전환 방식

실제 구현은 라우터가 아니라 단일 상태값 `view`로 화면을 분기한다.

```tsx
// src/App.tsx:48
const [view, setView] = useState('home');
```

| 화면 | 조건 | 코드 위치 |
|---|---|---|
| 로그인/회원가입 | `view === 'home' && !userProfile` | `src/App.tsx:372-391` |
| 학생 대시보드 | `view === 'home' && userProfile` | `src/App.tsx:394-423` |
| 관리자 로그인 | `view === 'admin-login'` | `src/App.tsx:827-833` |
| 관리자 대시보드 | `view === 'admin-dash'` | `src/App.tsx:426-583` |
| 과정 생성/수정 | `view === 'admin-create'` | `src/App.tsx:586-657` |
| 과정 안내 | `view === 'student-entry'` | `src/App.tsx:708-721` |
| 응시/학습 | `view === 'student-take'` | `src/App.tsx:723-775` |
| 결과 | `view === 'student-result'` 또는 `selectedResultDetail` | `src/App.tsx:777-824` |

### UX 영향

- 새로고침 시 `view`가 초기값 `home`으로 돌아간다.
- 모바일 브라우저 뒤로가기가 앱 내부 뒤로가기로 동작하지 않는다.
- 특정 과정/결과 상세를 URL로 공유할 수 없다.

## API/Firebase 연결 구조

Firebase 초기화와 서비스 인스턴스가 `App.tsx` 최상단에 직접 존재한다.

```tsx
// src/App.tsx:20-32
const firebaseConfig = { ... };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

Firestore 구독은 로그인/권한과 무관하게 앱 마운트 시 실행된다.

```tsx
// src/App.tsx:109-111
onSnapshot(collection(db, 'exams'), ...)
onSnapshot(collection(db, 'results'), ...)
문제은행 데이터 영역 전체 실시간 구독
```

### 문제

| severity | 문제 | 원인 | 영향 |
|---|---|---|---|
| 치명 | 로그인 전 전체 컬렉션 구독 | `useEffect`에서 무조건 `onSnapshot` 실행 | 개인정보/문제 데이터 노출 위험, Firestore rules에 따라 앱 오류 |
| 높음 | API 계층 없음 | UI 이벤트 핸들러에서 직접 Firestore 호출 | 테스트/권한 처리/에러 처리 어려움 |
| 높음 | 관리자 기능도 클라이언트 직접 write | `updateDoc`, `deleteDoc`, `writeBatch` 직접 호출 | Firestore Rules가 약하면 위변조 가능 |

## 전역 상태 흐름

`App.tsx`에 30개 이상의 `useState`가 집중되어 있다.

주요 상태:

- 인증: `user`, `userProfile`, `authMode`, `empIdInput`, `nameInput`
- 라우팅: `view`, `adminTab`
- 데이터: 과정 데이터 영역, 결과 데이터 영역, 문제은행 데이터 영역
- 응시: `currentExamId`, `activeQuestions`, `questionQueue`, `testAnswers`, `firstAttemptAnswers`
- 관리자 편집: `editingExamId`, `newExamTitle`, `newQuestions`, `newBankQuestion`
- 모달/필터: `isBankModalOpen`, `selectedBankIds`, `bankCategoryFilter`, `resultFilterExamId`

### 유지보수 위험

| 지표 | 실제 값 |
|---|---|
| `src/App.tsx` 라인 수 | 843 lines |
| `src/App.tsx` 파일 크기 | 60,294 bytes |
| 화면 수 | 최소 8개 |
| API/상태/뷰 혼재 | 예 |

## 스타일링 구조

| 파일 | 실제 사용 여부 | 문제 |
|---|---|---|
| `src/index.css` | `main.tsx:3`에서 import | Vite 템플릿 성격 CSS가 남아 있음. `#root`에 `text-align:center`, border 등 전역 영향 |
| `src/App.css` | import 없음 | 미사용 템플릿 잔재 |
| Tailwind CDN | `App.tsx:87-99`에서 동적 주입 | 네트워크 실패 시 앱 미표시 |

Before:

```tsx
// src/App.tsx:87-99
script.src = "https://cdn.tailwindcss.com";
if ((window as any).tailwind) setIsStyleLoaded(true);
```

After 예시:

```ts
// tailwind.config.ts + src/index.css에서 빌드 타임 적용
// App.tsx에서는 isStyleLoaded 상태와 CDN 스크립트 제거
```

## 빌드 구조와 안정성

| 항목 | 상태 |
|---|---|
| 빌드 명령 | `package.json:8` - `tsc && vite build` |
| 설치 결과 | `npm.cmd install` 성공. 148 packages 변경, 155 packages audit |
| 실행 결과 | `npm.cmd run build` 성공 |
| 산출물 | `dist/index.html`, `dist/assets/index-C-dvAIOk.css`, `dist/assets/index-ChkbJhwA.js` |
| 경고 | JS chunk `630.14 kB`가 Vite 기본 경고 기준 500 kB 초과 |
| 추가 이슈 | `npm.cmd run lint`, `npm.cmd run test`는 script 없음 |

## 런타임 의존성

| 의존성 | 실제 코드 영향 |
|---|---|
| Firebase | 인증/DB 전체 기능에 필수 |
| Tailwind CDN | UI 표시 자체에 필수처럼 동작 |
| 외부 Wuerth 로고 URL | 네비게이션 로고 표시 |
| 브라우저 FileReader | CSV 업로드 |
| Blob URL 다운로드 | CSV 다운로드 |

## 미사용 파일

| 파일 | 근거 | 정리 제안 |
|---|---|---|
| `src/App.css` | 어느 파일에서도 import되지 않음 | 삭제 또는 실제 앱 스타일로 교체 |
| `src/assets/hero.png` | `rg` 기준 참조 없음 | 삭제 또는 실제 UI에서 사용 |
| `src/assets/react.svg` | 참조 없음 | 삭제 |
| `src/assets/vite.svg` | 참조 없음 | 삭제 |
| `README.md` | Vite 기본 템플릿 내용 | 실제 운영 문서로 교체 |

## 주요 기술 부채

| severity | 부채 | 실제 위치 |
|---|---|---|
| 치명 | 관리자 인증값 클라이언트 하드코딩 | `src/App.tsx:183-186` |
| 치명 | 로그인 전 전체 Firestore 구독 | `src/App.tsx:101-113` |
| 치명 | Tailwind CDN 실패 시 앱 진입 불가 | `src/App.tsx:87-99`, `src/App.tsx:351` |
| 높음 | `App.tsx` 단일 파일 집중 | `src/App.tsx:41-843` |
| 높음 | 라우팅 없음 | `src/App.tsx:48` |
| 높음 | 테스트 없음 | `package.json:6-10` |
| 보통 | `strict` TypeScript 미설정 | `tsconfig.app.json:18-22` |
| 보통 | README/HTML 메타 불일치 | `README.md:1`, `index.html:2-7` |








