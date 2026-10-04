
import { Student, Exam, Payment, HallTicket, AccountStatus, PaymentStatus, PaymentSettings, Scholarship, ScholarshipType, Faculty, AcademicYearConfig, Semester, SubSection, AdminUser, UserRole, TicketVerificationOfficer, TicketVerificationLog } from '../types';
import { db } from '../services/db';
import React, { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import AdminAuthModal from './AdminAuthModal';
import FinancialStatement from './FinancialStatement';
import { D3BarChart, ExamTktStat } from './D3BarChart';
import { StudentRegistrationForm } from './StudentRegistrationForm';

interface AdminDashboardProps {
  currentUser: AdminUser | { id: string, name: string, phoneNumber?: string };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearConfig[]>([]);
  const [studentRegistrySearch, setStudentRegistrySearch] = useState('');
  const [auditTrailSearch, setAuditTrailSearch] = useState('');
  
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [activeFeeFilter, setActiveFeeFilter] = useState<string>('ALL');

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PAYMENTS' | 'STUDENTS' | 'REGISTRATION' | 'EXAMS' | 'ACADEMIC_YEAR' | 'FACULTIES' | 'SCHOLARSHIPS' | 'HISTORY' | 'SETTINGS' | 'NOTIFICATIONS' | 'FINANCIAL_STATEMENT' | 'VERIFIERS'>('DASHBOARD');
  const [examTab, setExamTab] = useState<'CURRENT' | 'PAST'>('CURRENT');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(db.getPaymentSettings());
  const [selectedStatementStudentId, setSelectedStatementStudentId] = useState<string>('');
  
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isScholarshipModalOpen, setIsScholarshipModalOpen] = useState(false);
  const [isAssignScholarshipModalOpen, setIsAssignScholarshipModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [isDeleteAuthOpen, setIsDeleteAuthOpen] = useState(false);
  const [isExamDeleteAuthOpen, setIsExamDeleteAuthOpen] = useState(false);
  const [isFeeControlOpen, setIsFeeControlOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isLoanAuthOpen, setIsLoanAuthOpen] = useState(false);
  const [isFeeAuthOpen, setIsFeeAuthOpen] = useState(false);
  const [isFeeAuthorized, setIsFeeAuthorized] = useState(false);
  const [isAcademicYearModalOpen, setIsAcademicYearModalOpen] = useState(false);
  const [isVerifierModalOpen, setIsVerifierModalOpen] = useState(false);
  const [verifiers, setVerifiers] = useState<TicketVerificationOfficer[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<TicketVerificationLog[]>([]);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isRevokeAuthOpen, setIsRevokeAuthOpen] = useState(false);
  const [editingVerifier, setEditingVerifier] = useState<TicketVerificationOfficer | null>(null);
  const [verifierForm, setVerifierForm] = useState({ name: '', email: '' });

  const refreshVerifiers = async () => {
    setVerifiers(await db.getVerifiers());
    setVerificationLogs(db.getVerificationLogs());
  };

  useEffect(() => {
    refreshVerifiers();
  }, []);

  const resetVerifierPassword = async (verifier: TicketVerificationOfficer) => {
    if (confirm(`Are you sure you want to reset password for ${verifier.name}? It will be reset to 'Ticket123'.`)) {
      await db.resetVerifierPassword(verifier.id);
      await refreshVerifiers();
      alert(`Password for ${verifier.name} has been reset to Ticket123. The officer will be required to change it on next login.`);
    }
  };

  const toggleVerifierActive = async (verifier: TicketVerificationOfficer) => {
    await db.updateVerifier({ ...verifier, active: !verifier.active });
    await refreshVerifiers();
  };

  const deleteVerifierOfficer = async (verifier: TicketVerificationOfficer) => {
    if (confirm(`Are you sure you want to permanently delete Ticket Verification Officer ${verifier.name} (${verifier.id})?`)) {
      await db.deleteVerifier(verifier.id);
      await refreshVerifiers();
    }
  };

  const openVerifierModal = (verifier: TicketVerificationOfficer | null = null) => {
    if (verifier) {
      setEditingVerifier(verifier);
      setVerifierForm({ name: verifier.name, email: verifier.email });
    } else {
      setEditingVerifier(null);
      setVerifierForm({ name: '', email: '' });
    }
    setIsVerifierModalOpen(true);
  };

  const handleVerifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVerifier) {
      await db.updateVerifier({...editingVerifier, ...verifierForm});
    } else {
      await db.addVerifier({
        id: db.generateVerifierId(),
        name: verifierForm.name,
        email: verifierForm.email,
        password: 'Ticket123',
        mustChangePassword: true,
        role: UserRole.TICKET_VERIFIER,
        active: true
      });
    }
    setIsVerifierModalOpen(false);
    refreshVerifiers();
  };
  const [isRemoveFeeAuthOpen, setIsRemoveFeeAuthOpen] = useState(false);
  const [feeToRemove, setFeeToRemove] = useState<{studentId: string, examId: string} | null>(null);
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [feeControlStudent, setFeeControlStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [revokeData, setRevokeData] = useState<{studentId: string, scholarshipId: string} | null>(null);
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [studentForm, setStudentForm] = useState<Partial<Student>>({});
  const [examForm, setExamForm] = useState({ 
    name: '', 
    fee: 0, 
    session: '2023-2024', 
    date: '', 
    time: '',
    expDate: '',
    expTime: '',
    targetFaculty: 'ALL',
    targetDepartment: '',
    targetAcademicYear: 'ALL',
    targetSemester: 'ALL',
    targetProgram: '',
    targetStudentId: ''
  });
  const [facultyForm, setFacultyForm] = useState({ name: '', fee: 0 });
  
  const initialSub: SubSection = { percentage: 0, createdDate: '', expireDate: '', isOpen: false };
  const [ayForm, setAyForm] = useState<Partial<AcademicYearConfig>>({
    name: '',
    semester1: { quiz: {...initialSub}, midterm: {...initialSub}, final: {...initialSub} },
    semester2: { quiz: {...initialSub}, midterm: {...initialSub}, final: {...initialSub} },
    isActive: true
  });

  const [scholarshipForm, setScholarshipForm] = useState({
    name: '',
    type: ScholarshipType.PERCENTAGE,
    value: 0,
    startDateTime: '',
    endDateTime: '',
    categories: ['Exam']
  });
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM' as 'PAYMENT' | 'SYSTEM' | 'URGENT',
    faculty: '',
    semester: ''
  });
  const [loanForm, setLoanForm] = useState({ 
    studentIdSearch: '', 
    selectedStudentId: '', 
    examId: '', 
    approvedAmount: 0
  });

  const [dashboardCategory, setDashboardCategory] = useState<'ALL' | 'ACTIVE' | 'PAST'>('ALL');
  const [dashboardSelectedExamId, setDashboardSelectedExamId] = useState<string>('ALL');
  const [dashboardPeriod, setDashboardPeriod] = useState<'ALL' | 'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM'>('ALL');
  const [dashboardStartDate, setDashboardStartDate] = useState('');
  const [dashboardEndDate, setDashboardEndDate] = useState('');

  const [partialAuditRecords, setPartialAuditRecords] = useState<any[]>([]);
  const [isLoadingPartial, setIsLoadingPartial] = useState(false);

  useEffect(() => {
    refreshData();
    const unsubscribe = db.subscribe(() => {
      refreshData();
    });
    return () => { unsubscribe(); };
  }, []);

  const refreshData = async () => {
    setStudents(db.getStudents());
    setExams(db.getExams());
    setPayments(db.getPayments());
    setScholarships(db.getScholarships());
    setFaculties(db.getFaculties());
    setAcademicYears(db.getAcademicYears());
    setPaymentSettings(db.getPaymentSettings());

    try {
      const res = await fetch('/api/financial-audit-trail/partial-payments');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPartialAuditRecords(json.data);
          return;
        }
      }
    } catch (err) {
      // Fallback to client-side enriched calculation
    }
    setPartialAuditRecords(db.getEnrichedPartialPayments());
  };

  const resetAuthState = () => {
    setAdminAuthPassword('');
    setAuthError('');
  };

  // Internal helper to verify the currently logged-in admin's password
  const verifyCurrentAdmin = (inputPassword: string): boolean => {
    if (currentUser.id === 'admin') {
      return inputPassword === 'admin123';
    }
    const adminRecord = db.findAdminById(currentUser.id);
    return adminRecord ? adminRecord.password === inputPassword : false;
  };

  // Real-time calculation of Hall Ticket statistics for the D3 visual dashboard with period and category filtering
  const ticketStats = React.useMemo(() => {
    const studentsList = students.filter(s => s.status !== AccountStatus.DELETED);
    const ticketsList = db.getHallTickets();

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredExams = exams.filter(exam => {
      const isPast = db.isExamExpiredOrPast(exam);
      if (dashboardCategory === 'ACTIVE' && isPast) return false;
      if (dashboardCategory === 'PAST' && !isPast) return false;
      if (dashboardSelectedExamId !== 'ALL' && exam.id !== dashboardSelectedExamId) return false;
      return true;
    });

    const statsList: ExamTktStat[] = filteredExams.map(exam => {
      let issued = 0;
      let pending = 0;

      studentsList.forEach(student => {
        const isEligible = (student.examEligibility || []).includes(exam.id);
        if (!isEligible) return;
        if (!db.isStudentEligibleForExam(exam, student)) return;

        const ticket = ticketsList.find(t => t.studentId === student.id && t.examId === exam.id);
        let matchTime = true;
        const targetDate = ticket ? new Date(ticket.createdAt || 0) : (exam.dates ? new Date(exam.dates) : new Date());

        if (dashboardPeriod === 'TODAY') {
          if (targetDate.getDate() !== currentDay || targetDate.getMonth() !== currentMonth || targetDate.getFullYear() !== currentYear) {
            matchTime = false;
          }
        } else if (dashboardPeriod === 'MONTH') {
          if (targetDate.getMonth() !== currentMonth || targetDate.getFullYear() !== currentYear) {
            matchTime = false;
          }
        } else if (dashboardPeriod === 'YEAR') {
          if (targetDate.getFullYear() !== currentYear) {
            matchTime = false;
          }
        } else if (dashboardPeriod === 'CUSTOM') {
          const start = dashboardStartDate ? new Date(dashboardStartDate).getTime() : 0;
          const end = dashboardEndDate ? new Date(dashboardEndDate + 'T23:59:59').getTime() : Infinity;
          const tTime = targetDate.getTime();
          if (tTime < start || tTime > end) {
            matchTime = false;
          }
        }

        if (matchTime) {
          if (ticket) {
            issued++;
          } else {
            pending++;
          }
        }
      });

      return {
        examId: exam.id,
        examName: exam.name,
        issued,
        pending,
        total: issued + pending
      };
    }).filter(stat => stat.total > 0 || dashboardPeriod === 'ALL' || dashboardSelectedExamId !== 'ALL' || dashboardCategory !== 'ALL');

    return statsList;
  }, [students, exams, payments, dashboardCategory, dashboardSelectedExamId, dashboardPeriod, dashboardStartDate, dashboardEndDate]);

  const overallStats = React.useMemo(() => {
    const totalIssued = ticketStats.reduce((sum, s) => sum + s.issued, 0);
    const totalPending = ticketStats.reduce((sum, s) => sum + s.pending, 0);
    return {
      examName: 'All Exams (Total)',
      issued: totalIssued,
      pending: totalPending,
      total: totalIssued + totalPending
    };
  }, [ticketStats]);

  const issuanceRate = React.useMemo(() => {
    if (overallStats.total === 0) return 0;
    return Math.round((overallStats.issued / overallStats.total) * 100);
  }, [overallStats]);

  const togglePaymentMethod = (method: keyof PaymentSettings) => {
    const updated = { ...paymentSettings, [method]: !paymentSettings[method] };
    db.updatePaymentSettings(updated);
    setPaymentSettings(updated);
  };

  const openStudentModal = (student: Student | null = null) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm(student);
    } else {
      setEditingStudent(null);
      setStudentForm({
        name: '', phoneNumber: '', faculty: '', department: '', semester: '',
        email: '', status: AccountStatus.ACTIVE, examEligibility: [], scholarships: []
      });
    }
    setIsStudentModalOpen(true);
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      db.updateStudent({ ...editingStudent, ...studentForm } as Student);
    } else {
      const id = db.generateStudentId();
      const now = new Date();
      const activeExamIdsAtEnrollment = exams
        .filter(ex => !ex.expiryDate || new Date(ex.expiryDate) > now)
        .map(ex => ex.id);

      db.addStudent({
        ...studentForm, id, password: `${id}123`, status: AccountStatus.ACTIVE,
        examEligibility: activeExamIdsAtEnrollment, processedExams: [],
        hasChangedPassword: false, passwordChangeCount: 0, scholarships: []
      } as Student);
    }
    setIsStudentModalOpen(false);
  };

  const openDeleteAuth = (studentId: string) => {
    setStudentToDelete(studentId);
    resetAuthState();
    setIsDeleteAuthOpen(true);
  };

  const handleConfirmDeleteStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword) && studentToDelete) {
      db.deleteStudent(studentToDelete);
      setIsDeleteAuthOpen(false);
      setStudentToDelete(null);
    } else setAuthError('Invalid Admin Password');
  };

  const openExamModal = (exam: Exam | null = null) => {
    if (exam) {
      setEditingExam(exam);
      const d = exam.dates && !isNaN(new Date(exam.dates).getTime()) ? new Date(exam.dates) : new Date();
      const exp = exam.expiryDate && !isNaN(new Date(exam.expiryDate).getTime()) ? new Date(exam.expiryDate) : null;
      setExamForm({
        name: exam.name || '',
        fee: exam.fee ?? 0,
        session: exam.session || '2023-2024',
        date: d.toISOString().split('T')[0],
        time: d.toTimeString().split(' ')[0].substring(0, 5),
        expDate: exp ? exp.toISOString().split('T')[0] : '',
        expTime: exp ? exp.toTimeString().split(' ')[0].substring(0, 5) : '',
        targetFaculty: exam.targetFaculty || 'ALL',
        targetDepartment: exam.targetDepartment || '',
        targetAcademicYear: exam.targetAcademicYear || 'ALL',
        targetSemester: exam.targetSemester || 'ALL',
        targetProgram: exam.targetProgram || '',
        targetStudentId: exam.targetStudentId || ''
      });
    } else {
      setEditingExam(null);
      setExamForm({ 
        name: '', 
        fee: 0, 
        session: '2023-2024', 
        date: '', 
        time: '', 
        expDate: '', 
        expTime: '',
        targetFaculty: 'ALL',
        targetDepartment: '',
        targetAcademicYear: 'ALL',
        targetSemester: 'ALL',
        targetProgram: '',
        targetStudentId: ''
      });
    }
    setIsExamModalOpen(true);
  };

  const handleExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledDate = new Date(`${examForm.date}T${examForm.time || '09:00:00'}`).toISOString();
    const expiryDate = examForm.expDate ? new Date(`${examForm.expDate}T${examForm.expTime || '23:59:00'}`).toISOString() : undefined;
    
    const examPayload = {
      name: examForm.name,
      fee: examForm.fee,
      session: examForm.session,
      dates: scheduledDate,
      expiryDate: expiryDate,
      targetFaculty: examForm.targetFaculty,
      targetDepartment: examForm.targetDepartment,
      targetAcademicYear: examForm.targetAcademicYear,
      targetSemester: examForm.targetSemester,
      targetProgram: examForm.targetProgram,
      targetStudentId: examForm.targetStudentId
    };

    if (editingExam) {
      db.updateExam({ 
        ...editingExam,
        ...examPayload
      });
      db.addAuditLog({
        action: 'UPDATE_FEE',
        actorId: currentUser?.id || 'admin',
        targetId: editingExam.id,
        details: `Admin updated targeted fee "${examForm.name}" ($${examForm.fee}). Target Faculty: ${examForm.targetFaculty || 'ALL'}, Dept: ${examForm.targetDepartment || 'ALL'}, AY: ${examForm.targetAcademicYear || 'ALL'}, Semester: ${examForm.targetSemester || 'ALL'}, Program: ${examForm.targetProgram || 'ALL'}, Student ID: ${examForm.targetStudentId || 'ALL'}`
      });
    } else {
      const newExamId = `EXM-${Date.now()}`;
      db.addExam({ 
        id: newExamId,
        ...examPayload
      });
      db.addAuditLog({
        action: 'CREATE_FEE',
        actorId: currentUser?.id || 'admin',
        targetId: newExamId,
        details: `Admin created and published fee "${examForm.name}" ($${examForm.fee}). Target Faculty: ${examForm.targetFaculty || 'ALL'}, Dept: ${examForm.targetDepartment || 'ALL'}, AY: ${examForm.targetAcademicYear || 'ALL'}, Semester: ${examForm.targetSemester || 'ALL'}, Program: ${examForm.targetProgram || 'ALL'}, Student ID: ${examForm.targetStudentId || 'ALL'}`
      });
    }
    setIsExamModalOpen(false);
  };

  const normalizeSub = (sub?: Partial<SubSection>): SubSection => ({
    percentage: sub?.percentage ?? 0,
    createdDate: sub?.createdDate || '',
    expireDate: sub?.expireDate || '',
    isOpen: !!sub?.isOpen
  });

  const openAcademicYearModal = (ay: AcademicYearConfig | null = null) => {
    if (ay) {
      setAyForm({
        id: ay.id,
        name: ay.name || '',
        fee: ay.fee ?? 100,
        targetFaculty: ay.targetFaculty || 'ALL',
        targetDepartment: ay.targetDepartment || 'ALL',
        targetSemester: ay.targetSemester || 'ALL',
        targetProgram: ay.targetProgram || 'ALL',
        targetStudentId: ay.targetStudentId || 'ALL',
        isActive: ay.isActive !== undefined ? ay.isActive : true,
        semester1: {
          quiz: normalizeSub(ay.semester1?.quiz),
          midterm: normalizeSub(ay.semester1?.midterm),
          final: normalizeSub(ay.semester1?.final)
        },
        semester2: {
          quiz: normalizeSub(ay.semester2?.quiz),
          midterm: normalizeSub(ay.semester2?.midterm),
          final: normalizeSub(ay.semester2?.final)
        }
      });
    } else {
      setAyForm({
        id: `AY-${Date.now()}`,
        name: '',
        fee: 100,
        targetFaculty: 'ALL',
        targetDepartment: 'ALL',
        targetSemester: 'ALL',
        targetProgram: 'ALL',
        targetStudentId: 'ALL',
        semester1: { quiz: {...initialSub}, midterm: {...initialSub}, final: {...initialSub} },
        semester2: { quiz: {...initialSub}, midterm: {...initialSub}, final: {...initialSub} },
        isActive: true
      });
    }
    setIsAcademicYearModalOpen(true);
  };

  const handleAcademicYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validateSum = (sem: Semester) => sem.quiz.percentage + sem.midterm.percentage + sem.final.percentage;
    if (validateSum(ayForm.semester1!) > 100 || validateSum(ayForm.semester2!) > 100) {
      alert("SYSTEM ERROR: Semester percentage total cannot exceed 100%.");
      return;
    }
    
    // Save to local db layer (triggers local memory update and sync)
    db.saveAcademicYear(ayForm as AcademicYearConfig);

    // Also call backend dedicated route to guarantee atomic SQLite transaction
    try {
      await fetch('/api/academic-year/create-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ayForm)
      });
    } catch(err) {
      console.warn("Backend AY fee sync notification:", err);
    }

    setIsAcademicYearModalOpen(false);
  };

  const openFacultyModal = (faculty: Faculty | null = null) => {
    if (faculty) {
      setEditingFaculty(faculty);
      setFacultyForm({ name: faculty.name || '', fee: faculty.fee ?? 0 });
    } else {
      setEditingFaculty(null);
      setFacultyForm({ name: '', fee: 0 });
    }
    setIsFacultyModalOpen(true);
  };

  const handleFacultySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFaculty) db.updateFaculty({ ...editingFaculty, ...facultyForm });
    else db.addFaculty({ id: `FAC-${Date.now()}`, ...facultyForm });
    setIsFacultyModalOpen(false);
  };

  const openScholarshipModal = () => {
    setScholarshipForm({
      name: '',
      type: ScholarshipType.PERCENTAGE,
      value: 0,
      startDateTime: new Date().toISOString().slice(0, 16),
      endDateTime: '',
      categories: ['Exam']
    });
    setIsScholarshipModalOpen(true);
  };

  const handleScholarshipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(scholarshipForm.startDateTime).toISOString();
    const end = scholarshipForm.endDateTime ? new Date(scholarshipForm.endDateTime).toISOString() : undefined;
    
    db.addScholarship({
      id: `SCH-${Date.now()}`,
      name: scholarshipForm.name,
      type: scholarshipForm.type,
      value: Number(scholarshipForm.value),
      startDate: start,
      endDate: end,
      categories: scholarshipForm.categories
    });
    
    alert(`SUCCESS: Scholarship "${scholarshipForm.name}" defined and active.`);
    setIsScholarshipModalOpen(false);
    refreshData();
  };

  const openAssignScholarship = (student: Student) => {
    setAssigningStudent(student);
    setIsAssignScholarshipModalOpen(true);
  };

  const handleAssignScholarship = (sId: string) => {
    if (assigningStudent) {
      db.assignScholarshipToStudent(assigningStudent.id, sId);
      setIsAssignScholarshipModalOpen(false);
    }
  };

  const handleRequestRevoke = (studentId: string, sId: string) => {
    setRevokeData({ studentId, scholarshipId: sId });
    resetAuthState();
    setIsRevokeAuthOpen(true);
  };

  const handleConfirmRevoke = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword) && revokeData) {
      db.removeScholarshipFromStudent(revokeData.studentId, revokeData.scholarshipId);
      setIsRevokeAuthOpen(false);
      setRevokeData(null);
      refreshData();
    } else {
      setAuthError('Revocation Failed: Invalid Admin Secret.');
    }
  };

  const handleRequestExamDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExamToDelete(id);
    resetAuthState();
    setIsExamDeleteAuthOpen(true);
  };

  const handleConfirmExamDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword) && examToDelete) {
      db.deleteExam(examToDelete);
      setIsExamDeleteAuthOpen(false);
      setExamToDelete(null);
    } else setAuthError('Invalid Admin Password');
  };

  const handleLoanAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword)) {
      setIsLoanAuthOpen(false);
      openLoanModal();
    } else {
      setAuthError('Authentication Failed');
    }
  };

  const openLoanModal = () => {
    setLoanForm({ studentIdSearch: '', selectedStudentId: '', examId: '', approvedAmount: 0 });
    setIsLoanModalOpen(true);
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = db.findStudentById(loanForm.selectedStudentId);
    const exam = exams.find(ex => ex.id === loanForm.examId);
    if (student && exam) {
      const loanConfig = {
        examId: exam.id,
        authorizedAmount: loanForm.approvedAmount
      };
      db.updateStudent({ 
        ...student, 
        loanConfig
      });
      await db.syncImmediately();
      try {
        await fetch(`/api/students/${student.id}/partial-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loanConfig)
        });
      } catch (err) {
        console.error("Failed to sync partial payment config to server:", err);
      }
      setIsLoanModalOpen(false);
    }
  };

  const openCredentialView = (student: Student) => {
    setViewingStudent(student);
    resetAuthState();
    setIsCredentialModalOpen(true);
  };

  const openFeeControl = (student: Student) => {
    setFeeControlStudent(student);
    setIsFeeControlOpen(true);
  };

  const openFeeAuth = (student: Student) => {
    setFeeControlStudent(student);
    resetAuthState();
    setIsFeeAuthOpen(true);
  };

  const handleFeeAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword)) {
      setIsFeeAuthOpen(false);
      setIsFeeAuthorized(true);
      setIsFeeControlOpen(true);
      resetAuthState();
    } else {
      setAuthError('Access Denied: Invalid Admin Password');
    }
  };

  const initiateRemoveFee = (studentId: string, examId: string) => {
    setFeeToRemove({studentId, examId});
    setIsRemoveFeeAuthOpen(true);
  };

  const handleConfirmRemoveFee = () => {
    if (feeToRemove) {
      const { studentId, examId } = feeToRemove;
      const student = db.findStudentById(studentId);
      const exam = exams.find(e => e.id === examId);
      
      if (student && exam) {
        const { final } = db.calculateDiscountedFee(exam, student);
        
        db.addFeeRemovalRequest({
          id: `REQ-${Date.now()}`,
          studentId,
          examId,
          studentName: student.name,
          examName: exam.name,
          amount: final,
          requestedBy: currentUser.id,
          requestedAt: new Date().toISOString(),
          status: 'PENDING'
        });
      }
      
      refreshData();
      setIsRemoveFeeAuthOpen(false);
      setFeeToRemove(null);
    }
  }

  const handleRemoveAllFees = (studentId: string, examIds: string[]) => {
    if (isFeeAuthorized) {
      examIds.forEach(eid => {
        db.removeStudentFee(studentId, eid);
      });
      setIsFeeControlOpen(false);
      setIsFeeAuthorized(false);
    } else {
      setAuthError('Admin Authentication Required');
    }
  };

  const handleResetPasswordDefault = () => {
    if (viewingStudent) {
      db.resetStudentPassword(viewingStudent.id);
      setViewingStudent(db.findStudentById(viewingStudent.id) || null);
    }
  };

  const verifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCurrentAdmin(adminAuthPassword)) setAuthError('AUTH_SUCCESS');
    else setAuthError('System Auth Failed: Invalid Admin Secret.');
  };
  const exportToCSV = () => {
    let filename = `financial_audit_trail_${new Date().toISOString()}.csv`;

    const csvContent = [
      ["Tx ID", "Student ID", "Fee / Exam", "Gateway Method", "Amount", "Status", "Date & Time"],
      ...filteredPayments.map(p => [
        `"${p.id}"`,
        `"${p.studentId}"`,
        `"${p.examId}"`,
        `"${p.method}"`,
        p.amount,
        `"${p.status}"`,
        `"${new Date(p.timestamp).toLocaleString()}"`
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (event) => {
      try {
        let parsedData: any[] = [];
        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          const content = event.target?.result as string;
          parsedData = JSON.parse(content);
        }
        
        if (Array.isArray(parsedData)) {
          const now = new Date();
          const activeExamIdsAtIngest = exams
            .filter(ex => !ex.expiryDate || new Date(ex.expiryDate) > now)
            .map(ex => ex.id);

          parsedData.forEach(item => {
            db.addStudent({
              ...item,
              status: item.status || AccountStatus.ACTIVE,
              password: item.password || `${item.id}123`,
              // FIX: Use activeExamIdsAtIngest which is defined in this scope
              examEligibility: item.examEligibility || activeExamIdsAtIngest,
              processedExams: item.processedExams || [],
              hasChangedPassword: item.hasChangedPassword || false,
              passwordChangeCount: item.passwordChangeCount || 0,
              scholarships: item.scholarships || []
            } as Student);
          });
          setIsBulkUploadOpen(false);
          alert(`SUCCESS: ${parsedData.length} records processed with absolute data integrity.`);
        }
      } catch (err) {
        alert("ERROR: System integrity check failed. Ensure file is a valid JSON trace or Excel workbook.");
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const filteredStudents = students.filter(s => 
    s.status !== AccountStatus.DELETED &&
    (studentRegistrySearch === '' || 
     (s.id && s.id.toUpperCase().includes(studentRegistrySearch.toUpperCase())) ||
     (s.name && s.name.toUpperCase().includes(studentRegistrySearch.toUpperCase())))
  );

  const deletedStudents = students.filter(s => s.status === AccountStatus.DELETED);

  const studentsWithDebt = students.filter(s => {
    const balance = db.getStudentBalance(s.id);
    const matchesSearch = auditTrailSearch === '' || 
         (s.id && s.id.toUpperCase().includes(auditTrailSearch.toUpperCase())) ||
         (s.name && s.name.toUpperCase().includes(auditTrailSearch.toUpperCase()));
    return balance > 0 && matchesSearch;
  });

  const filteredPayments = payments.filter(p => {
    const q = auditTrailSearch.trim().toUpperCase();
    const matchesSearch = q === '' || 
         (p.studentId && p.studentId.toUpperCase().includes(q)) ||
         (p.examId && p.examId.toUpperCase().includes(q)) ||
         (p.id && p.id.toUpperCase().includes(q));
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
    const matchesMethod = filterMethod === 'ALL' || p.method === filterMethod;
    const matchesActiveFee = activeFeeFilter === 'ALL' || p.examId === activeFeeFilter;
    return matchesSearch && matchesStatus && matchesMethod && matchesActiveFee;
  }).sort((a, b) => {
    const timeA = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
    return timeB - timeA;
  });

  const filteredPartialPayments = React.useMemo(() => {
    return partialAuditRecords.filter(p => {
      const q = auditTrailSearch.trim().toUpperCase();
      const matchesSearch = q === '' ||
        (p.studentId && p.studentId.toUpperCase().includes(q)) ||
        (p.studentName && p.studentName.toUpperCase().includes(q)) ||
        (p.feeName && p.feeName.toUpperCase().includes(q)) ||
        (p.feeId && p.feeId.toUpperCase().includes(q)) ||
        (p.transactionId && p.transactionId.toUpperCase().includes(q)) ||
        (p.academicYear && p.academicYear.toUpperCase().includes(q));

      const matchesActiveFee = activeFeeFilter === 'ALL' || p.feeId === activeFeeFilter;
      const matchesMethod = filterMethod === 'ALL' || p.paymentMethod === filterMethod || p.method === filterMethod;

      return matchesSearch && matchesActiveFee && matchesMethod;
    }).sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [partialAuditRecords, auditTrailSearch, activeFeeFilter, filterMethod]);

  const loanSearchSuggestions = loanForm.studentIdSearch.length > 2 
    ? db.searchStudents(loanForm.studentIdSearch) 
    : [];

  const loanTargetStudent = db.findStudentById(loanForm.selectedStudentId);
  const eligibleLoanExams = loanTargetStudent 
    ? exams.filter(e => {
        const isEligible = (loanTargetStudent.examEligibility || []).includes(e.id);
        const isActive = !e.expiryDate || new Date(e.expiryDate) > new Date();
        return isEligible && isActive;
      }) 
    : [];

  const getDaysRemaining = (deletionTimestamp: string) => {
    const now = new Date();
    const del = new Date(deletionTimestamp);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expires = del.getTime() + thirtyDays;
    const diff = expires - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const availableMethods = Array.from(new Set(payments.map(p => p.method)));

  const matchedStudentsPreview = students.filter(student => {
    // Faculty
    if (examForm.targetFaculty && examForm.targetFaculty !== 'ALL' && examForm.targetFaculty.trim() !== '') {
      const sFaculty = student.faculty || '';
      if (sFaculty.trim().toLowerCase() !== examForm.targetFaculty.trim().toLowerCase()) return false;
    }
    // Department
    if (examForm.targetDepartment && examForm.targetDepartment !== 'ALL' && examForm.targetDepartment.trim() !== '') {
      const sDept = student.department || '';
      if (sDept.trim().toLowerCase() !== examForm.targetDepartment.trim().toLowerCase()) return false;
    }
    // Academic Year
    if (examForm.targetAcademicYear && examForm.targetAcademicYear !== 'ALL' && examForm.targetAcademicYear.trim() !== '') {
      const sAY = student.academicYear || '';
      if (sAY.trim().toLowerCase() !== examForm.targetAcademicYear.trim().toLowerCase()) return false;
    }
    // Semester
    if (examForm.targetSemester && examForm.targetSemester !== 'ALL' && examForm.targetSemester.trim() !== '') {
      const sSem = student.semester || '';
      if (sSem.trim().toLowerCase() !== examForm.targetSemester.trim().toLowerCase()) return false;
    }
    // Program
    if (examForm.targetProgram && examForm.targetProgram !== 'ALL' && examForm.targetProgram.trim() !== '') {
      const sProg = student.program || '';
      if (sProg.trim().toLowerCase() !== examForm.targetProgram.trim().toLowerCase()) return false;
    }
    // Student ID
    if (examForm.targetStudentId && examForm.targetStudentId !== 'ALL' && examForm.targetStudentId.trim() !== '') {
      const sId = student.id || '';
      if (sId.trim().toUpperCase() !== examForm.targetStudentId.trim().toUpperCase()) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 md:mb-12">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase font-serif italic"></h2>
          <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.4em] mt-1"></p>
          <p className="text-[10px] md:text-xs font-bold text-blue-900 mt-2">Active Admin: {currentUser.name}</p>
        </div>
        <div className="flex bg-slate-200 p-1 md:p-1.5 rounded-xl md:rounded-2xl gap-1 overflow-x-auto scrollbar-admin w-full lg:w-auto">
          {[
            { id: 'DASHBOARD', label: 'Visual Dashboard' },
            { id: 'PAYMENTS', label: 'Financial Audit Trail' },
            { id: 'STUDENTS', label: 'Student Records' },
            { id: 'EXAMS', label: 'EXAMS' },
            { id: 'ACADEMIC_YEAR', label: 'Academic Year' },
            { id: 'FACULTIES', label: 'FACULTIES' },
            { id: 'SCHOLARSHIPS', label: 'SCHOLARSHIPS' },
            { id: 'VERIFIERS', label: 'Ticket Verification' },
            { id: 'SETTINGS', label: 'SETTINGS' },
            { id: 'NOTIFICATIONS', label: 'NOTIFICATIONS' },
            { id: 'FINANCIAL_STATEMENT', label: 'FINANCIAL STATEMENT' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl font-black text-[8px] md:text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-blue-900 shadow-xl scale-105' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 min-h-[600px] scrollbar-admin overflow-hidden">
        {activeTab === 'DASHBOARD' && (
          <div className="p-10 animate-in fade-in h-full overflow-y-auto scrollbar-admin">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black uppercase font-serif text-slate-900">Visual Operations Dashboard</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-Time Hall Ticket Issuance & Clearance Metrics</p>
              </div>
            </div>

            {/* Advanced Payment/Fee & Time Filters */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm mb-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Payment Status / Period Category Filter */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Payment Status / Category</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'ACTIVE', label: 'Active' },
                        { id: 'PAST', label: 'Past' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setDashboardCategory(cat.id as any)}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                            dashboardCategory === cat.id ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Individual Fee Selection */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Specific Fee / Exam Item</label>
                    <select
                      value={dashboardSelectedExamId}
                      onChange={(e) => setDashboardSelectedExamId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="ALL">All Available Fees ({exams.length})</option>
                      {exams.map(exam => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name} {db.isExamExpiredOrPast(exam) ? '(Past)' : '(Active)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Time Filter */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Time Period</label>
                    <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'TODAY', label: 'Today' },
                        { id: 'MONTH', label: 'Month' },
                        { id: 'YEAR', label: 'Year' },
                        { id: 'CUSTOM', label: 'Custom' }
                      ].map(period => (
                        <button
                          key={period.id}
                          onClick={() => setDashboardPeriod(period.id as any)}
                          className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                            dashboardPeriod === period.id ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Date Pickers */}
                {dashboardPeriod === 'CUSTOM' && (
                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 animate-in fade-in">
                    <span className="text-xs font-black uppercase text-slate-700">Custom Date Range:</span>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">From:</label>
                      <input
                        type="date"
                        value={dashboardStartDate}
                        onChange={(e) => setDashboardStartDate(e.target.value)}
                        className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">To:</label>
                      <input
                        type="date"
                        value={dashboardEndDate}
                        onChange={(e) => setDashboardEndDate(e.target.value)}
                        className="p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            
            {/* Real-time KPI Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="p-6 bg-emerald-50/55 rounded-3xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-[0.2em]">Issued Tickets</span>
                  <p className="text-4xl font-black text-emerald-900 mt-2 font-mono">{overallStats.issued}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase">
                  <i className="fa-solid fa-circle-check text-xs"></i>
                  <span>Cleared for exams</span>
                </div>
              </div>

              <div className="p-6 bg-amber-50/55 rounded-3xl border border-amber-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-[0.2em]">Pending Tickets</span>
                  <p className="text-4xl font-black text-amber-900 mt-2 font-mono">{overallStats.pending}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase">
                  <i className="fa-solid fa-hourglass-half text-xs"></i>
                  <span>Awaiting payment clearance</span>
                </div>
              </div>

              <div className="p-6 bg-blue-50/55 rounded-3xl border border-blue-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-800 tracking-[0.2em]">Total Allocations</span>
                  <p className="text-4xl font-black text-blue-900 mt-2 font-mono">{overallStats.total}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase">
                  <i className="fa-solid fa-users text-xs"></i>
                  <span>Eligible Examinees</span>
                </div>
              </div>

              <div className="p-6 bg-slate-50/55 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Issuance Rate</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-4xl font-black text-slate-800 font-mono">{issuanceRate}%</p>
                    <span className="text-xs font-black text-slate-400">of total</span>
                  </div>
                </div>
                <div className="mt-4 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${issuanceRate}%` }}></div>
                </div>
              </div>
            </div>

            {/* D3 visual bar chart card or Zero-Result Empty State */}
            {ticketStats.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-16 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl">
                  <i className="fa-solid fa-filter-circle-xmark"></i>
                </div>
                <div>
                  <h4 className="text-base font-black uppercase text-slate-900 font-serif">No Records Match Selected Filters</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                    There are no hall ticket or payment records matching the selected filter combination. Try resetting your filter criteria.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDashboardCategory('ALL');
                    setDashboardSelectedExamId('ALL');
                    setDashboardPeriod('ALL');
                    setDashboardStartDate('');
                    setDashboardEndDate('');
                  }}
                  className="px-6 py-3 bg-blue-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-black transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                <D3BarChart stats={ticketStats} overall={overallStats} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'PAYMENTS' && (
          <div className="p-10 animate-in fade-in h-full overflow-y-auto scrollbar-admin">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-black uppercase font-serif">Financial Audit Trail</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Institutional Ledger & Payment Verification</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => refreshData()} 
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
                  >
                    <i className="fa-solid fa-rotate text-xs"></i>
                    <span>Refresh</span>
                  </button>
                  <button 
                    onClick={exportToCSV} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-file-csv text-xs"></i>
                    <span>Export CSV</span>
                  </button>
                  <button 
                    onClick={() => { resetAuthState(); setIsLoanAuthOpen(true); }} 
                    className="bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-hand-holding-dollar text-xs"></i>
                    <span>Partial Payment</span>
                  </button>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 sm:p-6 bg-slate-50 rounded-3xl">
                <input 
                  placeholder="Search student, fee, or Tx ID..." 
                  value={auditTrailSearch} 
                  onChange={e => setAuditTrailSearch(e.target.value)} 
                  className="p-3 sm:p-4 rounded-xl border font-bold text-xs bg-white text-black w-full" 
                />
                <select 
                  value={activeFeeFilter} 
                  onChange={e => setActiveFeeFilter(e.target.value)} 
                  className="p-3 sm:p-4 rounded-xl border font-bold text-xs bg-white text-black w-full"
                >
                    <option value="ALL">All Active Fees</option>
                    {exams.filter(e => !e.expiryDate || new Date(e.expiryDate) > new Date()).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
                <select 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)} 
                  className="p-3 sm:p-4 rounded-xl border font-bold text-xs bg-white text-black w-full"
                >
                    <option value="ALL">All Status</option>
                    <option value={PaymentStatus.PAID}>Paid (Full)</option>
                    <option value={PaymentStatus.PARTIAL}>Partial</option>
                </select>
                <select 
                  value={filterMethod} 
                  onChange={e => setFilterMethod(e.target.value)} 
                  className="p-3 sm:p-4 rounded-xl border font-bold text-xs bg-white text-black w-full"
                >
                    <option value="ALL">All Gateways</option>
                  {availableMethods.map((m, index) => <option key={`${m}-${index}`} value={m}>{m}</option>)}
                </select>
             </div>

             <div className="table-responsive-container scrollbar-admin">
               <table className="w-full text-xs min-w-[800px]">
                 <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
                   <tr><th className="p-6 text-left">Tx ID</th><th className="p-6 text-left">Student</th><th className="p-6 text-left">Exam</th><th className="p-6 text-left">Method</th><th className="p-6 text-left">Amount</th><th className="p-6 text-left">Status</th><th className="p-6 text-left">Date & Time</th></tr>
                 </thead>
                 <tbody className="divide-y">
                   {filteredPayments.map(p => {
                     const isLoan = (p.method || '').includes('LOAN_ALLOCATION');
                     const isRemovedMethod = p.method === '(admin paid...)';
                     const isRemovedStatus = p.status.toString() === '(removed...)';
                     const isPartial = (p.status as any) === PaymentStatus.PARTIAL || (p.status as any) === 'PARTIAL' || (p.status as any) === 'partial';
                     const isNonLoanPaid = !isLoan && !isRemovedMethod && !isPartial && p.status === PaymentStatus.PAID;
                     return (
                       <tr key={p.id} className="hover:bg-slate-50 transition-none">
                         <td className="p-6 font-black">{p.id}</td>
                         <td className="p-6">{p.studentId}</td>
                         <td className="p-6 font-bold">{p.examId}</td>
                         <td className="p-6">
                           <span className={`px-2 py-1 rounded font-bold uppercase text-[9px] ${isLoan ? 'bg-red-600 text-white shadow-sm' : isRemovedMethod ? 'text-red-600 font-black' : 'bg-black/10 text-slate-600'}`}>
                             {p.method}
                           </span>
                         </td>
                         <td className={`p-6 font-black ${isRemovedStatus ? 'text-red-600' : ''}`}>
                           {isRemovedStatus ? '-' : ''}${p.amount.toLocaleString()}
                         </td>
                         <td className="p-6 font-black uppercase text-[9px]">
                           {isPartial ? (
                             <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                               <i className="fa-solid fa-clock-rotate-left text-[8px]"></i>
                               PARTIAL
                             </span>
                           ) : isNonLoanPaid ? (
                             <span className="text-emerald-500">PAID</span>
                           ) : isRemovedStatus ? (
                             <span className="text-red-600">REMOVED</span>
                           ) : (
                             <span>{p.status}</span>
                           )}
                         </td>
                         <td className="p-6 font-bold text-slate-500">{new Date(p.timestamp).toLocaleString()}</td>
                       </tr>
                     );
                   })}
                   {filteredPayments.length === 0 && (
                     <tr>
                       <td colSpan={7} className="py-16 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                         No payment records found matching the current search filters.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {/* ... (Existing Tab Content Logic Retained, just hidden for brevity as requested structure) ... */}
        {activeTab === 'STUDENTS' && (
          <div className="p-10 animate-in fade-in h-full overflow-y-auto scrollbar-admin">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-4">
              <div className="flex items-center gap-6 w-full lg:w-auto">
                <h3 className="text-xl font-black uppercase font-serif whitespace-nowrap">Student Records Registry</h3>
                <input placeholder="Search Examinee..." value={studentRegistrySearch} onChange={e => setStudentRegistrySearch(e.target.value)} className="px-6 py-3 bg-white text-black border rounded-xl font-bold text-xs w-full lg:w-72" />
              </div>
              <button onClick={() => openStudentModal(null)} className="bg-blue-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-md">Registration</button>
            </div>
            <div className="table-responsive-container scrollbar-admin">
              <table className="w-full text-xs min-w-[800px]">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
                  <tr><th className="p-6 text-left">Identity ID</th><th className="p-6 text-left">Name</th><th className="p-6 text-left">Student Unit</th><th className="p-6 text-left">Scholarships</th><th className="p-6 text-left">Debt</th><th className="p-6 text-left">Actions</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-6 font-black text-blue-900">{s.id}</td>
                      <td className="p-6 font-black uppercase">{s.name}</td>
                      <td className="p-6">
                        <p className="font-bold text-slate-800">{s.faculty}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          {s.department}
                          {s.program ? ` • ${s.program}` : ''}
                          {s.academicYear ? ` • ${s.academicYear}` : ''}
                        </p>
                      </td>
                      <td className="p-6">
                          <div className="flex flex-wrap gap-1">
                              {(s.scholarships || []).map(sc_entry => {
                                  const sc = scholarships.find(item => item.id === sc_entry.scholarshipId);
                                  return (
                                      <div key={sc_entry.scholarshipId} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-2 group/s">
                                          <span className="text-[8px] font-black uppercase">{sc?.name || sc_entry.scholarshipId}</span>
                                          <button onClick={() => handleRequestRevoke(s.id, sc_entry.scholarshipId)} title="Revoke Authorization" className="text-[8px] opacity-0 group-hover/s:opacity-100 transition-opacity text-red-600"><i className="fa-solid fa-ban"></i></button>
                                      </div>
                                  );
                              })}
                              <button onClick={() => openAssignScholarship(s)} className="text-[10px] text-blue-600 hover:text-blue-900"><i className="fa-solid fa-plus-circle"></i></button>
                          </div>
                      </td>
                      <td className="p-6 font-black text-slate-900">${db.getStudentBalance(s.id).toLocaleString()}</td>
                      <td className="p-6 flex gap-2">
                        <button onClick={() => openFeeControl(s)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Fees</button>
                        <button onClick={() => openCredentialView(s)} className="bg-sky-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">View</button>
                        <button onClick={() => openStudentModal(s)} className="bg-yellow-400 text-slate-900 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Edit</button>
                        <button onClick={() => openDeleteAuth(s.id)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'EXAMS' && (
          <div className="p-10 animate-in fade-in h-full overflow-y-auto scrollbar-admin">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black uppercase font-serif text-blue-900">Exam Fee Master</h3>
              <button onClick={() => openExamModal()} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Create Fee</button>
            </div>

            <div className="flex gap-4 mb-10">
              <button 
                onClick={() => setExamTab('CURRENT')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${examTab === 'CURRENT' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                <i className="fa-solid fa-bolt mr-2"></i>
                Current Fees
              </button>
              <button 
                onClick={() => setExamTab('PAST')}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${examTab === 'PAST' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                <i className="fa-solid fa-clock-rotate-left mr-2"></i>
                Past Fees
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.filter(e => {
                const isExpired = e.expiryDate && new Date(e.expiryDate) < new Date();
                return examTab === 'CURRENT' ? !isExpired : isExpired;
              }).map(e => (
                <div key={e.id} className={`p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-${examTab === 'CURRENT' ? 'emerald' : 'red'}-600 shadow-sm relative group transition-all`}>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openExamModal(e)} className="bg-yellow-400 text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                    <button onClick={(event) => handleRequestExamDelete(e.id, event)} className="bg-red-600 text-white w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-trash text-xs"></i></button>
                  </div>
                  <h4 className="text-lg font-black uppercase font-serif mb-2">{e.name}</h4>
                  <p className={`text-3xl font-black ${examTab === 'CURRENT' ? 'text-emerald-600' : 'text-red-600'} mb-4`}>
                    {e.isPercentageBased || e.id.startsWith('AY_') ? `Dynamic (${e.percentageValue || e.name.match(/(\d+)%/)?.[1] || 0}%)` : `$${e.fee.toLocaleString()}`}
                  </p>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4 border-t">
                    <p><i className="fa-solid fa-calendar mr-2"></i>{new Date(e.dates).toLocaleDateString()}</p>
                    {e.expiryDate && <p className={`${examTab === 'CURRENT' ? 'text-emerald-500' : 'text-red-500'} font-black mt-2`}><i className="fa-solid fa-clock mr-2"></i>Expires: {new Date(e.expiryDate).toLocaleDateString()}</p>}
                  </div>
                </div>
              ))}
              {exams.filter(e => {
                const isExpired = e.expiryDate && new Date(e.expiryDate) < new Date();
                return examTab === 'CURRENT' ? !isExpired : isExpired;
              }).length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[3rem] text-slate-300 font-black uppercase tracking-widest text-[10px]">
                  No {examTab === 'CURRENT' ? 'Active' : 'Expired'} Exam Fees Found
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ACADEMIC_YEAR' && (
          <div className="p-10 animate-in fade-in h-full overflow-y-auto scrollbar-admin">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black uppercase font-serif text-blue-900">Academic Year</h3>
                <button onClick={() => openAcademicYearModal()} className="bg-blue-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Add New Academic Year</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {academicYears.map(ay => (
                  <div key={ay.id} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-blue-600 shadow-sm relative group">
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAcademicYearModal(ay)} className="bg-yellow-400 text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                      </div>
                      <h4 className="text-lg font-black uppercase font-serif mb-2">{ay.name}</h4>
                      <div className="space-y-2 mt-4">
                         <div className="flex justify-between text-[9px] font-black uppercase">
                            <span className="text-slate-400">Semester 1</span>
                            <span className="text-blue-900">Configured</span>
                         </div>
                         <div className="flex justify-between text-[9px] font-black uppercase">
                            <span className="text-slate-400">Semester 2</span>
                            <span className="text-blue-900">Configured</span>
                         </div>
                      </div>
                  </div>
                ))}
                {academicYears.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[3rem] text-slate-300 font-black uppercase tracking-widest text-[10px]">No Academic Years Defined</div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'FACULTIES' && (
          <div className="p-10 animate-in fade-in">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black uppercase font-serif text-blue-900">Faculty Base Fee Management</h3>
              <button onClick={() => openFacultyModal()} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Register Faculty Fee</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {faculties.map(f => (
                <div key={f.id} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-emerald-600 shadow-sm relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openFacultyModal(f)} className="bg-yellow-400 text-slate-900 w-8 h-8 rounded-lg flex items-center justify-center"><i className="fa-solid fa-pen text-xs"></i></button>
                  </div>
                  <h4 className="text-lg font-black uppercase font-serif mb-2">{f.name}</h4>
                  <p className="text-3xl font-black text-emerald-700 mb-1">${f.fee.toLocaleString()}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Annual Fee</p>
                </div>
              ))}
              {faculties.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[3rem] text-slate-300 font-black uppercase tracking-widest text-[10px]">No Faculties Registered</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'SCHOLARSHIPS' && (
          <div className="p-10 animate-in fade-in">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black uppercase font-serif text-blue-950">Scholarship definitions</h3>
              <button onClick={() => openScholarshipModal()} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">New Scholarship</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scholarships.map(s => (
                <div key={s.id} className="p-8 bg-white rounded-3xl border-2 border-slate-100 hover:border-emerald-600 shadow-sm relative group">
                  <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-black uppercase font-serif">{s.name}</h4>
                      <div className="bg-blue-950 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">{s.type}</div>
                  </div>
                  <p className="text-3xl font-black text-emerald-700 mb-4">{s.type === ScholarshipType.PERCENTAGE ? `${s.value}%` : `$${s.value.toLocaleString()}`} OFF</p>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4 border-t space-y-1">
                    <p><i className="fa-solid fa-calendar mr-2"></i>Start: {s.startDate ? new Date(s.startDate).toLocaleDateString() : 'N/A'}</p>
                    {s.endDate && <p><i className="fa-solid fa-clock mr-2"></i>End: {new Date(s.endDate).toLocaleDateString()}</p>}
                    <p className="mt-2 text-blue-600"><i className="fa-solid fa-tags mr-2"></i>{(s.categories || ['Exam']).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
            {scholarships.length === 0 && (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] border-2 border-dashed rounded-[3rem]">No scholarship definitions.</div>
            )}
          </div>
        )}
        {activeTab === 'NOTIFICATIONS' && (
          <div className="p-10 animate-in fade-in h-[600px] overflow-y-auto scrollbar-admin">
            <h3 className="text-xl font-black uppercase font-serif mb-6">Targeted Notifications</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              db.sendTargetedNotification(
                { faculty: notificationForm.faculty || undefined, semester: notificationForm.semester || undefined },
                { title: notificationForm.title, message: notificationForm.message, type: notificationForm.type }
              );
              alert('Notification dispatched successfully');
              setNotificationForm({ title: '', message: '', type: 'SYSTEM', faculty: '', semester: '' });
            }} className="space-y-4 bg-slate-50 p-8 rounded-3xl">
              <input placeholder="Title" value={notificationForm.title} onChange={e => setNotificationForm(f => ({...f, title: e.target.value}))} className="w-full p-4 rounded-xl border border-slate-200" required />
              <textarea placeholder="Message" value={notificationForm.message} onChange={e => setNotificationForm(f => ({...f, message: e.target.value}))} className="w-full p-4 rounded-xl border border-slate-200" required />
              <select value={notificationForm.type} onChange={e => setNotificationForm(f => ({...f, type: e.target.value as any}))} className="w-full p-4 rounded-xl border border-slate-200">
                <option value="SYSTEM">System</option>
                <option value="PAYMENT">Payment</option>
                <option value="URGENT">Urgent</option>
              </select>
              <input placeholder="Target Faculty (Optional)" value={notificationForm.faculty} onChange={e => setNotificationForm(f => ({...f, faculty: e.target.value}))} className="w-full p-4 rounded-xl border border-slate-200" />
              <input placeholder="Target Semester (Optional)" value={notificationForm.semester} onChange={e => setNotificationForm(f => ({...f, semester: e.target.value}))} className="w-full p-4 rounded-xl border border-slate-200" />
              <button type="submit" className="bg-blue-900 text-white px-8 py-4 rounded-xl font-black uppercase text-sm">Send Notification</button>
            </form>
          </div>
        )}
        {activeTab === 'FINANCIAL_STATEMENT' && (
          <div className="p-10 animate-in fade-in h-[700px] overflow-y-auto scrollbar-admin">
            <h3 className="text-xl font-black uppercase font-serif mb-6">Financial Account Statement</h3>
            
            <div className="mb-6 p-6 bg-slate-50 rounded-2xl">
              <input 
                placeholder="Search Student by Name or ID..." 
                value={studentRegistrySearch} 
                onChange={e => {
                  setStudentRegistrySearch(e.target.value);
                  setSelectedStatementStudentId('');
                }}
                className="w-full p-4 rounded-xl border border-slate-200"
              />
              {studentRegistrySearch && filteredStudents.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {filteredStudents.map(s => (
                        <button key={s.id} onClick={() => setSelectedStatementStudentId(s.id)} className={`p-2 rounded-lg text-left text-xs ${selectedStatementStudentId === s.id ? 'bg-blue-900 text-white' : 'bg-white border'}`}>
                            {s.name} ({s.id})
                        </button>
                    ))}
                </div>
              )}
            </div>

            {selectedStatementStudentId && (
              <FinancialStatement student={students.find(s => s.id === selectedStatementStudentId)!} />
            )}
          </div>
        )}
        {activeTab === 'SETTINGS' && (
          <div className="p-10 animate-in fade-in">
            <h3 className="text-xl font-black uppercase font-serif mb-10">Institutional Configuration</h3>
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 max-w-2xl">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-8">Authorized Payment Methods</h4>
              <div className="space-y-4">
                {[
                  { key: 'allowMobile' as keyof PaymentSettings, label: 'Mobile Money', icon: 'fa-mobile-screen' },
                  { key: 'allowCard' as keyof PaymentSettings, label: 'Card', icon: 'fa-credit-card' },
                  { key: 'allowBank' as keyof PaymentSettings, label: 'Bank', icon: 'fa-building-columns' }
                ].map(method => (
                  <div key={method.key} className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${paymentSettings[method.key] ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <i className={`fa-solid ${method.icon}`}></i>
                      </div>
                      <span className="font-black text-slate-800 uppercase tracking-widest text-xs">{method.label}</span>
                    </div>
                    <button 
                      onClick={() => togglePaymentMethod(method.key)}
                      className={`w-14 h-8 rounded-full transition-all relative ${paymentSettings[method.key] ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${paymentSettings[method.key] ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'VERIFIERS' && (
          <div className="p-8 md:p-10 animate-in fade-in space-y-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
              <div>
                <h3 className="text-2xl font-black uppercase font-serif text-slate-900">Ticket Verification Management</h3>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Authorized Hall Ticket Verification Personnel & Live Audit Trail</p>
              </div>
              <button
                onClick={() => openVerifierModal()}
                className="px-6 py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg flex items-center gap-2 transition-all"
              >
                <i className="fa-solid fa-user-plus"></i>
                <span>Create Verification Officer</span>
              </button>
            </div>

            {/* Verification Officers Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <i className="fa-solid fa-id-badge text-blue-600"></i>
                  <span>Verification Officers Registry</span>
                </h4>
                <span className="text-xs font-bold text-slate-400 font-mono">{verifiers.length} Officers</span>
              </div>
              
              <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                <div className="table-responsive-container scrollbar-admin">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Officer ID</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Initial Key</th>
                        <th className="p-4">Created Date</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {verifiers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                            No verification officers registered yet. Click &quot;Create Verification Officer&quot; to provision.
                          </td>
                        </tr>
                      ) : (
                        verifiers.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4 font-mono font-black text-blue-900 text-sm">
                              {v.id}
                            </td>
                            <td className="p-4 font-bold text-slate-900">{v.name}</td>
                            <td className="p-4 text-slate-600">{v.email}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {v.active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${v.mustChangePassword ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                {v.mustChangePassword ? 'Must Change' : 'Updated'}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 font-mono text-[11px]">
                              {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => resetVerifierPassword(v)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-black text-[10px] uppercase tracking-wider transition-colors"
                                  title="Reset password to Ticket123"
                                >
                                  Reset Password
                                </button>
                                <button
                                  onClick={() => toggleVerifierActive(v)}
                                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-colors ${v.active ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'}`}
                                >
                                  {v.active ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                  onClick={() => deleteVerifierOfficer(v)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-wider transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Real-time Ticket Verification Logs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <i className="fa-solid fa-clipboard-check text-emerald-600"></i>
                  <span>Real-Time Ticket Verification Logs</span>
                </h4>
                <button
                  onClick={() => refreshVerifiers()}
                  className="text-xs font-bold text-blue-900 hover:underline flex items-center gap-1"
                >
                  <i className="fa-solid fa-arrows-rotate"></i> Refresh Logs
                </button>
              </div>

              <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                <div className="table-responsive-container scrollbar-admin">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">Log Timestamp</th>
                        <th className="p-4">Ticket Serial</th>
                        <th className="p-4">Verified By</th>
                        <th className="p-4">Result</th>
                        <th className="p-4">Reason / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {verificationLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                            No verification scans logged yet. Real-time hall ticket scans will appear here.
                          </td>
                        </tr>
                      ) : (
                        verificationLogs.slice(0, 50).map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4 font-mono text-[11px] text-slate-600">
                              {new Date(log.verifiedAt || log.timestamp || Date.now()).toLocaleString()}
                            </td>
                            <td className="p-4 font-mono font-bold text-slate-900">
                              {log.ticketSerial || 'N/A'}
                            </td>
                            <td className="p-4 font-mono font-bold text-blue-900">
                              {log.verifiedByOfficerId || log.verifierId || 'N/A'}
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${log.result === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {log.result}
                              </span>
                            </td>
                            <td className="p-4 text-slate-600 font-mono text-xs">
                              {log.reason || 'CLEARANCE_GRANTED'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isRevokeAuthOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-950/80 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase text-red-600 mb-6 text-center">Revocation Security Clearance</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-6 leading-relaxed">Enter Administrator Secret key to execute the permanent withdrawal of scholarship node from registry record.</p>
            <form onSubmit={handleConfirmRevoke} className="space-y-6">
              <input type="password" required autoFocus placeholder="Enter Admin Secret" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-center text-2xl" />
              {authError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{authError}</p>}
              <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-red-600/20">Authorize Revocation</button>
              <button type="button" onClick={() => { setIsRevokeAuthOpen(false); resetAuthState(); }} className="text-center block w-full mt-2 text-slate-400 font-black text-[9px] uppercase">Abort Action</button>
            </form>
          </div>
        </div>
      )}

      {isFeeAuthOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-blue-950/80 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase text-blue-900 mb-6 text-center">Fee Control Clearance</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-6 leading-relaxed">Enter Administrator Secret key to access student fee management node.</p>
            <form onSubmit={handleFeeAuthSubmit} className="space-y-6">
              <input type="password" required autoFocus placeholder="Enter Admin Secret" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-center text-2xl" />
              {authError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{authError}</p>}
              <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20">Grant Access</button>
              <button type="button" onClick={() => { setIsFeeAuthOpen(false); resetAuthState(); }} className="text-center block w-full mt-2 text-slate-400 font-black text-[9px] uppercase">Abort</button>
            </form>
          </div>
        </div>
      )}
      
      {/* ... (Other modals for Academic Year, Faculty, Scholarship, Exam, Bulk Upload, Student, Delete, Loan Auth, Loan Modal remain logically the same, just utilizing the new auth verify function) ... */}

      {isAcademicYearModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-blue-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl zoom-in duration-300">
            <h3 className="text-3xl font-black uppercase font-serif italic mb-2 text-blue-900 text-center">Academic Year Workspace</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-10 tracking-widest">Global Fee Partitioning & Phase Lockdown</p>
            
            <form onSubmit={handleAcademicYearSubmit} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="text-[10px] font-black uppercase text-blue-900 mb-2 block ml-4">Year Designation</label>
                   <input required placeholder="e.g. 2024-2025" value={ayForm.name} onChange={e => setAyForm({...ayForm, name: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-xl text-center" />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-blue-900 mb-2 block ml-4">Mandatory Academic Year Fee ($)</label>
                   <input type="number" required min="0" step="any" placeholder="e.g. 100" value={ayForm.fee ?? ''} onChange={e => setAyForm({...ayForm, fee: Number(e.target.value)})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-xl text-center text-emerald-700" />
                </div>
              </div>

              {/* Targeting Scope */}
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2.5rem]">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 mb-4 ml-2">Target Student Audience (Defaults to ALL)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-2">Faculty</label>
                    <select value={ayForm.targetFaculty || 'ALL'} onChange={e => setAyForm({...ayForm, targetFaculty: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs">
                      <option value="ALL">All Faculties</option>
                      {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-2">Semester</label>
                    <select value={ayForm.targetSemester || 'ALL'} onChange={e => setAyForm({...ayForm, targetSemester: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs">
                      <option value="ALL">All Semesters</option>
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-2">Program</label>
                    <input placeholder="ALL or Program Name" value={ayForm.targetProgram || 'ALL'} onChange={e => setAyForm({...ayForm, targetProgram: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-2">Specific Student ID</label>
                    <input placeholder="ALL or Student ID" value={ayForm.targetStudentId || 'ALL'} onChange={e => setAyForm({...ayForm, targetStudentId: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {['semester1', 'semester2'].map((semKey) => {
                  const sem = (ayForm as any)[semKey] as Semester;
                  const total = sem.quiz.percentage + sem.midterm.percentage + sem.final.percentage;
                  return (
                    <div key={semKey} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
                       <div className="flex justify-between items-center mb-8">
                          <h4 className="text-lg font-black uppercase font-serif text-blue-950">{semKey.replace('s', ' S')}</h4>
                          <span className={`text-[10px] font-black px-4 py-2 rounded-full ${total > 100 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>ALLOCATED: {total}%</span>
                       </div>
                       
                       <div className="space-y-6">
                         {['quiz', 'midterm', 'final'].map((compKey) => {
                           const sub = (sem as any)[compKey] as SubSection;
                           const componentFee = Math.round(((ayForm.fee || 0) * (sub.percentage / 100)) * 100) / 100;
                           return (
                             <div key={compKey} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm relative">
                                <div className="flex justify-between items-center mb-6">
                                   <div>
                                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-800">{compKey} SECTION</h5>
                                      <span className="text-[9px] font-black text-emerald-600">Calculated: ${componentFee}</span>
                                   </div>
                                   <button type="button" onClick={() => {
                                      const nextIsOpen = !sub.isOpen;
                                      const todayStr = new Date().toISOString().split('T')[0];
                                      const nextYearStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                                      const updatedSem = {
                                        ...sem, 
                                        [compKey]: {
                                          ...sub, 
                                          isOpen: nextIsOpen,
                                          createdDate: nextIsOpen && !sub.createdDate ? todayStr : sub.createdDate,
                                          expireDate: nextIsOpen && !sub.expireDate ? nextYearStr : sub.expireDate
                                        }
                                      };
                                      setAyForm({...ayForm, [semKey]: updatedSem});
                                   }} className={`w-12 h-6 rounded-full relative transition-all ${sub.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${sub.isOpen ? 'left-7' : 'left-1'}`}></div>
                                   </button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                   <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Percentage</label>
                                      <input type="number" required value={sub.percentage} onChange={e => {
                                         const updatedSem = {...sem, [compKey]: {...sub, percentage: Number(e.target.value)}};
                                         setAyForm({...ayForm, [semKey]: updatedSem});
                                      }} className="w-full p-4 border rounded-xl font-black text-center" />
                                   </div>
                                   <div>
                                      <label className={`text-[8px] font-black uppercase mb-1 block transition-colors ${sub.isOpen ? 'text-slate-400' : 'text-slate-200'}`}>Created Date {sub.isOpen ? '*' : '(Opt)'}</label>
                                      <input type="date" required={sub.isOpen} disabled={!sub.isOpen} value={sub.createdDate} onChange={e => {
                                         const updatedSem = {...sem, [compKey]: {...sub, createdDate: e.target.value}};
                                         setAyForm({...ayForm, [semKey]: updatedSem});
                                      }} className={`w-full p-4 border rounded-xl font-black text-xs text-center transition-all ${!sub.isOpen ? 'opacity-30' : 'opacity-100'}`} />
                                   </div>
                                   <div>
                                      <label className={`text-[8px] font-black uppercase mb-1 block transition-colors ${sub.isOpen ? 'text-slate-400' : 'text-slate-200'}`}>Expire Date & Time {sub.isOpen ? '*' : '(Opt)'}</label>
                                      <input type="datetime-local" required={sub.isOpen} disabled={!sub.isOpen} value={sub.expireDate} onChange={e => {
                                         const updatedSem = {...sem, [compKey]: {...sub, expireDate: e.target.value}};
                                         setAyForm({...ayForm, [semKey]: updatedSem});
                                      }} className={`w-full p-4 border rounded-xl font-black text-[10px] text-center text-red-600 transition-all ${!sub.isOpen ? 'opacity-30' : 'opacity-100'}`} />
                                   </div>
                                </div>
                             </div>
                           );
                         })}
                       </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4">
                 <button type="submit" className="flex-1 py-6 bg-blue-900 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Authorize Configuration</button>
                 <button type="button" onClick={() => setIsAcademicYearModalOpen(false)} className="px-10 py-6 bg-slate-100 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest">Discard Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFacultyModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl">
            <h3 className="text-2xl font-black font-serif uppercase mb-8">{editingFaculty ? 'Modify Faculty Base' : 'Register Faculty Node'}</h3>
            <form onSubmit={handleFacultySubmit} className="space-y-6">
              <input required placeholder="Faculty Name" value={facultyForm.name} onChange={e => setFacultyForm({...facultyForm, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" />
              <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Annual Tuition Fee ($)</label>
                  <input type="number" required placeholder="Base Fee Amount" value={facultyForm.fee || ''} onChange={e => setFacultyForm({...facultyForm, fee: Number(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-xl" />
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Commit Definition</button>
              <button type="button" onClick={() => setIsFacultyModalOpen(false)} className="w-full mt-2 text-slate-400 font-bold text-[9px] uppercase text-center block">Abort</button>
            </form>
          </div>
        </div>
      )}

      {isScholarshipModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black font-serif uppercase mb-8">Create Scholarship definition</h3>
            <form onSubmit={handleScholarshipSubmit} className="space-y-6">
              <input required placeholder="Scholarship name" value={scholarshipForm.name} onChange={e => setScholarshipForm({...scholarshipForm, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" />
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Reduction Type</label>
                      <select value={scholarshipForm.type} onChange={e => setScholarshipForm({...scholarshipForm, type: e.target.value as ScholarshipType})} className="p-4 bg-slate-50 rounded-2xl border font-bold">
                          <option value={ScholarshipType.FULL}>Full Scholarship (100%)</option>
                          <option value={ScholarshipType.PERCENTAGE}>Partial (%)</option>
                          <option value={ScholarshipType.FIXED}>Fixed Amount ($)</option>
                      </select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Reduction Value</label>
                      <input type="number" required placeholder="Value" disabled={scholarshipForm.type === ScholarshipType.FULL} value={scholarshipForm.type === ScholarshipType.FULL ? 100 : scholarshipForm.value || ''} onChange={e => setScholarshipForm({...scholarshipForm, value: Number(e.target.value)})} className="p-4 bg-slate-50 rounded-2xl border font-black text-xl" />
                  </div>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Effective Start Interval</label>
                      <input type="datetime-local" required value={scholarshipForm.startDateTime} onChange={e => setScholarshipForm({...scholarshipForm, startDateTime: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border font-bold" />
                  </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Termination Interval (Optional)</label>
                      <input type="datetime-local" value={scholarshipForm.endDateTime} onChange={e => setScholarshipForm({...scholarshipForm, endDateTime: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border font-bold" />
                  </div>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Define Scholarship Node</button>
              <button type="button" onClick={() => setIsScholarshipModalOpen(false)} className="w-full mt-2 text-slate-400 font-bold text-[9px] uppercase text-center block">Abort</button>
            </form>
          </div>
        </div>
      )}

      {isAssignScholarshipModalOpen && assigningStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-xl font-black uppercase font-serif mb-6 text-emerald-600">Assign Scholarship Linked to {assigningStudent.id}</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-admin pr-2 mb-8">
                  {scholarships.map(s => {
                      const isAssigned = (assigningStudent.scholarships || []).some(sc => sc.scholarshipId === s.id);
                      return (
                        <div key={s.id} className={`p-6 rounded-2xl border flex items-center justify-between ${isAssigned ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 hover:border-blue-200'} transition-all`}>
                            <div>
                                <p className="font-black uppercase text-xs">{s.name}</p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.type}: {s.value}</p>
                            </div>
                            {isAssigned ? (
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest"><i className="fa-solid fa-check-circle"></i> Linked</span>
                            ) : (
                                <button onClick={() => handleAssignScholarship(s.id)} className="bg-blue-900 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest">Assign</button>
                            )}
                        </div>
                      );
                  })}
                  {scholarships.length === 0 && <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No definitions available.</p>}
              </div>
              <button onClick={() => setIsAssignScholarshipModalOpen(false)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest">Close</button>
          </div>
        </div>
      )}

      {isExamModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
            <div className="p-6 sm:p-8 pb-4 flex-shrink-0 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-black font-serif uppercase">{editingExam ? 'Modify Exam Fee' : 'Deploy New Exam Fee'}</h3>
              <button type="button" onClick={() => setIsExamModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black hover:bg-slate-200 transition-colors">✕</button>
            </div>
            <form onSubmit={handleExamSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 sm:p-8 py-6 overflow-y-auto flex-1 space-y-6 scrollbar-admin">
                <input required placeholder="Fee Designation Title (e.g., Business Examination Fee)" value={examForm.name} onChange={e => setExamForm({...examForm, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold text-sm" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="number" required placeholder="Mandatory Fee ($)" value={examForm.fee || ''} onChange={e => setExamForm({...examForm, fee: Number(e.target.value)})} className="p-4 bg-slate-50 rounded-2xl border font-black text-xl" />
                  <input required placeholder="Academic Session" value={examForm.session} onChange={e => setExamForm({...examForm, session: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border font-bold text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Exam Date</label>
                    <input type="date" required value={examForm.date} onChange={e => setExamForm({...examForm, date: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border font-bold text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Exam Time</label>
                    <input type="time" required value={examForm.time} onChange={e => setExamForm({...examForm, time: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border font-bold text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-red-400 ml-1">Expiry Date (Optional)</label>
                    <input type="date" value={examForm.expDate} onChange={e => setExamForm({...examForm, expDate: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-2 border-red-50 font-bold text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-red-400 ml-1">Expiry Time (Optional)</label>
                    <input type="time" value={examForm.expTime} onChange={e => setExamForm({...examForm, expTime: e.target.value})} className="p-4 bg-slate-50 rounded-2xl border-2 border-red-50 font-bold text-sm" />
                  </div>
                </div>

                {/* TARGET FILTERS SECTION */}
                <div className="border-t pt-4">
                  <h4 className="text-[10px] font-black uppercase text-blue-900 tracking-widest mb-3 flex items-center gap-1">
                    <i className="fa-solid fa-filter text-xs"></i> Targeted Fee Assignment Filters
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Faculty</label>
                      <select value={examForm.targetFaculty} onChange={e => setExamForm({...examForm, targetFaculty: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs">
                        <option value="ALL">All Faculties</option>
                        {faculties.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Academic Year</label>
                      <select value={examForm.targetAcademicYear} onChange={e => setExamForm({...examForm, targetAcademicYear: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs">
                        <option value="ALL">All Academic Years</option>
                        <option value="2023-2024">2023-2024</option>
                        {academicYears.map(ay => <option key={ay.id} value={ay.name}>{ay.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Semester</label>
                      <select value={examForm.targetSemester} onChange={e => setExamForm({...examForm, targetSemester: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs">
                        <option value="ALL">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={`${s}th Semester`}>{s}th Semester</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Program (Optional)</label>
                      <input placeholder="All Programs (or specific)" value={examForm.targetProgram} onChange={e => setExamForm({...examForm, targetProgram: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs text-black" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Department (Optional)</label>
                      <input placeholder="All Departments (or specific)" value={examForm.targetDepartment} onChange={e => setExamForm({...examForm, targetDepartment: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs text-black" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Target Individual Student ID (Optional)</label>
                      <input placeholder="All Students (or specific ID)" value={examForm.targetStudentId} onChange={e => setExamForm({...examForm, targetStudentId: e.target.value})} className="p-3 bg-slate-50 rounded-xl border font-bold text-xs text-black" />
                    </div>
                  </div>
                </div>

                {/* LIVE MATCH PREVIEW */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 text-xs">
                  <span className="font-bold text-blue-900 uppercase tracking-wider block text-[9px] mb-1">Fee Assignment Live Preview</span>
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    Matches <span className="text-blue-700 font-extrabold text-sm">{matchedStudentsPreview.length}</span> active student{matchedStudentsPreview.length === 1 ? '' : 's'} based on filters.
                  </p>
                  {matchedStudentsPreview.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate">
                      Matched: <span className="font-semibold text-slate-700">{matchedStudentsPreview.slice(0, 5).map(s => s.name).join(', ')}</span>
                      {matchedStudentsPreview.length > 5 ? ` and ${matchedStudentsPreview.length - 5} others...` : ''}
                    </p>
                  )}
                  {matchedStudentsPreview.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1 font-bold">
                      Warning: No students match these filters! This fee won't be assigned to anyone unless updated.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-8 pt-4 flex-shrink-0 border-t border-slate-100 bg-white space-y-2">
                <button type="submit" className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-colors">Commit Deployment</button>
                <button type="button" onClick={() => setIsExamModalOpen(false)} className="w-full text-slate-400 font-bold text-[9px] uppercase text-center block py-2">Abort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkUploadOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-xl font-black uppercase font-serif mb-6 text-emerald-600">Bulk Registry Node Upload</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-8 leading-relaxed tracking-widest">Select university enrollment trace files (JSON or .xlsx) for secure ingestion.</p>
              <input type="file" accept=".json,.xlsx,.xls" onChange={handleBulkUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[9px] font-black uppercase file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all cursor-pointer border-2 border-dashed rounded-2xl p-6" />
              <button onClick={() => setIsBulkUploadOpen(false)} className="w-full mt-6 py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel Ingest</button>
          </div>
        </div>
      )}

      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <StudentRegistrationForm 
              key={editingStudent ? editingStudent.id : 'new-student'}
              isModalMode={true}
              studentToEdit={editingStudent}
              onCancel={() => {
                setIsStudentModalOpen(false);
                setEditingStudent(null);
              }}
              onSuccess={(savedStudent) => {
                setStudents(db.getStudents());
                setIsStudentModalOpen(false);
                setEditingStudent(null);
              }}
            />
          </div>
        </div>
      )}

      {isVerifierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black font-serif uppercase mb-2 text-slate-900">
              {editingVerifier ? 'Edit Verification Officer' : 'Create Ticket Verification Officer'}
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-6">
              Institutional Examination Security Clearance
            </p>
            <form onSubmit={handleVerifierSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block ml-1">
                  Officer ID (Auto-Generated)
                </label>
                <input
                  disabled
                  value={editingVerifier ? editingVerifier.id : db.peekNextVerifierId()}
                  className="w-full p-4 bg-slate-100 rounded-2xl border font-mono font-black text-blue-900 tracking-widest"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block ml-1">
                  Full Name
                </label>
                <input
                  required
                  placeholder="Officer Full Name"
                  value={verifierForm.name}
                  onChange={e => setVerifierForm({...verifierForm, name: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border font-bold text-slate-900 focus:outline-blue-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block ml-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="officer@institutional.edu"
                  value={verifierForm.email}
                  onChange={e => setVerifierForm({...verifierForm, email: e.target.value})}
                  className="w-full p-4 bg-slate-50 rounded-2xl border font-bold text-slate-900 focus:outline-blue-900"
                />
              </div>
              {!editingVerifier && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1 block ml-1">
                    Default Access Key / Password
                  </label>
                  <input
                    disabled
                    value="Ticket123"
                    className="w-full p-4 bg-slate-100 rounded-2xl border font-mono font-bold text-slate-600"
                  />
                  <p className="text-[10px] font-bold text-amber-600 mt-2 ml-1">
                    ⚠️ The officer must change this password upon first login before entering the system.
                  </p>
                </div>
              )}
              <button
                type="submit"
                className="w-full py-4 bg-blue-900 hover:bg-blue-950 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all"
              >
                {editingVerifier ? 'Save Changes' : 'Create Officer'}
              </button>
              <button
                type="button"
                onClick={() => setIsVerifierModalOpen(false)}
                className="w-full mt-2 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase text-center block"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
      {(isDeleteAuthOpen || isExamDeleteAuthOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase text-red-600 mb-6 text-center">Security Authentication</h3>
            <form onSubmit={isExamDeleteAuthOpen ? handleConfirmExamDelete : handleConfirmDeleteStudent} className="space-y-6">
              <input type="password" required autoFocus placeholder="Enter Admin Secret" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-center text-2xl" />
              {authError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{authError}</p>}
              <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-red-600/20">Execute Access Deletion</button>
              <button type="button" onClick={() => { setIsDeleteAuthOpen(false); setIsExamDeleteAuthOpen(false); resetAuthState(); }} className="text-center block w-full mt-2 text-slate-400 font-black text-[9px] uppercase">Abort Deletion Trace</button>
            </form>
          </div>
        </div>
      )}

      {isLoanAuthOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-10 shadow-2xl">
              <h3 className="text-xl font-black uppercase font-serif mb-6 text-red-600 text-center">Security Access Control</h3>
              <form onSubmit={handleLoanAuth} className="space-y-6">
                  <input type="password" required autoFocus value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} placeholder="Admin Secret Key" className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-center text-2xl" />
                  {authError && <p className="text-red-600 text-[10px] font-black text-center uppercase">{authError}</p>}
                  <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-600/20">Verify & Proceed</button>
                  <button type="button" onClick={() => setIsLoanAuthOpen(false)} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] text-center block">Discard</button>
              </form>
          </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl">
            <h3 className="text-2xl font-black uppercase font-serif mb-8 text-blue-900 text-center">Partial Payment</h3>
            <form onSubmit={handleLoanSubmit} className="space-y-6">
              <input placeholder="Search Examinee ID..." value={loanForm.studentIdSearch} onChange={e => setLoanForm({...loanForm, studentIdSearch: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" />
              {loanSearchSuggestions.length > 0 && !loanForm.selectedStudentId && (
                <div className="max-h-40 overflow-y-auto bg-white border rounded-2xl p-2 scrollbar-admin">
                  {loanSearchSuggestions.map(s => (
                    <button key={s.id} type="button" onClick={() => setLoanForm({...loanForm, selectedStudentId: s.id})} className="w-full text-left p-3 hover:bg-blue-50 rounded-xl text-xs font-black uppercase flex justify-between">
                      {s.name} <span className="text-blue-600">{s.id}</span>
                    </button>
                  ))}
                </div>
              )}
              {loanTargetStudent && <div className="p-4 rounded-2xl border-2 border-blue-600 bg-blue-50 flex items-center justify-between"><span className="font-black uppercase text-xs">{loanTargetStudent.name}</span><button type="button" onClick={() => setLoanForm({...loanForm, selectedStudentId: ''})} className="text-red-500 text-[9px] font-black uppercase">Change</button></div>}
              <select required value={loanForm.examId || ''} onChange={e => setLoanForm({...loanForm, examId: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold">
                <option value="">Select Fee Record...</option>
                {eligibleLoanExams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.isPercentageBased || e.id.startsWith('AY_') ? `Dynamic ${e.percentageValue || e.name.match(/(\d+)%/)?.[1] || 0}%` : `$${e.fee}`})</option>)}
              </select>
              <input type="number" required placeholder="Authorized Payment Amount ($)" value={loanForm.approvedAmount || ''} onChange={e => setLoanForm({...loanForm, approvedAmount: Number(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-blue-100 font-black text-2xl text-center" />
              <button type="submit" disabled={!loanForm.selectedStudentId || !loanForm.examId} className="w-full py-5 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl disabled:bg-slate-300">Authorize Partial Payment</button>
              <button type="button" onClick={() => setIsLoanModalOpen(false)} className="w-full mt-4 text-red-600 font-black text-[10px] uppercase text-center block tracking-widest">Back</button>
            </form>
          </div>
        </div>
      )}

      {isFeeControlOpen && feeControlStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl">
            <h3 className="text-2xl font-black uppercase font-serif mb-8 flex justify-between"><span>Fee Asset Control</span><span className="text-blue-900">{feeControlStudent.id}</span></h3>
            <div className="max-h-[300px] overflow-y-auto pr-4 scrollbar-admin mb-8 space-y-4">
                 {([...(feeControlStudent.examEligibility || []), ...(feeControlStudent.processedExams || [])]).map(eid => {
                    const exam = exams.find(ex => ex.id === eid);
                    const isExpired = exam?.expiryDate && new Date() > new Date(exam.expiryDate);
                    const { final, scholarshipName } = db.calculateDiscountedFee(exam!, feeControlStudent);
                    const isPendingRemoval = db.getFeeRemovalRequests().some(r => r.studentId === feeControlStudent.id && r.examId === eid && r.status === 'PENDING');
                    return (
                      <div key={eid} className={`p-5 rounded-3xl border flex items-center justify-between group transition-all ${isExpired ? 'bg-red-50 border-red-100 hover:border-red-300' : 'bg-slate-50 border-slate-200 hover:border-blue-200'}`}>
                          <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <p className="text-[10px] font-black uppercase text-blue-900">{eid}</p>
                                {isExpired && <span className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black rounded-full uppercase tracking-tighter">Expired Node</span>}
                                {scholarshipName && <span className="px-2 py-0.5 bg-emerald-600 text-white text-[7px] font-black rounded-full uppercase tracking-tighter">Scholarship Active</span>}
                                {isPendingRemoval && <span className="px-2 py-0.5 bg-amber-500 text-white text-[7px] font-black rounded-full uppercase tracking-tighter flex items-center gap-1 animate-pulse"><i className="fa-solid fa-clock"></i> Removal Awaiting Super Admin Review</span>}
                              </div>
                              <p className="font-black uppercase">{exam?.name || 'Institutional Node'}</p>
                              <p className="text-[9px] font-bold text-slate-400">Net Fee: ${final.toLocaleString()}</p>
                          </div>
                          {isPendingRemoval ? (
                            <span className="text-amber-600 font-black uppercase text-[8px] tracking-widest bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1"><i className="fa-solid fa-lock"></i> Pending Approval</span>
                          ) : (
                            <button onClick={() => { if (exam) initiateRemoveFee(feeControlStudent.id, exam.id); }} className="text-red-600 font-black uppercase text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Remove Asset</button>
                          )}
                      </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { const all = [...(feeControlStudent.examEligibility||[]), ...(feeControlStudent.processedExams||[])]; handleRemoveAllFees(feeControlStudent.id, all); }} className="py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Wipe All Node Assets</button>
                <button onClick={() => { setIsFeeControlOpen(false); setIsFeeAuthorized(false); }} className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Exit Node</button>
            </div>
          </div>
        </div>
      )}

      {isRemoveFeeAuthOpen && (
        <AdminAuthModal 
          isOpen={isRemoveFeeAuthOpen} 
          onSuccess={handleConfirmRemoveFee} 
          onCancel={() => { setIsRemoveFeeAuthOpen(false); setFeeToRemove(null); }}
          adminId={currentUser.id}
        />
      )}

      {isCredentialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-admin p-12 shadow-2xl text-center">
            {authError === 'AUTH_SUCCESS' ? (
              <div>
                <h3 className="text-2xl font-black uppercase font-serif mb-8">Examinee Account Assets</h3>
                <div className="p-6 bg-slate-50 rounded-3xl border mb-8 text-left">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Examinee ID</p>
                   <p className="text-2xl font-black text-blue-900 mb-4">{viewingStudent?.id}</p>
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Access Key (PIN)</p>
                   <p className="text-2xl font-black font-mono tracking-widest">{viewingStudent?.password}</p>
                </div>
                <button onClick={handleResetPasswordDefault} className="w-full py-5 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] mb-4 shadow-lg shadow-blue-900/20">Reset Key to 000000</button>
                <button onClick={() => setIsCredentialModalOpen(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Close Node</button>
              </div>
            ) : (
              <form onSubmit={verifyAdminPassword} className="space-y-6">
                <h3 className="text-xl font-black uppercase font-serif mb-6">Security Validation</h3>
                <input type="password" required autoFocus placeholder="Admin Secret Key" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border font-black text-center text-2xl" />
                {authError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{authError}</p>}
                <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-900/20">Authorize Node Viewer</button>
                <button type="button" onClick={() => setIsCredentialModalOpen(false)} className="w-full mt-2 text-slate-400 font-black text-[9px] uppercase">Cancel Validation</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
