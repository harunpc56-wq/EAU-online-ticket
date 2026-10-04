import re

with open('services/db.ts', 'r') as f:
    content = f.read()

pattern = r"  getStudentBalance\(studentId: string\): number \{.*?(?=  addSecurityAlert\(alert: SecurityAlert\): void \{)"

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
  }
'''

content = re.sub(pattern, new_func, content, flags=re.DOTALL)

with open('services/db.ts', 'w') as f:
    f.write(content)

