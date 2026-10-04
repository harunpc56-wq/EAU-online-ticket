import re

with open('services/db.ts', 'r') as f:
    content = f.read()

# Patch processAcademicYearToggles
old_ay = '''        students.forEach(s => {
          if (!s.examEligibility) s.examEligibility = [];
          if (!s.examEligibility.includes(examId) && !(s.processedExams || []).includes(examId)) {
            s.examEligibility.push(examId);
          }
        });'''

new_ay = '''        students.forEach(s => {
          if (!s.examEligibility) s.examEligibility = [];
          if (!s.examEligibility.includes(examId) && !(s.processedExams || []).includes(examId)) {
            if (this.isStudentEligibleForExam(examObj, s)) {
              s.examEligibility.push(examId);
            }
          }
        });'''
if old_ay in content:
    content = content.replace(old_ay, new_ay)
    print("Patched processAcademicYearToggles")
else:
    print("Could not find processAcademicYearToggles pattern")

# Patch updateExam
old_ue = '''  updateExam(updatedExam: Exam): void {
    const exams = this.getExams().map(e => e.id === updatedExam.id ? updatedExam : e);
    this.setStorage('exams', exams);

    const students = this.getStudents().map(s => ({
      ...s,
      examEligibility: Array.from(new Set([...(s.examEligibility || []), updatedExam.id]))
    }));
    this.setStorage('students', students);
  }'''

new_ue = '''  updateExam(updatedExam: Exam): void {
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
  }'''

if old_ue in content:
    content = content.replace(old_ue, new_ue)
    print("Patched updateExam")
else:
    print("Could not find updateExam pattern")


# Patch addExam
old_ae = '''  addExam(exam: Exam): void {
    const exams = this.getExams();
    exams.push(exam);
    this.setStorage('exams', exams);

    const students = this.getStudents().map(s => ({
      ...s,
      examEligibility: Array.from(new Set([...(s.examEligibility || []), exam.id]))
    }));
    this.setStorage('students', students);
  }'''

new_ae = '''  addExam(exam: Exam): void {
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
  }'''

if old_ae in content:
    content = content.replace(old_ae, new_ae)
    print("Patched addExam")
else:
    print("Could not find addExam pattern")

with open('services/db.ts', 'w') as f:
    f.write(content)

