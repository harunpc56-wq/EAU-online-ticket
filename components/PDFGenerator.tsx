import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { Student, Exam, HallTicket } from '../types';
import { db } from '../services/db';

interface PDFGeneratorProps {
  student: Student;
  exam: Exam;
  ticket: HallTicket;
  onClose: () => void;
}

const PDFGenerator: React.FC<PDFGeneratorProps> = ({ student, exam, ticket, onClose }) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const specificPayment = db.getPayments().find(p => p.id === ticket.paymentId);
  const isBalanceLeft = specificPayment?.method?.includes('Balance left') || false;
  const { discount, scholarshipName } = db.calculateDiscountedFee(exam, student);

  const [securityHash, setSecurityHash] = React.useState('');
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
  const [isQrGenerated, setIsQrGenerated] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [hasAutoDownloaded, setHasAutoDownloaded] = React.useState(false);

  // Generate cryptographic security hash and local QR code base64 Data URL
  React.useEffect(() => {
    let active = true;

    const generateSecurityHash = async () => {
      const data = `${student.id}-${ticket.id}-${ticket.createdAt}-${exam.id}-${ticket.serialNumber || ''}`;
      const msgUint8 = new TextEncoder().encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      if (active) {
        setSecurityHash(hashHex.substring(0, 32).toUpperCase());
      }
    };

    const generateQrCode = async () => {
      try {
        // Encode the official QR token, or fall back to serialNumber / id
        const qrPayload = ticket.qrToken || ticket.serialNumber || ticket.id;
        const dataUrl = await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 360,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        if (active) {
          setQrDataUrl(dataUrl);
          setIsQrGenerated(true);
        }
      } catch (err) {
        console.error("Local QR code generation error:", err);
      }
    };

    generateSecurityHash();
    generateQrCode();

    return () => { active = false; };
  }, [student.id, ticket.id, ticket.createdAt, ticket.serialNumber, ticket.qrToken, exam.id]);

  // Auto-download once the local QR data URL is generated and rendered in DOM
  React.useEffect(() => {
    if (!isQrGenerated || !qrDataUrl || hasAutoDownloaded) return;
    const timer = setTimeout(() => {
      handleDownload();
      setHasAutoDownloaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [isQrGenerated, qrDataUrl, hasAutoDownloaded]);

  const handleDownload = async () => {
    const element = printRef.current;
    if (!element || isDownloading) return;
    setIsDownloading(true);

    try {
      const canvas = await html2canvas(element, { 
        scale: 3, 
        useCORS: true,
        logging: false,
        allowTaint: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'px', 
        format: [canvas.width, canvas.height] 
      });

      // Embed PDF Metadata for security tracking
      pdf.setProperties({
        title: `Hall Ticket - ${student.name}`,
        subject: `Official Exam Credential with Scannable QR - ${exam.name}`,
        author: 'East Africa University - Board of Examinations',
        keywords: `EAU, Exam, Hall Ticket, ${student.id}, ${ticket.serialNumber || ticket.id}`,
        creator: 'EAU Secure Credential Engine'
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`EAU_SECURE_CREDENTIAL_${student.id}_${ticket.serialNumber || ticket.id}.pdf`);
    } catch (err) {
      console.error("HTML2Canvas capture failed, generating direct vector PDF:", err);
      // Fail-proof direct PDF generation fallback
      try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('EAST AFRICA UNIVERSITY', 105, 22, { align: 'center' });
        pdf.setFontSize(11);
        pdf.text('BOARD OF EXAMINATIONS - OFFICIAL HALL TICKET', 105, 29, { align: 'center' });

        pdf.setDrawColor(20, 40, 90);
        pdf.setLineWidth(0.8);
        pdf.line(20, 34, 190, 34);

        pdf.setFontSize(10);
        pdf.text(`Student Name: ${student.name}`, 20, 46);
        pdf.text(`Student ID: ${student.id}`, 20, 54);
        pdf.text(`Faculty & Unit: ${student.faculty} / ${student.department}`, 20, 62);
        pdf.text(`Examination: ${exam.name}`, 20, 70);
        pdf.text(`Scheduled Interval: ${new Date(exam.dates).toLocaleString()}`, 20, 78);
        pdf.text(`Designated Center: ${exam.venue || 'Main Examination Hall'}`, 20, 86);
        pdf.text(`Ticket Serial: ${ticket.serialNumber || ticket.id}`, 20, 94);
        pdf.text(`Issuance Timestamp: ${new Date(ticket.createdAt).toLocaleString()}`, 20, 102);
        pdf.text(`Validity: 20 Days from Issuance`, 20, 110);

        if (qrDataUrl) {
          pdf.addImage(qrDataUrl, 'PNG', 130, 42, 58, 58);
          pdf.setFontSize(8);
          pdf.text('SCAN TO VERIFY', 159, 104, { align: 'center' });
          pdf.text(ticket.serialNumber || ticket.id, 159, 108, { align: 'center' });
        }

        pdf.save(`EAU_SECURE_CREDENTIAL_${student.id}_${ticket.serialNumber || ticket.id}.pdf`);
      } catch (fbErr) {
        console.error("Fallback PDF generation failed:", fbErr);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const formatExactDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: true 
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="bg-white rounded-[3rem] p-6 sm:p-10 max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl scrollbar-admin">
        
        {/* Ticket Container */}
        <div ref={printRef} className={`p-8 sm:p-12 border-[12px] border-double relative overflow-hidden ${isBalanceLeft ? 'bg-red-600 border-white text-white' : 'bg-white border-blue-950 text-slate-900'}`}>
          
          {/* Enhanced Repeating Watermark */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04] flex flex-wrap gap-20 p-10 rotate-[-25deg] scale-150">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`text-4xl font-black uppercase whitespace-nowrap ${isBalanceLeft ? 'text-white' : 'text-blue-950'}`}>
                EAU OFFICIAL SECURE • {student.id} • VALIDATED
              </div>
            ))}
          </div>

          {/* Header Banner */}
          <div className={`flex items-center gap-6 sm:gap-8 border-b-4 pb-8 mb-8 relative z-10 ${isBalanceLeft ? 'border-white/20' : 'border-blue-950'}`}>
             <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-4 overflow-hidden shadow-inner ${isBalanceLeft ? 'bg-white/10 border-white' : 'bg-white border-blue-900'}`}>
                <img 
                  src="/EAU.png" 
                  alt="EAU University Logo" 
                  className="w-full h-full object-contain p-1" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('eastafricauniversity.net')) {
                      target.src = "https://www.eastafricauniversity.net/wp-content/uploads/2021/06/cropped-EAU-Logo-1-192x192.png";
                    }
                  }}
                />
             </div>
             <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                   <h1 className={`text-2xl sm:text-3xl font-black uppercase font-serif leading-none ${isBalanceLeft ? 'text-white' : 'text-blue-950'}`}>East Africa University-Garowe</h1>
                   <i className={`fa-solid fa-shield-check text-xl ${isBalanceLeft ? 'text-white/40' : 'text-blue-900/20'}`}></i>
                </div>
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-3 ${isBalanceLeft ? 'text-white/60' : 'text-gray-500'}`}>University Examination Office</p>
                <div className={`inline-block px-4 py-1.5 text-[9px] font-black rounded-full tracking-[0.3em] ${isBalanceLeft ? 'bg-white text-red-600' : 'bg-blue-950 text-white'}`}>Official Student Ticket</div>
             </div>
          </div>

          {/* Student Details & Scannable QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 relative z-10">
             <div className="space-y-4">
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/50' : 'text-gray-400'}`}>Full Legal Name</p>
                   <p className="text-lg font-black uppercase font-serif tracking-tight">{student.name}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/50' : 'text-gray-400'}`}>Examinee ID</p>
                   <p className={`text-lg font-black font-mono ${isBalanceLeft ? 'text-white' : 'text-blue-900'}`}>{student.id}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/50' : 'text-gray-400'}`}>Faculty & Department</p>
                   <p className={`text-xs font-bold ${isBalanceLeft ? 'text-white/80' : 'text-slate-700'}`}>{student.faculty} / {student.department}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/50' : 'text-gray-400'}`}>Validity Period</p>
                   <p className={`text-[10px] font-bold ${isBalanceLeft ? 'text-emerald-200' : 'text-emerald-700'}`}>
                     <i className="fa-solid fa-clock-check mr-1.5"></i>20 Days from Generation
                   </p>
                </div>
             </div>

             {/* Scannable QR Code Section (Always high-contrast black on white) */}
             <div className="flex flex-col items-center sm:items-end justify-center space-y-3">
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-300 shadow-md flex flex-col items-center">
                   {qrDataUrl ? (
                      <img 
                        src={qrDataUrl} 
                        alt={`QR Code for ${ticket.serialNumber || ticket.id}`} 
                        className="w-28 h-28 object-contain block" 
                      />
                   ) : (
                      <div className="w-28 h-28 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                         <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-1"></div>
                         <span className="text-[8px] font-black uppercase">Generating QR...</span>
                      </div>
                   )}
                   <p className="text-[8px] font-black uppercase text-slate-800 tracking-wider mt-1.5">
                     SCAN TO VERIFY
                   </p>
                   <p className="text-[7px] font-mono text-slate-500 font-bold">
                     {ticket.serialNumber || ticket.id}
                   </p>
                </div>
                <div className="text-center sm:text-right">
                   <p className={`text-[8px] font-black uppercase mb-0.5 ${isBalanceLeft ? 'text-white/60' : 'text-gray-400'}`}>Ticket Serial #</p>
                   <p className={`text-sm font-black font-mono ${isBalanceLeft ? 'text-white' : 'text-blue-900'}`}>{ticket.serialNumber || ticket.id}</p>
                </div>
             </div>
          </div>

          {/* Exam  Configuration */}
          <div className={`p-6 rounded-3xl mb-6 relative z-10 ${isBalanceLeft ? 'bg-white/10 border border-white/20' : 'bg-slate-900 text-white'}`}>
             <h4 className={`text-[9px] font-black uppercase tracking-[0.3em] mb-3 ${isBalanceLeft ? 'text-white/60' : 'text-blue-400'}`}>Exam Configuration</h4>
             <p className="text-lg sm:text-xl font-black uppercase mb-3 font-serif leading-tight">{exam.name}</p>
             <div className={`grid grid-cols-2 gap-4 pt-3 border-t ${isBalanceLeft ? 'border-white/10' : 'border-white/10'}`}>
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/40' : 'text-white/40'}`}>Scheduled Interval</p>
                   <p className="text-[10px] font-black">{new Date(exam.dates).toLocaleString()}</p>
                </div>
                <div>
                   <p className={`text-[8px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-white/40' : 'text-white/40'}`}>Designated Center</p>
                   <p className="text-[10px] font-black">{exam.venue || 'Main Examination Center'}</p>
                </div>
             </div>
          </div>

          {/* Financial Clearance Card */}
          <div className={`p-6 rounded-3xl mb-8 shadow-lg relative z-10 ${isBalanceLeft ? 'bg-white text-red-600' : 'bg-emerald-600 text-white shadow-emerald-900/10'}`}>
             <div className="flex justify-between items-center">
                <div className="flex-1">
                   <h4 className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${isBalanceLeft ? 'text-red-400' : 'text-white'}`}>Financial Clearance</h4>
                   <p className={`text-[8px] font-bold uppercase tracking-widest ${isBalanceLeft ? 'text-red-500' : 'text-emerald-100'}`}>
                     {isBalanceLeft ? 'BALANCE LEFT SETTLEMENT' : 'REMAINING BALANCE SETTLEMENT'}
                   </p>
                   {scholarshipName && !isBalanceLeft && (
                       <p className={`text-[8px] font-black uppercase mt-1 ${isBalanceLeft ? 'text-red-300' : 'text-emerald-200'}`}>Scholarship: {scholarshipName} (-${discount.toLocaleString()})</p>
                   )}
                </div>
                <div className="text-right">
                   <p className={`text-[9px] font-black uppercase mb-1 ${isBalanceLeft ? 'text-red-400' : 'text-emerald-200'}`}>Transaction Value</p>
                   <p className="text-2xl sm:text-3xl font-black">${(specificPayment?.amount || 0).toLocaleString()}</p>
                </div>
             </div>
             <div className="mt-4 pt-3 border-t flex justify-between items-end">
               <p className={`text-[8px] font-bold uppercase tracking-widest ${isBalanceLeft ? 'border-red-100 text-red-400' : 'border-white/20 text-emerald-50'}`}>
                 Authenticated Trace: {formatExactDateTime(ticket.createdAt)}
               </p>
               {securityHash && (
                 <div className="text-right">
                    <p className={`text-[6px] font-black uppercase mb-0.5 ${isBalanceLeft ? 'text-red-300' : 'text-emerald-200'}`}>Security Verification Hash</p>
                    <p className={`text-[7px] font-mono font-bold ${isBalanceLeft ? 'text-red-400' : 'text-white'}`}>{securityHash}</p>
                 </div>
               )}
             </div>
          </div>

          {/* Footer Seal */}
          <div className={`flex justify-between items-end pt-6 border-t-2 border-dashed ${isBalanceLeft ? 'border-white/20' : 'border-gray-200'}`}>
             <div className="text-center">
                <div className={`w-28 h-8 border-b mb-1 italic font-serif text-xs ${isBalanceLeft ? 'border-white/40 text-white/40' : 'border-gray-300 text-gray-400'}`}>Official Seal</div>
                <p className={`text-[8px] font-black uppercase tracking-widest ${isBalanceLeft ? 'text-white/40' : 'text-gray-400'}`}>University Head of Finance</p>
             </div>
             <div className={`px-5 py-2 rounded-full font-black text-[9px] uppercase tracking-widest ${isBalanceLeft ? 'bg-white text-red-600' : 'bg-blue-950 text-white'}`}>
                CLEARANCE: VALIDATED
             </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleDownload} 
            disabled={isDownloading || !isQrGenerated}
            className="flex-1 bg-blue-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest shadow-lg disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-file-pdf text-sm"></i>
                <span>Download Official PDF</span>
              </>
            )}
          </button>
          <button 
            onClick={onClose} 
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black px-8 py-4 rounded-2xl transition-all text-xs uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFGenerator;
