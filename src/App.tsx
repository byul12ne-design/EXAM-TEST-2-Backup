import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, type User 
} from 'firebase/auth';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, 
  doc, setDoc, getDoc, writeBatch, query, where 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// ==========================================
// 🛠️ 앱 설정 및 파이어베이스
// ==========================================
const APP_CONFIG = {
  logoText: "뷔르트 교육 센터",
  logoImageUrl: "https://eshop.wuerth.de/is-bin/intershop.static/WFS/1401-B1-Site/-/en_US/webkit_bootstrap/dist/img/wuerth-logo.svg",
};

// --- 인터페이스 ---
interface Question { category?: string; text: string; options: string[]; answerIndex: number; explanation: string; }
interface BankQuestion extends Question { id: string; createdAt: number; }
interface Exam { id: string; title: string; notice?: string; questions: Question[]; displayCount: number; createdAt: number; mode: 'study' | 'test'; isVisible: boolean; }
interface ExamResult { id: string; examId: string; examTitle: string; studentId: string; studentName: string; score: number; correctCount: number; totalCount: number; answers: Record<number, number>; activeQuestions: Question[]; createdAt: number; mode: 'study' | 'test'; }
interface UserProfile { uid: string; employeeId: string; name: string; role: 'student' | 'admin'; }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [questionBank, setQuestionBank] = useState<BankQuestion[]>([]);
  
  const [view, setView] = useState('home');
  const [adminTab, setAdminTab] = useState<'exams' | 'bank' | 'analytics'>('exams');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [currentExamId, setCurrentExamId] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [empIdInput, setEmpIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState(''); 
  
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]); 
  const [studentScore, setStudentScore] = useState(0);
  const [lastResult, setLastResult] = useState<ExamResult | null>(null); 
  const [selectedResultDetail, setSelectedResultDetail] = useState<ExamResult | null>(null); 

  const [questionQueue, setQuestionQueue] = useState<{q: Question, originalIndex: number}[]>([]); 
  const [isAnswerChecked, setIsAnswerChecked] = useState(false); 
  const [currentSelectedOption, setCurrentSelectedOption] = useState<number | null>(null); 
  const [testAnswers, setTestAnswers] = useState<Record<number, number>>({});
  const [firstAttemptAnswers, setFirstAttemptAnswers] = useState<Record<number, number>>({});

  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [customExamId, setCustomExamId] = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamNotice, setNewExamNotice] = useState(''); // 💡 추가됨: 공지사항 상태
  const [newExamMode, setNewExamMode] = useState<'study' | 'test'>('study');
  const [displayCount, setDisplayCount] = useState('');
  const [newQuestions, setNewQuestions] = useState<Question[]>([{ category: '', text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }]);

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [bankCategoryFilter, setBankCategoryFilter] = useState<string>('all');
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [newBankQuestion, setNewBankQuestion] = useState<Question>({ category: '', text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' });

  const [resultFilterExamId, setResultFilterExamId] = useState<string>('all');
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const isAdminDataView = view === 'admin-dash' || view === 'admin-create';

  useEffect(() => {
    let script = document.getElementById('tailwind-cdn') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    const handleLoad = () => setIsStyleLoaded(true);
    if ((window as any).tailwind) setIsStyleLoaded(true);
    else script.addEventListener('load', handleLoad);
    return () => script.removeEventListener('load', handleLoad);
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setUserProfile(snap.exists() ? snap.data() as UserProfile : null);
      } else setUserProfile(null);
    });
    
    return () => { unsubAuth(); };
  }, []);

  useEffect(() => {
    function sortByCreatedAtDesc<T extends { createdAt?: number }>(items: T[]) {
      return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    const clearSensitiveCollections = () => {
      setExams([]);
      setResults([]);
      setQuestionBank([]);
      setSelectedResultIds([]);
      setSelectedResultDetail(null);
    };

    if (isAdminDataView) {
      // TODO(security): This client-side gate only reduces unauthenticated subscriptions.
      // Firestore Rules/claims must still enforce real read/write authorization.
      const unsubExams = onSnapshot(collection(db, 'exams'), (snap) =>
        setExams(sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam))))
      );
      const unsubResults = onSnapshot(collection(db, 'results'), (snap) =>
        setResults(sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult))))
      );
      const unsubBank = onSnapshot(collection(db, 'questionBank'), (snap) =>
        setQuestionBank(sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankQuestion))))
      );

      return () => {
        unsubExams();
        unsubResults();
        unsubBank();
      };
    }

    if (userProfile?.role === 'student') {
      const visibleExamsQuery = query(collection(db, 'exams'), where('isVisible', '==', true));
      const ownResultsQuery = query(collection(db, 'results'), where('studentId', '==', userProfile.employeeId));

      const unsubExams = onSnapshot(visibleExamsQuery, (snap) =>
        setExams(sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam))))
      );
      const unsubResults = onSnapshot(ownResultsQuery, (snap) =>
        setResults(sortByCreatedAtDesc(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult))))
      );

      setQuestionBank([]);
      setSelectedResultIds([]);
      setSelectedResultDetail(null);

      return () => {
        unsubExams();
        unsubResults();
      };
    }

    clearSensitiveCollections();
  }, [isAdminDataView, userProfile?.employeeId, userProfile?.role]);

  const showToast = (message: string) => { setToastMessage(message); setTimeout(() => setToastMessage(null), 3000); };

  const parseCSV = (text: string) => {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (let line of lines) {
      if (!line.trim()) continue;
      const cols = []; let cur = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { cols.push(cur.replace(/^"|"$/g, '').trim()); cur = ''; } 
        else cur += char;
      }
      cols.push(cur.replace(/^"|"$/g, '').trim());
      rows.push(cols);
    }
    return rows.map(cols => ({
      text: cols[0] || '', options: [cols[1] || '', cols[2] || '', cols[3] || '', cols[4] || ''], 
      answerIndex: isNaN(parseInt(cols[5])) ? 0 : parseInt(cols[5]) - 1, explanation: cols[6] || '', category: cols[7] || '미분류'
    })).filter(q => q.text && q.text !== '문제' && q.options.length >= 4 && q.options[0] !== '보기1'); 
  };

  const handleBankFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const parsed = parseCSV(evt.target?.result as string);
      if (parsed.length > 0) { 
        try {
          const batch = writeBatch(db);
          parsed.forEach(q => batch.set(doc(collection(db, 'questionBank')), { ...q, createdAt: Date.now() }));
          await batch.commit();
          showToast(`✅ 저장고에 ${parsed.length}문제가 등록되었습니다!`); 
        } catch(err) { showToast('❌ 업로드 오류!'); }
      }
    };
    reader.readAsText(file); e.target.value = ''; 
  };

  const handleExamFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseCSV(evt.target?.result as string);
      if (parsed.length > 0) { 
        const existing = newQuestions.filter(q => q.text.trim() !== '');
        setNewQuestions([...existing, ...parsed]); 
        showToast(`✅ ${parsed.length}문제가 세트에 추가되었습니다!`); 
      }
    };
    reader.readAsText(file); e.target.value = ''; 
  };

  const handleStudentAuth = async () => {
    if (empIdInput.length !== 8) return showToast('사번 8자리를 입력해주세요.');
    const finalEmpId = `WN${empIdInput}`; const pseudoEmail = `${finalEmpId.toLowerCase()}@wuerth.exam`; const PWD = "WuerthExamSecretPassword2026!";
    try {
      if (authMode === 'register') {
        if (!nameInput.trim()) return showToast('이름을 입력해주세요.');
        const cred = await createUserWithEmailAndPassword(auth, pseudoEmail, PWD);
        await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, employeeId: finalEmpId, name: nameInput.trim(), role: 'student' });
      } else await signInWithEmailAndPassword(auth, pseudoEmail, PWD);
      showToast('반갑습니다!');
    } catch (e) { showToast('사번 확인 또는 최초 등록이 필요합니다.'); }
  };

  const handleAdminLogin = () => {
    if (adminPasswordInput === '2026') { setView('admin-dash'); setAdminPasswordInput(''); } 
    else showToast('비밀번호 불일치');
  };

  const handleResetProgress = async (examId: string) => {
    if (!userProfile) return;
    if (window.confirm('학습 기록을 모두 초기화하고 다시 진행하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'studyProgress', `${userProfile.uid}_${examId}`));
        await deleteDoc(doc(db, 'testProgress', `${userProfile.uid}_${examId}`));
        showToast('🔄 기록이 초기화되었습니다.');
      } catch(e) { showToast('❌ 초기화 실패'); }
    }
  };

  const startExam = async () => {
    const exam = exams.find(e => e.id === currentExamId);
    if (!exam || !userProfile) return;

    if (exam.mode === 'study') {
      const spDoc = await getDoc(doc(db, 'studyProgress', `${userProfile.uid}_${currentExamId}`));
      if (spDoc.exists() && spDoc.data().queue && spDoc.data().queue.length > 0) {
        setActiveQuestions(spDoc.data().activeQuestions);
        setQuestionQueue(spDoc.data().queue);
        setFirstAttemptAnswers(spDoc.data().firstAttemptAnswers || {});
        setIsAnswerChecked(false); setCurrentSelectedOption(null);
        showToast('🔄 이전에 하던 학습을 이어갑니다.');
        setView('student-take');
        return;
      }
    } else if (exam.mode === 'test') {
      const tpDoc = await getDoc(doc(db, 'testProgress', `${userProfile.uid}_${currentExamId}`));
      if (tpDoc.exists() && tpDoc.data().answers) {
        setTestAnswers(tpDoc.data().answers);
        showToast('🔄 임시 저장된 답안을 불러왔습니다.');
      } else setTestAnswers({});
    }

    const pool = exam.questions || [];
    const displayCnt = exam.displayCount || pool.length;
    const selected = [...pool].sort(() => Math.random() - 0.5).slice(0, displayCnt);
    
    setActiveQuestions(selected);
    setFirstAttemptAnswers({});
    
    if (exam.mode === 'test') { 
      setTestAnswers({}); 
    } else { 
      const initQueue = selected.map((q, idx) => ({q, originalIndex: idx}));
      setQuestionQueue(initQueue); 
      setIsAnswerChecked(false); setCurrentSelectedOption(null); 
      await setDoc(doc(db, 'studyProgress', `${userProfile.uid}_${currentExamId}`), {
        activeQuestions: selected, queue: initQueue, firstAttemptAnswers: {}
      });
    }
    setView('student-take');
  };

  const handleStudyNextQuestion = async () => {
    if (questionQueue.length === 0) return;
    const currentItem = questionQueue[0];
    const isCorrect = currentSelectedOption === currentItem.q.answerIndex;
    
    let newFirstAttempt = { ...firstAttemptAnswers };
    if (newFirstAttempt[currentItem.originalIndex] === undefined && currentSelectedOption !== null) {
      newFirstAttempt[currentItem.originalIndex] = currentSelectedOption;
      setFirstAttemptAnswers(newFirstAttempt);
    }

    let nextQueue = [...questionQueue];
    const shiftedItem = nextQueue.shift();
    if (!isCorrect && shiftedItem) nextQueue.push(shiftedItem);

    setQuestionQueue(nextQueue);
    setIsAnswerChecked(false);
    setCurrentSelectedOption(null);

    if (nextQueue.length === 0) {
      submitExam(newFirstAttempt);
      await deleteDoc(doc(db, 'studyProgress', `${userProfile?.uid}_${currentExamId}`));
    } else {
      setDoc(doc(db, 'studyProgress', `${userProfile?.uid}_${currentExamId}`), {
        queue: nextQueue, firstAttemptAnswers: newFirstAttempt
      }, { merge: true });
    }
  };

  const handleTestOptionClick = async (qIndex: number, oi: number) => {
    const nextAnswers = {...testAnswers, [qIndex]: oi};
    setTestAnswers(nextAnswers);
    if (userProfile) await setDoc(doc(db, 'testProgress', `${userProfile.uid}_${currentExamId}`), { answers: nextAnswers }, { merge: true });
  };

  const handleMobileBack = async () => {
    const exam = exams.find(e => e.id === currentExamId);
    if (!exam) { setView('home'); return; }
    const shouldLeave = window.confirm('현재 진행 상황을 저장하고 메인 화면으로 돌아가시겠습니까?');
    if (!shouldLeave) return;

    if (userProfile) {
      try {
        if (exam.mode === 'study') {
          await setDoc(doc(db, 'studyProgress', `${userProfile.uid}_${currentExamId}`), {
            activeQuestions,
            queue: questionQueue,
            firstAttemptAnswers,
          }, { merge: true });
        } else if (exam.mode === 'test') {
          await setDoc(doc(db, 'testProgress', `${userProfile.uid}_${currentExamId}`), {
            answers: testAnswers,
          }, { merge: true });
        }
        showToast('진행 상황이 저장되었습니다.');
      } catch (e) {
        console.error('진행 상황 저장 실패', e);
        showToast('진행 상황 저장에 실패했습니다.');
      }
    }
    setView('home');
  };

  const submitExam = async (finalAnswers: Record<number, number>) => {
    const exam = exams.find(e => e.id === currentExamId);
    if (!exam || !userProfile) return;

    const correctCount = activeQuestions.reduce((cnt, q, idx) => finalAnswers[idx] === q.answerIndex ? cnt + 1 : cnt, 0);
    const score = activeQuestions.length > 0 ? Math.round((correctCount / activeQuestions.length) * 100) : 0;
    setStudentScore(score);

    const resultData = { examId: currentExamId, examTitle: exam.title, studentId: userProfile.employeeId, studentName: userProfile.name, score, correctCount, totalCount: activeQuestions.length, answers: finalAnswers, activeQuestions, createdAt: Date.now(), mode: exam.mode };
    try {
      const docRef = await addDoc(collection(db, 'results'), resultData);
      setLastResult({ id: docRef.id, ...resultData });
      if (exam.mode === 'test') await deleteDoc(doc(db, 'testProgress', `${userProfile.uid}_${currentExamId}`));
    } catch(e) { console.error("결과 저장 오류"); }
    setView('student-result');
  };

  const handleSaveExam = async () => {
    if (!newExamTitle.trim()) return showToast('제목을 입력해주세요.');
    const cleaned = newQuestions.filter(q => q.text.trim());
    if (cleaned.length === 0) return showToast('문제를 추가해주세요.');
    const finalId = customExamId.trim().replace(/\s+/g, '-') || editingExamId || undefined;
    
    // 💡 저장 시 notice(안내사항) 필드 포함
    const examData = { title: newExamTitle, notice: newExamNotice, mode: newExamMode, questions: cleaned, displayCount: parseInt(displayCount) || cleaned.length, isVisible: false, createdAt: Date.now() };
    
    try {
      if (editingExamId) {
        if(editingExamId !== customExamId && customExamId) {
           await deleteDoc(doc(db, 'exams', editingExamId));
           await setDoc(doc(db, 'exams', customExamId), { ...examData, isVisible: exams.find(e=>e.id===editingExamId)?.isVisible || false });
        } else {
           await updateDoc(doc(db, 'exams', editingExamId), { ...examData, isVisible: exams.find(e=>e.id===editingExamId)?.isVisible || false });
        }
      } else {
        if(finalId) await setDoc(doc(db, 'exams', finalId), examData);
        else await addDoc(collection(db, 'exams'), examData);
      }
      setView('admin-dash'); showToast('저장 완료! (초기 상태: 숨김)');
    } catch(e) { showToast('저장 실패'); }
  };

  const toggleVisibility = async (examId: string, currentStatus: boolean) => {
    try { await updateDoc(doc(db, 'exams', examId), { isVisible: !currentStatus }); showToast(currentStatus ? '비공개 처리됨' : '출시 완료!'); } 
    catch (e) { showToast('오류 발생'); }
  };

  const handleSaveBankQuestion = async () => {
    if (!newBankQuestion.text.trim()) return showToast('문제를 입력하세요.');
    try {
      if (editingBankId) await setDoc(doc(db, 'questionBank', editingBankId), { ...newBankQuestion, category: newBankQuestion.category || '미분류' }, { merge: true });
      else await addDoc(collection(db, 'questionBank'), { ...newBankQuestion, category: newBankQuestion.category || '미분류', createdAt: Date.now() });
      setEditingBankId(null); setNewBankQuestion({ category: newBankQuestion.category, text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' });
      showToast('저장 완료');
    } catch(e) { showToast('저장 실패'); }
  };

  const filteredBank = useMemo(() => questionBank.filter(q => bankCategoryFilter === 'all' || q.category === bankCategoryFilter), [questionBank, bankCategoryFilter]);
  const bankCategories = useMemo(() => Array.from(new Set(questionBank.map(q => q.category || '미분류'))), [questionBank]);

  const filteredResults = useMemo(() => results.filter(r => resultFilterExamId === 'all' || r.examId === resultFilterExamId), [results, resultFilterExamId]);
  const resultExamOptions = useMemo(() => Array.from(new Map(results.map(r => [r.examId, r.examTitle])).entries()), [results]);

  const handleExportCSV = () => {
    if (filteredResults.length === 0) return showToast('데이터가 없습니다.');
    const headers = ['응시일시', '시험/학습명', '유형', '사번', '이름', '점수(점)'];
    const rows = filteredResults.map(r => [new Date(r.createdAt).toLocaleString(), `"${r.examTitle}"`, r.mode === 'test' ? '퀴즈' : '학습', r.studentId, r.studentName, r.score]);
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n"); 
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `뷔르트_결과통계_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (!isStyleLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400 font-bold">디자인 로딩중...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col items-center">
      <style>{`
        .force-show { display: block !important; opacity: 1 !important; visibility: visible !important; }
        .animate-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <nav className="w-full p-4 bg-white shadow-sm border-b flex justify-between items-center sticky top-0 z-50">
        <h1 onClick={() => setView('home')} className="cursor-pointer flex items-center gap-2 ml-4">
          <img src={APP_CONFIG.logoImageUrl} alt="Logo" className="h-8" />
          <span className="font-bold text-slate-800 hidden sm:block">{APP_CONFIG.logoText}</span>
        </h1>
        {userProfile && <button onClick={() => signOut(auth)} className="mr-4 text-xs bg-slate-100 px-3 py-2 rounded-lg font-bold hover:bg-slate-200">로그아웃</button>}
      </nav>

      <main className="p-4 sm:p-8 max-w-4xl mx-auto w-full flex-1">
        
        {/* [1] 홈 화면 */}
        {view === 'home' && !userProfile && (
          <div className="w-full flex justify-center py-10 animate-in">
            <div className="bg-white w-full max-w-[420px] rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-12">
              <h2 className="text-3xl font-black text-center mb-10 text-slate-800">교육 센터</h2>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-3.5 rounded-xl font-bold text-sm ${authMode === 'login' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>로그인</button>
                <button onClick={() => setAuthMode('register')} className={`flex-1 py-3.5 rounded-xl font-bold text-sm ${authMode === 'register' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>최초 등록</button>
              </div>
              <div className="space-y-5">
                <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-[1.25rem] focus-within:border-blue-600 p-1">
                  <span className="pl-5 pr-1 font-black text-blue-600 text-xl italic">WN</span>
                  <input type="text" value={empIdInput} onChange={e => setEmpIdInput(e.target.value.replace(/[^0-9]/g, ''))} maxLength={8} className="w-full bg-transparent py-4 font-bold text-xl outline-none" placeholder="사번 8자리" />
                </div>
                {authMode === 'register' && <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-[1.25rem] text-lg font-bold text-center outline-none" placeholder="성함 입력" />}
                <button onClick={handleStudentAuth} className="force-show w-full bg-slate-900 text-white font-black py-5 rounded-[1.25rem] shadow-xl text-xl hover:bg-blue-600 transition-colors">교육장 입장하기</button>
              </div>
              <button onClick={() => setView('admin-login')} className="w-full text-slate-300 text-xs mt-10 font-bold hover:text-slate-500">⚙️ 관리자 모드</button>
            </div>
          </div>
        )}

        {/* [2] 학생 대시보드 */}
        {view === 'home' && userProfile && (
          <div className="animate-in space-y-8 w-full">
            <h2 className="text-3xl font-black text-slate-800">환영합니다, {userProfile.name}님! 👋</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                <h3 className="font-black text-xl text-emerald-600 flex items-center gap-2">📖 자율 학습</h3>
                {exams.filter(e => e.mode === 'study' && e.isVisible).length === 0 && <p className="text-sm text-slate-400">등록된 학습이 없습니다.</p>}
                {exams.filter(e => e.mode === 'study' && e.isVisible).map(ex => (
                  <div key={ex.id} className="p-4 bg-slate-50 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <span className="font-bold text-sm text-slate-700">{ex?.title}</span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleResetProgress(ex.id)} className="w-full sm:w-auto bg-slate-200 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap">초기화 🔄</button>
                      <button onClick={() => { setCurrentExamId(ex.id); setView('student-entry'); }} className="w-full sm:w-auto bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-sm whitespace-nowrap">학습시작</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                <h3 className="font-black text-xl text-purple-600 flex items-center gap-2">🏆 실전 퀴즈</h3>
                {exams.filter(e => e.mode === 'test' && e.isVisible).length === 0 && <p className="text-sm text-slate-400">등록된 퀴즈가 없습니다.</p>}
                {exams.filter(e => e.mode === 'test' && e.isVisible).map(ex => (
                  <div key={ex.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center hover:border-purple-300">
                    <span className="font-bold text-sm text-slate-700">{ex?.title}</span>
                    <button onClick={() => { setCurrentExamId(ex.id); setView('student-entry'); }} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-xs font-black">응시하기</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* [3] 관리자 대시보드 */}
        {view === 'admin-dash' && (
          <div className="animate-in space-y-6 pb-20 w-full">
            <div className="flex justify-between items-center border-b pb-6">
              <h2 className="text-3xl font-black">Admin Dash</h2>
              <button onClick={() => setView('home')} className="text-blue-600 font-bold underline">메인으로</button>
            </div>
            
            <div className="flex flex-wrap bg-white p-2 rounded-2xl border w-fit font-bold text-sm shadow-sm gap-2">
              <button onClick={() => setAdminTab('exams')} className={`px-5 py-2.5 rounded-xl transition-all ${adminTab === 'exams' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>세트 관리</button>
              <button onClick={() => setAdminTab('bank')} className={`px-5 py-2.5 rounded-xl transition-all ${adminTab === 'bank' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>🗃️ 문제 저장고</button>
              <button onClick={() => setAdminTab('analytics')} className={`px-5 py-2.5 rounded-xl transition-all ${adminTab === 'analytics' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>📊 통계 및 결과</button>
            </div>

            {adminTab === 'exams' && (
              <div className="space-y-6">
                <button onClick={() => { 
                  setEditingExamId(null); setCustomExamId(''); setNewExamTitle(''); setNewExamNotice(''); setDisplayCount(''); 
                  setNewQuestions([{ category: '', text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }]); setView('admin-create'); 
                }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-slate-800">➕ 새 과정 만들기</button>
                <div className="bg-white p-6 rounded-[2rem] border shadow-sm grid gap-4">
                  {exams.map(ex => (
                    <div key={ex.id} className="p-5 bg-slate-50 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded mr-2 ${ex?.mode === 'test' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>{ex?.mode === 'test' ? '시험' : '학습'}</span>
                        <span className="font-bold text-slate-800">{ex?.title}</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => toggleVisibility(ex.id, ex.isVisible)} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-colors ${ex.isVisible ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {ex.isVisible ? '● 출시됨' : '○ 대기 (숨김)'}
                        </button>
                        <button onClick={() => { 
                          setEditingExamId(ex.id); setCustomExamId(ex.id); setNewExamTitle(ex.title); 
                          setNewExamNotice(ex.notice || ''); // 수정 시 안내사항 불러오기
                          setNewExamMode(ex.mode); setDisplayCount(ex.displayCount?.toString() || ''); 
                          setNewQuestions(ex.questions?.length ? ex.questions : [{ category: '', text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }]); 
                          setView('admin-create'); 
                        }} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-xl text-xs font-black text-slate-700">✏️ 수정</button>
                        <button onClick={async () => { if(window.confirm('정말 삭제하시겠습니까?')) await deleteDoc(doc(db, 'exams', ex.id)); }} className="text-red-400 text-xs font-bold px-2 hover:underline">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 저장고 탭 */}
            {adminTab === 'bank' && (
              <div className="space-y-6">
                <div className={`p-6 sm:p-8 rounded-[2rem] border shadow-sm space-y-4 ${editingBankId ? 'bg-yellow-50 border-yellow-400' : 'bg-white'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-4">
                    <h3 className={`font-bold ${editingBankId ? 'text-yellow-700' : 'text-blue-700'}`}>{editingBankId ? '✏️ 문제 수정 중' : '새로운 문제 보관하기'}</h3>
                    {!editingBankId && (
                      <label className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold cursor-pointer hover:bg-emerald-700 text-xs shadow-md">
                        📊 CSV 엑셀 일괄 업로드<input type="file" accept=".csv" className="hidden" onChange={handleBankFileUpload} />
                      </label>
                    )}
                  </div>
                  <input value={newBankQuestion.category} onChange={e => setNewBankQuestion({...newBankQuestion, category: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl text-sm outline-none focus:border-blue-400" placeholder="카테고리 분류 (예: 화학, 공구)"/>
                  <textarea value={newBankQuestion.text} onChange={e => setNewBankQuestion({...newBankQuestion, text: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-400" placeholder="문제 내용" rows={2}/>
                  <div className="grid grid-cols-2 gap-3">
                    {newBankQuestion.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" checked={newBankQuestion.answerIndex === i} onChange={() => setNewBankQuestion({...newBankQuestion, answerIndex: i})} className="accent-blue-600 w-4 h-4"/>
                        <input value={opt} onChange={e => { const opts = [...newBankQuestion.options]; opts[i] = e.target.value; setNewBankQuestion({...newBankQuestion, options: opts}); }} className="w-full border p-2 rounded-lg text-xs" placeholder={`보기 ${i+1}`}/>
                      </div>
                    ))}
                  </div>
                  <textarea value={newBankQuestion.explanation} onChange={e => setNewBankQuestion({...newBankQuestion, explanation: e.target.value})} className="w-full bg-slate-50 border p-2 rounded-xl text-xs outline-none" placeholder="해설 (선택)"/>
                  <div className="flex gap-2">
                    <button onClick={handleSaveBankQuestion} className={`w-full py-3 rounded-xl text-sm font-bold text-white ${editingBankId ? 'bg-yellow-500' : 'bg-blue-600'}`}>{editingBankId ? '수정 완료' : '저장고에 넣기'}</button>
                    {editingBankId && <button onClick={() => { setEditingBankId(null); setNewBankQuestion({ category: '', text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }); }} className="w-1/3 py-3 rounded-xl text-sm font-bold bg-slate-200 text-slate-600">취소</button>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
                   <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 border-b pb-4">
                     <select value={bankCategoryFilter} onChange={e => setBankCategoryFilter(e.target.value)} className="p-2 rounded-xl border outline-none font-bold text-sm bg-slate-50 w-full sm:w-auto">
                        <option value="all">전체보기</option>
                        {bankCategories.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                      </select>
                   </div>
                   <div className="space-y-4">
                     {filteredBank.map(q => (
                        <div key={q.id} className="p-4 bg-slate-50 border rounded-2xl flex justify-between items-start">
                          <div>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold mb-1 block w-fit">{q?.category || '미분류'}</span>
                            <p className="font-bold text-sm mb-1">{q?.text}</p>
                            <p className="text-xs text-slate-500">정답: {q?.options?.[q?.answerIndex || 0]}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingBankId(q.id); setNewBankQuestion({ category: q.category || '', text: q.text, options: [...q.options], answerIndex: q.answerIndex, explanation: q.explanation || '' }); window.scrollTo(0,0); }} className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-xl font-bold">수정</button>
                            <button onClick={async () => { if(window.confirm('삭제하시겠습니까?')) await deleteDoc(doc(db, 'questionBank', q.id)); }} className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl font-bold">삭제</button>
                          </div>
                        </div>
                     ))}
                   </div>
                </div>
              </div>
            )}

            {/* 통계 탭 */}
            {adminTab === 'analytics' && (
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                  <h3 className="font-black text-xl">📊 제출된 결과 리스트</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm flex-1 sm:flex-none">📥 엑셀 다운로드</button>
                    <button disabled={selectedResultIds.length === 0} onClick={async () => {
                        if(selectedResultIds.length === 0) return;
                        if(window.confirm(`${selectedResultIds.length}개 데이터를 완전 삭제합니까?`)) {
                           const batch = writeBatch(db);
                           selectedResultIds.forEach(id => batch.delete(doc(db, 'results', id)));
                           await batch.commit(); setSelectedResultIds([]); showToast('삭제 완료');
                        }
                    }} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex-1 sm:flex-none ${selectedResultIds.length > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-400'}`}>선택 삭제 ({selectedResultIds.length})</button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-4 rounded-2xl items-center">
                  <span className="font-bold text-sm text-slate-600">과정별 필터:</span>
                  <select value={resultFilterExamId} onChange={e => { setResultFilterExamId(e.target.value); setSelectedResultIds([]); }} className="p-2 rounded-xl border outline-none font-bold text-sm bg-white flex-1 w-full sm:max-w-xs cursor-pointer">
                    <option value="all">전체 과정 보기</option>
                    {resultExamOptions.map(([id, title]) => <option key={id} value={id as string}>{title as string}</option>)}
                  </select>
                </div>

                <div className="grid gap-3">
                  {filteredResults.length > 0 && (
                    <label className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl cursor-pointer w-fit pr-5">
                      <input type="checkbox" className="w-4 h-4 accent-blue-600 cursor-pointer" checked={selectedResultIds.length === filteredResults.length} onChange={e => {
                        if (e.target.checked) setSelectedResultIds(filteredResults.map(r => r.id)); else setSelectedResultIds([]);
                      }}/>
                      <span className="text-xs font-bold text-slate-600">전체 선택</span>
                    </label>
                  )}
                  {filteredResults.map(r => (
                    <div key={r.id} className="flex gap-3 items-center">
                      <input type="checkbox" className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0" checked={selectedResultIds.includes(r.id)} onChange={e => {
                        if (e.target.checked) setSelectedResultIds([...selectedResultIds, r.id]); else setSelectedResultIds(selectedResultIds.filter(id => id !== r.id));
                      }} />
                      <div className="flex-1 p-4 bg-white border rounded-2xl flex justify-between items-center cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setSelectedResultDetail(r)}>
                        <div>
                          <p className="font-bold text-slate-800 flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black ${r.mode === 'test' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.mode === 'test' ? '퀴즈' : '학습'}</span>
                            {r.examTitle}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{r.studentName} ({r.studentId}) | {new Date(r.createdAt || 0).toLocaleString()}</p>
                        </div>
                        <div className="text-xl font-black text-blue-600">{r.score}점</div>
                      </div>
                    </div>
                  ))}
                  {filteredResults.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">결과 데이터가 없습니다.</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* [4] 과정 생성/수정 화면 */}
        {view === 'admin-create' && (
          <div className="animate-in space-y-6 pb-20 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
              <button onClick={() => setView('admin-dash')} className="text-3xl hover:bg-white p-2 rounded-full transition-colors shrink-0">⬅️</button>
              <div className="flex-1 w-full flex flex-col gap-1">
                 <input value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} className="w-full text-2xl sm:text-3xl font-black outline-none bg-transparent focus:border-blue-500 transition-all text-slate-800" placeholder="학습 또는 퀴즈 제목 입력"/>
                 <div className="flex flex-wrap items-center gap-2 mt-2">
                   <span className="text-xs font-bold text-slate-400">과정 코드:</span>
                   <input value={customExamId} onChange={e => setCustomExamId(e.target.value)} className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded outline-none border border-blue-100 min-w-[150px]" placeholder="(선택) 직접 지정 시 입력"/>
                 </div>
              </div>
            </div>

            {/* 💡 추가됨: 공지사항(안내사항) 입력란 */}
            <div className="bg-white p-6 rounded-[2rem] border shadow-sm">
              <span className="text-xs font-black text-slate-400 tracking-widest uppercase">📢 과정 안내사항 작성 (선택사항)</span>
              <textarea 
                value={newExamNotice} 
                onChange={e => setNewExamNotice(e.target.value)} 
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-sm font-medium outline-none focus:border-blue-400 mt-4" 
                placeholder="참가자가 '시작하기'를 누르기 전에 읽어야 할 안내사항이나 시험 규칙을 입력하세요." 
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <button onClick={() => setNewExamMode('study')} className={`flex-1 py-4 rounded-xl font-black border-2 ${newExamMode === 'study' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>📖 학습 모드</button>
              <button onClick={() => setNewExamMode('test')} className={`flex-1 py-4 rounded-xl font-black border-2 ${newExamMode === 'test' ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-slate-100 text-slate-400'}`}>🏆 실전 퀴즈 모드</button>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h5 className="font-bold text-slate-700">🔀 랜덤 출제 문항 수 제한</h5>
                <p className="text-[10px] text-slate-500 mt-1">입력한 수만큼 아래 목록에서 무작위 출제됩니다. (비워두면 등록된 전체 출제)</p>
              </div>
              <input type="number" value={displayCount} onChange={e => setDisplayCount(e.target.value)} className="w-24 p-3 rounded-xl border-2 bg-slate-50 text-center outline-none focus:border-blue-500 text-slate-800 font-bold" placeholder="전체"/>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-100 pb-4 gap-4">
                <span className="font-black text-lg text-slate-800">📝 문제 세팅 (총 {newQuestions.length}문항)</span>
                <div className="flex flex-wrap gap-2">
                  <label className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-xl font-bold hover:bg-emerald-700 cursor-pointer shadow-sm flex items-center gap-1">
                     📊 엑셀 대량 업로드<input type="file" accept=".csv" className="hidden" onChange={handleExamFileUpload} />
                  </label>
                  <button onClick={() => setIsBankModalOpen(true)} className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-xl font-bold hover:bg-blue-200">🗃️ 저장고 불러오기</button>
                  <button onClick={() => setNewQuestions([...newQuestions, { text: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }])} className="text-xs bg-slate-100 text-slate-600 px-3 py-2 rounded-xl font-bold hover:bg-slate-200">+ 수동 문항 추가</button>
                </div>
              </div>
              
              <div className="space-y-6 pt-2">
                {newQuestions.map((q, i) => (
                  <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border relative">
                    <span className="text-sm font-black text-blue-500 mb-4 block">Q{i+1}.</span>
                    <textarea value={q?.text || ''} onChange={e => { const n = [...newQuestions]; n[i].text = e.target.value; setNewQuestions(n); }} className="w-full bg-white border-2 p-4 rounded-2xl font-bold mb-4 outline-none focus:border-blue-400" placeholder="문제 내용을 입력하세요" rows={2}/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {q?.options?.map((opt, oi) => (
                        <div key={oi} className={`flex items-center gap-3 border-2 p-3 rounded-2xl bg-white ${q.answerIndex === oi ? 'border-emerald-400' : 'border-slate-100'}`}>
                          <input type="radio" checked={q.answerIndex === oi} onChange={() => { const n = [...newQuestions]; n[i].answerIndex = oi; setNewQuestions(n); }} className="w-5 h-5 accent-emerald-500 cursor-pointer"/>
                          <input value={opt || ''} onChange={e => { const n = [...newQuestions]; n[i].options[oi] = e.target.value; setNewQuestions(n); }} className="w-full bg-transparent outline-none font-medium text-sm" placeholder={`보기 ${oi+1}`} />
                        </div>
                      ))}
                    </div>
                    <textarea value={q?.explanation || ''} onChange={e => { const n = [...newQuestions]; n[i].explanation = e.target.value; setNewQuestions(n); }} className="w-full bg-white border p-4 rounded-2xl text-sm font-medium outline-none focus:border-blue-400" placeholder="💡 문제 해설을 입력하세요 (제출 후 오답노트에서 보여집니다)" rows={2}/>
                    <button onClick={() => setNewQuestions(newQuestions.filter((_, idx) => idx !== i))} className="absolute top-6 right-6 bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200">삭제</button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleSaveExam} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl sticky bottom-6 z-20 hover:bg-slate-800 transition-colors">과정 저장하기</button>
          </div>
        )}

        {/* 저장고에서 불러오기 모달 */}
        {isBankModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in">
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800">🗃️ 저장고에서 불러오기</h3>
                <button onClick={() => {setIsBankModalOpen(false); setSelectedBankIds([]);}} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center font-bold">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 mb-6 space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-slate-600">분류 필터:</span>
                  <select value={bankCategoryFilter} onChange={e => setBankCategoryFilter(e.target.value)} className="p-2 rounded-xl border outline-none font-bold text-sm bg-white flex-1 sm:w-40 cursor-pointer">
                    <option value="all">전체보기</option>
                    {Array.from(new Set(questionBank.map(q => q.category || '미분류'))).map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                  </select>
                </div>
                {questionBank.filter(q => bankCategoryFilter === 'all' || q.category === bankCategoryFilter).length > 0 && (
                  <label className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl cursor-pointer w-fit pr-5 mb-2 hover:bg-slate-200">
                    <input type="checkbox" className="w-5 h-5 accent-blue-600 cursor-pointer" 
                      checked={questionBank.filter(q => bankCategoryFilter === 'all' || q.category === bankCategoryFilter).every(q => selectedBankIds.includes(q.id))} 
                      onChange={e => {
                        const filteredIds = questionBank.filter(q => bankCategoryFilter === 'all' || q.category === bankCategoryFilter).map(q => q.id);
                        if (e.target.checked) setSelectedBankIds(Array.from(new Set([...selectedBankIds, ...filteredIds])));
                        else setSelectedBankIds(selectedBankIds.filter(id => !filteredIds.includes(id)));
                      }}/>
                    <span className="text-sm font-bold text-slate-800">현재 목록 전체 선택</span>
                  </label>
                )}
                {questionBank.filter(q => bankCategoryFilter === 'all' || q.category === bankCategoryFilter).map(q => (
                  <label key={q.id} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedBankIds.includes(q.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200 bg-white'}`}>
                    <input type="checkbox" checked={selectedBankIds.includes(q.id)} onChange={e => { if(e.target.checked) setSelectedBankIds([...selectedBankIds, q.id]); else setSelectedBankIds(selectedBankIds.filter(id => id !== q.id)); }} className="w-5 h-5 cursor-pointer accent-blue-600 mt-1" />
                    <div>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold mb-1 block w-fit">{q?.category || '미분류'}</span>
                      <p className="font-bold text-sm text-slate-800">{q?.text}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={() => {
                const selected = questionBank.filter(q => selectedBankIds.includes(q.id)).map(({ id, createdAt, ...rest }) => rest);
                const existing = newQuestions.filter(q => q.text.trim() !== '');
                setNewQuestions([...existing, ...selected]); setIsBankModalOpen(false); setSelectedBankIds([]);
                showToast(`${selected.length}개 추가됨!`);
              }} disabled={selectedBankIds.length === 0} className={`w-full py-4 rounded-xl font-bold text-white shrink-0 ${selectedBankIds.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300'}`}>선택한 {selectedBankIds.length}개 세트에 추가</button>
            </div>
          </div>
        )}

        {/* [5] 학생: 안내사항 대기 화면 */}
        {view === 'student-entry' && (
          <div className="py-10 sm:py-20 text-center animate-in w-full flex flex-col items-center max-w-2xl mx-auto">
            <h2 className="text-4xl font-black mb-8 tracking-tight text-slate-800">{exams.find(e => e.id === currentExamId)?.title}</h2>
            
            {/* 💡 추가됨: 작성된 공지사항이 있으면 예쁜 박스 형태로 노출 */}
            {exams.find(e => e.id === currentExamId)?.notice && (
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm mb-10 w-full text-left whitespace-pre-wrap text-slate-600 leading-relaxed font-medium">
                {exams.find(e => e.id === currentExamId)?.notice}
              </div>
            )}
            
            <button onClick={startExam} className="bg-blue-600 text-white px-16 py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">과정 시작하기 👉</button>
          </div>
        )}

        {view === 'student-take' && (
          <div className="max-w-2xl mx-auto w-full animate-in pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
               <button onClick={handleMobileBack} className="md:hidden inline-flex items-center gap-2 text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-2xl font-bold shadow-sm">
                 <span className="text-lg">←</span> 뒤로
               </button>
               <button onClick={() => setView('home')} className="hidden md:inline-flex text-slate-600 font-bold hover:text-blue-600 flex items-center gap-2">
                 <span>⬅️</span> 나가기
               </button>
               {exams.find(e => e.id === currentExamId)?.mode === 'study' ? (
                  <div className="font-bold text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                    남은 문제: <span className="text-blue-600">{questionQueue.length}</span>개
                  </div>
               ) : (
                  <div className="font-bold text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                    총 <span className="text-purple-600">{activeQuestions.length}</span> 문항
                  </div>
               )}
            </div>

            {exams.find(e => e.id === currentExamId)?.mode === 'study' && questionQueue.length > 0 && (
               <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
                 <h2 className="text-2xl font-black leading-tight text-slate-800">{questionQueue[0].q.text}</h2>
                 <div className="grid gap-4">
                   {questionQueue[0].q.options.map((opt, i) => (
                     <button key={i} onClick={() => { if(!isAnswerChecked) { setCurrentSelectedOption(i); setIsAnswerChecked(true); } }} className={`text-left p-6 rounded-2xl border-2 font-black transition-all ${isAnswerChecked ? (i === questionQueue[0].q.answerIndex ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : (i === currentSelectedOption ? 'border-red-500 bg-red-50 text-red-600 shadow-inner' : 'opacity-30 border-slate-50')) : 'hover:border-blue-400 hover:bg-blue-50 border-slate-100'}`}>
                       {opt}
                     </button>
                   ))}
                 </div>
                 {isAnswerChecked && (
                   <div className="space-y-4 animate-in">
                     {questionQueue[0].q.explanation && <div className="p-5 bg-slate-50 rounded-2xl border text-sm text-slate-600 leading-relaxed font-medium">💡 해설: {questionQueue[0].q.explanation}</div>}
                     <button onClick={handleStudyNextQuestion} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all">다음 문제로</button>
                   </div>
                 )}
               </div>
            )}
            
            {exams.find(e => e.id === currentExamId)?.mode === 'test' && (
              <div className="space-y-6">
                {activeQuestions.map((q, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                    <p className="font-black text-lg text-slate-800 leading-snug"><span className="text-blue-500 mr-2">Q{idx+1}.</span>{q.text}</p>
                    <div className="grid gap-3">
                      {q.options.map((opt, oi) => (
                        <button key={oi} onClick={() => handleTestOptionClick(idx, oi)} className={`p-5 rounded-2xl border-2 text-left font-bold transition-all ${testAnswers[idx] === oi ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 hover:bg-slate-50'}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={() => submitExam(testAnswers)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-95 transition-all">전체 답안 제출하기</button>
              </div>
            )}
          </div>
        )}

        {(view === 'student-result' || selectedResultDetail) && (
          <div className={`animate-in space-y-8 w-full max-w-2xl mx-auto pb-20 ${selectedResultDetail ? 'fixed inset-0 bg-slate-50 z-[100] p-6 sm:p-10 overflow-y-auto' : 'py-10'}`}>
            <div className="text-center mb-10">
              {view === 'student-result' && <h2 className="text-4xl font-black text-slate-800 mb-6">수고하셨습니다!</h2>}
              {selectedResultDetail && <h2 className="text-2xl font-black text-slate-800 mb-4">{selectedResultDetail.studentName}님의 결과지</h2>}
              <div className="text-7xl font-black text-blue-600 drop-shadow-md">{selectedResultDetail ? selectedResultDetail.score : studentScore}<span className="text-3xl text-slate-400 ml-2">점</span></div>
            </div>

            <div className="space-y-6">
              <h3 className="font-black text-xl border-b-2 pb-2 border-slate-200">📝 상세 결과 및 해설</h3>
              {(selectedResultDetail || lastResult)?.activeQuestions.map((q, idx) => {
                const ansObj = selectedResultDetail ? selectedResultDetail.answers : lastResult?.answers;
                const studentAns = ansObj?.[idx];
                const isCorrect = studentAns === q.answerIndex;
                return (
                  <div key={idx} className={`p-6 rounded-[2rem] border-2 shadow-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <p className="font-bold text-slate-800 mb-4 text-lg">Q{idx+1}. {q?.text}</p>
                    <div className="grid gap-2 mb-4">
                      {q?.options?.map((opt, oi) => {
                        let style = "bg-white border-slate-100 opacity-60";
                        if (oi === q.answerIndex) style = "bg-emerald-100 border-emerald-500 font-black text-emerald-800 ring-2 ring-emerald-200 opacity-100";
                        else if (oi === studentAns) style = "bg-red-100 border-red-500 font-bold text-red-800 line-through opacity-100";
                        return (
                          <div key={oi} className={`p-4 rounded-xl border ${style} flex justify-between items-center`}>
                            <span>{opt}</span>
                            {oi === q.answerIndex && <span>✅ 정답</span>}
                            {oi === studentAns && oi !== q.answerIndex && <span>❌ 내 답안</span>}
                          </div>
                        );
                      })}
                    </div>
                    {q?.explanation && (
                      <div className="bg-white/80 p-5 rounded-2xl border text-sm font-medium text-slate-700 shadow-inner">
                        <span className="font-black text-blue-600 mb-1 block">💡 해설</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {view === 'student-result' ? (
               <button onClick={() => { setView('home'); setLastResult(null); window.history.replaceState({}, '', window.location.pathname); }} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xl shadow-xl mt-10 hover:bg-slate-800 transition-colors">목록으로 돌아가기</button>
            ) : (
               <button onClick={() => setSelectedResultDetail(null)} className="w-full bg-slate-300 text-slate-700 py-5 rounded-[2rem] font-black text-xl mt-10 hover:bg-slate-400 transition-colors">닫기</button>
            )}
          </div>
        )}

        {view === 'admin-login' && (
          <div className="max-w-xs mx-auto py-20 text-center animate-in space-y-8">
            <h2 className="text-3xl font-black text-slate-800">Admin Login</h2>
            <input type="password" value={adminPasswordInput} onChange={e => setAdminPasswordInput(e.target.value)} className="w-full border-2 p-5 rounded-2xl text-center text-xl font-bold outline-none" placeholder="Password" />
            <button onClick={handleAdminLogin} className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-lg shadow-lg">인증하기</button>
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-full text-sm font-black shadow-2xl z-[110] animate-in flex items-center gap-3">
          <span className="text-emerald-400 font-bold">●</span> {toastMessage}
        </div>
      )}
    </div>
  );
}
