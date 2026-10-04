import React, { useState } from 'react';
import { UserSession } from '../types';
import { db } from '../services/db';
import { Scanner } from '@yudiel/react-qr-scanner';
import { CheckCircle, XCircle, LogOut, Camera, User, Lock, Loader2 } from 'lucide-react';

interface Props {
  session: UserSession;
  onLogout: () => void;
}

export const VerifierDashboard: React.FC<Props> = ({ session, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'verify'>('verify');
  const [isScanning, setIsScanning] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    status: 'VALID' | 'INVALID';
    ticket?: any;
    reason?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  const [manualInput, setManualInput] = useState('');

  const handleScan = async (result: string) => {
    if (isVerifying || !result) return;
    setIsVerifying(true);
    setIsScanning(false);
    try {
      const res = await fetch('/api/verify-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: result, verifierId: session.user.id })
      });
      const data = await res.json();
      if (data.valid) {
        setVerifyResult({ status: 'VALID', ticket: data.ticket });
      } else {
        setVerifyResult({ status: 'INVALID', reason: data.reason });
      }
    } catch (err) {
      setVerifyResult({ status: 'INVALID', reason: 'Network error or backend unreachable.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScan(manualInput.trim());
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    try {
       await db.updateVerifierPassword(session.user.id, passwordForm.new);
       setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
       setPasswordForm({ old: '', new: '', confirm: '' });
    } catch(err) {
       setPasswordMsg({ type: 'error', text: 'Failed to update password.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-xl text-gray-900">Verification Portal</span>
          </div>
          <div className="flex space-x-4">
             <button
              onClick={() => setActiveTab('verify')}
              className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'verify' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Verify Ticket
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'profile' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Profile
            </button>
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'verify' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Scan QR Code</h2>
            
            {!isScanning && !verifyResult && !isVerifying && (
              <div className="flex flex-col items-center w-full max-w-md space-y-6">
                <button
                  onClick={() => setIsScanning(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center space-x-3 transition-colors shadow-md"
                >
                  <Camera className="w-6 h-6" />
                  <span>Verify Ticket</span>
                </button>

                <div className="w-full flex items-center gap-3">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-xs uppercase text-gray-400 font-bold tracking-wider">or verify by token / serial</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <form onSubmit={handleManualVerify} className="w-full flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Ticket Serial or QR Token..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Check
                  </button>
                </form>
              </div>
            )}

            {isScanning && (
              <div className="w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden shadow-inner relative">
                <Scanner 
                   onScan={(result: any) => {
                     if (Array.isArray(result) && result[0]?.rawValue) {
                       handleScan(result[0].rawValue);
                     } else if (result?.rawValue) {
                       handleScan(result.rawValue);
                     } else if (typeof result === 'string') {
                       handleScan(result);
                     }
                   }}
                   components={{ onOff: true }}
                />
                <button 
                  onClick={() => setIsScanning(false)}
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            )}

            {isVerifying && (
              <div className="flex flex-col items-center space-y-4 py-12">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="text-gray-600 font-medium">Verifying ticket...</p>
              </div>
            )}

            {verifyResult && (
              <div className={`w-full max-w-md rounded-xl p-6 shadow-md border ${verifyResult.status === 'VALID' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex flex-col items-center text-center">
                  {verifyResult.status === 'VALID' ? (
                    <>
                      <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                      <h1 className="text-3xl font-black text-green-700 mb-2">VALID</h1>
                      <h2 className="text-xl font-bold text-green-800 mb-6">TICKET VERIFIED</h2>
                      
                      <div className="w-full space-y-3 text-left bg-white p-4 rounded-lg shadow-sm border border-green-100">
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Ticket Number</p>
                          <p className="font-mono text-gray-900">{verifyResult.ticket.serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Student Name</p>
                          <p className="font-bold text-gray-900">{verifyResult.ticket.studentName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Student ID</p>
                          <p className="font-mono text-gray-900">{verifyResult.ticket.studentId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Amount</p>
                          <p className="font-bold text-gray-900">${verifyResult.ticket.amount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Status</p>
                          <p className="font-bold text-green-600">{verifyResult.ticket.status}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase">Verified</p>
                          <p className="text-gray-900">{new Date(verifyResult.ticket.verifiedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-20 h-20 text-red-500 mb-4" />
                      <h1 className="text-3xl font-black text-red-700 mb-2">INVALID</h1>
                      <h2 className="text-xl font-bold text-red-800 mb-6">INVALID TICKET</h2>
                      
                      <div className="w-full bg-white p-4 rounded-lg shadow-sm border border-red-100 text-left">
                        <p className="font-semibold text-red-700 mb-2">This ticket could not be verified.</p>
                        <p className="text-red-600 text-sm">{verifyResult.reason || 'The QR code is invalid, expired or does not exist.'}</p>
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => setVerifyResult(null)}
                    className={`mt-8 w-full py-3 rounded-lg font-bold text-white transition-colors ${verifyResult.status === 'VALID' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-gray-800">
              <User className="w-6 h-6 text-blue-600" />
              <span>Officer Profile</span>
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Officer Name</p>
                  <p className="text-lg font-semibold text-gray-900">{session.user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Officer ID</p>
                  <p className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded inline-block">{session.user.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Email Address</p>
                  <p className="text-gray-900">{(session.user as any).email || 'officer@institutional.edu'}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border">
                <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                  <Lock className="w-5 h-5 text-gray-600" />
                  <span>Change Password</span>
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordMsg.text && (
                    <div className={`p-3 rounded text-sm ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {passwordMsg.text}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.new}
                      onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-md hover:bg-gray-800 transition-colors">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
