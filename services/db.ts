
import bcrypt from 'bcryptjs';
import { Student, Exam, Payment, HallTicket, PaymentStatus, SecurityAlert, AccountStatus, AuditLog, PaymentSettings, Scholarship, ScholarshipType, Faculty, AcademicYearConfig, AdminUser, UserRole, Notification, FeeRemovalRequest, TicketVerificationOfficer, TicketVerificationLog } from '../types';
import { INITIAL_STUDENTS, INITIAL_EXAMS } from '../constants';

class DatabaseService {
  private listeners: Set<() => void> = new Set();
  private syncTimeout: any = null;
  private memoryDb: Record<string, any> = {
    students: INITIAL_STUDENTS,
    admins: [{
      id: 'admin',
      name: 'System Legacy Admin',
      phoneNumber: '+252000000000',
      password: 'admin123',
      isSuspended: false,
      role: UserRole.ADMIN,
      mustChangePassword: false
    }],
    verifiers: [],
    verification_logs: [],
    verifier_counter: 0,
    hall_ticket_counter: 0,
    super_admin_pass: 'super123',
    system_admins_status: {},
    exams: INITIAL_EXAMS,
    faculties: [],
    academic_years: [],
    payments: [],
    audit_logs: [],
    hall_tickets: [],
    security_alerts: [],
    payment_settings: { allowCard: true, allowMobile: true, allowBank: true },
    scholarships: [],
    notifications: [],
    fee_removal_requests: [],
    fas_counter: 0
  };

  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log("Browser detected online. Triggering SQLite synchronization...");
        this.serializeAndSyncAll();
      });
    }

    // Real-time cross-tab synchronization via BroadcastChannel
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel('edu_realtime_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'DB_UPDATE' && event.data.db) {
            Object.assign(this.memoryDb, event.data.db);
            this.notify();
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }

    // Real-time server SSE synchronization
    if (typeof window !== 'undefined') {
      const connectSSE = () => {
        const eventSource = new EventSource('/api/db/stream');
        eventSource.onmessage = async (event) => {
           if (event.data === 'update') {
               try {
                   const res = await fetch('/api/db');
                   if (res.ok) {
                       const serverData = await res.json();
                       if (serverData && typeof serverData === 'object') {
                           Object.assign(this.memoryDb, serverData);
                           this.notify();
                       }
                   }
               } catch (e) {}
           }
        };
        eventSource.onerror = () => {
            eventSource.close();
            setTimeout(connectSSE, 3000);
        };
      };
      connectSSE();
      
      // Keep a slower fallback polling just in case SSE fails
      setInterval(async () => {
        try {
          const res = await fetch('/api/db');
          if (res.ok) {
            const serverData = await res.json();
            if (serverData && typeof serverData === 'object') {
              const currentStr = JSON.stringify(this.memoryDb);
              const serverStr = JSON.stringify(serverData);
              if (currentStr !== serverStr) {
                Object.assign(this.memoryDb, serverData);
                this.notify();
              }
            }
          }
        } catch (err) {}
      }, 5000);
    }
  }

  private broadcastUpdate() {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'DB_UPDATE', db: this.memoryDb });
      } catch (e) {}
    }
  }

  public hydrate(data: Record<string, any>) {
    if (data && typeof data === 'object') {
      Object.assign(this.memoryDb, data);
      this.notify();
    }
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public serializeAndSyncAll(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.executeSync();
      this.broadcastUpdate();
    }, 300);
  }

  public async syncImmediately(): Promise<boolean> {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    if (typeof window === 'undefined') {
      return true;
    }
    try {
      const res = await fetch('/api/db/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: this.memoryDb })
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  private executeSync(): void {
    fetch('/api/db/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: this.memoryDb })
    })
    .catch(err => {
      console.warn("SQLite sync error:", err);
    });
  }

  private getStorage<T>(key: string, defaultValue: T): T {
    if (this.memoryDb[key] === undefined || this.memoryDb[key] === null) {
      this.memoryDb[key] = defaultValue;
      this.serializeAndSyncAll();
    }
    return this.memoryDb[key];
  }

  private setStorage<T>(key: string, data: T): void {
    this.memoryDb[key] = data;
    this.notify();

    this.serializeAndSyncAll();
  }

  getStudentDynamicEligibility(student: Student, exams: Exam[], payments: Payment[]): string[] {
    const matchedExams = exams.filter(exam => {
      // Check Faculty
      if (exam.targetFaculty && exam.targetFaculty !== 'ALL' && exam.targetFaculty.trim() !== '') {
        const studentFaculty = student.faculty || '';
        if (studentFaculty.trim().toLowerCase() !== exam.targetFaculty.trim().toLowerCase()) {
          return false;
        }
      }
      // Check Department
      if (exam.targetDepartment && exam.targetDepartment !== 'ALL' && exam.targetDepartment.trim() !== '') {
        const studentDept = student.department || '';
        if (studentDept.trim().toLowerCase() !== exam.targetDepartment.trim().toLowerCase()) {
          return false;
        }
      }
      // Check Academic Year
      if (exam.targetAcademicYear && exam.targetAcademicYear !== 'ALL' && exam.targetAcademicYear.trim() !== '') {
        const studentAY = student.academicYear || '';
        if (studentAY.trim().toLowerCase() !== exam.targetAcademicYear.trim().toLowerCase()) {
          return false;
        }
      }
      // Check Semester
      if (exam.targetSemester && exam.targetSemester !== 'ALL' && exam.targetSemester.trim() !== '') {
        const studentSem = student.semester || '';
        if (studentSem.trim().toLowerCase() !== exam.targetSemester.trim().toLowerCase()) {
          return false;
        }
      }
      // Check Program
      if (exam.targetProgram && exam.targetProgram !== 'ALL' && exam.targetProgram.trim() !== '') {
        const studentProg = student.program || '';
        if (studentProg.trim().toLowerCase() !== exam.targetProgram.trim().toLowerCase()) {
          return false;
        }
      }
      // Check Individual Student (Optional)
      if (exam.targetStudentId && exam.targetStudentId !== 'ALL' && exam.targetStudentId.trim() !== '') {
        const studentId = student.id || '';
        if (studentId.trim().toUpperCase() !== exam.targetStudentId.trim().toUpperCase()) {
          return false;
        }
      }
      return true;
    });

    const matchedExamIds = matchedExams.map(e => e.id);

    // Keep exams that are already paid, pending, or has a loan configuration (unless they no longer exist)
    const studentPayments = payments.filter(p => p.studentId === student.id && (this.isPaymentSettledOrPartial(p.status) || p.status === PaymentStatus.PENDING));
    const paidExamIds = studentPayments.map(p => p.examId);

    const loanExamId = student.loanConfig?.examId;

    const allEligibleIds = new Set([
      ...(student.examEligibility || []),
      ...matchedExamIds,
      ...paidExamIds,
      ...(loanExamId ? [loanExamId] : [])
    ]);

    // Ensure we only include exams that actually exist in the database
    const existingExamIds = new Set(exams.map(e => e.id));
    return Array.from(allEligibleIds).filter(id => existingExamIds.has(id));
  }

  getStudents(): Student[] {
    const students = this.getStorage<Student[]>('students', INITIAL_STUDENTS);
    const exams = this.getExams();
    const payments = this.getPayments();

    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const activeStudents = students.filter(s => {
      if (s.status === AccountStatus.DELETED && s.deletionTimestamp) {
        const deletionDate = new Date(s.deletionTimestamp);
        const diff = now.getTime() - deletionDate.getTime();
        return diff < thirtyDaysInMs;
      }
      return true;
    });

    const updatedActiveStudents = activeStudents.map(s => {
      const dynamicEligibility = this.getStudentDynamicEligibility(s, exams, payments);
      return {
        ...s,
        examEligibility: dynamicEligibility
      };
    });

    return updatedActiveStudents;
  }

  async getVerifiers(): Promise<TicketVerificationOfficer[]> {
    let verifiers = this.getStorage<TicketVerificationOfficer[]>('verifiers', []);
    const isInitialized = this.getStorage<boolean>('verifiers_initialized', false);
    
    if (!isInitialized && verifiers.length === 0) {
      // Ensure default verifiers exist only on very first initial load
      const salt = bcrypt.genSaltSync(10);
      const defaultHash = bcrypt.hashSync('Ticket123', salt);
      const defaultOfficers: TicketVerificationOfficer[] = [
        {
          id: 'ticket0000',
          name: 'Chief Examination Officer',
          email: 'exam.officer@university.edu',
          password: 'Ticket123',
          passwordHash: defaultHash,
          mustChangePassword: true,
          role: UserRole.TICKET_VERIFIER,
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'ticket0001',
          name: 'Hall Verifier Beta',
          email: 'hall.verifier@university.edu',
          password: 'Ticket123',
          passwordHash: defaultHash,
          mustChangePassword: true,
          role: UserRole.TICKET_VERIFIER,
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'TV0002',
          name: 'Verification Officer TV0002',
          email: 'tv0002@university.edu',
          password: 'Ticket123',
          passwordHash: defaultHash,
          mustChangePassword: true,
          role: UserRole.TICKET_VERIFIER,
          active: true,
          createdAt: new Date().toISOString()
        }
      ];

      verifiers = defaultOfficers;
      this.setStorage('verifiers', verifiers);
      this.setStorage('verifiers_initialized', true);
    }
    return verifiers;
  }

  async addVerifier(verifier: Omit<TicketVerificationOfficer, 'passwordHash' | 'createdAt'> & { password: string }): Promise<void> {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(verifier.password, salt);
    
    const verifiers = await this.getVerifiers();
    verifiers.push({
      ...verifier,
      passwordHash,
      createdAt: new Date().toISOString(),
      mustChangePassword: verifier.mustChangePassword ?? true,
      active: verifier.active ?? true
    });
    
    this.setStorage('verifiers', verifiers);
    await this.syncImmediately();
  }

  async updateVerifier(updatedVerifier: TicketVerificationOfficer): Promise<void> {
    const verifiers = await this.getVerifiers();
    const index = verifiers.findIndex(v => v.id === updatedVerifier.id);
    if (index !== -1) {
      verifiers[index] = updatedVerifier;
      this.setStorage('verifiers', verifiers);
      await this.syncImmediately();
    }
  }

  async updateVerifierPassword(id: string, newPassword: string): Promise<void> {
    const verifiers = await this.getVerifiers();
    const index = verifiers.findIndex(v => v.id === id);
    if (index !== -1) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);
      verifiers[index] = { ...verifiers[index], passwordHash, mustChangePassword: false, password: newPassword };
      this.setStorage('verifiers', verifiers);
      await this.syncImmediately();
    }
  }

  async deleteVerifier(id: string): Promise<void> {
    const verifiers = await this.getVerifiers();
    const filtered = verifiers.filter(v => v.id !== id);
    this.setStorage('verifiers', filtered);
    await this.syncImmediately();
  }

  async resetVerifierPassword(id: string): Promise<void> {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('Ticket123', salt);
    const verifiers = await this.getVerifiers();
    const index = verifiers.findIndex(v => v.id === id);
    if (index !== -1) {
      verifiers[index] = { ...verifiers[index], passwordHash, password: 'Ticket123', mustChangePassword: true };
      this.setStorage('verifiers', verifiers);
      await this.syncImmediately();
    }
  }

  peekNextVerifierId(): string {
    const verifiers = this.getStorage<TicketVerificationOfficer[]>('verifiers', []);
    let maxNum = -1;
    for (const v of verifiers) {
      const match = v.id.match(/^ticket(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    return `ticket${nextNum.toString().padStart(4, '0')}`;
  }

  generateVerifierId(): string {
    const nextId = this.peekNextVerifierId();
    const num = parseInt(nextId.replace(/^ticket/i, ''), 10);
    this.setStorage('verifier_counter', num + 1);
    return nextId;
  }

  generateTicketSerial(): string {
    const counter = this.getStorage<number>('hall_ticket_counter', 0);
    this.setStorage('hall_ticket_counter', counter + 1);
    return `EAU-TKT-${(counter + 1).toString().padStart(6, '0')}`;
  }

  generateQrToken(serialNumber?: string, studentId?: string, ticketId?: string): string {
    const rawToken = `EAU-QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    if (serialNumber) {
      return JSON.stringify({
        serialNumber,
        ticketId: ticketId || '',
        studentId: studentId || '',
        qrToken: rawToken
      });
    }
    return rawToken;
  }

  getVerificationLogs(): TicketVerificationLog[] {
    return this.getStorage<TicketVerificationLog[]>('verification_logs', []);
  }

  addVerificationLog(log: Omit<TicketVerificationLog, 'id' | 'verifiedAt'>): void {
    const logs = this.getVerificationLogs();
    logs.unshift({
      ...log,
      id: `LOG-${Date.now()}`,
      verifiedAt: new Date().toISOString()
    });
    this.setStorage('verification_logs', logs);
  }

  // Super Admin: Admin Management
  getAdmins(): AdminUser[] {
    const defaultAdmins: AdminUser[] = [
      {
        id: 'admin',
        name: 'System Legacy Admin',
        phoneNumber: '+252000000000',
        password: 'admin123',
        isSuspended: false,
        role: UserRole.ADMIN,
        mustChangePassword: false
      }
    ];
    return this.getStorage<AdminUser[]>('admins', defaultAdmins);
  }

  getSuperAdminPassword(): string {
    return this.getStorage<string>('super_admin_pass', 'super123');
  }

  updateSuperAdminPassword(newPassword: string): void {
    this.setStorage('super_admin_pass', newPassword);
  }

  findAdminById(id: string): AdminUser | undefined {
    if (id.toLowerCase() === 'superadmin') {
      return {
        id: 'superadmin',
        name: 'Super Administrator',
        phoneNumber: '+252000000000',
        password: this.getSuperAdminPassword(),
        isSuspended: false,
        role: UserRole.SUPER_ADMIN
      };
    }
    return this.getAdmins().find(a => a.id === id);
  }

  updateAdminHeartbeat(id: string): void {
    if (id === 'superadmin' || id === 'admin') {
      const status = this.getStorage<Record<string, string>>('system_admins_status', {});
      status[id] = new Date().toISOString();
      this.setStorage('system_admins_status', status);
      return;
    }
    const admins = this.getAdmins().map(a => a.id === id ? { ...a, lastSeen: new Date().toISOString() } : a);
    this.setStorage('admins', admins);
  }

  setAdminOffline(id: string): void {
    if (id === 'superadmin' || id === 'admin') {
      const status = this.getStorage<Record<string, string>>('system_admins_status', {});
      delete status[id];
      this.setStorage('system_admins_status', status);
      return;
    }
    const admins = this.getAdmins().map(a => a.id === id ? { ...a, lastSeen: undefined } : a);
    this.setStorage('admins', admins);
  }

  getAdminStatus(id: string): string | undefined {
    if (id === 'superadmin' || id === 'admin') {
      const status = this.getStorage<Record<string, string>>('system_admins_status', {});
      return status[id];
    }
    return this.findAdminById(id)?.lastSeen;
  }

  addAdmin(admin: AdminUser): void {
    const admins = this.getAdmins();
    admins.push(admin);
    this.setStorage('admins', admins);
    this.addAuditLog({
      action: 'CREATE_ADMIN',
      actorId: 'superadmin',
      targetId: admin.id,
      details: `Admin account "${admin.id}" created with default credentials.`
    });
  }

  updateAdmin(updated: AdminUser): void {
    const admins = this.getAdmins().map(a => a.id === updated.id ? updated : a);
    this.setStorage('admins', admins);
  }

  deleteAdmin(id: string): void {
    const admins = this.getAdmins().filter(a => a.id !== id);
    this.setStorage('admins', admins);
    this.addAuditLog({
      action: 'DELETE_ADMIN',
      actorId: 'superadmin',
      targetId: id,
      details: `Admin account "${id}" permanently purged.`
    });
  }

  resetAdminPassword(id: string): void {
    const admins = this.getAdmins().map(a => 
      a.id === id ? { ...a, password: 'pass12345', mustChangePassword: true } : a
    );
    this.setStorage('admins', admins);
    this.addAuditLog({
      action: 'RESET_ADMIN_PASSWORD',
      actorId: 'superadmin',
      targetId: id,
      details: `Admin "${id}" password reset to default. Forced rotation enabled.`
    });
  }

  toggleAdminSuspension(id: string): void {
    const admins = this.getAdmins().map(a => 
      a.id === id ? { ...a, isSuspended: !a.isSuspended } : a
    );
    this.setStorage('admins', admins);
  }

  getExams(): Exam[] {
    return this.getStorage<Exam[]>('exams', INITIAL_EXAMS);
  }

  getFaculties(): Faculty[] {
    return this.getStorage<Faculty[]>('faculties', []);
  }

  getAcademicYears(): AcademicYearConfig[] {
    return this.getStorage<AcademicYearConfig[]>('academic_years', []);
  }

  getPayments(): Payment[] {
    return this.getStorage<Payment[]>('payments', []);
  }

  getAuditLogs(): AuditLog[] {
    return this.getStorage<AuditLog[]>('audit_logs', []);
  }

  getHallTickets(): HallTicket[] {
    const tickets = this.getStorage<HallTicket[]>('hall_tickets', []);
    let modified = false;
    for (const t of tickets) {
      if (!t.serialNumber) {
        t.serialNumber = this.generateTicketSerial();
        modified = true;
      }
      if (!t.qrToken) {
        t.qrToken = this.generateQrToken(t.serialNumber, t.studentId, t.id);
        modified = true;
      }
      if (!t.status) {
        t.status = 'ACTIVE';
        modified = true;
      }
    }
    if (modified) {
      this.setStorage('hall_tickets', tickets);
    }
    return tickets;
  }

  getSecurityAlerts(): SecurityAlert[] {
    return this.getStorage<SecurityAlert[]>('security_alerts', []);
  }

  getPaymentSettings(): PaymentSettings {
    return this.getStorage<PaymentSettings>('payment_settings', {
      allowCard: true,
      allowMobile: true,
      allowBank: true
    });
  }

  getScholarships(): Scholarship[] {
    const list = this.getStorage<Scholarship[]>('scholarships', []);
    return list.map(s => ({
      ...s,
      categories: Array.isArray(s.categories) ? s.categories : ['Exam'],
      startDate: s.startDate || new Date().toISOString()
    }));
  }

  getNotifications(userId: string): Notification[] {
    const all = this.getStorage<Notification[]>('notifications', []);
    return all.filter(n => n.userId === userId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): void {
    const notifications = this.getStorage<Notification[]>('notifications', []);
    notifications.push({
      ...notification,
      id: `NOTIF-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      isRead: false
    });
    this.setStorage('notifications', notifications);
  }

  sendTargetedNotification(criteria: { faculty?: string, semester?: string }, message: { title: string, message: string, type: Notification['type'] }): void {
    const students = this.getStudents();
    const targets = students.filter(s => {
      if (criteria.faculty && s.faculty !== criteria.faculty) return false;
      if (criteria.semester && s.semester !== criteria.semester) return false;
      return true;
    });

    targets.forEach(student => {
      this.addNotification({
        userId: student.id,
        ...message
      });
    });
  }

  markNotificationRead(id: string): void {
    const all = this.getStorage<Notification[]>('notifications', []);
    const updated = all.map(n => n.id === id ? { ...n, isRead: true } : n);
    this.setStorage('notifications', updated);
  }

  addFaculty(faculty: Faculty): void {
    const f = this.getFaculties();
    f.push(faculty);
    this.setStorage('faculties', f);
  }

  updateFaculty(updated: Faculty): void {
    const f = this.getFaculties().map(item => item.id === updated.id ? updated : item);
    this.setStorage('faculties', f);
  }

  saveAcademicYear(config: AcademicYearConfig): void {
    const ays = this.getAcademicYears();
    const index = ays.findIndex(a => a.id === config.id);
    if (index > -1) ays[index] = config;
    else ays.push(config);
    this.setStorage('academic_years', ays);
    this.processAcademicYearToggles(config);
  }

  private processAcademicYearToggles(config: AcademicYearConfig) {
    const exams = this.getExams();
    const students = this.getStudents();
    const totalAyFee = Number(config.fee) || 0;

    let anySubOpen = false;

    const processSub = (semNum: number, assessmentName: string, sub: any) => {
      if (!sub) return;
      const examId = `AY_${config.id}_S${semNum}_${assessmentName}`;
      
      let subFee = 0;
      if (sub.fee !== undefined && sub.fee !== null && Number(sub.fee) > 0) {
        subFee = Number(sub.fee);
      } else if (totalAyFee > 0) {
        if (sub.percentage && sub.percentage > 0) {
          subFee = Math.round(totalAyFee * (sub.percentage / 100) * 100) / 100;
        } else {
          subFee = totalAyFee;
        }
      }

      const dynamicName = `${config.name} Academic Year Fee - Semester ${semNum} ${assessmentName} (${sub.percentage || 100}%)`;

      if (sub.isOpen) {
        anySubOpen = true;
        const existingExam = exams.find(e => e.id === examId);
        const examObj: Exam = existingExam || {
          id: examId,
          name: dynamicName,
          session: config.name,
          fee: subFee > 0 ? subFee : totalAyFee, 
          dates: sub.createdDate || new Date().toISOString(),
          expiryDate: sub.expireDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          venue: 'The Finance Office of East Africa University',
          targetAcademicYear: config.name,
          targetFaculty: config.targetFaculty || 'ALL',
          targetDepartment: config.targetDepartment || 'ALL',
          targetSemester: config.targetSemester || (semNum === 1 ? '1st Semester' : '2nd Semester'),
          targetProgram: config.targetProgram || 'ALL',
          targetStudentId: config.targetStudentId || 'ALL',
          isPercentageBased: false,
          percentageValue: sub.percentage || 0
        };
        
        examObj.fee = subFee > 0 ? subFee : totalAyFee; 
        examObj.name = dynamicName;
        examObj.expiryDate = sub.expireDate || examObj.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        examObj.dates = sub.createdDate || examObj.dates || new Date().toISOString();
        examObj.targetAcademicYear = config.name;
        examObj.targetFaculty = config.targetFaculty || 'ALL';
        examObj.targetDepartment = config.targetDepartment || 'ALL';
        examObj.targetSemester = config.targetSemester || examObj.targetSemester || 'ALL';
        examObj.targetProgram = config.targetProgram || 'ALL';
        examObj.targetStudentId = config.targetStudentId || 'ALL';
        examObj.isPercentageBased = false;
        examObj.percentageValue = sub.percentage || 0;

        if (!existingExam) exams.push(examObj);
        else {
          const idx = exams.findIndex(e => e.id === examId);
          exams[idx] = examObj;
        }

        students.forEach(s => {
          if (!s.examEligibility) s.examEligibility = [];
          if (this.isStudentEligibleForExam(examObj, s)) {
            if (!s.examEligibility.includes(examId) && !(s.processedExams || []).includes(examId)) {
              s.examEligibility.push(examId);
            }
          } else {
            const hasPaid = this.getPayments().some(p => p.studentId === s.id && p.examId === examId);
            if (!hasPaid) {
              s.examEligibility = s.examEligibility.filter(id => id !== examId);
            }
          }
        });
      } else {
        students.forEach(s => {
          if (!s.examEligibility) s.examEligibility = [];
          const hasPaid = this.getPayments().some(p => p.studentId === s.id && p.examId === examId);
          if (!hasPaid) {
            s.examEligibility = s.examEligibility.filter(id => id !== examId);
          }
        });
      }
    };

    if (config.semester1) {
      if (config.semester1.quiz) processSub(1, 'Quiz', config.semester1.quiz);
      if (config.semester1.midterm) processSub(1, 'Midterm', config.semester1.midterm);
      if (config.semester1.final) processSub(1, 'Final', config.semester1.final);
    }
    if (config.semester2) {
      if (config.semester2.quiz) processSub(2, 'Quiz', config.semester2.quiz);
      if (config.semester2.midterm) processSub(2, 'Midterm', config.semester2.midterm);
      if (config.semester2.final) processSub(2, 'Final', config.semester2.final);
    }

    const primaryExamId = `AY_${config.id}_PRIMARY`;
    if (!anySubOpen && (config.isActive !== false) && totalAyFee > 0) {
      const primaryName = `${config.name} Academic Year Fee`;
      const existingPrimary = exams.find(e => e.id === primaryExamId);
      const primaryObj: Exam = existingPrimary || {
        id: primaryExamId,
        name: primaryName,
        session: config.name,
        fee: totalAyFee,
        dates: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'The Finance Office of East Africa University',
        targetAcademicYear: config.name,
        targetFaculty: config.targetFaculty || 'ALL',
        targetDepartment: config.targetDepartment || 'ALL',
        targetSemester: config.targetSemester || 'ALL',
        targetProgram: config.targetProgram || 'ALL',
        targetStudentId: config.targetStudentId || 'ALL',
        isPercentageBased: false,
        percentageValue: 0
      };
      primaryObj.fee = totalAyFee;
      primaryObj.name = primaryName;
      primaryObj.targetAcademicYear = config.name;
      primaryObj.targetFaculty = config.targetFaculty || 'ALL';
      primaryObj.targetDepartment = config.targetDepartment || 'ALL';
      primaryObj.targetSemester = config.targetSemester || 'ALL';
      primaryObj.targetProgram = config.targetProgram || 'ALL';
      primaryObj.targetStudentId = config.targetStudentId || 'ALL';

      if (!existingPrimary) exams.push(primaryObj);
      else {
        const idx = exams.findIndex(e => e.id === primaryExamId);
        exams[idx] = primaryObj;
      }

      students.forEach(s => {
        if (!s.examEligibility) s.examEligibility = [];
        if (this.isStudentEligibleForExam(primaryObj, s)) {
          if (!s.examEligibility.includes(primaryExamId) && !(s.processedExams || []).includes(primaryExamId)) {
            s.examEligibility.push(primaryExamId);
          }
        } else {
          const hasPaid = this.getPayments().some(p => p.studentId === s.id && p.examId === primaryExamId);
          if (!hasPaid) {
            s.examEligibility = s.examEligibility.filter(id => id !== primaryExamId);
          }
        }
      });
    } else if (anySubOpen) {
      const hasPaid = this.getPayments().some(p => p.examId === primaryExamId);
      if (!hasPaid) {
        const pIdx = exams.findIndex(e => e.id === primaryExamId);
        if (pIdx > -1) exams.splice(pIdx, 1);
        students.forEach(s => {
          if (s.examEligibility) {
            s.examEligibility = s.examEligibility.filter(id => id !== primaryExamId);
          }
        });
      }
    }

    this.setStorage('exams', exams);
    this.setStorage('students', students);
    this.syncImmediately();
  }

  addScholarship(scholarship: Scholarship): void {
    const s = this.getScholarships();
    s.push(scholarship);
    this.setStorage('scholarships', s);
    this.addAuditLog({
      action: 'CREATE_SCHOLARSHIP',
      actorId: 'admin',
      targetId: scholarship.id,
      details: `Scholarship "${scholarship.name}" created (${scholarship.type}: ${scholarship.value})`
    });
  }

  assignScholarshipToStudent(studentId: string, scholarshipId: string): void {
    const student = this.findStudentById(studentId);
    if (!student) return;
    
    const scholarships = student.scholarships || [];
    if (scholarships.find(s => s.scholarshipId === scholarshipId)) return;
    
    const updatedStudent = {
      ...student,
      scholarships: [...scholarships, { scholarshipId, awardDate: new Date().toISOString() }]
    };
    
    this.updateStudent(updatedStudent);
    this.addAuditLog({
      action: 'ASSIGN_SCHOLARSHIP',
      actorId: 'admin',
      targetId: studentId,
      details: `Scholarship ID "${scholarshipId}" assigned to student ${studentId}`
    });
  }

  removeScholarshipFromStudent(studentId: string, scholarshipId: string): void {
    const student = this.findStudentById(studentId);
    if (!student) return;
    
    const scholarships = (student.scholarships || []).filter(s => s.scholarshipId !== scholarshipId);
    const updatedStudent = {
      ...student,
      scholarships
    };
    
    this.updateStudent(updatedStudent);
    this.addAuditLog({
      action: 'REMOVE_SCHOLARSHIP',
      actorId: 'admin',
      targetId: studentId,
      details: `Scholarship ID "${scholarshipId}" removed from student ${studentId}`
    });
  }

  calculateDiscountedFee(exam: Exam, student: Student): { original: number, discount: number, final: number, scholarshipName?: string } {
    let original = Number(exam.fee) || 0;
    let baseFee = original;

    if (exam.isPercentageBased || exam.id.startsWith('AY_')) {
      if (baseFee <= 0) {
        const faculties = this.getFaculties();
        const studentFacultyStr = (student.faculty || "").trim().toLowerCase();
        const faculty = faculties.find(f => (f.name || "").trim().toLowerCase() === studentFacultyStr);
        baseFee = faculty ? Number(faculty.fee) : 0;
      }
      
      let percentage = exam.percentageValue || 0;
      if (!percentage && exam.id.startsWith('AY_')) {
        const match = exam.name.match(/(\d+)%/);
        percentage = match ? parseInt(match[1]) : 100;
      }
      if (!percentage) percentage = 100;

      const feePortion = (exam.fee > 0 && (!exam.percentageValue || exam.percentageValue === 100))
        ? exam.fee
        : (baseFee * (percentage / 100));

      const discountedBase = this.calculateDiscountedTotal(feePortion, student, exam.dates);
      const discount = Math.max(0, feePortion - discountedBase.final);

      return { 
        original: feePortion, 
        discount: discount, 
        final: discountedBase.final, 
        scholarshipName: discountedBase.scholarshipName 
      };
    }

    if (!student.scholarships || student.scholarships.length === 0) {
      return { original: baseFee, discount: 0, final: baseFee };
    }

    const allScholarships = this.getScholarships();
    const now = new Date();
    const examDate = new Date(exam.dates);

    const applicable = allScholarships.filter(s => {
      const assignment = student.scholarships?.find(ss => ss.scholarshipId === s.id);
      if (!assignment) return false;

      return (s.categories || []).includes('Exam') &&
        new Date(s.startDate) <= now &&
        (!s.endDate || new Date(s.endDate) >= now) &&
        examDate >= new Date(s.startDate) &&
        examDate >= new Date(assignment.awardDate);
    });

    if (applicable.length === 0) return { original, discount: 0, final: original };

    let maxDiscount = 0;
    let appliedS: Scholarship | null = null;

    applicable.forEach(s => {
      let currentDiscount = 0;
      if (s.type === ScholarshipType.FULL) {
        currentDiscount = original;
      } else if (s.type === ScholarshipType.PERCENTAGE) {
        currentDiscount = original * (s.value / 100);
      } else if (s.type === ScholarshipType.FIXED) {
        currentDiscount = Math.min(original, s.value);
      }
      
      if (currentDiscount >= maxDiscount) {
        maxDiscount = currentDiscount;
        appliedS = s;
      }
    });

    return {
      original,
      discount: maxDiscount,
      final: Math.max(0, original - maxDiscount),
      scholarshipName: appliedS ? appliedS.name : undefined
    };
  }

  private calculateDiscountedTotal(base: number, student: Student, referenceDate: string = new Date().toISOString()) {
    if (!student.scholarships || student.scholarships.length === 0) {
      return { final: base };
    }
    const allScholarships = this.getScholarships();
    const now = new Date();
    const refDate = new Date(referenceDate);

    const applicable = allScholarships.filter(s => {
      const assignment = student.scholarships?.find(ss => ss.scholarshipId === s.id);
      if (!assignment) return false;

      return (s.categories || []).includes('Exam') &&
        new Date(s.startDate) <= now &&
        (!s.endDate || new Date(s.endDate) >= now) &&
        refDate >= new Date(s.startDate) &&
        refDate >= new Date(assignment.awardDate);
    });

    let maxDiscount = 0;
    let appliedS: Scholarship | null = null;
    applicable.forEach(s => {
      let d = 0;
      if (s.type === ScholarshipType.FULL) d = base;
      else if (s.type === ScholarshipType.PERCENTAGE) d = base * (s.value / 100);
      else if (s.type === ScholarshipType.FIXED) d = Math.min(base, s.value);
      if (d >= maxDiscount) { maxDiscount = d; appliedS = s; }
    });
    return { final: Math.max(0, base - maxDiscount), scholarshipName: appliedS?.name };
  }

  updatePaymentSettings(settings: PaymentSettings): void {
    this.setStorage('payment_settings', settings);
  }

  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog);
    this.setStorage('audit_logs', logs);
  }

  updateStudent(student: Student): void {
    const students = this.getStorage<Student[]>('students', INITIAL_STUDENTS);
    const updated = students.map(s => s.id === student.id ? { ...s, ...student } : s);
    this.setStorage('students', updated);
  }

  addStudent(student: Student): void {
    const students = this.getStorage<Student[]>('students', INITIAL_STUDENTS);
    const existingIndex = students.findIndex(s => s.id === student.id);
    
    const allExams = this.getExams();
    const eligibleExamIds = allExams
      .filter(ex => this.isStudentEligibleForExam(ex, student))
      .map(ex => ex.id);
    
    const mergedEligibility = Array.from(new Set([...(student.examEligibility || []), ...eligibleExamIds]));

    const preparedStudent: Student = {
      ...student,
      examEligibility: mergedEligibility,
      passwordChangeCount: student.passwordChangeCount || 0,
      processedExams: student.processedExams || [],
      scholarships: student.scholarships || [],
      loans: student.loans || [],
      createdAt: student.createdAt || new Date().toISOString()
    };
    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...preparedStudent };
    } else {
      students.push(preparedStudent);
    }
    this.setStorage('students', students);
  }

  deleteStudent(id: string): void {
    const students = this.getStudents().map(s => 
      s.id === id ? { ...s, status: AccountStatus.DELETED, deletionTimestamp: new Date().toISOString() } : s
    );
    this.setStorage('students', students);
    
    this.addAuditLog({
      action: 'SOFT_DELETE_STUDENT',
      actorId: 'admin',
      targetId: id,
      details: 'Student marked as deleted. 30-day retention period started.'
    });
  }

  restoreStudent(id: string): void {
    const students = this.getStudents().map(s => 
      s.id === id ? { ...s, status: AccountStatus.ACTIVE, deletionTimestamp: undefined, failedAttempts: 0 } : s
    );
    this.setStorage('students', students);
  }

  resetStudentPassword(id: string): void {
    const students = this.getStudents().map(s => 
      s.id === id ? { ...s, password: '000000', passwordHash: '', hasChangedPassword: false, passwordChangeCount: 0, passwordResetByAdmin: true, failedAttempts: 0 } : s
    );
    this.setStorage('students', students);
  }

  deleteExam(id: string): void {
    const exams = this.getExams().filter(e => e.id !== id);
    this.setStorage('exams', exams);
    
    const students = this.getStudents().map(s => ({
      ...s,
      examEligibility: (s.examEligibility || []).filter(eid => eid !== id),
      processedExams: (s.processedExams || []).filter(eid => eid !== id)
    }));
    this.setStorage('students', students);
  }

  updateExam(updatedExam: Exam): void {
    const exams = this.getExams().map(e => e.id === updatedExam.id ? updatedExam : e);
    this.setStorage('exams', exams);

    const students = this.getStudents().map(s => {
      if (this.isStudentEligibleForExam(updatedExam, s)) {
        return {
          ...s,
          examEligibility: Array.from(new Set([...(s.examEligibility || []), updatedExam.id]))
        };
      } else {
        // Option to remove if not paid could be added, but for now we just don't blindly add.
        return s;
      }
    });
    this.setStorage('students', students);
  }

  addExam(exam: Exam): void {
    const exams = this.getExams();
    exams.push(exam);
    this.setStorage('exams', exams);

    const students = this.getStudents().map(s => {
      if (this.isStudentEligibleForExam(exam, s)) {
         return {
           ...s,
           examEligibility: Array.from(new Set([...(s.examEligibility || []), exam.id]))
         };
      }
      return s;
    });
    this.setStorage('students', students);
  }

  clearStudentPayments(studentId: string): void {
    const payments = this.getPayments().filter(p => p.studentId !== studentId);
    this.setStorage('payments', payments);
  }

  clearStudentTickets(studentId: string): void {
    const tickets = this.getHallTickets().filter(t => t.studentId !== studentId);
    this.setStorage('hall_tickets', tickets);
  }

  removeStudentFee(studentId: string, examId: string): void {
    const student = this.findStudentById(studentId);
    if (!student) return;
    const updated = {
      ...student,
      examEligibility: (student.examEligibility || []).filter(id => id !== examId),
      processedExams: (student.processedExams || []).filter(id => id !== examId)
    };
    this.updateStudent(updated);
  }

  removeStudentFees(studentId: string, examIds: string[]): void {
    const student = this.findStudentById(studentId);
    if (!student) return;
    const updated = {
      ...student,
      examEligibility: (student.examEligibility || []).filter(id => !examIds.includes(id)),
      processedExams: (student.processedExams || []).filter(id => !examIds.includes(id))
    };
    this.updateStudent(updated);
  }

  isPaymentSettledOrPartial(status: any): boolean {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return s === 'paid' || s === 'partial' || s === PaymentStatus.PAID || s === PaymentStatus.PARTIAL;
  }

  addPayment(payment: Payment): void {
    const exam = this.getExams().find(e => e.id === payment.examId);
    if (exam && this.isExamExpiredOrPast(exam) && !payment.id.startsWith('TXN-BAL')) {
      throw new Error(`Payment rejected: Fee ${exam.name || exam.id} is a Past/Expired Fee and is View-Only. Direct payments are disabled for past fees.`);
    }

    const payments = this.getPayments();
    payments.push(payment);
    this.setStorage('payments', payments);
    this.syncImmediately();

    // Automatically generate hall ticket instantly for active exam payments (full or partial)
    if (payment.examId && payment.examId !== 'BALANCE_CLEARANCE' && exam && !this.isExamExpiredOrPast(exam)) {
      const existingTickets = this.getHallTickets();
      const hasTicket = existingTickets.some(t => t.studentId === payment.studentId && t.examId === payment.examId);
      if (!hasTicket) {
        this.createHallTicket(payment.studentId, payment.examId, payment.id);
      }
    }

    // If fully paid, clear any temporary loan authorization
    const student = this.findStudentById(payment.studentId);
    if (student && student.loanConfig && student.loanConfig.examId === payment.examId) {
      const exam = this.getExams().find(e => e.id === payment.examId);
      const totalPaidForExam = payments
        .filter(p => p.studentId === student.id && p.examId === payment.examId && this.isPaymentSettledOrPartial(p.status))
        .reduce((sum, p) => sum + p.amount, 0);
      const { final } = exam ? this.calculateDiscountedFee(exam, student) : { final: payment.amount };
      if (totalPaidForExam >= final) {
        this.updateStudent({
          ...student,
          loanConfig: undefined
        });
      }
    }
  }

  getFeeRemovalRequests(): FeeRemovalRequest[] {
    return this.getStorage<FeeRemovalRequest[]>('fee_removal_requests', []);
  }

  addFeeRemovalRequest(req: FeeRemovalRequest): void {
    const list = this.getFeeRemovalRequests();
    list.push(req);
    this.setStorage('fee_removal_requests', list);
    
    this.addAuditLog({
      action: 'REMOVE_REQUESTED',
      actorId: req.requestedBy,
      targetId: req.studentId,
      details: `Requested removal of "${req.examName}" ($${req.amount}) for student ${req.studentName}. Awaiting Super Admin review.`
    });
  }

  approveFeeRemovalRequest(id: string): void {
    const list = this.getFeeRemovalRequests();
    const req = list.find(r => r.id === id);
    if (req) {
      req.status = 'APPROVED';
      this.setStorage('fee_removal_requests', list);
      
      this.removeStudentFee(req.studentId, req.examId);
      
      this.addPayment({
        id: `REM-${Date.now()}`,
        studentId: req.studentId,
        examId: req.examId,
        amount: req.amount,
        status: '(removed...)' as any,
        transactionId: `TRX-REM-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: `(admin_removed:$${req.amount.toLocaleString()})`,
        adminId: req.requestedBy
      });

      this.addAuditLog({
        action: 'REMOVE_APPROVED',
        actorId: 'superadmin',
        targetId: req.studentId,
        details: `Super Admin approved removal of "${req.examName}" for student ${req.studentName}.`
      });
    }
  }

  rejectFeeRemovalRequest(id: string): void {
    const list = this.getFeeRemovalRequests();
    const req = list.find(r => r.id === id);
    if (req) {
      req.status = 'REJECTED';
      this.setStorage('fee_removal_requests', list);
      
      this.addAuditLog({
        action: 'REMOVE_REJECTED',
        actorId: 'superadmin',
        targetId: req.studentId,
        details: `Super Admin rejected removal of "${req.examName}" for student ${req.studentName}.`
      });
    }
  }

  addHallTicket(ticket: HallTicket): void {
    if (!ticket.serialNumber) {
      ticket.serialNumber = this.generateTicketSerial();
    }
    if (!ticket.qrToken) {
      ticket.qrToken = this.generateQrToken(ticket.serialNumber, ticket.studentId, ticket.id);
    }
    if (!ticket.status) {
      ticket.status = 'ACTIVE';
    }
    if (!ticket.createdAt) {
      ticket.createdAt = new Date().toISOString();
    }
    const tickets = this.getHallTickets();
    const existingIdx = tickets.findIndex(t => t.id === ticket.id || (ticket.serialNumber && t.serialNumber === ticket.serialNumber));
    if (existingIdx >= 0) {
      tickets[existingIdx] = { ...tickets[existingIdx], ...ticket };
    } else {
      tickets.push(ticket);
    }
    this.setStorage('hall_tickets', tickets);
    this.syncImmediately();
  }

  createHallTicket(studentId: string, examId: string, paymentId: string): HallTicket {
    const serialNumber = this.generateTicketSerial();
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const qrToken = this.generateQrToken(serialNumber, studentId, ticketId);
    const ticket: HallTicket = {
      id: ticketId,
      studentId,
      examId,
      paymentId,
      createdAt,
      qrToken,
      status: 'ACTIVE',
      serialNumber
    };
    this.addHallTicket(ticket);
    return ticket;
  }

  findStudentById(id: string): Student | undefined {
    if (!id) return undefined;
    const query = id.trim().toUpperCase();
    return this.getStudents().find(s => s.id && s.id.toUpperCase() === query);
  }

  searchStudents(query: string): Student[] {
    const q = (query || '').trim().toUpperCase();
    if (!q) return [];
    return this.getStudents().filter(s => 
      s.status !== AccountStatus.DELETED && 
      ((s.id && s.id.toUpperCase().includes(q)) || (s.name && s.name.toUpperCase().includes(q)))
    );
  }

  isStudentEligibleForExam(exam: Exam, student: Student): boolean {
    if (exam.targetStudentId && exam.targetStudentId !== 'ALL' && exam.targetStudentId.trim() !== '') {
       if (student.id.trim().toUpperCase() !== exam.targetStudentId.trim().toUpperCase()) return false;
       return true;
    }
    if (exam.targetAcademicYear && exam.targetAcademicYear !== 'ALL' && exam.targetAcademicYear.trim() !== '') {
       const studentAY = (student.academicYear || "").trim().toLowerCase();
       const examAY = exam.targetAcademicYear.trim().toLowerCase();
       if (studentAY && studentAY !== examAY) return false;
    }
    if (exam.targetProgram && exam.targetProgram !== 'ALL' && exam.targetProgram.trim() !== '') {
       const studentProg = (student.program || '').trim().toLowerCase();
       const examProg = exam.targetProgram.trim().toLowerCase();
       if (studentProg && examProg && studentProg !== examProg) return false;
    }
    if (exam.targetFaculty && exam.targetFaculty !== 'ALL' && exam.targetFaculty.trim() !== '') {
       const studentFaculty = (student.faculty || '').trim().toLowerCase();
       const examFaculty = exam.targetFaculty.trim().toLowerCase();
       if (studentFaculty && examFaculty && studentFaculty !== examFaculty) return false;
    }
    if (exam.targetDepartment && exam.targetDepartment !== 'ALL' && exam.targetDepartment.trim() !== '') {
       const studentDepartment = (student.department || '').trim().toLowerCase();
       const examDepartment = exam.targetDepartment.trim().toLowerCase();
       if (studentDepartment && examDepartment && studentDepartment !== examDepartment) return false;
    }
    if (exam.targetSemester && exam.targetSemester !== 'ALL' && exam.targetSemester.trim() !== '') {
       const studentSemester = (student.semester || '').trim().toLowerCase();
       const examSemester = exam.targetSemester.trim().toLowerCase();
       if (studentSemester && examSemester && studentSemester !== examSemester) {
         const normS = studentSemester.replace(/[^0-9]/g, '');
         const normE = examSemester.replace(/[^0-9]/g, '');
         if (normS && normE && normS !== normE) return false;
       }
    }
    
    // Legacy fields fallback
    if (exam.facultyId && (!exam.targetFaculty || exam.targetFaculty === 'ALL')) {
      const studentFaculty = (student.faculty || '').trim().toLowerCase();
      const examFaculty = exam.facultyId.trim().toLowerCase();
      if (studentFaculty && examFaculty && studentFaculty !== examFaculty) {
        return false;
      }
    }
    if (exam.semester && (!exam.targetSemester || exam.targetSemester === 'ALL')) {
      const studentSemester = (student.semester || '').trim().toLowerCase();
      const examSemester = exam.semester.trim().toLowerCase();
      if (studentSemester && examSemester && studentSemester !== examSemester) {
        return false;
      }
    }
    return true;
  }

  getStudentBalance(studentId: string): number {
    const student = this.findStudentById(studentId);
    if (!student) return 0;
    
    const allExams = this.getExams();
    const payments = this.getPayments().filter(p => p.studentId === studentId && this.isPaymentSettledOrPartial(p.status));
    
    const applicableExams = allExams.filter(exam => {
       const isExplicit = (student.examEligibility || []).includes(exam.id) || (student.processedExams || []).includes(exam.id);
       const isDynamic = this.isStudentEligibleForExam(exam, student);
       return isExplicit || isDynamic;
    });

    return applicableExams.reduce((totalDebt, exam) => {
      const { final } = this.calculateDiscountedFee(exam, student);
      
      const paidForThisExam = payments
        .filter(p => p.examId === exam.id)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const balance = Math.max(0, final - paidForThisExam);
      return totalDebt + balance;
    }, 0);
  }

  isExamExpiredOrPast(exam: Exam): boolean {
    if (!exam.expiryDate) return false;
    const expiry = new Date(exam.expiryDate);
    return !isNaN(expiry.getTime()) && Date.now() >= expiry.getTime();
  }

  getStudentActivePayableBalance(studentId: string): number {
    const student = this.findStudentById(studentId);
    if (!student) return 0;
    
    const allExams = this.getExams();
    const payments = this.getPayments().filter(p => p.studentId === studentId && this.isPaymentSettledOrPartial(p.status));
    
    const applicableActiveExams = allExams.filter(exam => {
       if (this.isExamExpiredOrPast(exam)) return false;
       const isExplicit = (student.examEligibility || []).includes(exam.id) || (student.processedExams || []).includes(exam.id);
       const isDynamic = this.isStudentEligibleForExam(exam, student);
       return isExplicit || isDynamic;
    });

    return applicableActiveExams.reduce((total, exam) => {
      const { final } = this.calculateDiscountedFee(exam, student);
      const paid = payments.filter(p => p.examId === exam.id).reduce((s, p) => s + p.amount, 0);
      const isLoan = student.loanConfig?.examId === exam.id;
      const loanAmount = student.loanConfig?.authorizedAmount || 0;
      if (isLoan && paid < loanAmount) {
        return total + Math.max(0, loanAmount - paid);
      }
      if (isLoan && paid >= loanAmount) {
        return total;
      }
      return total + Math.max(0, final - paid);
    }, 0);
  }

  getStudentPastDebt(studentId: string): number {
    const student = this.findStudentById(studentId);
    if (!student) return 0;
    
    const allExams = this.getExams();
    const payments = this.getPayments().filter(p => p.studentId === studentId && this.isPaymentSettledOrPartial(p.status));
    
    const applicablePastExams = allExams.filter(exam => {
       if (!this.isExamExpiredOrPast(exam)) return false;
       const isExplicit = (student.examEligibility || []).includes(exam.id) || (student.processedExams || []).includes(exam.id);
       const hasPaidBefore = payments.some(p => p.examId === exam.id);
       return isExplicit || hasPaidBefore;
    });

    return applicablePastExams.reduce((totalDebt, exam) => {
      const { final } = this.calculateDiscountedFee(exam, student);
      const paidForThisExam = payments
        .filter(p => p.examId === exam.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, final - paidForThisExam);
      return totalDebt + balance;
    }, 0);
  }

  payStudentBalance(studentId: string, amount: number, method: string): Payment[] {
    const student = this.findStudentById(studentId);
    if (!student || amount <= 0) return [];

    const pastDebt = this.getStudentPastDebt(studentId);
    if (amount > pastDebt) {
      throw new Error(`Payment amount $${amount} exceeds outstanding past debt of $${pastDebt}. Balance Left is strictly for past fees.`);
    }

    const allExams = this.getExams();
    const existingPayments = this.getPayments().filter(p => p.studentId === studentId && this.isPaymentSettledOrPartial(p.status));
    
    // Sort past/expired exams by date descending
    const applicablePastExams = allExams.filter(exam => {
       if (!this.isExamExpiredOrPast(exam)) return false;
       const isExplicit = (student.examEligibility || []).includes(exam.id) || (student.processedExams || []).includes(exam.id);
       const isDynamic = this.isStudentEligibleForExam(exam, student);
       return isExplicit || isDynamic;
    }).sort((a, b) => new Date(b.dates || 0).getTime() - new Date(a.dates || 0).getTime());

    let remainingToPay = amount;
    const generatedPayments: Payment[] = [];

    for (const exam of applicablePastExams) {
      if (remainingToPay <= 0) break;

      const { final } = this.calculateDiscountedFee(exam, student);
      const paidForThisExam = existingPayments
        .filter(p => p.examId === exam.id)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const unpaidForThisExam = Math.max(0, final - paidForThisExam);
      if (unpaidForThisExam <= 0) continue;

      const payThis = Math.min(remainingToPay, unpaidForThisExam);
      const isNowFullyPaid = (paidForThisExam + payThis) >= final;

      const newPayment: Payment = {
        id: `TXN-BAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        studentId: student.id,
        examId: exam.id,
        amount: payThis,
        status: isNowFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        transactionId: `EAU-BAL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: method || 'Balance Payment'
      };

      this.addPayment(newPayment);
      generatedPayments.push(newPayment);
      remainingToPay -= payThis;

      // Issue hall ticket for paid past exam so student can view/print ticket immediately
      if (isNowFullyPaid) {
        const tickets = this.getHallTickets();
        const ticketExists = tickets.some(t => t.studentId === student.id && t.examId === exam.id);
        if (!ticketExists) {
          const serialNumber = this.generateTicketSerial();
          const createdAt = new Date().toISOString();
          const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const qrData = {
            serialNumber,
            ticketId,
            studentId: student.id,
            studentName: student.name,
            amount: final,
            createdAt
          };
          this.addHallTicket({
            id: ticketId,
            studentId: student.id,
            examId: exam.id,
            paymentId: newPayment.id,
            createdAt,
            serialNumber,
            qrToken: JSON.stringify(qrData),
            status: 'ACTIVE'
          });
        }
      }
    }

    if (remainingToPay > 0 && generatedPayments.length === 0) {
      const fallbackExamId = applicablePastExams[0]?.id || 'GENERAL_INSTITUTIONAL_DEBT';
      const newPayment: Payment = {
        id: `TXN-BAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        studentId: student.id,
        examId: fallbackExamId,
        amount: remainingToPay,
        status: PaymentStatus.PAID,
        transactionId: `EAU-BAL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: method || 'Balance Payment'
      };
      this.addPayment(newPayment);
      generatedPayments.push(newPayment);
    }

    this.syncImmediately();
    return generatedPayments;
  }

  getEnrichedPartialPayments(): Array<{
    id: string;
    transactionId: string;
    studentId: string;
    studentName: string;
    paymentType: string;
    feeType: string;
    feeId: string;
    feeName: string;
    academicYear: string;
    faculty: string;
    semester: string;
    originalFee: number;
    amountPaid: number;
    totalPaidToDate: number;
    remainingBalance: number;
    paymentMethod: string;
    paymentDate: string;
    paymentTime: string;
    timestamp: string;
    status: string;
    isPartial: boolean;
  }> {
    const allPayments = this.getPayments();
    const allStudents = this.getStudents();
    const allExams = this.getExams();

    const studentMap = new Map(allStudents.map(s => [s.id, s]));
    const examMap = new Map(allExams.map(e => [e.id, e]));

    // Chronological sort
    const chronological = [...allPayments].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const runningTotals: { [key: string]: number } = {};

    const enriched = chronological.map(p => {
      const student = studentMap.get(p.studentId);
      const exam = examMap.get(p.examId);
      const key = `${p.studentId}_${p.examId}`;
      const prevPaid = runningTotals[key] || 0;
      const thisAmount = Number(p.amount) || 0;
      const totalPaidToDate = prevPaid + thisAmount;
      runningTotals[key] = totalPaidToDate;

      const originalFee = exam ? (Number(exam.fee) || 0) : thisAmount;
      const remainingBalance = Math.max(0, originalFee - totalPaidToDate);

      const isAcademicYear =
        (p.examId && p.examId.startsWith('AY_')) ||
        (exam && (
          (exam.name && exam.name.toLowerCase().includes('academic year')) ||
          (exam.name && exam.name.toLowerCase().includes('ay ')) ||
          exam.targetAcademicYear ||
          (exam.session && exam.session.includes('-'))
        ));

      const feeType = isAcademicYear ? 'Academic Year' : 'Standard Fee';
      const academicYear = exam?.targetAcademicYear || exam?.session || student?.academicYear || '2024-2025';
      const faculty = exam?.targetFaculty || student?.faculty || 'General';
      const semester = exam?.targetSemester || student?.semester || 'Semester 1';

      const rawStatus = (p.status || '').toLowerCase();
      const isPartial = rawStatus === 'partial' || remainingBalance > 0;

      const dateObj = new Date(p.timestamp);
      const paymentDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : p.timestamp;
      const paymentTime = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '';

      return {
        id: p.id,
        transactionId: p.transactionId || p.id,
        studentId: p.studentId,
        studentName: student ? student.name : p.studentId,
        paymentType: isPartial ? 'Partial Payment' : 'Full Payment',
        feeType,
        feeId: p.examId,
        feeName: exam ? exam.name : p.examId,
        academicYear,
        faculty,
        semester,
        originalFee,
        amountPaid: thisAmount,
        totalPaidToDate,
        remainingBalance,
        paymentMethod: p.method || 'Card',
        paymentDate,
        paymentTime,
        timestamp: p.timestamp,
        status: isPartial ? 'PARTIAL' : 'PAID',
        isPartial
      };
    });

    return enriched.filter(r => r.isPartial).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  addSecurityAlert(alert: SecurityAlert): void {
    const alerts = this.getSecurityAlerts();
    alerts.unshift(alert);
    this.setStorage('security_alerts', alerts);
  }

  generateStudentId(): string {
    const students = this.getStudents();
    const idPrefix = 'EAUGRW';
    const numericIds = students
      .filter(s => s.id && s.id.startsWith(idPrefix))
      .map(s => parseInt(s.id.replace(idPrefix, ''), 10))
      .filter(num => !isNaN(num));
    const maxIdNum = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    return `${idPrefix}${(maxIdNum + 1).toString().padStart(4, '0')}`;
  }

  getFasCounter(): number {
    return this.getStorage<number>('fas_counter', 0);
  }

  getNextFasNumber(): number {
    const next = this.getFasCounter() + 1;
    this.setStorage('fas_counter', next);
    return next;
  }
}

export const db = new DatabaseService();
