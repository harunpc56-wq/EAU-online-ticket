import re

with open('components/StudentDashboard.tsx', 'r') as f:
    content = f.read()

old_current = '''  const currentExams = useMemo(() => {
    const now = new Date();
    return allExams.filter(e => {
      const isEligible = (freshStudent.examEligibility || []).includes(e.id);
      if (!isEligible) return false;
      if (!db.isStudentEligibleForExam(e, freshStudent)) return false;
      
      const { final } = db.calculateDiscountedFee(e, freshStudent);
      const paidForExam = payments.filter(p => p.examId === e.id && p.status === PaymentStatus.PAID).reduce((sum, p) => sum + p.amount, 0);
      
      if (paidForExam >= final) return false;
      const expiry = e.expiryDate ? new Date(e.expiryDate) : null;
      if (expiry && now >= expiry) return false;
      return true;
    });
  }, [allExams, freshStudent, payments, tick]);'''

new_current = '''  const currentExams = useMemo(() => {
    const now = new Date();
    return allExams.filter(e => {
      const isExplicit = (freshStudent.examEligibility || []).includes(e.id) || (freshStudent.processedExams || []).includes(e.id);
      const isDynamic = db.isStudentEligibleForExam(e, freshStudent);
      
      if (!isExplicit && !isDynamic) return false;
      
      const { final } = db.calculateDiscountedFee(e, freshStudent);
      const paidForExam = payments.filter(p => p.examId === e.id && p.status === PaymentStatus.PAID).reduce((sum, p) => sum + p.amount, 0);
      
      if (paidForExam >= final) return false;
      const expiry = e.expiryDate ? new Date(e.expiryDate) : null;
      if (expiry && now >= expiry) return false;
      return true;
    });
  }, [allExams, freshStudent, payments, tick]);'''

content = content.replace(old_current, new_current)

old_debt = '''  const oldestDebtExam = useMemo(() => {
    const now = new Date();
    const currentIds = currentExams.map(e => e.id);
    const assignedFees = [...new Set([...(freshStudent.examEligibility || []), ...(freshStudent.processedExams || [])])];
    const debtExamId = assignedFees.find(id => {
        if (currentIds.includes(id)) return false;
        const exam = allExams.find(e => e.id === id);
        if (!exam) return false;
        if (!db.isStudentEligibleForExam(exam, freshStudent)) return false;
        
        const { final } = db.calculateDiscountedFee(exam, freshStudent);
        const paid = payments.filter(p => p.examId === id && p.status === PaymentStatus.PAID).reduce((s, p) => s + p.amount, 0);
        return paid < final;
    });
    return allExams.find(e => e.id === debtExamId) || null;
  }, [currentExams, allExams, freshStudent, payments, tick]);'''

new_debt = '''  const oldestDebtExam = useMemo(() => {
    const now = new Date();
    const currentIds = currentExams.map(e => e.id);
    const applicableExams = allExams.filter(exam => {
       const isExplicit = (freshStudent.examEligibility || []).includes(exam.id) || (freshStudent.processedExams || []).includes(exam.id);
       const isDynamic = db.isStudentEligibleForExam(exam, freshStudent);
       return isExplicit || isDynamic;
    });
    
    const debtExam = applicableExams.find(exam => {
        if (currentIds.includes(exam.id)) return false;
        const { final } = db.calculateDiscountedFee(exam, freshStudent);
        const paid = payments.filter(p => p.examId === exam.id && p.status === PaymentStatus.PAID).reduce((s, p) => s + p.amount, 0);
        return paid < final;
    });
    return debtExam || null;
  }, [currentExams, allExams, freshStudent, payments, tick]);'''

content = content.replace(old_debt, new_debt)

with open('components/StudentDashboard.tsx', 'w') as f:
    f.write(content)
