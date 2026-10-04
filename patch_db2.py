import re

with open('services/db.ts', 'r') as f:
    content = f.read()

old_func = '''  getStudentBalance(studentId: string): number {
    const student = this.findStudentById(studentId);
    if (!student) return 0;
    
    const allExams = this.getExams();
    const payments = this.getPayments().filter(p => p.studentId === studentId && p.status === PaymentStatus.PAID);
    
    const assignedFees = [...new Set([...(student.examEligibility || []), ...(student.processedExams || [])])];
    return assignedFees.reduce((totalDebt, examId) => {
      const exam = allExams.find(e => e.id === examId);
      if (!exam) return totalDebt;
      if (!this.isStudentEligibleForExam(exam, student)) return totalDebt;
      
      const { final } = this.calculateDiscountedFee(exam, student);
      
      const paidForThisExam = payments
        .filter(p => p.examId === examId)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const balance = Math.max(0, final - paidForThisExam);
      return totalDebt + balance;
    }, 0);
  }'''

new_func = '''  getStudentBalance(studentId: string): number {
    const student = this.findStudentById(studentId);
    if (!student) return 0;
    
    const allExams = this.getExams();
    const payments = this.getPayments().filter(p => p.studentId === studentId && p.status === PaymentStatus.PAID);
    
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
  }'''

if old_func in content:
    content = content.replace(old_func, new_func)
    with open('services/db.ts', 'w') as f:
        f.write(content)
    print("Patched getStudentBalance in db.ts successfully.")
else:
    print("Could not find the function in db.ts")
