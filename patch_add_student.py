import re

with open('services/db.ts', 'r') as f:
    content = f.read()

old_func = '''  addStudent(student: Student): void {
    const students = this.getStorage<Student[]>('students', INITIAL_STUDENTS);
    const existingIndex = students.findIndex(s => s.id === student.id);
    const preparedStudent: Student = {
      ...student,
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
  }'''

new_func = '''  addStudent(student: Student): void {
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
  }'''

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Patched addStudent successfully.")
else:
    print("Could not find addStudent.")

with open('services/db.ts', 'w') as f:
    f.write(content)
