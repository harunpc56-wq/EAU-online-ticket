import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Student, Exam, Payment, HallTicket, PaymentStatus, AccountStatus } from '../types';
import { db } from '../services/db';
import PaymentModal from './PaymentModal';
import PDFGenerator from './PDFGenerator';

interface StudentDashboardProps {
  student: Student;
}

const TicketCardItem: React.FC<{
  ticket: HallTicket;
  exam: Exam;
  payment?: Payment;
  onDownload: () => void;
}> = ({ ticket, exam, payment, onDownload }) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const token = ticket.qrToken || ticket.serialNumber || ticket.id;
    QRCode.toDataURL(token, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    }).then(url => {
      if (active) setQrUrl(url);
    }).catch(err => {
      console.error("QR thumbnail error:", err);
    });
    return () => { active = false; };
  }, [ticket.qrToken, ticket.serialNumber, ticket.id]);

  const createdTime = new Date(ticket.createdAt).getTime();
  const expiresTime = createdTime + (20 * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil((expiresTime - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all">
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="w-20 h-20 bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-200 shadow-inner flex-shrink-0 flex flex-col items-center justify-center">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Thumbnail" className="w-full h-full object-contain" />
          ) : (
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-[8px] font-mono font-black">
              {ticket.serialNumber || ticket.id}
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[8px] font-black uppercase">
              {daysLeft > 0 ? `${daysLeft}d Valid` : 'Expired'}
            </span>
          </div>
          <p className="text-xs font-black uppercase text-slate-900 leading-snug truncate">{exam.name}</p>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
            Issued: {new Date(ticket.createdAt).toLocaleDateString()} • Fee: ${payment?.amount.toLocaleString() || '0'}
          </p>
        </div>
      </div>
      <button 
        onClick={onDownload}
        className="w-full sm:w-auto px-5 py-3.5 bg-blue-900 hover:bg-black text-white rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all text-[9px] font-black uppercase tracking-widest whitespace-nowrap"
      >
        <i className="fa-solid fa-file-pdf text-xs"></i>
        <span>Download PDF</span>
      </button>
    </div>
  );
};

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student: initialStudent }) => {
  const [tick, setTick] = useState(0);
  const [selectedExamForPayment, setSelectedExamForPayment] = useState<Exam | null>(null);
  const [isBalanceLeftModalOpen, setIsBalanceLeftModalOpen] = useState(false);
  const [selectedTicketForPrint, setSelectedTicketForPrint] = useState<{ticket: HallTicket, exam: Exam} | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'TX' | 'TKT'>('TX');
  const [examTab, setExamTab] = useState<'CURRENT' | 'PAST'>('CURRENT');

  useEffect(() => {
    // REAL-TIME SUBSCRIPTION: Subscribes to the institutional data bus
    const unsubscribe = db.subscribe(() => {
      setTick(t => t + 1);
    });
    
    // Heartbeat as a secondary reliability mechanism
    const heartbeat = setInterval(() => setTick(t => t + 1), 1000); 

    return () => {
      unsubscribe();
      clearInterval(heartbeat);
    };
  }, []);

  const freshStudent = useMemo(() => {
    if (!initialStudent?.id) return initialStudent;
    return db.findStudentById(initialStudent.id) || initialStudent;
  }, [initialStudent, tick]);

  const allExams = useMemo(() => db.getExams(), [tick]);
  const payments = useMemo(() => {
    if (!freshStudent?.id) return [];
    return db.getPayments()
      .filter(p => p.studentId === freshStudent.id)
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
        const timeB = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [freshStudent?.id, tick]);
  
  const tickets = useMemo(() => {
    if (!freshStudent?.id) return [];
    return db.getHallTickets().filter(t => t.studentId === freshStudent.id);
  }, [freshStudent?.id, tick]);

  const notifications = useMemo(() => {
    if (!freshStudent?.id) return [];
    return db.getNotifications(freshStudent.id);
  }, [freshStudent?.id, tick]);

  const unreadNotifications = useMemo(() => notifications.filter(n => !n.isRead), [notifications]);
  
  const remainingBalance = useMemo(() => {
    if (!freshStudent?.id) return 0;
    return db.getStudentBalance(freshStudent.id);
  }, [freshStudent?.id, tick]);

  const activePayableBalance = useMemo(() => {
    if (!freshStudent?.id) return 0;
    return db.getStudentActivePayableBalance(freshStudent.id);
  }, [freshStudent?.id, tick]);

  const pastDebt = useMemo(() => {
    if (!freshStudent?.id) return 0;
    return db.getStudentPastDebt(freshStudent.id);
  }, [freshStudent?.id, tick]);

  const showBalanceLeft = pastDebt > 0;

  const currentExams = useMemo(() => {
    const now = new Date();
    return allExams.filter(e => {
      const isExplicit = (freshStudent.examEligibility || []).includes(e.id) || (freshStudent.processedExams || []).includes(e.id);
      const isDynamic = db.isStudentEligibleForExam(e, freshStudent);
      
      if (!isExplicit && !isDynamic) return false;
      
      const { final } = db.calculateDiscountedFee(e, freshStudent);
      const paidForExam = payments.filter(p => p.examId === e.id && db.isPaymentSettledOrPartial(p.status)).reduce((sum, p) => sum + p.amount, 0);
      
      if (paidForExam >= final) return false;
      const expiry = e.expiryDate ? new Date(e.expiryDate) : null;
      if (expiry && now >= expiry) return false;
      return true;
    });
  }, [allExams, freshStudent, payments, tick]);

  const pastExams = useMemo(() => {
    const now = new Date();
    return allExams.filter(e => {
      const isExplicit = (freshStudent.examEligibility || []).includes(e.id) || (freshStudent.processedExams || []).includes(e.id);
      const isDynamic = db.isStudentEligibleForExam(e, freshStudent);
      if (!isExplicit && !isDynamic) return false;
      
      const { final } = db.calculateDiscountedFee(e, freshStudent);
      const paidForExam = payments.filter(p => p.examId === e.id && db.isPaymentSettledOrPartial(p.status)).reduce((sum, p) => sum + p.amount, 0);
      
      if (paidForExam >= final) return false;
      const expiry = e.expiryDate ? new Date(e.expiryDate) : null;
      if (expiry && now >= expiry) return true;
      return false;
    });
  }, [allExams, freshStudent, payments, tick]);

  const currentExamsTotal = useMemo(() => {
    return currentExams.reduce((sum, e) => {
      const { final } = db.calculateDiscountedFee(e, freshStudent);
      const paid = payments.filter(p => p.examId === e.id && db.isPaymentSettledOrPartial(p.status)).reduce((s, p) => s + p.amount, 0);
      const isLoan = freshStudent.loanConfig?.examId === e.id;
      const loanAmount = freshStudent.loanConfig?.authorizedAmount || 0;
      if (isLoan && paid < loanAmount) {
        return sum + Math.max(0, loanAmount - paid);
      }
      if (isLoan && paid >= loanAmount) {
        return sum;
      }
      return sum + Math.max(0, final - paid);
    }, 0);
  }, [currentExams, freshStudent, payments]);

  const handleCopy = () => {
    navigator.clipboard.writeText('6666666');
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handlePaymentSuccess = async (payment: Payment) => {
    setIsBalanceLeftModalOpen(false);
    setSelectedExamForPayment(null);
    setTick(t => t + 1);

    const exam = allExams.find(e => e.id === payment.examId) || allExams.find(e => db.isExamExpiredOrPast(e)) || allExams[0];
    if (exam) {
      let ticket = db.getHallTickets().find(t => t.studentId === freshStudent.id && t.examId === exam.id);
      if (!ticket) {
        const serialNumber = db.generateTicketSerial();
        const createdAt = new Date().toISOString();
        const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const qrData = {
          serialNumber,
          ticketId,
          studentId: freshStudent.id,
          studentName: freshStudent.name,
          amount: payment.amount,
          createdAt
        };
        ticket = {
          id: ticketId,
          studentId: freshStudent.id,
          examId: exam.id,
          paymentId: payment.id,
          createdAt,
          serialNumber,
          qrToken: JSON.stringify(qrData),
          status: 'ACTIVE'
        };
        db.addHallTicket(ticket);
        await db.syncImmediately();
      }
      setSelectedTicketForPrint({ ticket, exam });
    }
  };

  const getExamName = (examId: string) => {
    const ex = allExams.find(e => e.id === examId);
    return ex ? ex.name : 'Institutional Record ';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase font-serif italic leading-none">Examinee Portal</h1>
          <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.4em]">University Academic Control Systems</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 px-6 rounded-full border border-slate-100 shadow-sm self-start md:self-auto">
          <div className="flex flex-col text-right text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-widest">Security: <span className="text-emerald-600">Validated</span></div>
          <div className="h-8 w-[2px] bg-slate-100"></div>
          <div className="flex flex-col text-[10px] md:text-xs font-mono font-bold text-slate-700 uppercase">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-900"></div>
            <div className="relative inline-block mb-6 group">
              <div className="h-32 w-32 md:h-36 md:w-36 bg-white rounded-[2rem] flex items-center justify-center text-slate-400 text-5xl font-black overflow-hidden border-4 border-white shadow-2xl">
                <img 
                  src={freshStudent.profilePicture || "https://upload.wikimedia.org/wikipedia/en/4/44/East_Africa_University_logo.png"} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('eastafricauniversity.net')) {
                      target.src = "https://www.eastafricauniversity.net/wp-content/uploads/2021/06/cropped-EAU-Logo-1-192x192.png";
                    }
                  }}
                />
              </div>
              <label className="absolute -bottom-2 -right-2 bg-blue-900 text-white w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center cursor-pointer border-4 border-white shadow-lg">
                <i className="fa-solid fa-camera text-xs md:text-sm"></i>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      db.updateStudent({ ...freshStudent, profilePicture: reader.result as string });
                      setTick(t => t + 1);
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase font-serif mb-1 leading-tight">{freshStudent.name}</h2>
            <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-900 rounded-full font-black text-[9px] uppercase mb-8 tracking-widest">{freshStudent.id}</div>
            <div className="space-y-2 text-left">
              {[
                { label: 'Faculty', value: freshStudent.faculty },
                { label: 'Department', value: freshStudent.department },
                { label: 'Semester', value: freshStudent.semester }
              ].map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl flex items-center justify-between border border-transparent hover:border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">{item.label}</span>
                  <span className="text-xs font-bold text-slate-700 uppercase">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-[2rem] md:rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl transition-all duration-500 ${remainingBalance > 0 ? 'bg-red-600' : 'bg-emerald-600'}`}>
            <div className="relative z-10 flex flex-col items-center text-center text-white">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-white/60">Financial Clearance Status</span>
              <div className="text-4xl md:text-5xl font-black mb-2 font-serif tracking-tight transition-transform duration-300 transform-gpu">${remainingBalance.toLocaleString()}</div>
              <div className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[8px] md:text-[9px] font-black uppercase border border-white/30 tracking-widest mb-3">
                {remainingBalance === 0 ? 'Cleared' : 'Payment Required'}
              </div>
              {showBalanceLeft && (
                <button
                  onClick={() => setIsBalanceLeftModalOpen(true)}
                  className="w-full mt-4 p-4 bg-white hover:bg-slate-50 text-red-600 rounded-3xl shadow-xl flex items-center gap-4 border border-red-100 transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 text-xl shrink-0 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-mobile-screen-button"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-[8px] font-black uppercase text-red-500 tracking-widest">Institutional Debt Found</div>
                    <div className="text-sm md:text-base font-black uppercase tracking-wider text-red-600 font-serif">Balance Left</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <h3 className="text-lg font-black uppercase tracking-widest mb-6 flex items-center gap-3 font-serif italic">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-xs"><i className="fa-solid fa-headset"></i></div>
              Assistance Number 
            </h3>
            <div className="space-y-4">
              <a href="tel:6666666" className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-all">
                <span className="text-2xl font-black font-mono tracking-tighter">6666666</span>
                <i className="fa-solid fa-phone text-blue-400"></i>
              </a>
              <button onClick={handleCopy} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-blue-600/20 tracking-widest">
                {copySuccess ? 'Copied' : 'Copy Gateway Code'}
              </button>
            </div>
          </div>

          <div onClick={() => setIsHistoryOpen(true)} className="bg-white rounded-[2.5rem] p-8 text-slate-900 shadow-xl border border-slate-100 relative overflow-hidden group cursor-pointer hover:border-blue-900 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fa-solid fa-clock-rotate-left text-6xl"></i></div>
            <h3 className="text-lg font-black uppercase tracking-widest mb-2 flex items-center gap-3 font-serif italic">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs"><i className="fa-solid fa-history"></i></div>
              History
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Institutional Vault Access</p>
          </div>

          <div onClick={() => setIsNotificationsOpen(true)} className="bg-white rounded-[2.5rem] p-8 text-slate-900 shadow-xl border border-slate-100 relative overflow-hidden group cursor-pointer hover:border-blue-900 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fa-solid fa-bell text-6xl"></i></div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-3 font-serif italic">
                <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center text-xs"><i className="fa-solid fa-bell"></i></div>
                Notifications
              </h3>
              {unreadNotifications.length > 0 && (
                <span className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full animate-pulse">
                  {unreadNotifications.length} NEW
                </span>
              )}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Official Administrative Signal Record</p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-12">
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
              <div className="flex items-center gap-4">
                 <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase font-serif">Academic Fee</h3>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl md:rounded-2xl gap-1 overflow-x-auto no-scrollbar">
                <button 
                  onClick={() => setExamTab('CURRENT')} 
                  className={`px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase transition-all whitespace-nowrap ${examTab === 'CURRENT' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}
                >
                  Current ({currentExams.length})
                </button>
                <button 
                  onClick={() => setExamTab('PAST')} 
                  className={`px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase transition-all whitespace-nowrap ${examTab === 'PAST' ? 'bg-white text-red-600 shadow-md' : 'text-slate-500'}`}
                >
                  Past ({pastExams.length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(examTab === 'CURRENT' ? currentExams : pastExams).length === 0 ? (
                <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                  <p className="text-slate-400 font-black uppercase text-xs tracking-[0.4em]">Queue Cleared / No Action Required</p>
                </div>
              ) : (
                (examTab === 'CURRENT' ? currentExams : pastExams).map(exam => {
                  const paidForExam = payments.filter(p => p.examId === exam.id && db.isPaymentSettledOrPartial(p.status)).reduce((sum, p) => sum + p.amount, 0);
                  const { original, discount, final, scholarshipName } = db.calculateDiscountedFee(exam, freshStudent);
                  const examTicket = tickets.find(t => t.examId === exam.id);
                  
                  const isLoan = freshStudent.loanConfig?.examId === exam.id;
                  const loanAmount = freshStudent.loanConfig?.authorizedAmount || 0;

                  let displayAmount = final - paidForExam;
                  let showUnpaidBalance = false;
                  let cardTitle = exam.name;

                  if (isLoan) {
                    if (paidForExam < loanAmount) {
                      displayAmount = Math.max(0, loanAmount - paidForExam);
                      showUnpaidBalance = false;
                      cardTitle = exam.name;
                    } else if (paidForExam >= loanAmount && (final - paidForExam) > 0) {
                      displayAmount = final - paidForExam;
                      showUnpaidBalance = true;
                      cardTitle = exam.name;
                    }
                  }

                  const isPast = examTab === 'PAST';

                  return (
                    <div key={exam.id} className={`group relative rounded-[3rem] border transition-all p-10 overflow-hidden shadow-sm hover:shadow-2xl ${isPast ? 'bg-red-600 border-red-700 text-white' : showUnpaidBalance ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 hover:border-blue-900 text-slate-900'}`}>
                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-6">
                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border tracking-widest ${isPast || showUnpaidBalance ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>REF: {exam.id}</span>
                            {scholarshipName && (
                              <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse tracking-widest">
                                <i className="fa-solid fa-award mr-1"></i> {scholarshipName} Active
                              </span>
                            )}
                            {showUnpaidBalance && (
                              <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 tracking-widest">
                                <i className="fa-solid fa-circle-check mr-1"></i> Partial Clearance Active
                              </span>
                            )}
                          </div>
                          <h4 className="text-3xl font-black mb-1 uppercase font-serif tracking-tight leading-tight">{cardTitle}</h4>
                          {isPast && <p className="text-[10px] font-black uppercase text-white/70 mb-4 tracking-widest">{exam.name}</p>}
                          
                          <div className={`flex flex-wrap gap-x-8 gap-y-3 mb-8 ${isPast || showUnpaidBalance ? 'text-white/80' : 'text-slate-400'}`}>
                            <div className="flex items-center gap-3"><i className="fa-solid fa-calendar-day"></i><span className="text-[10px] font-black uppercase">{new Date(exam.dates).toLocaleDateString()}</span></div>
                            <div className="flex items-center gap-3"><i className="fa-solid fa-location-crosshairs"></i><span className="text-[10px] font-black uppercase tracking-wider">{exam.venue || 'Block G-2'}</span></div>
                          </div>

                          <div className={`flex items-end gap-10 pt-6 border-t ${isPast || showUnpaidBalance ? 'border-white/20' : 'border-slate-50'}`}>
                            <div className="flex flex-col">
                              <span className={`text-[8px] font-black uppercase tracking-[0.4em] mb-1 ${isPast || showUnpaidBalance ? 'text-white/60' : 'text-slate-300'}`}>
                                {showUnpaidBalance ? 'Deferred Remaining Balance' : isPast ? 'Overdue Unpaid Balance' : (isLoan && paidForExam < loanAmount ? 'Amount Due Now' : 'Payable Sum')}
                              </span>
                              <span className="text-4xl font-black font-serif leading-none">
                                ${displayAmount.toLocaleString()}
                              </span>
                            </div>
                            
                            {discount > 0 && (
                              <div className="flex flex-col">
                                <span className={`text-[8px] font-black uppercase tracking-[0.4em] mb-1 ${isPast || showUnpaidBalance ? 'text-white/40' : 'text-slate-300'}`}>Original Fee</span>
                                <span className={`text-xs font-black line-through ${isPast || showUnpaidBalance ? 'text-white/60' : 'text-slate-400'}`}>${original.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 min-w-[240px]">
                          {examTicket && (
                            <button
                              onClick={() => setSelectedTicketForPrint({ ticket: examTicket, exam })}
                              className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl active:scale-95"
                            >
                              <i className="fa-solid fa-ticket"></i> View Hall Ticket
                            </button>
                          )}
                          {isPast ? (
                            <div className="w-full py-4 px-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 bg-white/10 text-white/80 border border-white/20 select-none cursor-default">
                              <i className="fa-solid fa-eye text-xs"></i> View Only • Past Fee
                            </div>
                          ) : (!examTicket || showUnpaidBalance) && (
                            <button 
                              onClick={() => setSelectedExamForPayment(exam)} 
                              className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                                showUnpaidBalance
                                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20 active:scale-95'
                                  : (isLoan && paidForExam < loanAmount) 
                                  ? 'bg-blue-900 text-white hover:bg-black active:scale-95' 
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                              }`}
                            >
                              {showUnpaidBalance 
                                ? `Pay Remainder ($${displayAmount.toLocaleString()})` 
                                : final === 0 
                                ? 'Claim Waived Credential' 
                                : (isLoan && paidForExam < loanAmount) 
                                ? `Pay $${displayAmount.toLocaleString()}` 
                                : 'Finalize Clearance'} <i className="fa-solid fa-lock"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>
      </div>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl zoom-in duration-300">
            <div className="p-10 pb-0 flex items-center justify-between border-b border-slate-50 mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-serif italic font-black">History Node</h3>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                  <button onClick={() => setActiveHistoryTab('TX')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeHistoryTab === 'TX' ? 'bg-white text-blue-900 shadow-md' : 'text-slate-500'}`}>Transactions</button>
                  <button onClick={() => setActiveHistoryTab('TKT')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeHistoryTab === 'TKT' ? 'bg-white text-blue-900 shadow-md' : 'text-slate-500'}`}>Tickets</button>
                </div>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto scrollbar-admin">
              {activeHistoryTab === 'TX' ? (
                <div className="animate-in fade-in">
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Financial Audit Record Trace</span>
                  </div>
                  {payments.length === 0 ? (
                    <div className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest border-2 border-dashed rounded-[2rem]">Record archive is empty.</div>
                  ) : (
                    <div className="space-y-4">
                      {payments.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-8 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-blue-200 transition-all">
                          <div>
                            <p className="text-xs font-black uppercase text-slate-900">{getExamName(p.examId)}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{p.method} • {new Date(p.timestamp).toLocaleDateString()}</p>
                            <p className="text-[8px] text-blue-900 font-mono mt-1">TXID: {p.transactionId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-slate-900 font-serif">${p.amount.toLocaleString()}</p>
                            <p className={`text-[8px] font-black uppercase tracking-widest ${db.isPaymentSettledOrPartial(p.status) && String(p.status).toLowerCase() === 'partial' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {String(p.status).toLowerCase() === 'partial' ? 'PARTIAL' : 'VALIDATED'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in">
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Digital Exam Vault (Dedicated PDF Credentials)</span>
                  </div>
                  {tickets.length === 0 ? (
                    <div className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest border-2 border-dashed rounded-[2rem]">Vault is empty.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {tickets.map(t => {
                        const ex: Exam = allExams.find(e => e.id === t.examId) || {
                          id: t.examId,
                          name: 'Official Semester Examination',
                          session: 'Regular',
                          fee: 0,
                          dates: t.createdAt,
                          venue: 'Main Examination Hall'
                        };
                        const p = payments.find(pay => pay.id === t.paymentId);
                        return (
                          <TicketCardItem
                            key={t.id}
                            ticket={t}
                            exam={ex}
                            payment={p}
                            onDownload={() => setSelectedTicketForPrint({ ticket: t, exam: ex })}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedExamForPayment && <PaymentModal student={freshStudent} exam={selectedExamForPayment} onSuccess={handlePaymentSuccess} onCancel={() => setSelectedExamForPayment(null)} />}
      {isBalanceLeftModalOpen && <PaymentModal student={freshStudent} isBalanceLeft={true} onSuccess={handlePaymentSuccess} onCancel={() => setIsBalanceLeftModalOpen(false)} />}
      {selectedTicketForPrint && <PDFGenerator student={freshStudent} exam={selectedTicketForPrint.exam} ticket={selectedTicketForPrint.ticket} onClose={() => setSelectedTicketForPrint(null)} />}

      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl zoom-in duration-300">
            <div className="p-10 pb-6 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-900 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg">
                  <i className="fa-solid fa-bell"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase font-serif italic">Alert Vault</h3>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Administrative Command Records</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNotificationsOpen(false)} 
                className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-6 scrollbar-admin">
              {notifications.length === 0 ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest border-2 border-dashed rounded-[3rem]">No signals detected in the node.</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => !n.isRead && db.markNotificationRead(n.id)}
                    className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer ${n.isRead ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/50 border-blue-200 shadow-lg shadow-blue-900/5 ring-1 ring-blue-500'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${n.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>
                          {n.type}
                        </span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>}
                      </div>
                      <span className="text-[9px] text-slate-400 font-black uppercase">{new Date(n.timestamp).toLocaleString()}</span>
                    </div>
                    <h4 className="text-sm font-black uppercase text-slate-900 mb-2 leading-tight">{n.title}</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default StudentDashboard;