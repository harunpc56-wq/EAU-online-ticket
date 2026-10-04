import { db } from './services/db';

async function runBalanceLeftTests() {
  console.log("=== RUNNING BALANCE LEFT SUITE OF 8 TEST CASES ===");

  const testStudentId = `TEST-STU-${Date.now()}`;
  const pastExamId = `EXAM-PAST-${Date.now()}`;
  const activeExamId = `EXAM-ACTIVE-${Date.now()}`;

  // Register student
  db.addStudent({
    id: testStudentId,
    name: "Test Student",
    email: "test@student.edu",
    faculty: "TestFaculty",
    semester: "1",
    examEligibility: [pastExamId, activeExamId],
    department: "CS",
    phoneNumber: "1234567890",
    status: 'ACTIVE'
  } as any);

  // Create past exam
  const pastExam: any = {
    id: pastExamId,
    name: "Past Semester Exam",
    facultyId: "OtherFaculty",
    targetFaculty: "OtherFaculty",
    semester: "1",
    session: "2024/2025",
    fee: 50,
    dates: "2025-01-01",
    expiryDate: "2025-02-01"
  };

  // Create active exam
  const activeExam: any = {
    id: activeExamId,
    name: "Current Semester Exam",
    facultyId: "TestFaculty",
    targetFaculty: "TestFaculty",
    semester: "1",
    session: "2026/2027",
    fee: 100,
    dates: "2027-01-01",
    expiryDate: "2027-12-31"
  };

  db.addExam(pastExam);
  db.addExam(activeExam);

  // --- TEST 1 ---
  console.log("\n[TEST 1] Active Fee = $100, Past Debt = $0 -> Balance Left HIDDEN");
  const testStudentId1 = `TEST-STU-1-${Date.now()}`;
  db.addStudent({
    id: testStudentId1,
    name: "Test Student 1",
    email: "test1@student.edu",
    faculty: "TestFaculty",
    semester: "1",
    examEligibility: [activeExamId],
    department: "CS",
    phoneNumber: "1234567890",
    status: 'ACTIVE'
  } as any);
  let pastDebt1 = db.getStudentPastDebt(testStudentId1);
  console.log(`Past Debt: $${pastDebt1} (Expected: 0)`);
  if (pastDebt1 !== 0) throw new Error("Test 1 failed: Past debt should be 0");
  console.log("PASS: Test 1");

  // --- TEST 2 ---
  console.log("\n[TEST 2] Active Fee = $100, Past Debt = $50 -> Balance Left VISIBLE");
  db.updateStudent({
    ...db.findStudentById(testStudentId)!,
    examEligibility: [pastExamId, activeExamId]
  });
  let pastDebt2 = db.getStudentPastDebt(testStudentId);
  console.log(`Past Debt: $${pastDebt2} (Expected: 50)`);
  if (pastDebt2 !== 50) throw new Error("Test 2 failed: Past debt should be 50");
  console.log("PASS: Test 2");

  // --- TEST 3 ---
  console.log("\n[TEST 3] Attempt to pay $75 when Past Debt = $50 -> REJECTED");
  let rejected = false;
  try {
    db.payStudentBalance(testStudentId, 75, 'Mobile');
  } catch (err: any) {
    rejected = true;
    console.log(`Successfully caught rejection: ${err.message}`);
  }
  if (!rejected) throw new Error("Test 3 failed: Payment > pastDebt was accepted");
  console.log("PASS: Test 3");

  // --- TEST 4 ---
  console.log("\n[TEST 4] Pay $20 -> Remaining Past Debt = $30 -> Stays Visible");
  db.payStudentBalance(testStudentId, 20, 'Mobile');
  let pastDebt4 = db.getStudentPastDebt(testStudentId);
  console.log(`Remaining Past Debt: $${pastDebt4} (Expected: 30)`);
  if (pastDebt4 !== 30) throw new Error("Test 4 failed: Remaining past debt should be 30");
  console.log("PASS: Test 4");

  // --- TEST 5 ---
  console.log("\n[TEST 5] Pay remaining $30 -> Remaining = $0 -> Hides Immediately");
  db.payStudentBalance(testStudentId, 30, 'Mobile');
  let pastDebt5 = db.getStudentPastDebt(testStudentId);
  console.log(`Remaining Past Debt: $${pastDebt5} (Expected: 0)`);
  if (pastDebt5 !== 0) throw new Error("Test 5 failed: Remaining past debt should be 0");
  console.log("PASS: Test 5");

  // --- TEST 6 ---
  console.log("\n[TEST 6] Active unpaid fee ($100), Past Debt = $0 -> Balance Left hidden");
  let pastDebt6 = db.getStudentPastDebt(testStudentId);
  console.log(`Past Debt: $${pastDebt6} (Expected: 0)`);
  if (pastDebt6 !== 0) throw new Error("Test 6 failed");
  console.log("PASS: Test 6");

  // --- TEST 7 ---
  console.log("\n[TEST 7] Past Debt ($50) and Active Fee ($100) -> Balance Left pays past debt only");
  const testStudentId7 = `TEST-STU-7-${Date.now()}`;
  db.addStudent({
    id: testStudentId7,
    name: "Test Student 7",
    email: "test7@student.edu",
    faculty: "TestFaculty7",
    semester: "1",
    examEligibility: [pastExamId, activeExamId],
    department: "CS",
    phoneNumber: "1234567890",
    status: 'ACTIVE'
  } as any);
  const pastDebt7 = db.getStudentPastDebt(testStudentId7);
  const activePayable7 = db.getStudentActivePayableBalance(testStudentId7);
  
  db.payStudentBalance(testStudentId7, 50, 'Card');
  const pastDebt7After = db.getStudentPastDebt(testStudentId7);
  const activePayable7After = db.getStudentActivePayableBalance(testStudentId7);
  if (pastDebt7After !== 0 || activePayable7After !== activePayable7) {
    throw new Error("Test 7 failed: Active fee was affected by Balance Left payment");
  }
  console.log("PASS: Test 7");

  // --- TEST 8 ---
  console.log("\n[TEST 8] Successful Balance Left payment -> Ticket generated");
  const testStudentId8 = `TEST-STU-8-${Date.now()}`;
  db.addStudent({
    id: testStudentId8,
    name: "Test Student 8",
    email: "test8@student.edu",
    faculty: "Computing",
    semester: "1",
    examEligibility: [pastExamId],
    department: "CS",
    phoneNumber: "1234567890",
    status: 'ACTIVE'
  } as any);
  db.payStudentBalance(testStudentId8, 50, 'Mobile');
  const tickets = db.getHallTickets().filter(t => t.studentId === testStudentId8 && t.examId === pastExamId);
  if (tickets.length === 0) throw new Error("Test 8 failed: Hall ticket was not generated upon paying past debt");
  console.log("PASS: Test 8");

  console.log("\n=== ALL 8 BALANCE LEFT SCENARIOS PASSED SUCCESSFULLY ===");
}

runBalanceLeftTests().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
