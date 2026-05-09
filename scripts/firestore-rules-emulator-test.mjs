import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-exam-test-rules';

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
  },
});

const results = [];

async function seedData() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'users', 'studentA'), {
      uid: 'studentA',
      employeeId: 'WN12345678',
      name: 'Student A',
      role: 'student',
    });
    await setDoc(doc(db, 'users', 'studentB'), {
      uid: 'studentB',
      employeeId: 'WN87654321',
      name: 'Student B',
      role: 'student',
    });

    await setDoc(doc(db, 'exams', 'visible-course'), {
      title: 'Visible Course',
      mode: 'study',
      isVisible: true,
      questions: [],
      displayCount: 0,
      createdAt: 1,
    });
    await setDoc(doc(db, 'exams', 'hidden-course'), {
      title: 'Hidden Course',
      mode: 'test',
      isVisible: false,
      questions: [],
      displayCount: 0,
      createdAt: 2,
    });

    await setDoc(doc(db, 'results', 'resultA'), {
      examId: 'visible-course',
      examTitle: 'Visible Course',
      studentId: 'WN12345678',
      studentName: 'Student A',
      score: 100,
      correctCount: 1,
      totalCount: 1,
      answers: { 0: 0 },
      activeQuestions: [],
      createdAt: 3,
      mode: 'study',
    });
    await setDoc(doc(db, 'results', 'resultB'), {
      examId: 'visible-course',
      examTitle: 'Visible Course',
      studentId: 'WN87654321',
      studentName: 'Student B',
      score: 50,
      correctCount: 1,
      totalCount: 2,
      answers: { 0: 0 },
      activeQuestions: [],
      createdAt: 4,
      mode: 'test',
    });

    await setDoc(doc(db, 'questionBank', 'bankItem1'), {
      text: 'Question',
      options: ['A', 'B', 'C', 'D'],
      answerIndex: 0,
      explanation: '',
      category: 'General',
      createdAt: 5,
    });
  });
}

async function record(name, expectation, action) {
  try {
    if (expectation === 'allow') {
      await assertSucceeds(action());
    } else {
      await assertFails(action());
    }
    results.push({ scenario: name, expected: expectation, status: 'PASS' });
  } catch (error) {
    results.push({
      scenario: name,
      expected: expectation,
      status: 'FAIL',
      message: error?.message?.split('\n')[0] || String(error),
    });
  }
}

try {
  await seedData();

  const anonymousDb = testEnv.unauthenticatedContext().firestore();
  const studentDb = testEnv.authenticatedContext('studentA').firestore();
  const otherStudentDb = testEnv.authenticatedContext('studentB').firestore();
  const adminWithoutClaimDb = testEnv.authenticatedContext('adminUser').firestore();
  const adminDb = testEnv.authenticatedContext('adminUser', { admin: true }).firestore();

  await record('anonymous cannot read visible exams', 'deny', () =>
    getDocs(query(collection(anonymousDb, 'exams'), where('isVisible', '==', true)))
  );
  await record('anonymous cannot read results', 'deny', () =>
    getDocs(collection(anonymousDb, 'results'))
  );
  await record('anonymous cannot read questionBank', 'deny', () =>
    getDocs(collection(anonymousDb, 'questionBank'))
  );

  await record('student can read visible exams query', 'allow', () =>
    getDocs(query(collection(studentDb, 'exams'), where('isVisible', '==', true)))
  );
  await record('student cannot read hidden exam directly', 'deny', () =>
    getDoc(doc(studentDb, 'exams', 'hidden-course'))
  );
  await record('student can read own results query', 'allow', () =>
    getDocs(query(collection(studentDb, 'results'), where('studentId', '==', 'WN12345678')))
  );
  await record('student cannot read another student result directly', 'deny', () =>
    getDoc(doc(studentDb, 'results', 'resultB'))
  );
  await record('student cannot write exams', 'deny', () =>
    setDoc(doc(studentDb, 'exams', 'student-created-course'), {
      title: 'Student Created',
      mode: 'study',
      isVisible: true,
      questions: [],
      displayCount: 0,
      createdAt: 6,
    })
  );
  await record('student cannot read questionBank', 'deny', () =>
    getDocs(collection(studentDb, 'questionBank'))
  );
  await record('student can create own result', 'allow', () =>
    addDoc(collection(studentDb, 'results'), {
      examId: 'visible-course',
      examTitle: 'Visible Course',
      studentId: 'WN12345678',
      studentName: 'Student A',
      score: 80,
      correctCount: 4,
      totalCount: 5,
      answers: { 0: 0 },
      activeQuestions: [],
      createdAt: 7,
      mode: 'test',
    })
  );
  await record('student cannot create result for another employeeId', 'deny', () =>
    addDoc(collection(studentDb, 'results'), {
      examId: 'visible-course',
      examTitle: 'Visible Course',
      studentId: 'WN87654321',
      studentName: 'Student B',
      score: 80,
      correctCount: 4,
      totalCount: 5,
      answers: { 0: 0 },
      activeQuestions: [],
      createdAt: 8,
      mode: 'test',
    })
  );
  await record('student can write own studyProgress document', 'allow', () =>
    setDoc(doc(studentDb, 'studyProgress', 'studentA_visible-course'), {
      queue: [],
      firstAttemptAnswers: {},
    })
  );
  await record('student cannot read another uid progress document', 'deny', () =>
    getDoc(doc(otherStudentDb, 'studyProgress', 'studentA_visible-course'))
  );

  await record('admin without claim cannot read exams as admin', 'deny', () =>
    getDocs(collection(adminWithoutClaimDb, 'exams'))
  );
  await record('admin without claim cannot read questionBank', 'deny', () =>
    getDocs(collection(adminWithoutClaimDb, 'questionBank'))
  );
  await record('admin without claim cannot read all results', 'deny', () =>
    getDocs(collection(adminWithoutClaimDb, 'results'))
  );

  await record('admin claim can read all exams', 'allow', () =>
    getDocs(collection(adminDb, 'exams'))
  );
  await record('admin claim can read questionBank', 'allow', () =>
    getDocs(collection(adminDb, 'questionBank'))
  );
  await record('admin claim can delete a result', 'allow', () =>
    deleteDoc(doc(adminDb, 'results', 'resultB'))
  );
  await record('admin claim can update an exam', 'allow', () =>
    updateDoc(doc(adminDb, 'exams', 'visible-course'), { isVisible: false })
  );

  console.table(results);

  const failed = results.filter((result) => result.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`${failed.length} rules scenario(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('All Firestore rules emulator scenarios passed.');
  }
} finally {
  await testEnv.cleanup();
}
