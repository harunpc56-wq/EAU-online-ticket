
import React, { useState } from 'react';
import { db } from '../services/db';

interface ResetPasswordModalProps {
  onClose: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<'USERNAME' | 'PHONE' | 'OTP' | 'PASSWORD'>('USERNAME');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [otpData, setOtpData] = useState<{ code: string, expiry: number } | null>(null);
  const [smsMessage, setSmsMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSmsMessage('');

    if (step === 'USERNAME') {
      if (username.toLowerCase() === 'superadmin') setStep('PHONE');
      else setError('Invalid Username');
    } else if (step === 'PHONE') {
      if (phone === '+252000000000') {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setOtpData({ code, expiry: Date.now() + 60000 });
        setSmsMessage(`SIMULATED SMS RECEIVED: Your OTP is ${code}`);
        setStep('OTP');
      } else setError('Invalid Phone Number');
    } else if (step === 'OTP') {
      if (otpData && otpData.code === otp && Date.now() < otpData.expiry) setStep('PASSWORD');
      else setError('Invalid or Expired OTP');
    } else if (step === 'PASSWORD') {
      db.updateSuperAdminPassword(newPassword);
      alert('Password Updated');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl w-full max-w-sm">
        <h2 className="text-xl font-black mb-4 uppercase">{step}</h2>
        {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
        {smsMessage && <p className="text-emerald-600 text-xs mb-4 font-bold">{smsMessage}</p>}
        {step === 'USERNAME' && <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full p-4 mb-4 border rounded-xl" />}
        {step === 'PHONE' && <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (+252...)" className="w-full p-4 mb-4 border rounded-xl" />}
        {step === 'OTP' && <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="OTP" className="w-full p-4 mb-4 border rounded-xl" />}
        {step === 'PASSWORD' && <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" className="w-full p-4 mb-4 border rounded-xl" />}
        <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-xl">Continue</button>
        <button type="button" onClick={onClose} className="w-full py-2 mt-2 text-slate-400">Cancel</button>
      </form>
    </div>
  );
};

export default ResetPasswordModal;
