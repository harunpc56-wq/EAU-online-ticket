import { EventEmitter } from 'events';
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import initSqlJs from "sql.js";

async function startServer() {
  const app = express();
const dbEvents = new EventEmitter();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));

  const SQLITE_FILE = path.join(process.cwd(), 'database.sqlite');
  
  // Connect to actual SQLite database file using WebAssembly (sql.js)
  // This circumvents native GLIBC limitations while providing a true SQLite engine.
  const SQL = await initSqlJs();
  let db: any;

  if (fs.existsSync(SQLITE_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(SQLITE_FILE);
      db = new SQL.Database(fileBuffer);
      console.log("Connected to existing SQLite database at:", SQLITE_FILE);
    } catch (err) {
      console.error("Failed to load SQLite file, initializing new one:", err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log("Created new SQLite database.");
  }

  const saveDatabase = () => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(SQLITE_FILE, buffer);
    } catch (err) {
      console.error("Failed to save SQLite database:", err);
    }
  };

  const dbRun = (sql: string, params: any[] = []) => {
    const sanitizedParams = params.map(p => p === undefined ? null : p);
    db.run(sql, sanitizedParams);
    saveDatabase();
  };

  const dbAll = (sql: string, params: any[] = []): any[] => {
    const sanitizedParams = params.map(p => p === undefined ? null : p);
    const stmt = db.prepare(sql);
    stmt.bind(sanitizedParams);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };

  // Bootstrap full relational SQLite schema
  dbRun(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      faculty TEXT,
      department TEXT,
      semester TEXT,
      email TEXT UNIQUE,
      phone_number TEXT,
      phone_number_2 TEXT,
      status TEXT,
      password_hash TEXT,
      password_reset_by_admin INTEGER DEFAULT 0,
      loans TEXT,
      scholarships TEXT,
      program TEXT,
      academic_year TEXT,
      profile_picture TEXT,
      gender TEXT,
      date_of_birth TEXT,
      address TEXT,
      exam_eligibility TEXT,
      has_changed_password INTEGER DEFAULT 0,
      password_change_count INTEGER DEFAULT 0,
      failed_attempts INTEGER DEFAULT 0,
      lockout_timestamp TEXT,
      deletion_timestamp TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number TEXT,
      password TEXT NOT NULL,
      is_suspended INTEGER DEFAULT 0,
      role TEXT,
      must_change_password INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS verifiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fee REAL,
      dates TEXT,
      expiry_date TEXT,
      target_faculty TEXT,
      target_department TEXT,
      target_semester TEXT,
      target_academic_year TEXT,
      target_program TEXT,
      target_student_id TEXT,
      is_percentage_based INTEGER,
      percentage_value REAL
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      exam_id TEXT,
      amount REAL,
      status TEXT,
      transaction_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT
    );
    CREATE TABLE IF NOT EXISTS hall_tickets (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      exam_id TEXT,
      serial_number TEXT UNIQUE,
      qr_token TEXT,
      payment_id TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS verification_logs (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      ticket_serial TEXT,
      verified_by_officer_id TEXT,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      result TEXT,
      reason TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      admin_id TEXT,
      action TEXT,
      details TEXT
    );
    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT,
      description TEXT,
      resolved INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scholarships (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      value REAL,
      student_ids TEXT,
      start_date TEXT,
      end_date TEXT,
      categories TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      message TEXT,
      read INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fee_removal_requests (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      exam_id TEXT,
      reason TEXT,
      status TEXT,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS faculties (
      id TEXT PRIMARY KEY,
      name TEXT,
      fee REAL
    );
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT,
      semester1 TEXT,
      semester2 TEXT,
      active INTEGER
    );
    CREATE TABLE IF NOT EXISTS payment_settings (
      id TEXT PRIMARY KEY,
      allow_card INTEGER,
      allow_mobile INTEGER,
      allow_bank INTEGER
    );
  `);

  // Schema migrations (adding new columns safely if they don't exist)
  try { db.run("ALTER TABLE faculties ADD COLUMN fee REAL"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN scholarships TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN program TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN academic_year TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN phone_number_2 TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN profile_picture TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN gender TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN date_of_birth TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN address TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN exam_eligibility TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN semester1 TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN semester2 TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN fee REAL DEFAULT 0"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN target_faculty TEXT DEFAULT 'ALL'"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN target_department TEXT DEFAULT 'ALL'"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN target_semester TEXT DEFAULT 'ALL'"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN target_program TEXT DEFAULT 'ALL'"); } catch (e) {}
  try { db.run("ALTER TABLE academic_years ADD COLUMN target_student_id TEXT DEFAULT 'ALL'"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN has_changed_password INTEGER DEFAULT 0"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN password_change_count INTEGER DEFAULT 0"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN failed_attempts INTEGER DEFAULT 0"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN lockout_timestamp TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN deletion_timestamp TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE students ADD COLUMN loan_config TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE exams ADD COLUMN target_academic_year TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE exams ADD COLUMN target_program TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE exams ADD COLUMN target_student_id TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE exams ADD COLUMN is_percentage_based INTEGER"); } catch (e) {}
  try { db.run("ALTER TABLE exams ADD COLUMN percentage_value REAL"); } catch (e) {}
  try { db.run("ALTER TABLE scholarships ADD COLUMN start_date TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE scholarships ADD COLUMN end_date TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE scholarships ADD COLUMN categories TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE hall_tickets ADD COLUMN payment_id TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE hall_tickets ADD COLUMN status TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE hall_tickets ADD COLUMN created_at DATETIME"); } catch (e) {}
  try { db.run("ALTER TABLE hall_tickets ADD COLUMN qr_token TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE hall_tickets ADD COLUMN serial_number TEXT"); } catch (e) {}
  try { db.run("ALTER TABLE payments ADD COLUMN method TEXT"); } catch (e) {}

  // Backfill existing tickets missing qr_token or serial_number
  try {
    const existingTicketsWithoutQr = dbAll("SELECT * FROM hall_tickets WHERE qr_token IS NULL OR qr_token = '' OR serial_number IS NULL OR serial_number = ''");
    for (const t of existingTicketsWithoutQr) {
      const serial = t.serial_number || `EAU-TKT-${(t.id || '').replace(/\D/g, '').padStart(6, '0') || '000001'}`;
      const token = JSON.stringify({ serialNumber: serial, ticketId: t.id, studentId: t.student_id, createdAt: t.created_at || new Date().toISOString() });
      dbRun("UPDATE hall_tickets SET qr_token = ?, serial_number = ?, status = COALESCE(status, 'ACTIVE') WHERE id = ?", [token, serial, t.id]);
    }
  } catch (e) {}

  saveDatabase();

  // Initial dummy admin if needed
  const adminCheck = dbAll("SELECT * FROM admins WHERE id = 'admin'");
  if (adminCheck.length === 0) {
    dbRun("INSERT INTO admins (id, name, phone_number, password, role) VALUES ('admin', 'System Legacy Admin', '+252000000000', 'admin123', 'SUPER_ADMIN')");
  }

  // Initial dummy student if needed
  const studentCheck = dbAll("SELECT * FROM students");
  if (studentCheck.length === 0) {
    dbRun("INSERT INTO students (id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, has_changed_password, password_change_count, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['EAUGRW0001', 'Ali Farah', 'Faculty of IT', 'Computer Science', '6th Semester', 'ali.farah@university.edu', '+252610000000', 'ACTIVE', 'EAUGRW0001123', 0, '[]', '[]', '', '', 0, 0, 0]);
    dbRun("INSERT INTO students (id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, has_changed_password, password_change_count, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['EAUGRW0002', 'Sara Ahmed', 'Faculty of Business', 'Business Administration', '4th Semester', 'sara.ahmed@university.edu', '+252611111111', 'ACTIVE', 'EAUGRW0002123', 0, '[]', '[]', '', '', 0, 0, 0]);
  }

  // Initial dummy exam if needed
  const examCheck = dbAll("SELECT * FROM exams");
  if (examCheck.length === 0) {
    dbRun("INSERT INTO exams (id, name, fee, dates, expiry_date) VALUES (?, ?, ?, ?, ?)",
      ['EXAM-2024-SPR', 'Spring Annual Examination 2024', 300, new Date('2026-01-15T09:00:00').toISOString(), new Date('2026-12-31').toISOString()]);
  }

  // API Endpoints for true SQLite database access
  
  app.get("/api/db/stream", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    
    const listener = () => {
      res.write("data: update\n\n");
      if ((res as any).flush) (res as any).flush();
    };
    
    dbEvents.on('update', listener);
    
    req.on('close', () => {
      dbEvents.off('update', listener);
    });
  });

  app.get("/api/db", async (req, res) => {
    try {
      const keys = ["verifier_counter", "hall_ticket_counter", "super_admin_pass", "system_admins_status", "fas_counter"];
      const result: Record<string, any> = {};

      for (const k of keys) {
        const rows = dbAll("SELECT value FROM kv_store WHERE key = ?", [k]);
        if (rows.length > 0) {
          try {
            result[k] = JSON.parse(rows[0].value);
          } catch (e) {
            result[k] = rows[0].value;
          }
        }
      }

      // Read from all SQLite tables
      result.students = dbAll("SELECT * FROM students").map(s => {
        let parsedEligibility: string[] = ['EXAM-2024-SPR'];
        try {
          if (s.exam_eligibility) parsedEligibility = JSON.parse(s.exam_eligibility);
        } catch (e) {}
        let parsedLoanConfig: any = undefined;
        try {
          if (s.loan_config) parsedLoanConfig = JSON.parse(s.loan_config);
        } catch (e) {}
        return {
          ...s, 
          loans: JSON.parse(s.loans || '[]'),
          scholarships: JSON.parse(s.scholarships || '[]'),
          loanConfig: parsedLoanConfig,
          examEligibility: parsedEligibility,
          hasChangedPassword: Boolean(s.has_changed_password),
          passwordChangeCount: s.password_change_count || 0,
          failedAttempts: s.failed_attempts || 0,
          lockoutTimestamp: s.lockout_timestamp || undefined,
          deletionTimestamp: s.deletion_timestamp || undefined
        };
      });
      result.admins = dbAll("SELECT * FROM admins");
      result.verifiers = dbAll("SELECT * FROM verifiers");
      result.exams = dbAll("SELECT * FROM exams");
      result.payments = dbAll("SELECT * FROM payments");
      result.hall_tickets = dbAll("SELECT * FROM hall_tickets");
      result.verification_logs = dbAll("SELECT * FROM verification_logs");
      result.audit_logs = dbAll("SELECT * FROM audit_logs");
      result.security_alerts = dbAll("SELECT * FROM security_alerts");
      result.scholarships = dbAll("SELECT * FROM scholarships");
      result.notifications = dbAll("SELECT * FROM notifications");
      result.fee_removal_requests = dbAll("SELECT * FROM fee_removal_requests");
      result.faculties = dbAll("SELECT * FROM faculties");
      result.academic_years = dbAll("SELECT * FROM academic_years");

      const psRows = dbAll("SELECT * FROM payment_settings LIMIT 1");
      if (psRows.length > 0) {
        result.payment_settings = {
          allowCard: Boolean(psRows[0].allow_card),
          allowMobile: Boolean(psRows[0].allow_mobile),
          allowBank: Boolean(psRows[0].allow_bank)
        };
      } else {
        result.payment_settings = { allowCard: true, allowMobile: true, allowBank: true };
      }

      // Convert underscores to camelCase for the frontend where needed
      const camelCaseMap = (arr: any[]) => arr.map(obj => {
        const newObj: any = {};
        for (const key in obj) {
          const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
          newObj[camelKey] = obj[key];
        }
        if (newObj.passwordHash && !newObj.password) {
          newObj.password = newObj.passwordHash;
        }
        return newObj;
      });

      result.students = camelCaseMap(result.students);
      result.admins = camelCaseMap(result.admins);
      result.verifiers = camelCaseMap(result.verifiers);
      result.exams = camelCaseMap(result.exams).map((e: any) => ({
        ...e,
        isPercentageBased: e.isPercentageBased === 1,
        percentageValue: e.percentageValue || 0
      }));
      result.payments = camelCaseMap(result.payments);
      result.hall_tickets = camelCaseMap(result.hall_tickets);
      result.verification_logs = camelCaseMap(result.verification_logs);
      result.audit_logs = camelCaseMap(result.audit_logs);
      result.security_alerts = camelCaseMap(result.security_alerts);
      result.scholarships = camelCaseMap(result.scholarships).map((sc: any) => ({
        ...sc,
        categories: sc.categories ? (typeof sc.categories === 'string' ? JSON.parse(sc.categories) : sc.categories) : ['Exam'],
        startDate: sc.startDate || sc.start_date || new Date().toISOString(),
        endDate: sc.endDate || sc.end_date || undefined,
        studentIds: sc.studentIds ? (typeof sc.studentIds === 'string' ? JSON.parse(sc.studentIds) : sc.studentIds) : []
      }));
      result.notifications = camelCaseMap(result.notifications);
      result.fee_removal_requests = camelCaseMap(result.fee_removal_requests);
      result.academic_years = camelCaseMap(result.academic_years).map((ay: any) => ({
        ...ay,
        fee: Number(ay.fee) || 0,
        targetFaculty: ay.targetFaculty || 'ALL',
        targetDepartment: ay.targetDepartment || 'ALL',
        targetSemester: ay.targetSemester || 'ALL',
        targetProgram: ay.targetProgram || 'ALL',
        targetStudentId: ay.targetStudentId || 'ALL',
        semester1: typeof ay.semester1 === 'string' && ay.semester1 ? JSON.parse(ay.semester1) : ay.semester1,
        semester2: typeof ay.semester2 === 'string' && ay.semester2 ? JSON.parse(ay.semester2) : ay.semester2,
        isActive: ay.active === 1
      }));

      res.json(result);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  app.post("/api/verify-ticket", async (req, res) => {
    try {
      const { qrToken, verifierId } = req.body;
      if (!qrToken) return res.status(400).json({ error: "No QR token provided" });
      
      let parsedObj: any = null;
      let searchCandidates = [qrToken.toString().trim()];
      try {
        parsedObj = JSON.parse(qrToken);
        if (parsedObj && typeof parsedObj === 'object') {
          if (parsedObj.qrToken) searchCandidates.push(parsedObj.qrToken);
          if (parsedObj.token) searchCandidates.push(parsedObj.token);
          if (parsedObj.serialNumber) searchCandidates.push(parsedObj.serialNumber);
          if (parsedObj.serial) searchCandidates.push(parsedObj.serial);
          if (parsedObj.id) searchCandidates.push(parsedObj.id);
        }
      } catch (e) {
        // Not JSON
      }
      
      let tickets: any[] = [];
      for (const candidate of searchCandidates) {
        tickets = dbAll("SELECT * FROM hall_tickets WHERE qr_token = ? OR serial_number = ? OR id = ?", [candidate, candidate, candidate]);
        if (tickets.length > 0) break;
      }
      
      if (tickets.length === 0) {
        // Fallback: search kv_store in case hall_tickets are synced in JSON kv_store
        const kvRow = dbAll("SELECT value FROM kv_store WHERE key = 'hall_tickets'");
        if (kvRow.length > 0 && kvRow[0].value) {
          try {
            const parsedList = JSON.parse(kvRow[0].value);
            if (Array.isArray(parsedList)) {
              for (const candidate of searchCandidates) {
                const found = parsedList.find((t: any) => 
                  (t.qrToken && t.qrToken === candidate) ||
                  (t.serialNumber && t.serialNumber === candidate) ||
                  (t.id && t.id === candidate)
                );
                if (found) {
                  tickets = [{
                    id: found.id || `TKT-${found.serialNumber}`,
                    student_id: found.studentId,
                    exam_id: found.examId,
                    payment_id: found.paymentId,
                    serial_number: found.serialNumber,
                    qr_token: found.qrToken,
                    created_at: found.createdAt || new Date().toISOString(),
                    status: found.status || 'ACTIVE'
                  }];
                  break;
                }
              }
            }
          } catch (e) {
            // Ignore parse error
          }
        }
      }

      if (tickets.length === 0) {
        dbRun("INSERT INTO verification_logs (id, ticket_id, ticket_serial, verified_by_officer_id, verified_at, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
           [`LOG-${Date.now()}`, 'UNKNOWN', qrToken.toString().slice(0, 30), verifierId || 'unknown', new Date().toISOString(), 'INVALID', 'NOT_FOUND']
        );
        saveDatabase();
        return res.json({ valid: false, reason: "The QR code is invalid, expired or does not exist." });
      }
      
      const ticket = tickets[0];

      // Check cancellation / revocation
      if (ticket.status && ticket.status !== 'ACTIVE' && ticket.status !== 'VALID') {
        dbRun("INSERT INTO verification_logs (id, ticket_id, ticket_serial, verified_by_officer_id, verified_at, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
           [`LOG-${Date.now()}`, ticket.id, ticket.serial_number || ticket.id, verifierId || 'unknown', new Date().toISOString(), 'INVALID', 'REVOKED']
        );
        saveDatabase();
        return res.json({ valid: false, reason: "This ticket has been cancelled or revoked." });
      }

      const now = Date.now();
      const generatedAt = new Date(ticket.created_at || ticket.issued_at || Date.now()).getTime();
      const expirationTime = generatedAt + (20 * 24 * 60 * 60 * 1000); // 20 days
      
      if (now >= expirationTime) {
         dbRun("INSERT INTO verification_logs (id, ticket_id, ticket_serial, verified_by_officer_id, verified_at, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`LOG-${Date.now()}`, ticket.id, ticket.serial_number || ticket.id, verifierId || 'unknown', new Date().toISOString(), 'INVALID', 'EXPIRED']
         );
         saveDatabase();
         return res.json({ valid: false, reason: "This ticket has expired (exceeded 20 days)." });
      }
      
      const studentRows = dbAll("SELECT * FROM students WHERE id = ?", [ticket.student_id]);
      const studentName = studentRows.length > 0 ? studentRows[0].name : (parsedObj?.studentName || "Unknown Student");
      
      const paymentRows = dbAll("SELECT * FROM payments WHERE id = ?", [ticket.payment_id]);
      const amount = paymentRows.length > 0 ? paymentRows[0].amount : (parsedObj?.amount || 0);
      
      dbRun("INSERT INTO verification_logs (id, ticket_id, ticket_serial, verified_by_officer_id, verified_at, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [`LOG-${Date.now()}`, ticket.id, ticket.serial_number || ticket.id, verifierId || 'unknown', new Date().toISOString(), 'VALID', '']
      );
      saveDatabase();
      
      return res.json({ 
        valid: true,
        ticket: {
          serialNumber: ticket.serial_number || ticket.id,
          studentName: studentName,
          studentId: ticket.student_id,
          amount: amount,
          status: ticket.status || 'VALID',
          verifiedAt: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error("Verification Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Master setter for single-source-of-truth syncing (write-heavy path)
  app.post("/api/db/sync-all", async (req, res) => {
    try {
      const dbData = req.body.db || req.body;
      if (dbData && typeof dbData === 'object') {
        const txRun = (sql: string, params: any[] = []) => {
          db.run(sql, params.map(p => p === undefined ? null : p));
        };
        txRun("BEGIN TRANSACTION");
        try {
          for (const [k, v] of Object.entries(dbData)) {
            if (!['students', 'admins', 'verifiers', 'exams', 'payments', 'hall_tickets', 'verification_logs', 'audit_logs', 'security_alerts', 'scholarships', 'notifications', 'fee_removal_requests', 'faculties', 'academic_years', 'payment_settings'].includes(k)) {
              txRun("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)", [k, JSON.stringify(v)]);
            }
          }

          if (Array.isArray(dbData.students)) {
            for (const s of dbData.students) {
              txRun("INSERT OR REPLACE INTO students (id, name, faculty, department, semester, email, phone_number, phone_number_2, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, profile_picture, gender, date_of_birth, address, exam_eligibility, has_changed_password, password_change_count, failed_attempts, lockout_timestamp, deletion_timestamp, loan_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  s.id,
                  s.name,
                  s.faculty,
                  s.department,
                  s.semester,
                  s.email,
                  s.phoneNumber || s.phone_number,
                  s.phoneNumber2 || s.phone_number_2 || null,
                  s.status,
                  s.password || s.passwordHash || s.password_hash,
                  s.passwordResetByAdmin ? 1 : 0,
                  JSON.stringify(s.loans || []),
                  JSON.stringify(s.scholarships || []),
                  s.program || '',
                  s.academicYear || s.academic_year || null,
                  s.profilePicture || s.profile_picture || null,
                  s.gender || null,
                  s.dateOfBirth || s.date_of_birth || null,
                  s.address || null,
                  JSON.stringify(s.examEligibility || s.exam_eligibility || ['EXAM-2024-SPR']),
                  s.hasChangedPassword || s.has_changed_password ? 1 : 0,
                  s.passwordChangeCount || s.password_change_count || 0,
                  s.failedAttempts || s.failed_attempts || 0,
                  s.lockoutTimestamp || s.lockout_timestamp || null,
                  s.deletionTimestamp || s.deletion_timestamp || null,
                  s.loanConfig ? JSON.stringify(s.loanConfig) : (s.loan_config || null)
                ]);
            }
          }

          if (Array.isArray(dbData.admins)) {
            for (const a of dbData.admins) {
              txRun("INSERT OR REPLACE INTO admins (id, name, phone_number, password, is_suspended, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [a.id, a.name, a.phoneNumber || a.phone_number, a.password, a.isSuspended ? 1 : 0, a.role, a.mustChangePassword ? 1 : 0]);
            }
          }

          if (Array.isArray(dbData.verifiers)) {
            const verifierIds = dbData.verifiers.map((v: any) => v.id);
            if (verifierIds.length > 0) {
              const placeholders = verifierIds.map(() => '?').join(',');
              txRun(`DELETE FROM verifiers WHERE id NOT IN (${placeholders})`, verifierIds);
            } else {
              txRun("DELETE FROM verifiers");
            }
            for (const v of dbData.verifiers) {
              txRun("INSERT OR REPLACE INTO verifiers (id, name, email, password_hash, must_change_password, active, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [v.id, v.name, v.email, v.passwordHash || v.password_hash, v.mustChangePassword ? 1 : 0, v.active ? 1 : 0, v.role]);
            }
          }

          if (Array.isArray(dbData.exams)) {
            for (const e of dbData.exams) {
              txRun("INSERT OR REPLACE INTO exams (id, name, fee, dates, expiry_date, target_faculty, target_department, target_semester, target_academic_year, target_program, target_student_id, is_percentage_based, percentage_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [e.id, e.name, e.fee, e.dates, e.expiryDate || e.expiry_date, e.targetFaculty || e.target_faculty, e.targetDepartment || e.target_department, e.targetSemester || e.target_semester, e.targetAcademicYear || e.target_academic_year, e.targetProgram || e.target_program, e.targetStudentId || e.target_student_id, e.isPercentageBased || e.is_percentage_based ? 1 : 0, e.percentageValue || e.percentage_value || 0]);
            }
          }

          if (Array.isArray(dbData.payments)) {
            for (const p of dbData.payments) {
              txRun("INSERT OR REPLACE INTO payments (id, student_id, exam_id, amount, status, transaction_id, timestamp, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [p.id, p.studentId || p.student_id, p.examId || p.exam_id, p.amount, (p.status || 'paid').toLowerCase(), p.transactionId || p.transaction_id, p.timestamp, p.method || 'Direct']);
            }
          }

          if (Array.isArray(dbData.hall_tickets)) {
            for (const h of dbData.hall_tickets) {
              txRun("INSERT OR REPLACE INTO hall_tickets (id, student_id, exam_id, serial_number, qr_token, payment_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [h.id, h.studentId || h.student_id, h.examId || h.exam_id, h.serialNumber || h.serial_number, h.qrToken || h.qr_token, h.paymentId || h.payment_id, h.status, h.createdAt || h.created_at]);
            }
          }

          if (Array.isArray(dbData.audit_logs)) {
            for (const al of dbData.audit_logs) {
              txRun("INSERT OR REPLACE INTO audit_logs (id, timestamp, admin_id, action, details) VALUES (?, ?, ?, ?, ?)",
                [al.id, al.timestamp, al.adminId || al.admin_id, al.action, al.details]);
            }
          }

          if (Array.isArray(dbData.security_alerts)) {
            for (const sa of dbData.security_alerts) {
              txRun("INSERT OR REPLACE INTO security_alerts (id, timestamp, type, description, resolved) VALUES (?, ?, ?, ?, ?)",
                [sa.id, sa.timestamp, sa.type, sa.description, sa.resolved ? 1 : 0]);
            }
          }

          if (Array.isArray(dbData.verification_logs)) {
            for (const vl of dbData.verification_logs) {
              txRun("INSERT OR REPLACE INTO verification_logs (id, ticket_id, ticket_serial, verified_by_officer_id, verified_at, result, reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [vl.id, vl.ticketId || vl.ticket_id, vl.ticketSerial || vl.ticket_serial, vl.verifiedByOfficerId || vl.verified_by_officer_id, vl.verifiedAt || vl.verified_at, vl.result, vl.reason]);
            }
          }

          if (Array.isArray(dbData.scholarships)) {
            for (const sc of dbData.scholarships) {
              txRun("INSERT OR REPLACE INTO scholarships (id, name, type, value, student_ids, start_date, end_date, categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  sc.id, 
                  sc.name, 
                  sc.type, 
                  sc.value, 
                  JSON.stringify(sc.studentIds || []),
                  sc.startDate || sc.start_date || new Date().toISOString(),
                  sc.endDate || sc.end_date || null,
                  JSON.stringify(sc.categories || ['Exam'])
                ]);
            }
          }

          if (Array.isArray(dbData.notifications)) {
            for (const nt of dbData.notifications) {
              txRun("INSERT OR REPLACE INTO notifications (id, user_id, title, message, read, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                [nt.id, nt.userId || nt.user_id, nt.title, nt.message, nt.read ? 1 : 0, nt.timestamp]);
            }
          }

          if (Array.isArray(dbData.fee_removal_requests)) {
            for (const fr of dbData.fee_removal_requests) {
              txRun("INSERT OR REPLACE INTO fee_removal_requests (id, student_id, exam_id, reason, status, requested_at) VALUES (?, ?, ?, ?, ?, ?)",
                [fr.id, fr.studentId || fr.student_id, fr.examId || fr.exam_id, fr.reason, fr.status, fr.requestedAt || fr.requested_at]);
            }
          }

          if (Array.isArray(dbData.faculties)) {
            for (const f of dbData.faculties) {
              txRun("INSERT OR REPLACE INTO faculties (id, name, fee) VALUES (?, ?, ?)",
                [f.id, f.name, f.fee || 0]);
            }
          }

          if (Array.isArray(dbData.academic_years)) {
            for (const ay of dbData.academic_years) {
              txRun("INSERT OR REPLACE INTO academic_years (id, name, semester1, semester2, active, fee, target_faculty, target_department, target_semester, target_program, target_student_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  ay.id, 
                  ay.name, 
                  JSON.stringify(ay.semester1), 
                  JSON.stringify(ay.semester2), 
                  (ay.isActive || ay.active) ? 1 : 0,
                  Number(ay.fee) || 0,
                  ay.targetFaculty || ay.target_faculty || 'ALL',
                  ay.targetDepartment || ay.target_department || 'ALL',
                  ay.targetSemester || ay.target_semester || 'ALL',
                  ay.targetProgram || ay.target_program || 'ALL',
                  ay.targetStudentId || ay.target_student_id || 'ALL'
                ]);
            }
          }

          txRun("COMMIT");
          saveDatabase();
          dbEvents.emit("update");
          res.json({ status: "success" });
        } catch (ex: any) {
          try { txRun("ROLLBACK"); } catch(e) {}
          throw ex;
        }
      } else {
        res.status(400).json({ error: "Invalid payload" });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Dedicated endpoint to create/assign Academic Year Fee directly in SQLite
  app.post(["/api/academic-year/create-fee", "/api/academic-years/save-with-fee", "/api/academic-years/fee"], async (req, res) => {
    try {
      const config = req.body.config || req.body;
      if (!config || !config.name) {
        return res.status(400).json({ error: "Academic year name is required" });
      }

      const txRun = (sql: string, params: any[] = []) => {
        db.run(sql, params.map(p => p === undefined ? null : p));
      };

      const totalFee = Number(config.fee !== undefined ? config.fee : req.body.totalFee) || 0;
      const targetAY = req.body.targetAcademicYear || config.name;
      const targetFaculty = config.targetFaculty || req.body.targetFaculty || 'ALL';
      const targetDept = config.targetDepartment || req.body.targetDepartment || 'ALL';
      const targetSem = config.targetSemester || req.body.targetSemester || 'ALL';
      const targetProg = config.targetProgram || req.body.targetProgram || 'ALL';
      const targetStudent = config.targetStudentId || req.body.targetStudentId || 'ALL';

      txRun("BEGIN TRANSACTION");
      try {
        // 1. Save academic year
        txRun("INSERT OR REPLACE INTO academic_years (id, name, semester1, semester2, active, fee, target_faculty, target_department, target_semester, target_program, target_student_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            config.id || `AY-${Date.now()}`,
            config.name,
            JSON.stringify(config.semester1 || {}),
            JSON.stringify(config.semester2 || {}),
            config.isActive !== false ? 1 : 0,
            totalFee,
            targetFaculty,
            targetDept,
            targetSem,
            targetProg,
            targetStudent
          ]);

        // 2. Identify created fee components or primary fee
        const feeItemsToCreate: Array<{ id: string; name: string; fee: number; dates: string; expiryDate: string }> = [];

        let anySubOpen = false;
        const checkSub = (semNum: number, name: string, sub: any) => {
          if (sub && sub.isOpen) {
            anySubOpen = true;
            let subFee = totalFee;
            if (sub.fee && Number(sub.fee) > 0) {
              subFee = Number(sub.fee);
            } else if (sub.percentage && sub.percentage > 0) {
              subFee = Math.round(totalFee * (sub.percentage / 100) * 100) / 100;
            }
            feeItemsToCreate.push({
              id: `AY_${config.id}_S${semNum}_${name}`,
              name: `${config.name} Academic Year Fee - Semester ${semNum} ${name} (${sub.percentage || 100}%)`,
              fee: subFee > 0 ? subFee : totalFee,
              dates: sub.createdDate || new Date().toISOString(),
              expiryDate: sub.expireDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            });
          }
        };

        if (config.semester1) {
          checkSub(1, 'Quiz', config.semester1.quiz);
          checkSub(1, 'Midterm', config.semester1.midterm);
          checkSub(1, 'Final', config.semester1.final);
        }
        if (config.semester2) {
          checkSub(2, 'Quiz', config.semester2.quiz);
          checkSub(2, 'Midterm', config.semester2.midterm);
          checkSub(2, 'Final', config.semester2.final);
        }

        // If no sub components are open but fee > 0, create primary Academic Year fee
        if (!anySubOpen && totalFee > 0) {
          feeItemsToCreate.push({
            id: `AY_${config.id}_PRIMARY`,
            name: `${config.name} Academic Year Fee`,
            fee: totalFee,
            dates: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          });
        }

        // 3. Upsert fee records in exams table
        for (const item of feeItemsToCreate) {
          txRun("INSERT OR REPLACE INTO exams (id, name, fee, dates, expiry_date, target_faculty, target_department, target_semester, target_academic_year, target_program, target_student_id, is_percentage_based, percentage_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              item.id,
              item.name,
              item.fee,
              item.dates,
              item.expiryDate,
              targetFaculty,
              targetDept,
              targetSem,
              targetAY,
              targetProg,
              targetStudent,
              0,
              100
            ]);
        }

        // 4. Find all eligible students in SQLite
        const allStudents = dbAll("SELECT * FROM students");
        let assignedCount = 0;

        for (const s of allStudents) {
          // Check matching criteria
          if (targetStudent && targetStudent !== 'ALL' && s.id.toUpperCase() !== targetStudent.toUpperCase()) {
            continue;
          }
          if (targetAY && targetAY !== 'ALL') {
            const sAY = (s.academic_year || '').trim().toLowerCase();
            const tAY = targetAY.trim().toLowerCase();
            if (sAY && sAY !== tAY) continue;
          }
          if (targetFaculty && targetFaculty !== 'ALL') {
            const sFac = (s.faculty || '').trim().toLowerCase();
            const tFac = targetFaculty.trim().toLowerCase();
            if (sFac && sFac !== tFac) continue;
          }
          if (targetDept && targetDept !== 'ALL') {
            const sDept = (s.department || '').trim().toLowerCase();
            const tDept = targetDept.trim().toLowerCase();
            if (sDept && sDept !== tDept) continue;
          }
          if (targetSem && targetSem !== 'ALL') {
            const sSem = (s.semester || '').trim().toLowerCase();
            const tSem = targetSem.trim().toLowerCase();
            if (sSem && tSem && sSem !== tSem) {
              const normS = sSem.replace(/[^0-9]/g, '');
              const normT = tSem.replace(/[^0-9]/g, '');
              if (normS && normT && normS !== normT) continue;
            }
          }
          if (targetProg && targetProg !== 'ALL') {
            const sProg = (s.program || '').trim().toLowerCase();
            const tProg = targetProg.trim().toLowerCase();
            if (sProg && sProg !== tProg) continue;
          }

          // Student is eligible! Append new fee IDs
          let currentEligibility: string[] = [];
          try {
            if (s.exam_eligibility) currentEligibility = JSON.parse(s.exam_eligibility);
          } catch(e) {}
          if (!Array.isArray(currentEligibility)) currentEligibility = [];

          let changed = false;
          for (const item of feeItemsToCreate) {
            if (!currentEligibility.includes(item.id)) {
              currentEligibility.push(item.id);
              changed = true;
            }
          }

          if (changed) {
            txRun("UPDATE students SET exam_eligibility = ? WHERE id = ?", [JSON.stringify(currentEligibility), s.id]);
            assignedCount++;
          }
        }

        txRun("COMMIT");
        saveDatabase();
        dbEvents.emit("update");
        res.json({
          status: "success",
          createdFees: feeItemsToCreate,
          createdFeeItems: feeItemsToCreate,
          assignedStudentsCount: assignedCount
        });
      } catch (err: any) {
        try { txRun("ROLLBACK"); } catch(e) {}
        throw err;
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Authoritative debt calculation endpoint with Partial Payment support
  app.get(["/api/students/:id/debt", "/api/students/:id/financial-status"], async (req, res) => {
    try {
      const studentId = req.params.id;
      const sRows = dbAll("SELECT * FROM students WHERE id = ?", [studentId]);
      if (sRows.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      const s = sRows[0];
      let eligibility: string[] = [];
      try {
        if (s.exam_eligibility) eligibility = JSON.parse(s.exam_eligibility);
      } catch(e) {}

      let studentLoanConfig: any = null;
      try {
        if (s.loan_config) studentLoanConfig = JSON.parse(s.loan_config);
      } catch (e) {}

      const allExams = dbAll("SELECT * FROM exams");
      const payments = dbAll("SELECT * FROM payments WHERE student_id = ? AND (LOWER(status) = 'paid' OR LOWER(status) = 'partial')", [studentId]);

      // Calculate debt
      const applicableExams = allExams.filter(exam => {
        if (eligibility.includes(exam.id)) return true;
        if (exam.target_student_id && exam.target_student_id !== 'ALL' && exam.target_student_id.toUpperCase() === String(studentId).toUpperCase()) return true;
        if (exam.target_faculty && exam.target_faculty !== 'ALL') {
          if ((s.faculty || '').toLowerCase() !== exam.target_faculty.toLowerCase()) return false;
        }
        return true;
      });

      let totalDebt = 0;
      let currentPayable = 0;
      let deferredStudentDebt = 0;

      const feeBreakdown = applicableExams.map(exam => {
        const fee = Number(exam.fee) || 0;
        const paidForExam = payments
          .filter(p => p.exam_id === exam.id)
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const outstanding = Math.max(0, fee - paidForExam);
        totalDebt += outstanding;

        let payableNow = outstanding;
        let debtPart = 0;
        if (studentLoanConfig && studentLoanConfig.examId === exam.id) {
          const auth = Number(studentLoanConfig.authorizedAmount) || 0;
          if (paidForExam < auth) {
            payableNow = Math.max(0, auth - paidForExam);
            debtPart = Math.max(0, outstanding - payableNow);
          } else {
            payableNow = 0;
            debtPart = outstanding;
          }
        }
        currentPayable += payableNow;
        deferredStudentDebt += debtPart;

        return {
          id: exam.id,
          name: exam.name,
          fee,
          paid: paidForExam,
          outstanding,
          payableNow,
          deferredStudentDebt: debtPart
        };
      });

      res.json({
        studentId,
        totalDebt,
        currentPayable,
        studentDebt: deferredStudentDebt,
        fees: feeBreakdown
      });
    } catch(err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Admin Partial Payment configuration endpoint
  app.post("/api/students/:id/partial-payment", async (req, res) => {
    try {
      const studentId = req.params.id;
      const { examId, authorizedAmount } = req.body;
      const studentRows = dbAll("SELECT * FROM students WHERE id = ?", [studentId]);
      if (studentRows.length === 0) {
        return res.status(404).json({ error: "Student not found" });
      }
      const loanConfigObj = authorizedAmount !== undefined ? { examId, authorizedAmount: Number(authorizedAmount) } : null;
      dbRun("UPDATE students SET loan_config = ? WHERE id = ?", [loanConfigObj ? JSON.stringify(loanConfigObj) : null, studentId]);
      saveDatabase();
      dbEvents.emit("update");
      res.json({ success: true, studentId, loanConfig: loanConfigObj });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Direct Payment creation endpoint
  app.post(["/api/payments", "/api/payment/create"], async (req, res) => {
    try {
      const p = req.body;
      const id = p.id || `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const studentId = p.studentId || p.student_id;
      const examId = p.examId || p.exam_id;
      const amount = Number(p.amount) || 0;
      const status = (p.status || 'paid').toLowerCase();
      const transactionId = p.transactionId || p.transaction_id || `TX-${Date.now()}`;
      const timestamp = p.timestamp || new Date().toISOString();
      const method = p.method || 'Card';

      // Check if fee/exam is expired or past
      if (examId) {
        const examRows = dbAll("SELECT expiry_date, name FROM exams WHERE id = ?", [examId]);
        if (examRows.length > 0 && examRows[0].expiry_date) {
          const expiryTime = new Date(examRows[0].expiry_date).getTime();
          if (!isNaN(expiryTime) && Date.now() >= expiryTime) {
            return res.status(400).json({
              error: `Payment rejected: Fee ${examRows[0].name || examId} is a Past/Expired Fee and is View-Only. Direct payments are disabled for past fees.`
            });
          }
        }
      }

      dbRun(
        "INSERT OR REPLACE INTO payments (id, student_id, exam_id, amount, status, transaction_id, timestamp, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, studentId, examId, amount, status, transactionId, timestamp, method]
      );

      dbEvents.emit("update");
      res.json({
        success: true,
        payment: { id, studentId, examId, amount, status: status.toUpperCase(), transactionId, timestamp, method }
      });
    } catch (err: any) {
      console.error("Payment create error:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Dedicated Financial Audit Trail Partial Payments endpoint
  app.get(["/api/financial-audit-trail/partial-payments", "/api/audit-trail/partial-payments", "/api/payments/partial"], async (req, res) => {
    try {
      const allPayments = dbAll("SELECT * FROM payments ORDER BY timestamp ASC");
      const allStudents = dbAll("SELECT * FROM students");
      const allExams = dbAll("SELECT * FROM exams");

      const studentMap = new Map();
      for (const s of allStudents) {
        studentMap.set(s.id, s);
      }

      const examMap = new Map();
      for (const e of allExams) {
        examMap.set(e.id, e);
      }

      // Track running payments per (student, fee) to compute exact remaining balance per transaction
      const runningTotals: { [key: string]: number } = {};
      const enrichedRecords = allPayments.map(p => {
        const student = studentMap.get(p.student_id);
        const exam = examMap.get(p.exam_id);
        const key = `${p.student_id}_${p.exam_id}`;
        const prevPaid = runningTotals[key] || 0;
        const thisAmount = Number(p.amount) || 0;
        const totalPaidToDate = prevPaid + thisAmount;
        runningTotals[key] = totalPaidToDate;

        const originalFee = exam ? (Number(exam.fee) || 0) : thisAmount;
        const remainingBalance = Math.max(0, originalFee - totalPaidToDate);

        // Detect if Academic Year fee
        const isAcademicYear = 
          (p.exam_id && p.exam_id.startsWith('AY_')) || 
          (exam && (
            (exam.name && exam.name.toLowerCase().includes('academic year')) ||
            (exam.name && exam.name.toLowerCase().includes('ay ')) ||
            exam.target_academic_year ||
            (exam.session && exam.session.includes('-'))
          ));

        const feeType = isAcademicYear ? 'Academic Year' : 'Standard Fee';
        const academicYear = exam?.target_academic_year || exam?.session || student?.academic_year || '2024-2025';
        const faculty = exam?.target_faculty || student?.faculty || 'General';
        const semester = exam?.target_semester || student?.semester || 'Semester 1';

        const rawStatus = (p.status || '').toLowerCase();
        const isPartial = rawStatus === 'partial' || remainingBalance > 0;

        const dateObj = new Date(p.timestamp);
        const paymentDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : p.timestamp;
        const paymentTime = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString() : '';

        return {
          id: p.id,
          transactionId: p.transaction_id || p.id,
          studentId: p.student_id,
          studentName: student ? student.name : p.student_id,
          paymentType: isPartial ? 'Partial Payment' : 'Full Payment',
          feeType,
          feeId: p.exam_id,
          feeName: exam ? exam.name : p.exam_id,
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

      // Filter only partial payments
      let partialPayments = enrichedRecords.filter(r => r.isPartial);

      // Support query parameter filtering
      const { studentId, feeType, academicYear, status, search } = req.query;
      if (studentId) {
        partialPayments = partialPayments.filter(r => r.studentId.toLowerCase() === String(studentId).toLowerCase());
      }
      if (feeType && feeType !== 'ALL') {
        partialPayments = partialPayments.filter(r => r.feeType.toLowerCase() === String(feeType).toLowerCase());
      }
      if (academicYear && academicYear !== 'ALL') {
        partialPayments = partialPayments.filter(r => r.academicYear === academicYear);
      }
      if (status && status !== 'ALL') {
        partialPayments = partialPayments.filter(r => r.status.toUpperCase() === String(status).toUpperCase());
      }
      if (search) {
        const q = String(search).toLowerCase();
        partialPayments = partialPayments.filter(r =>
          r.studentId.toLowerCase().includes(q) ||
          r.studentName.toLowerCase().includes(q) ||
          r.transactionId.toLowerCase().includes(q) ||
          r.feeName.toLowerCase().includes(q)
        );
      }

      // Latest first
      partialPayments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        success: true,
        count: partialPayments.length,
        data: partialPayments,
        records: partialPayments
      });
    } catch (err: any) {
      console.error("Partial payments API error:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  app.post("/api/db/set", async (req, res) => {
    try {
      const { key, data } = req.body;
      if (key) {
        dbRun("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)", [key, JSON.stringify(data)]);

        if (key === 'payments' && Array.isArray(data)) {
          for (const p of data) {
            db.run("INSERT OR REPLACE INTO payments (id, student_id, exam_id, amount, status, transaction_id, timestamp, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [p.id, p.studentId || p.student_id, p.examId || p.exam_id, p.amount, (p.status || 'paid').toLowerCase(), p.transactionId || p.transaction_id, p.timestamp, p.method || 'Direct']);
          }
          saveDatabase();
        }
      }
      res.json({ status: "success" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || err });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local:   http://localhost:${PORT}/`);
    console.log(`Network: http://127.0.0.1:${PORT}/`);
  });
}

startServer();
