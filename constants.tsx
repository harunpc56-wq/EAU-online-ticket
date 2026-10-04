
import { Student, Exam, AccountStatus } from './types';

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'EAUGRW0001',
    name: 'Ali Farah',
    department: 'Computer Science',
    faculty: 'Faculty of IT',
    semester: '6th Semester',
    email: 'ali.farah@university.edu',
    phoneNumber: '+252610000000',
    password: 'EAUGRW0001123',
    status: AccountStatus.ACTIVE,
    examEligibility: ['EXAM-2024-SPR'],
    hasChangedPassword: false
  },
  {
    id: 'EAUGRW0002',
    name: 'Sara Ahmed',
    department: 'Business Administration',
    faculty: 'Faculty of Business',
    semester: '4th Semester',
    email: 'sara.ahmed@university.edu',
    phoneNumber: '+252611111111',
    password: 'EAUGRW0002123',
    status: AccountStatus.ACTIVE,
    examEligibility: ['EXAM-2024-SPR'],
    hasChangedPassword: false
  }
];

export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'EXAM-2024-SPR',
    name: 'Spring Annual Examination 2024',
    session: '2023-2024',
    fee: 300,
    dates: new Date('2026-01-15T09:00:00').toISOString(),
    venue: 'Academic Block A & B',
    availabilityStart: new Date('2024-01-01').toISOString(),
    availabilityEnd: new Date('2026-12-31').toISOString()
  }
];

export const UNIVERSITY_LOGO = "https://picsum.photos/id/197/200/200";
