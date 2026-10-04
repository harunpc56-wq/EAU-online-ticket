
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL = 'partial'
}

export enum UserRole {
  STUDENT = 'student',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  TICKET_VERIFIER = 'ticket_verifier'
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  DELETED = 'deleted' // Soft-deleted/History
}

export enum ScholarshipType {
  FULL = 'FULL',
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

export interface Scholarship {
  id: string;
  name: string;
  type: ScholarshipType;
  value: number; // 100 for Full, e.g. 50 for Percentage, e.g. 300 for Fixed
  startDate: string;
  endDate?: string;
  categories: string[]; // e.g. ['Exam']
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actorId: string;
  targetId: string;
  details: string;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  userId: string;
  type: 'FAILED_LOGIN' | 'UNAUTHORIZED_ACCESS' | 'ACCOUNT_LOCKED' | 'OTP_SENT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: string;
  isResolved: boolean;
}

export interface PaymentSettings {
  allowCard: boolean;
  allowMobile: boolean;
  allowBank: boolean;
}

export interface Faculty {
  id: string;
  name: string;
  fee: number;
}

export interface SubSection {
  percentage: number;
  fee?: number;
  createdDate: string;
  expireDate: string;
  isOpen: boolean;
}

export interface Semester {
  quiz: SubSection;
  midterm: SubSection;
  final: SubSection;
}

export interface AcademicYearConfig {
  id: string;
  name: string;
  fee?: number;
  targetFaculty?: string;
  targetDepartment?: string;
  targetSemester?: string;
  targetProgram?: string;
  targetStudentId?: string;
  semester1: Semester;
  semester2: Semester;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  phoneNumber: string;
  password: string;
  isSuspended: boolean;
  mustChangePassword?: boolean;
  role: UserRole.ADMIN | UserRole.SUPER_ADMIN;
  lastSeen?: string; // For online status tracking
}

export interface StudentScholarship {
  scholarshipId: string;
  awardDate: string;
}

// ... original Student interface ...
export interface Student {
  id: string;
  name: string;
  department: string;
  semester: string;
  faculty: string;
  email: string;
  phoneNumber: string; 
  phoneNumber2?: string;
  status: AccountStatus;
  password?: string;
  passwordHash?: string;
  hasChangedPassword?: boolean;
  passwordChangeCount?: number; // Requirement: Only allowed to change once
  passwordResetByAdmin?: boolean; // Flag for reset message
  failedAttempts?: number;
  lockoutTimestamp?: string;
  deletionTimestamp?: string;
  profilePicture?: string;
  examEligibility: string[]; // Active fees
  processedExams?: string[]; // Overridden/Cleared fees (still count towards debt calculation)
  loanConfig?: {
    examId: string;
    authorizedAmount: number;
    expiration?: string; // Optional per requirement 1
  };
  scholarships?: StudentScholarship[]; // Linked scholarship IDs with award date
  loans?: any[];
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  admissionDate?: string;
  createdAt?: string;
  program?: string; // Added for targeted fee selection
  academicYear?: string; // Added for targeted fee selection
}

export interface Exam {
  id: string;
  name: string;
  session: string;
  fee: number;
  dates: string; 
  expiryDate?: string; // Requirement: Auto-delete on this date
  venue?: string;
  facultyId?: string;
  semester?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  targetFaculty?: string;
  targetDepartment?: string;
  targetAcademicYear?: string;
  targetSemester?: string;
  targetProgram?: string;
  targetStudentId?: string;
  isPercentageBased?: boolean;
  percentageValue?: number;
}

export interface Payment {
  id: string;
  studentId: string;
  examId: string;
  amount: number;
  status: PaymentStatus;
  transactionId: string;
  timestamp: string;
  method: string;
  isCustomAmount?: boolean;
  customNote?: string;
  adminId?: string;
  lastModified?: string;
}

export interface HallTicket {
  id: string;
  studentId: string;
  examId: string;
  paymentId: string; // Linked to specific payment for accurate receipting
  createdAt: string;
  qrToken: string; // Updated from qrCode
  status: 'ACTIVE' | 'CANCELLED';
  serialNumber: string;
}

export interface TicketVerificationLog {
  id: string;
  ticketId: string;
  ticketSerial: string;
  verifiedByOfficerId: string;
  verifiedAt: string;
  result: 'VALID' | 'INVALID';
  reason?: string;
  timestamp?: string;
  verifierId?: string;
}

export interface TicketVerificationOfficer {
  id: string;
  name: string;
  email: string;
  password?: string;
  passwordHash: string;
  mustChangePassword: boolean;
  role: UserRole.TICKET_VERIFIER;
  active: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'PAYMENT' | 'SYSTEM' | 'URGENT';
}

export interface UserSession {
  user: Student | AdminUser | TicketVerificationOfficer | { id: string, name: string, email?: string, phoneNumber?: string, lastSeen?: string };
  role: UserRole;
}

export interface FeeRemovalRequest {
  id: string;
  studentId: string;
  examId: string;
  studentName: string;
  examName: string;
  amount: number;
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

