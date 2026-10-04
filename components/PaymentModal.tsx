import React, { useState, useEffect } from 'react';
import { Student, Exam, PaymentStatus, Payment, PaymentSettings } from '../types';
import { db } from '../services/db';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// Initialize Stripe with a test publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx');

interface StripePaymentFormProps {
  amount: number;
  totalFee: number;
  paidSoFar: number;
  student: Student;
  exam?: Exam | null;
  isBalanceLeft?: boolean;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
  methodLabel: string;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ amount, totalFee, paidSoFar, student, exam, isBalanceLeft, onSuccess, onCancel, methodLabel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (isBalanceLeft) {
        const pastDebt = db.getStudentPastDebt(student.id);
        if (amount > pastDebt) {
          throw new Error(`Payment amount $${amount} exceeds outstanding past debt of $${pastDebt}.`);
        }
        const payments = db.payStudentBalance(student.id, amount, `Card (${methodLabel})`);
        onSuccess(payments[0] || {
          id: `TXN-BAL-${Date.now()}`,
          studentId: student.id,
          examId: 'BALANCE_CLEARANCE',
          amount,
          status: PaymentStatus.PAID,
          transactionId: `STRIPE-${Date.now()}`,
          timestamp: new Date().toISOString(),
          method: `Card (${methodLabel})`
        });
      } else if (exam) {
        const isPartial = (paidSoFar + amount) < totalFee;
        const newPayment: Payment = {
          id: `TXN-STRIPE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          studentId: student.id,
          examId: exam.id,
          amount: amount,
          status: isPartial ? PaymentStatus.PARTIAL : PaymentStatus.PAID,
          transactionId: `STRIPE-${Date.now()}`,
          timestamp: new Date().toISOString(),
          method: methodLabel
        };
        db.addPayment(newPayment);
        await db.syncImmediately();
        onSuccess(newPayment);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1e1b4b',
                '::placeholder': { color: '#94a3b8' },
              },
              invalid: { color: '#ef4444' },
            },
          }}
        />
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black text-center border border-red-100 uppercase animate-shake">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full py-6 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all ${processing ? 'bg-slate-300' : 'bg-blue-900 hover:bg-black active:scale-95 shadow-blue-900/20'}`}
      >
        {processing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-lock"></i>}
        Authorize ${amount.toLocaleString()}
      </button>
      
      <button type="button" onClick={onCancel} disabled={processing} className="w-full text-slate-400 text-[10px] font-black uppercase hover:text-slate-900 transition-colors">Discard Transaction</button>
    </form>
  );
};

interface PaymentModalProps {
  student: Student;
  exam?: Exam | null;
  isBalanceLeft?: boolean;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ student, exam, isBalanceLeft, onSuccess, onCancel }) => {
  const [settings, setSettings] = useState<PaymentSettings>(db.getPaymentSettings());
  const [method, setMethod] = useState<'CARD' | 'MOBILE' | 'BANK'>('CARD');
  const [isProcessing, setIsProcessing] = useState(false);

  const pastDebt = db.getStudentPastDebt(student.id);
  const isPastFee = !isBalanceLeft && exam ? db.isExamExpiredOrPast(exam) : false;

  const paymentsForExam = (!isBalanceLeft && exam) ? db.getPayments().filter(p => p.studentId === student.id && p.examId === exam.id && db.isPaymentSettledOrPartial(p.status)) : [];
  const paidAmount = paymentsForExam.reduce((sum, p) => sum + p.amount, 0);
  
  const discountInfo = (!isBalanceLeft && exam) ? db.calculateDiscountedFee(exam, student) : { original: pastDebt, discount: 0, final: pastDebt, scholarshipName: undefined };
  const { original, discount, final, scholarshipName } = discountInfo;
  
  const remBal = isBalanceLeft ? pastDebt : Math.max(0, final - paidAmount);
  
  const [customAmount, setCustomAmount] = useState<number>(remBal);

  useEffect(() => {
    setCustomAmount(remBal);
  }, [remBal]);

  const isLoan = (!isBalanceLeft && exam) ? student.loanConfig?.examId === exam.id : false;
  const loanAmount = (!isBalanceLeft && exam) ? student.loanConfig?.authorizedAmount || 0 : 0;
  
  let payableAmount = remBal;
  if (!isBalanceLeft && isLoan && paidAmount < loanAmount) {
    payableAmount = Math.max(0, loanAmount - paidAmount);
  }

  const finalPayable = isBalanceLeft ? customAmount : payableAmount;

  useEffect(() => {
    const currentSettings = db.getPaymentSettings();
    setSettings(currentSettings);
    if (!currentSettings.allowCard) {
      if (currentSettings.allowMobile) setMethod('MOBILE');
      else if (currentSettings.allowBank) setMethod('BANK');
    }
  }, []);

  const handlePay = () => {
    if (isPastFee) {
      alert("Past/Expired fees cannot be paid directly. They are view-only.");
      return;
    }
    if (finalPayable <= 0 || finalPayable > remBal) {
      alert(`Please enter a valid payment amount between $1 and $${remBal.toLocaleString()}.`);
      return;
    }

    if (method === 'CARD') {
      return;
    }

    setIsProcessing(true);
    // Instant execution without artificial setTimeout delay
    if (isBalanceLeft) {
      const payments = db.payStudentBalance(student.id, finalPayable, method);
      setIsProcessing(false);
      onSuccess(payments[0] || {
        id: `TXN-BAL-${Date.now()}`,
        studentId: student.id,
        examId: 'BALANCE_CLEARANCE',
        amount: finalPayable,
        status: finalPayable >= remBal ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        transactionId: `EAU-BAL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method
      });
    } else if (exam) {
      const isPartial = (paidAmount + finalPayable) < final;
      const finalMethod = isLoan && paidAmount < loanAmount ? `Partial Payment / ${method}` : method;
      
      const newPayment: Payment = {
        id: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        studentId: student.id,
        examId: exam.id,
        amount: finalPayable,
        status: isPartial ? PaymentStatus.PARTIAL : PaymentStatus.PAID,
        transactionId: `EAU-TRX-${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: finalMethod
      };

      db.addPayment(newPayment);
      db.syncImmediately();
      setIsProcessing(false);
      onSuccess(newPayment);
    }
  };

  const noMethodsAvailable = !settings.allowCard && !settings.allowMobile && !settings.allowBank;
  const finalMethodLabel = !isBalanceLeft && isLoan && paidAmount < loanAmount ? `Partial Payment / ${method}` : method;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden zoom-in duration-200">
        <div className="p-6 sm:p-8 bg-blue-900 text-white flex-shrink-0">
          <h3 className="text-xl font-black uppercase font-serif italic">
            {isBalanceLeft ? 'Institutional Debt Clearance' : 'Institutional Checkout'}
          </h3>
          <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest mt-1">
            {isBalanceLeft ? 'Total Outstanding Balance Settlement' : 'Authorized Credentialing Gateway'}
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 scrollbar-admin">
          {isPastFee ? (
            <div className="p-6 bg-red-50 border-2 border-red-200 rounded-3xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl">
                <i className="fa-solid fa-lock"></i>
              </div>
              <div>
                <h4 className="text-sm font-black uppercase text-red-900 tracking-wider">Past / Expired Fee (View-Only)</h4>
                <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                  This fee expired on its scheduled due date and is retained for university financial clearance audit records only. Direct payments cannot be initiated for past/expired fees.
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-red-100 text-left space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">Fee Name:</span>
                  <span className="font-black text-slate-800 uppercase">{exam?.name}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">Assessed Fee:</span>
                  <span className="font-black text-slate-800 font-serif">${final.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase">Total Paid To Date:</span>
                  <span className="font-black text-emerald-600 font-serif">${paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-100 pt-2">
                  <span className="text-red-600 font-black uppercase">Unpaid Balance:</span>
                  <span className="font-black text-red-600 font-serif text-base">${remBal.toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all"
              >
                Close Record
              </button>
            </div>
          ) : (
            <>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 font-bold uppercase tracking-widest">
                {isBalanceLeft ? 'Account Total Debt' : 'Designation'}
              </span>
              <span className="font-black text-slate-800 uppercase">
                {isBalanceLeft ? `${student.name} (${student.id})` : exam?.name}
              </span>
            </div>
            
            {scholarshipName && !isBalanceLeft && (
              <div className="flex justify-between text-[8px] text-emerald-600 font-black uppercase tracking-widest mb-3">
                <span>Scholarship Active</span>
                <span>{scholarshipName}</span>
              </div>
            )}

            <div className="border-t border-slate-100 mt-4 pt-4">
              {discount > 0 && !isBalanceLeft && (
                <div className="flex items-center justify-end gap-4 mb-2">
                  <span className="text-[8px] font-black text-slate-300 uppercase line-through">${original.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-emerald-500 uppercase">Discount: -${discount.toLocaleString()}</span>
                </div>
              )}
              {isLoan && !isBalanceLeft && (final - payableAmount) > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 mb-3 text-[10px] space-y-1">
                  <div className="flex justify-between font-bold text-amber-800">
                    <span>Original Fee:</span>
                    <span>${final.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-700">
                    <span>Remaining Balance (Debt):</span>
                    <span className="font-black">+${(final - payableAmount).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex justify-between items-center w-full">
                  <span className="font-black text-slate-800 uppercase text-[10px] tracking-[0.3em]">
                    {isBalanceLeft ? 'Total Debt Balance' : 'Amount Due Now'}
                  </span>
                  <span className="font-black text-blue-900 text-3xl font-serif">
                    ${isBalanceLeft ? customAmount.toLocaleString() : payableAmount.toLocaleString()}
                  </span>
                </div>
                {isBalanceLeft && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Enter Payment Amount (Max: ${remBal.toLocaleString()})
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-600">$</span>
                      <input
                        type="number"
                        min="1"
                        max={remBal}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(Math.max(0, Math.min(remBal, Number(e.target.value))))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[10, 25, 50, 100].map(amt => amt <= remBal && (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCustomAmount(amt)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-black text-slate-700 uppercase"
                        >
                          ${amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCustomAmount(remBal)}
                        className="px-2.5 py-1 bg-blue-900 text-white rounded-lg text-[9px] font-black uppercase"
                      >
                        Full (${remBal})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Payment Selection</label>
            {noMethodsAvailable ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black text-center border border-red-100 uppercase">Gateways Offline</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {settings.allowMobile && (
                  <button onClick={() => setMethod('MOBILE')} className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${method === 'MOBILE' ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                    <i className="fa-solid fa-mobile-screen text-lg mb-2"></i>
                    <span className="text-[9px] font-black uppercase text-center">Mobile Money</span>
                  </button>
                )}
                {settings.allowCard && (
                  <button onClick={() => setMethod('CARD')} className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${method === 'CARD' ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                    <i className="fa-solid fa-credit-card text-lg mb-2"></i>
                    <span className="text-[9px] font-black uppercase text-center">Card</span>
                  </button>
                )}
                {settings.allowBank && (
                  <button onClick={() => setMethod('BANK')} className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition-all ${method === 'BANK' ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                    <i className="fa-solid fa-building-columns text-lg mb-2"></i>
                    <span className="text-[9px] font-black uppercase text-center">Bank</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {method === 'CARD' && settings.allowCard ? (
            <Elements stripe={stripePromise}>
              <StripePaymentForm 
                amount={payableAmount} 
                totalFee={isBalanceLeft ? pastDebt : final}
                paidSoFar={paidAmount}
                student={student} 
                exam={exam} 
                isBalanceLeft={isBalanceLeft}
                onSuccess={onSuccess} 
                onCancel={onCancel}
                methodLabel={finalMethodLabel}
              />
            </Elements>
          ) : (
            <>
              <button
                onClick={handlePay}
                disabled={isProcessing || noMethodsAvailable}
                className={`w-full py-6 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 transition-all ${isProcessing || noMethodsAvailable ? 'bg-slate-300' : 'bg-blue-900 hover:bg-black active:scale-95 shadow-blue-900/20'}`}
              >
                {isProcessing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-lock"></i>}
                Authorize ${payableAmount.toLocaleString()}
              </button>
              
              <button onClick={onCancel} disabled={isProcessing} className="w-full text-slate-400 text-[10px] font-black uppercase hover:text-slate-900 transition-colors">Discard Transaction</button>
            </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
