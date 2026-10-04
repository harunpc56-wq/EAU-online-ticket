import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, AccountStatus, Exam, Faculty, AcademicYearConfig, Scholarship } from '../types';
import { db } from '../services/db';
import { 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  Building2, 
  Calendar, 
  KeyRound, 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  BookOpen, 
  Sparkles, 
  DollarSign, 
  MapPin,
  RefreshCw,
  Camera,
  Layers,
  FileCheck
} from 'lucide-react';

interface StudentRegistrationFormProps {
  studentToEdit?: Student | null;
  onSuccess?: (student: Student) => void;
  onCancel?: () => void;
  isModalMode?: boolean;
}

export const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({
  studentToEdit,
  onSuccess,
  onCancel,
  isModalMode = false
}) => {
  const isEditing = Boolean(studentToEdit);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reference database data
  const existingStudents = useMemo(() => db.getStudents(), []);
  const availableExams = useMemo(() => db.getExams(), []);
  const systemFaculties = useMemo(() => db.getFaculties(), []);
  const academicYears = useMemo(() => db.getAcademicYears(), []);
  const availableScholarships = useMemo(() => db.getScholarships(), []);

  // Compute next ID
  const nextGeneratedId = useMemo(() => db.generateStudentId(), []);

  // Form State
  const [id, setId] = useState<string>(studentToEdit?.id || nextGeneratedId);
  const [name, setName] = useState<string>(studentToEdit?.name || '');
  const [gender, setGender] = useState<string>(studentToEdit?.gender || 'Male');
  const [dateOfBirth, setDateOfBirth] = useState<string>(studentToEdit?.dateOfBirth || '');
  const [profilePicture, setProfilePicture] = useState<string>(studentToEdit?.profilePicture || '');

  const [status, setStatus] = useState<AccountStatus>(studentToEdit?.status || AccountStatus.ACTIVE);
  const [password, setPassword] = useState<string>(studentToEdit ? (studentToEdit.password || '') : `${nextGeneratedId}123`);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [requirePasswordReset, setRequirePasswordReset] = useState<boolean>(
    studentToEdit?.passwordResetByAdmin ? true : (!isEditing)
  );
  const [admissionDate, setAdmissionDate] = useState<string>(
    studentToEdit?.createdAt ? studentToEdit.createdAt.split('T')[0].split(' ')[0] : new Date().toISOString().split('T')[0]
  );

  const [email, setEmail] = useState<string>(studentToEdit?.email || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(studentToEdit?.phoneNumber || '');
  const [phoneNumber2, setPhoneNumber2] = useState<string>(studentToEdit?.phoneNumber2 || '');
  const [address, setAddress] = useState<string>(studentToEdit?.address || '');

  // Pre-populate faculties with reference to existing registered students (Faculty of IT, Faculty of Business)
  const defaultFaculties = useMemo(() => {
    const list = ['Faculty of IT', 'Faculty of Business', 'Faculty of Engineering', 'Faculty of Health Sciences', 'Faculty of Law'];
    systemFaculties.forEach(f => {
      if (f.name && !list.includes(f.name)) list.push(f.name);
    });
    existingStudents.forEach(s => {
      if (s.faculty && !list.includes(s.faculty)) list.push(s.faculty);
    });
    return list;
  }, [systemFaculties, existingStudents]);

  const [faculty, setFaculty] = useState<string>(studentToEdit?.faculty || 'Faculty of IT');
  const [isCustomFaculty, setIsCustomFaculty] = useState<boolean>(false);
  const [customFaculty, setCustomFaculty] = useState<string>('');

  // Pre-populate departments with reference to existing registered students (Computer Science, Business Administration)
  const defaultDepartments = useMemo(() => {
    const list = [
      'Computer Science', 
      'Business Administration', 
      'Information Technology', 
      'Software Engineering', 
      'Accounting & Finance', 
      'Public Administration', 
      'Telecommunication Engineering'
    ];
    existingStudents.forEach(s => {
      if (s.department && !list.includes(s.department)) list.push(s.department);
    });
    return list;
  }, [existingStudents]);

  const [department, setDepartment] = useState<string>(studentToEdit?.department || 'Computer Science');
  const [isCustomDepartment, setIsCustomDepartment] = useState<boolean>(false);
  const [customDepartment, setCustomDepartment] = useState<string>('');

  const [program, setProgram] = useState<string>(studentToEdit?.program || '');
  const [semester, setSemester] = useState<string>(studentToEdit?.semester || '6th Semester');
  const [academicYear, setAcademicYear] = useState<string>(studentToEdit?.academicYear || '2023-2024');

  // Examination & Financial Clearance
  const [selectedExams, setSelectedExams] = useState<string[]>(
    studentToEdit?.examEligibility || (availableExams.length > 0 ? [availableExams[0].id] : ['EXAM-2024-SPR'])
  );
  const [selectedScholarship, setSelectedScholarship] = useState<string>(
    studentToEdit?.scholarships && studentToEdit.scholarships.length > 0 ? studentToEdit.scholarships[0].scholarshipId : ''
  );
  const [loanAmount, setLoanAmount] = useState<number>(
    studentToEdit?.loanConfig?.authorizedAmount || 0
  );

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Re-sync ID and default password if ID changes for a new student
  const handleRegenerateId = () => {
    if (isEditing) return;
    const newId = db.generateStudentId();
    setId(newId);
    setPassword(`${newId}123`);
  };

  // Live avatar calculation
  const avatarUrl = useMemo(() => {
    if (profilePicture && profilePicture.startsWith('http')) return profilePicture;
    const seed = encodeURIComponent(name || id || 'student');
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=e2e8f0,cbd5e1`;
  }, [profilePicture, name, id]);

  // Validation function
  const validateForm = () => {
    const errs: Record<string, string> = {};

    // 1. Personal
    if (!name.trim()) {
      errs.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Full name must contain at least 2 characters';
    }

    // 2. Student Info
    if (!id.trim()) {
      errs.id = 'Student ID is required';
    } else if (!isEditing) {
      const existing = existingStudents.find(s => s.id && s.id.toUpperCase() === id.trim().toUpperCase());
      if (existing) {
        errs.id = `Student ID ${id} is already registered to ${existing.name}`;
      }
    }

    if (!password.trim() && !(isEditing && studentToEdit?.passwordHash)) { errs.password = 'Initial password is required'; } else if (password.trim().length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }

    // 3. Contact
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'Institutional email is required';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please provide a valid email address (e.g., student@university.edu)';
    } else {
      const duplicateEmail = existingStudents.find(
        s => s.email && s.email.toLowerCase() === email.trim().toLowerCase() && s.id !== id
      );
      if (duplicateEmail) {
        errs.email = `Email is already assigned to student ${duplicateEmail.name} (${duplicateEmail.id})`;
      }
    }

    const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
    if (!phoneNumber.trim()) {
      errs.phoneNumber = 'Primary phone number is required';
    } else if (cleanPhone.length < 6) {
      errs.phoneNumber = 'Phone number must be at least 6 digits';
    }

    // 4. Academic
    const effectiveFaculty = isCustomFaculty ? customFaculty.trim() : faculty;
    if (!effectiveFaculty) {
      errs.faculty = 'University faculty is required';
    }

    const effectiveDept = isCustomDepartment ? customDepartment.trim() : department;
    if (!effectiveDept) {
      errs.department = 'Academic department is required';
    }

    if (!semester) {
      errs.semester = 'Semester assignment is required';
    }

    setErrors(errs);
    return errs;
  };

  useEffect(() => {
    if (submitAttempted) {
      validateForm();
    }
  }, [
    name, 
    id, 
    email, 
    phoneNumber, 
    faculty, 
    customFaculty, 
    isCustomFaculty, 
    department, 
    customDepartment, 
    isCustomDepartment, 
    semester, 
    password, 
    submitAttempted
  ]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScrollTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScrollBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ 
        top: scrollContainerRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  };

  const handleExamToggle = (examId: string) => {
    setSelectedExams(prev => 
      prev.includes(examId) ? prev.filter(x => x !== examId) : [...prev, examId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setServerError('');

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      // Scroll to the first error
      const firstKey = Object.keys(validationErrors)[0];
      const errorSectionMap: Record<string, string> = {
        name: 'reg-section-personal',
        id: 'reg-section-student-info',
        password: 'reg-section-student-info',
        email: 'reg-section-contact',
        phoneNumber: 'reg-section-contact',
        faculty: 'reg-section-academic',
        department: 'reg-section-academic',
        semester: 'reg-section-academic'
      };
      const targetSec = errorSectionMap[firstKey];
      if (targetSec) scrollToSection(targetSec);
      return;
    }

    const effectiveFaculty = isCustomFaculty ? customFaculty.trim() : faculty;
    const effectiveDept = isCustomDepartment ? customDepartment.trim() : department;

    try {
      const studentRecord: Student = {
        ...(studentToEdit || {}),
        id: id.trim().toUpperCase(),
        name: name.trim(),
        gender,
        dateOfBirth: dateOfBirth || undefined,
        profilePicture: profilePicture || undefined,
        faculty: effectiveFaculty,
        department: effectiveDept,
        program: program.trim(),
        semester,
        academicYear: academicYear || '2023-2024',
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        phoneNumber2: phoneNumber2.trim() || undefined,
        address: address.trim() || undefined,
        status,
        password: password.trim() ? password.trim() : (studentToEdit?.password || ''),
        passwordHash: password.trim() ? password.trim() : (studentToEdit?.passwordHash || ''),
        hasChangedPassword: isEditing ? (studentToEdit?.hasChangedPassword ?? false) : false,
        passwordChangeCount: studentToEdit?.passwordChangeCount || 0,
        passwordResetByAdmin: requirePasswordReset,
        examEligibility: selectedExams.length > 0 ? selectedExams : ['EXAM-2024-SPR'],
        processedExams: studentToEdit?.processedExams || [],
        scholarships: selectedScholarship ? [
          {
            scholarshipId: selectedScholarship,
            awardDate: new Date().toISOString()
          }
        ] : (studentToEdit?.scholarships || []),
        loans: loanAmount > 0 ? [
          {
            examId: selectedExams[0] || 'EXAM-2024-SPR',
            authorizedAmount: loanAmount
          }
        ] : (studentToEdit?.loans || []),
        loanConfig: loanAmount > 0 ? {
          examId: selectedExams[0] || 'EXAM-2024-SPR',
          authorizedAmount: loanAmount
        } : studentToEdit?.loanConfig,
        createdAt: studentToEdit?.createdAt || `${admissionDate} ${new Date().toTimeString().split(' ')[0]}`
      };

      if (isEditing) {
        db.updateStudent(studentRecord);
        setSuccessMessage(`Student ${studentRecord.name} (${studentRecord.id}) profile updated successfully.`);
      } else {
        db.addStudent(studentRecord);
        setSuccessMessage(`Student ${studentRecord.name} (${studentRecord.id}) registered and enrolled successfully.`);
      }

      // Audit Log
      db.addAuditLog({
        action: isEditing ? 'UPDATE_STUDENT_PROFILE' : 'REGISTER_NEW_STUDENT',
        actorId: 'admin',
        targetId: studentRecord.id,
        details: `Saved comprehensive registration record for ${studentRecord.name} under ${studentRecord.faculty} - ${studentRecord.department}`
      });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess(studentRecord);
        }, 600);
      }
    } catch (err: any) {
      console.error('Registration commit error:', err);
      setServerError(err.message || 'An error occurred while saving student record to the database.');
    }
  };

  const isFormValid = Object.keys(errors).length === 0;

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 ${isModalMode ? 'h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden' : 'rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden'}`}>
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-6 md:px-8 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black uppercase font-serif tracking-wide text-white">
                {isEditing ? 'Update Student Record' : 'Student Registration Portal'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Official Registry
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing 
                ? `Modifying registered institutional record for ${studentToEdit?.name} (${studentToEdit?.id})` 
                : 'Enroll new examinee with complete institutional identity, academic credentials & fees'}
            </p>
          </div>
        </div>

        {/* Quick ID Badge & Scroll Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Identity:</span>
            <span className="font-mono text-xs font-black text-amber-400">{id || 'GENERATING...'}</span>
          </div>

          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handleScrollTop}
              title="Scroll to Top"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleScrollBottom}
              title="Scroll to Bottom"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 border border-slate-700 flex items-center justify-center font-black transition-colors"
              title="Close Form"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Interactive Quick-Jump Navigation Bar */}
      <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-admin text-xs">
        <span className="text-[10px] font-black uppercase text-slate-400 mr-2 flex items-center gap-1 shrink-0">
          <Layers className="w-3.5 h-3.5" /> Jump:
        </span>
        <button
          type="button"
          onClick={() => scrollToSection('reg-section-personal')}
          className="px-3 py-1 bg-white dark:bg-slate-700 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
        >
          1. Personal Information
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('reg-section-student-info')}
          className="px-3 py-1 bg-white dark:bg-slate-700 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
        >
          2. Student Identity & Login
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('reg-section-contact')}
          className="px-3 py-1 bg-white dark:bg-slate-700 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
        >
          3. Contact Information
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('reg-section-academic')}
          className="px-3 py-1 bg-white dark:bg-slate-700 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
        >
          4. Academic Information
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('reg-section-financial')}
          className="px-3 py-1 bg-white dark:bg-slate-700 rounded-lg font-bold text-[11px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
        >
          5. Exams & Financial Clearance
        </button>
      </div>

      {/* Main Internal Scrollable Body */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto max-h-[calc(88vh-190px)] p-6 md:p-8 space-y-8 scrollbar-admin bg-slate-50/50 dark:bg-slate-950/40"
      >
        {/* Banner Messages */}
        {serverError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold uppercase tracking-wider">Registration Error</p>
              <p className="mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-start gap-3 text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            <div className="text-xs">
              <p className="font-bold uppercase tracking-wider">Commit Successful</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {submitAttempted && Object.keys(errors).length > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold uppercase tracking-wide">Required Fields Missing ({Object.keys(errors).length})</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                Please review and correct: {Object.values(errors).join(', ')}.
              </p>
            </div>
          </div>
        )}

        <form id="student-registration-form" onSubmit={handleSubmit} className="space-y-8">
          
          {/* ========================================================================= */}
          {/* SECTION 1: PERSONAL INFORMATION */}
          {/* ========================================================================= */}
          <div id="reg-section-personal" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    1. Personal Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Primary personal identity and demographic profile of the examinee
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                Required Section
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Profile Avatar / Photo Preview */}
              <div className="md:col-span-3 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white shadow-md border-2 border-slate-200 relative mb-3">
                  <img 
                    src={avatarUrl} 
                    alt={name || 'Student Avatar'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-500 text-center">
                  Identity Badge
                </span>
                <input 
                  type="text"
                  placeholder="Photo URL (Optional)"
                  value={profilePicture || ''}
                  onChange={e => setProfilePicture(e.target.value)}
                  className="w-full mt-3 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-medium text-slate-700 dark:text-slate-200"
                />
              </div>

              {/* Personal Fields */}
              <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Examinee Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      required
                      type="text"
                      placeholder="e.g., Ali Farah or Sara Ahmed"
                      value={name || ''}
                      onChange={e => setName(e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                      className={`w-full p-4 bg-white dark:bg-slate-800 border rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                        errors.name && (touched.name || submitAttempted)
                          ? 'border-red-500 focus:ring-red-400 bg-red-50/20'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                      }`}
                    />
                    {name && !errors.name && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                  {errors.name && (touched.name || submitAttempted) && (
                    <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender || 'Male'}
                    onChange={e => setGender(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Unspecified</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Date of Birth
                  </label>
                  <input 
                    type="date"
                    value={dateOfBirth || ''}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: STUDENT IDENTITY & LOGIN CREDENTIALS */}
          {/* ========================================================================= */}
          <div id="reg-section-student-info" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    2. Student Identity & Login Credentials
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    System roll number, account status, and portal authentication keys
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900">
                System Credentials
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Student ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Student ID (Roll No.) <span className="text-red-500">*</span>
                  </label>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={handleRegenerateId}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto Next
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    required
                    type="text"
                    disabled={isEditing}
                    placeholder="e.g., EAUGRW0003"
                    value={id || ''}
                    onChange={e => {
                      setId(e.target.value.toUpperCase());
                      if (!isEditing && password.startsWith(id)) {
                        setPassword(`${e.target.value.toUpperCase()}123`);
                      }
                    }}
                    className={`w-full p-4 font-mono font-black text-sm rounded-2xl border focus:outline-none focus:ring-2 ${
                      isEditing 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 cursor-not-allowed' 
                        : errors.id 
                          ? 'border-red-500 bg-red-50/20 text-red-900' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-900 dark:text-blue-400 focus:ring-blue-500'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 text-slate-700">
                    {isEditing ? 'LOCKED' : 'INSTITUTIONAL'}
                  </span>
                </div>
                {errors.id && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.id}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Sequential institutional identity standard (matches EAUGRW0001, EAUGRW0002).
                </p>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Account Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={status || AccountStatus.ACTIVE}
                  onChange={e => setStatus(e.target.value as AccountStatus)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={AccountStatus.ACTIVE}>ACTIVE (Full Portal & Exam Access)</option>
                  <option value={AccountStatus.INACTIVE}>INACTIVE (Suspended / Deferral)</option>
                  <option value={AccountStatus.LOCKED}>LOCKED (Administrative Freeze)</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Only ACTIVE students can verify clearance and print examination hall tickets.
                </p>
              </div>

              {/* Admission / Created Date */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Enrollment / Admission Date
                </label>
                <input 
                  type="date"
                  value={admissionDate || ''}
                  onChange={e => setAdmissionDate(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Official date examinee was registered into the university examination directory.
                </p>
              </div>

              {/* Initial Portal Password */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Portal Access Key / Initial Password <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? 'Hide Key' : 'Show Key'}
                  </button>
                </div>
                <div className="relative">
                  <input 
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="e.g., EAUGRW0003123 or custom key"
                    value={password || ''}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full p-4 bg-white dark:bg-slate-800 border rounded-2xl font-mono font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                      errors.password ? 'border-red-500 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(`${id}123`)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
                  >
                    Default ({id}123)
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.password}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Student uses their Student ID and this password to sign in to the examinee portal.
                </p>
              </div>

              {/* Require Password Reset */}
              <div className="sm:col-span-1 flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={requirePasswordReset}
                    onChange={e => setRequirePasswordReset(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Enforce Password Reset Upon First Login
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: CONTACT INFORMATION */}
          {/* ========================================================================= */}
          <div id="reg-section-contact" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    3. Contact Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Primary communication channels for exam notices and SMS dispatch
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                Verification & SMS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Institutional Email */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Institutional Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input 
                    required
                    type="email"
                    placeholder="e.g., ali.farah@university.edu"
                    value={email || ''}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                    className={`w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                      errors.email && (touched.email || submitAttempted)
                        ? 'border-red-500 bg-red-50/20'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {errors.email && (touched.email || submitAttempted) && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.email}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Used for examination schedule alerts and hall ticket notifications.
                </p>
              </div>

              {/* Primary Mobile Handset */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Primary Mobile Handset <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input 
                    required
                    type="tel"
                    placeholder="e.g., +252610000000"
                    value={phoneNumber || ''}
                    onChange={e => setPhoneNumber(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, phoneNumber: true }))}
                    className={`w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                      errors.phoneNumber && (touched.phoneNumber || submitAttempted)
                        ? 'border-red-500 bg-red-50/20'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {errors.phoneNumber && (touched.phoneNumber || submitAttempted) && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.phoneNumber}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Target handset for OTP authentications and instant payment receipt SMS.
                </p>
              </div>

              {/* Secondary Handset */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Secondary / Emergency Contact (Optional)
                </label>
                <input 
                  type="tel"
                  placeholder="e.g., +252611111111"
                  value={phoneNumber2 || ''}
                  onChange={e => setPhoneNumber2(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Campus / Residential Address */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Campus / Residential Address (Optional)
                </label>
                <input 
                  type="text"
                  placeholder="e.g., Main Campus Student Block C, Mogadishu"
                  value={address || ''}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: ACADEMIC INFORMATION */}
          {/* ========================================================================= */}
          <div id="reg-section-academic" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    4. Academic Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Faculty, department, semester and curriculum affiliation
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-900">
                Curriculum Unit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Faculty */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    University Faculty <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomFaculty(!isCustomFaculty);
                      if (!isCustomFaculty) setCustomFaculty('');
                    }}
                    className="text-[10px] font-bold text-purple-600 hover:text-purple-800"
                  >
                    {isCustomFaculty ? 'Select Standard' : '+ Custom Faculty'}
                  </button>
                </div>
                {isCustomFaculty ? (
                  <input 
                    required
                    type="text"
                    placeholder="Enter Custom Faculty Name"
                    value={customFaculty}
                    onChange={e => setCustomFaculty(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <select
                    value={faculty}
                    onChange={e => setFaculty(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {defaultFaculties.map((f, i) => (
                      <option key={`${f}-${i}`} value={f}>{f}</option>
                    ))}
                  </select>
                )}
                {errors.faculty && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.faculty}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Pre-configured with Faculty of IT & Faculty of Business.
                </p>
              </div>

              {/* Department */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Academic Department <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDepartment(!isCustomDepartment);
                      if (!isCustomDepartment) setCustomDepartment('');
                    }}
                    className="text-[10px] font-bold text-purple-600 hover:text-purple-800"
                  >
                    {isCustomDepartment ? 'Select Standard' : '+ Custom Department'}
                  </button>
                </div>
                {isCustomDepartment ? (
                  <input 
                    required
                    type="text"
                    placeholder="Enter Custom Department Name"
                    value={customDepartment}
                    onChange={e => setCustomDepartment(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {defaultDepartments.map((d, i) => (
                      <option key={`${d}-${i}`} value={d}>{d}</option>
                    ))}
                  </select>
                )}
                {errors.department && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.department}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Pre-configured with Computer Science & Business Admin.
                </p>
              </div>

              {/* Assigned Semester */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Assigned Semester <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Semester...</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={`${num}th Semester`}>{num}th Semester</option>
                  ))}
                </select>
                {errors.semester && (
                  <p className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.semester}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-slate-400">
                  Ali Farah is 6th Semester, Sara Ahmed is 4th Semester.
                </p>
              </div>

              {/* Degree Program */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Degree Program (e.g., Bachelor of Computer Science)
                </label>
                <input 
                  type="text"
                  placeholder="e.g., Bachelor of Science in Information Technology (B.Sc IT)"
                  value={program || ''}
                  onChange={e => setProgram(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Academic Year / Session */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Year / Session
                </label>
                <select
                  value={academicYear || '2023-2024'}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="2023-2024">2023-2024 (Active)</option>
                  <option value="2024-2025">2024-2025</option>
                  <option value="2025-2026">2025-2026</option>
                  {academicYears.map(ay => (
                    <option key={ay.id} value={ay.name}>{ay.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: EXAMINATION & FINANCIAL DETAILS */}
          {/* ========================================================================= */}
          <div id="reg-section-financial" className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    5. Examination & Financial Clearance Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Active exam eligibility enrollment, scholarships and emergency credit
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-900">
                Clearance Gate
              </span>
            </div>

            <div className="space-y-6">
              {/* Exam Eligibility Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Assign Exam Fee Eligibility
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableExams.map(exam => {
                    const isChecked = selectedExams.includes(exam.id);
                    return (
                      <div 
                        key={exam.id}
                        onClick={() => handleExamToggle(exam.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isChecked 
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="w-5 h-5 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase text-slate-900 dark:text-slate-100">
                              {exam.name}
                            </p>
                            <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                              {exam.isPercentageBased || exam.id.startsWith('AY_') ? `Dynamic (${exam.percentageValue || exam.name.match(/(\d+)%/)?.[1] || 0}%)` : `$${exam.fee}`}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            ID: {exam.id} • Session: {exam.session || '2023-2024'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Existing students Ali Farah & Sara Ahmed were enrolled into Spring Annual Examination 2024 (EXAM-2024-SPR).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Scholarship Assignment */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Link Institutional Scholarship (Optional)
                  </label>
                  <select
                    value={selectedScholarship || ''}
                    onChange={e => setSelectedScholarship(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Active Scholarship</option>
                    {availableScholarships.map(sch => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} ({sch.type} - {sch.value}{sch.type === 'PERCENTAGE' ? '%' : '$'})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Automatic fee deduction calculated on hall ticket checkout.
                  </p>
                </div>

                {/* Authorized Emergency Loan Credit */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Authorized Emergency Loan Limit ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                    <input 
                      type="number"
                      min="0"
                      step="10"
                      placeholder="0"
                      value={loanAmount !== undefined && loanAmount !== null ? loanAmount : ''}
                      onChange={e => setLoanAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Allows student to clear tickets with deferred payment authorization.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* 6. STICKY / FIXED FOOTER: ALWAYS VISIBLE & ACCESSIBLE SUBMIT ACTION */}
      {/* ========================================================================= */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 z-20 shadow-2xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isFormValid ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready for institutional commitment</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>{Object.keys(errors).length} required field(s) pending</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase text-xs tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            form="student-registration-form"
            className="px-8 py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:shadow-blue-900/30 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <FileCheck className="w-4 h-4" />
            <span>{isEditing ? 'Save Student Changes' : 'Register Student'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
