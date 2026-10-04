import React, { useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { PaymentStatus, Student, Exam } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface FinancialStatementProps {
  student: Student;
}

const FinancialStatement: React.FC<FinancialStatementProps> = ({ student }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [serialNumber, setSerialNumber] = useState(() => `FAS-${new Date().getFullYear()}-${db.getFasCounter().toString().padStart(6, '0')}`);
  
  const allExams = useMemo(() => db.getExams(), []);
  const payments = useMemo(() => db.getPayments().filter(p => p.studentId === student.id && p.status === PaymentStatus.PAID), [student.id]);
  const statementRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const assignedFees = [...new Set([...(student.examEligibility || []), ...(student.processedExams || [])])];
    
    let transactions: { date: string, type: string, description: string, amount: number, kind: 'CHARGE' | 'PAYMENT' | 'DISCOUNT', session: string }[] = [];

    // Add Charged Fees
    assignedFees.forEach(examId => {
      const exam = allExams.find(e => e.id === examId);
      if (!exam) return;
      const { original, discount, final } = db.calculateDiscountedFee(exam, student);
      
      transactions.push({ date: exam.dates, type: 'Charge', description: `Fee: ${exam.name}`, amount: original, kind: 'CHARGE', session: exam.session });
      if (discount > 0) {
        transactions.push({ date: exam.dates, type: 'Discount', description: `Scholarship`, amount: -discount, kind: 'DISCOUNT', session: exam.session });
      }
    });

    // Add Payments
    payments.forEach(p => {
      const exam = allExams.find(e => e.id === p.examId);
      transactions.push({ date: p.timestamp, type: 'Payment', description: `Payment: ${p.method} for ${exam?.name || 'Misc'}`, amount: p.amount, kind: 'PAYMENT', session: exam?.session || 'Unknown' });
    });

    // Filtering
    let filtered = transactions;
    if (dateFrom) filtered = filtered.filter(t => new Date(t.date) >= new Date(dateFrom));
    if (dateTo) filtered = filtered.filter(t => new Date(t.date) <= new Date(dateTo));
    if (semesterFilter !== 'ALL') filtered = filtered.filter(t => t.session === semesterFilter);

    return filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [student, allExams, payments, dateFrom, dateTo, semesterFilter]);

  const totals = useMemo(() => {
    const charged = data.filter(t => t.kind === 'CHARGE').reduce((sum, t) => sum + t.amount, 0);
    const paid = data.filter(t => t.kind === 'PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const discount = data.filter(t => t.kind === 'DISCOUNT').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const balance = charged - paid - discount;
    return { charged, paid, discount, balance };
  }, [data]);

  const sessions = useMemo(() => [...new Set(allExams.map(e => e.session))], [allExams]);

  const handleDownload = async () => {
    setIsExporting(true);
    const newSerial = `FAS-${new Date().getFullYear()}-${db.getNextFasNumber().toString().padStart(6, '0')}`;
    setSerialNumber(newSerial);

    await new Promise(resolve => setTimeout(resolve, 500));
    const element = statementRef.current;
    if (!element) {
        setIsExporting(false);
        return;
    }
    const canvas = await html2canvas(element, { 
        scale: 2,
        ignoreElements: (element) => element.classList.contains('no-print')
    });
    setIsExporting(false);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`statement.${student.name.replace(/\s+/g, '.').toLowerCase()}.pdf`);
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100" ref={statementRef}>
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-xl font-black uppercase font-serif">Financial Account Statement</h2>
        <button onClick={handleDownload} className="text-xs font-black bg-blue-900 text-white p-3 rounded-xl uppercase tracking-widest hover:bg-black">Export PDF</button>
      </div>
      
      <div className="flex gap-4 mb-6 no-print">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-3 border rounded-xl text-sm" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-3 border rounded-xl text-sm" />
        <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} className="p-3 border rounded-xl text-sm">
            <option value="ALL">All Sessions</option>
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      {/* PDF ONLY CONTENT */}
      <div className={`${isExporting ? 'flex' : 'hidden print:block'} flex-col mb-8 border-b pb-8`}>
        {/* Logo at center */}
        <div className="flex justify-center mb-6">
            <img src="/EAU.png" alt="University Logo" className="w-24 h-24 object-contain" />
        </div>
        
        {/* Serial/Date at top-right, Student Info at left */}
        <div className="flex justify-between items-start">
            {/* Student Info */}
            <div className='flex flex-col text-sm gap-1'>
                <p className='font-bold'>Name: {student.name}</p>
                <p className='font-bold'>ID: {student.id}</p>
                <p className='font-bold'>Faculty: {student.faculty}</p>
                <p className='font-bold'>Semester: {student.academicYear || student.semester || 'N/A'}</p>
            </div>
            
            {/* Serial and Date */}
            <div className='text-right'>
                <p className='text-sm font-bold'>Serial: <span className="font-mono">{serialNumber}</span></p>
                <p className='text-xs'>Generated: {new Date().toLocaleString()}</p>
            </div>
        </div>
        
        {/* Filter info */}
        <div className="mt-4 text-sm font-medium border-t pt-4">
            <p className='italic'>Filter Period: {dateFrom || 'Start'} to {dateTo || 'End'} (Semester: {semesterFilter})</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-50 p-6 rounded-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase">Charged</p>
          <p className="text-xl font-black">${totals.charged.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl">
          <p className="text-[10px] font-black text-emerald-600 uppercase">Paid</p>
          <p className="text-xl font-black text-emerald-900">${totals.paid.toLocaleString()}</p>
        </div>
        <div className={`p-6 rounded-2xl ${totals.balance > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase">Balance Remaining</p>
          <p className="text-xl font-black ${totals.balance > 0 ? 'text-red-900' : 'text-slate-900'}">${totals.balance.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="table-responsive-container scrollbar-admin mb-8">
        <table className="w-full text-left min-w-[550px]">
          <thead>
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <th className="pb-4">Date</th>
              <th className="pb-4">Description</th>
              <th className="pb-4">Type/Session</th>
              <th className="pb-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((t, i) => (
              <tr key={`${t.kind}-${t.description}-${t.date}-${i}`} className="text-xs font-medium">
                <td className="py-4">{new Date(t.date).toLocaleDateString()}</td>
                <td className="py-4">{t.description}</td>
                <td className="py-4 font-black">{t.type} ({t.session})</td>
                <td className={`py-4 text-right font-black ${t.kind === 'PAYMENT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {t.kind === 'PAYMENT' ? '+' : ''}${Math.abs(t.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`p-6 rounded-2xl flex justify-between items-center ${totals.balance > 0 ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
          <p className="text-xs font-black uppercase">Total Account Balance</p>
          <p className="text-2xl font-black font-serif">${totals.balance.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default FinancialStatement;
