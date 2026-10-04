
import React, { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import Navbar from './components/Navbar';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { UserRole, UserSession, Student, AccountStatus, AdminUser, TicketVerificationOfficer } from './types';
import { db } from './services/db';
import ResetPasswordModal from './components/ResetPasswordModal';
import { VerifierDashboard } from './components/VerifierDashboard';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [pendingSession, setPendingSession] = useState<UserSession | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [smsStatus, setSmsStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [resetMessage, setResetMessage] = useState('');
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Reset Flow State
  const [resetStep, setResetStep] = useState<'NONE' | 'TYPE' | 'ID' | 'PHONE' | 'OTP' | 'NEW_PASSWORD'>('NONE');
  const [resetRole, setResetRole] = useState<UserRole | null>(null);
  const [resetIdInput, setResetIdInput] = useState('');
  const [resetPhoneInput, setResetPhoneInput] = useState('');
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const savedSession = sessionStorage.getItem('edu_session');
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }

    const unsubscribe = db.subscribe(() => {
      const currentSession = sessionStorage.getItem('edu_session');
      if (currentSession) {
        const sess = JSON.parse(currentSession) as UserSession;
        if (sess.role === UserRole.ADMIN) {
          const freshAdminRecord = db.findAdminById(sess.user.id);
          if (freshAdminRecord && freshAdminRecord.isSuspended) {
             handleLogout();
             setError("ACCESS REVOKED: Your administrative privileges have been suspended by the Super Admin.");
          }
          if (!freshAdminRecord) {
             handleLogout();
             setError("ACCESS REVOKED: Account invalidated.");
          }
        }
      }
    });

    // Cleanup for real-time offline status when closing tab
    const handleUnload = () => {
      const currentSession = sessionStorage.getItem('edu_session');
      if (currentSession) {
        const sess = JSON.parse(currentSession) as UserSession;
        if (sess.role === UserRole.ADMIN || sess.role === UserRole.SUPER_ADMIN) {
          db.setAdminOffline(sess.user.id);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => { 
      unsubscribe(); 
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  useEffect(() => {
    if (session && (session.role === UserRole.ADMIN || session.role === UserRole.SUPER_ADMIN)) {
      const interval = setInterval(() => {
        db.updateAdminHeartbeat(session.user.id);
      }, 30000);
      
      db.updateAdminHeartbeat(session.user.id);
      
      return () => clearInterval(interval);
    }
  }, [session]);

  const triggerOtp = async (authResult: UserSession) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const primaryPhone = authResult.role === UserRole.STUDENT 
      ? (authResult.user as Student).phoneNumber 
      : (authResult.role === UserRole.ADMIN ? (authResult.user as AdminUser).phoneNumber : '+252000000000');
    
    setGeneratedOtp(otp);
    setPendingSession(authResult);
    setShowOtp(true);
    setSmsStatus('SENDING');
    
    db.addSecurityAlert({
      id: `OTP-${Date.now()}`,
      userId: authResult.user.id,
      timestamp: new Date().toISOString(),
      type: 'OTP_SENT',
      severity: 'LOW',
      details: `OTP dispatched to primary handset: ${primaryPhone}`,
      isResolved: true
    });
    
    setTimeout(() => {
      console.log(`%c 📱 [SECURE GATEWAY]: OTP Code for ${authResult.user.id} is ${otp}. Valid for 5 min. Only sent to ${primaryPhone}`, 'background: #111827; color: #10b981; padding: 10px; border-radius: 5px; font-weight: bold;');
      setSmsStatus('SENT');
    }, 1500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResetMessage('');

    const cleanId = loginId.trim();
    const verifiers = await db.getVerifiers();
    console.log("LOGIN ATTEMPT:", cleanId, verifiers);

    setTimeout(() => {
      const superPass = db.getSuperAdminPassword();
      if (cleanId.toLowerCase() === 'superadmin' && password === superPass) {
        triggerOtp({ user: { id: 'superadmin', name: 'Super Administrator' }, role: UserRole.SUPER_ADMIN });
      } 
      else {
        const managedAdmin = db.getAdmins().find(a => a.id.trim().toLowerCase() === cleanId.toLowerCase());
        
        if (managedAdmin) {
          if (managedAdmin.isSuspended) {
            setError('Your access has been suspended. Please contact the Super Admin.');
          } else if (managedAdmin.password === password) {
            triggerOtp({ user: managedAdmin, role: UserRole.ADMIN });
          } else {
            setError('Credential Mismatch.');
          }
        } else {
          const verifier = verifiers.find(v => v.id.trim().toLowerCase() === cleanId.toLowerCase());
          if (verifier) {
             if (!verifier.active) {
                setError('Account inactive. Please contact the Admin.');
             } else {
                let passwordMatches = false;
                try {
                  if (verifier.password && verifier.password === password) {
                    passwordMatches = true;
                  } else if (verifier.passwordHash && bcrypt.compareSync(password, verifier.passwordHash)) {
                    passwordMatches = true;
                  }
                } catch (e) {
                  if (verifier.password && verifier.password === password) {
                    passwordMatches = true;
                  }
                }

                if (passwordMatches) {
                   triggerOtp({ user: verifier, role: UserRole.TICKET_VERIFIER });
                } else {
                   setError('Credential Mismatch.');
                }
             }
          } else {
             const student = db.findStudentById(cleanId);
             if (!student) {
               setError('Identity ID not found.');
             } else if (student.status === AccountStatus.LOCKED) {
               setError('CRITICAL: Account LOCKED. Multiple failures detected.');
             } else if (student.status === AccountStatus.DELETED) {
               setError('Identity record archived in history.');
             } else {
               let passwordMatches = false;
               try {
                 if (student.passwordHash && bcrypt.compareSync(password, student.passwordHash)) {
                   passwordMatches = true;
                 } else if (student.password && student.password === password) {
                   passwordMatches = true;
                 }
               } catch (e) {
                 if (student.password && student.password === password) {
                   passwordMatches = true;
                 }
               }
               if (passwordMatches) {
                 if (student.passwordResetByAdmin) {
                   setResetMessage('Your previous password was reset by the administrator.');
                 }
                 triggerOtp({ user: student, role: UserRole.STUDENT });
               } else {
                 setError('Credential Mismatch.');
               }
             }
          }
        }
      }
      setIsLoading(false);
    }, 800);
  };

  const handleOtpVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput === generatedOtp && pendingSession) {
      if (pendingSession.role === UserRole.STUDENT) {
        const student = pendingSession.user as Student;
        const needsChange = !student.hasChangedPassword || student.passwordResetByAdmin;
        
        if (needsChange) {
          setShowPasswordChange(true);
        } else {
          finalizeLogin(pendingSession);
        }
      } else if (pendingSession.role === UserRole.ADMIN) {
        const adminUser = pendingSession.user as AdminUser;
        if (adminUser.mustChangePassword) {
          setShowPasswordChange(true);
        } else {
          finalizeLogin(pendingSession);
        }
      } else if (pendingSession.role === UserRole.TICKET_VERIFIER) {
        const verifier = pendingSession.user as TicketVerificationOfficer;
        if (verifier.mustChangePassword) {
          setShowPasswordChange(true);
        } else {
          finalizeLogin(pendingSession);
        }
      } else {
        finalizeLogin(pendingSession);
      }
    } else {
      setError('MFA Validation Failed.');
    }
  };

  const finalizeLogin = (sessionData: UserSession) => {
    setSession(sessionData);
    sessionStorage.setItem('edu_session', JSON.stringify(sessionData));

    if (sessionData.role === UserRole.ADMIN || sessionData.role === UserRole.SUPER_ADMIN) {
      db.addAuditLog({
        action: 'ADMIN_LOGIN',
        actorId: sessionData.user.id,
        targetId: 'DASHBOARD',
        details: 'System access authorized via security portal.'
      });
      db.updateAdminHeartbeat(sessionData.user.id);
    }

    setPendingSession(null);
    setShowOtp(false);
    setSmsStatus('IDLE');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pendingSession?.role === UserRole.STUDENT) {
      const student = pendingSession.user as Student;
      if (student.passwordChangeCount && student.passwordChangeCount >= 1 && !student.passwordResetByAdmin) {
        return setError('Security Policy: Password can only be changed once.');
      }

      const digitRegex = /^\d{6}$/;
      if (!digitRegex.test(newPassword)) {
        return setError('New key must be exactly 6 numeric digits.');
      }
      if (newPassword !== confirmPassword) {
        return setError('Keys must be identical.');
      }
      
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);
      const updated = { 
         ...student, 
         password: '', // Remove plain text password for security
         passwordHash: passwordHash,
         hasChangedPassword: true, 
         passwordResetByAdmin: false, 
         passwordChangeCount: (student.passwordChangeCount || 0) + 1,
         failedAttempts: 0 
       };
      
      db.updateStudent(updated);
      setShowPasswordChange(false);
      finalizeLogin({ ...pendingSession!, user: updated });
    } else if (pendingSession?.role === UserRole.ADMIN) {
      if (newPassword.length < 6) {
        return setError('New password must be at least 6 characters.');
      }
      if (newPassword !== confirmPassword) {
        return setError('Passwords must be identical.');
      }

      const admin = pendingSession.user as AdminUser;
      const updated = { ...admin, password: newPassword, mustChangePassword: false };
      db.updateAdmin(updated);
      setShowPasswordChange(false);
      finalizeLogin({ ...pendingSession!, user: updated });
    } else if (pendingSession?.role === UserRole.TICKET_VERIFIER) {
      if (newPassword.length < 6) {
        return setError('New password must be at least 6 characters.');
      }
      if (newPassword !== confirmPassword) {
        return setError('Passwords must be identical.');
      }

      const verifier = pendingSession.user as TicketVerificationOfficer;
      await db.updateVerifierPassword(verifier.id, newPassword);
      const updated = { ...verifier, mustChangePassword: false };
      setShowPasswordChange(false);
      finalizeLogin({ ...pendingSession!, user: updated });
    }
  };

  const handleLogout = () => {
    if (session && (session.role === UserRole.ADMIN || session.role === UserRole.SUPER_ADMIN)) {
      db.addAuditLog({
        action: 'ADMIN_LOGOUT',
        actorId: session.user.id,
        targetId: 'AUTH_PORTAL',
        details: 'System session terminated by user request.'
      });
      // Exact second offline status update
      db.setAdminOffline(session.user.id);
    }
    setSession(null);
    sessionStorage.removeItem('edu_session');
    setLoginId('');
    setPassword('');
    setShowOtp(false);
    setOtpInput('');
  };

  const handleResetCancel = () => {
    setResetStep('NONE');
    setResetRole(null);
    setResetIdInput('');
    setResetPhoneInput('');
    setResetTargetUser(null);
    setOtpInput('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetRoleSelect = (role: UserRole) => {
    if (role === UserRole.SUPER_ADMIN) {
      setResetRole(role);
      setResetStep('ID');
    } else {
      handleResetCancel();
      setError('Reset process stopped: Only Super Admin accounts supported.');
    }
  };

  const handleResetIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = resetIdInput.trim();
    let user: AdminUser | null = null;
    
    if (id.toLowerCase() === 'superadmin') {
      user = { id: 'superadmin', name: 'Super Administrator', phoneNumber: '+252000000000', role: UserRole.SUPER_ADMIN, password: db.getSuperAdminPassword(), isSuspended: false };
    } else {
      const found = db.getAdmins().find(a => a.id.toLowerCase() === id.toLowerCase() && a.role === UserRole.SUPER_ADMIN);
      if (found) user = found;
    }

    if (user) {
      setResetTargetUser(user);
      setResetStep('PHONE');
    } else {
      handleResetCancel();
      setError('Reset process stopped: Invalid Super Admin Identity.');
    }
  };

  const handleResetPhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPhoneInput.trim() === resetTargetUser?.phoneNumber) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setResetStep('OTP');
      setSmsStatus('SENDING');
      setTimeout(() => {
        console.log(`%c 📱 [RESET GATEWAY]: OTP Code for ${resetTargetUser?.id} is ${otp}`, 'background: #7c3aed; color: #fff; padding: 10px; border-radius: 5px; font-weight: bold;');
        setSmsStatus('SENT');
      }, 1500);
    } else {
      handleResetCancel();
      setError('Reset process stopped: Incorrect Phone Number.');
    }
  };

  const handleResetOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput === generatedOtp) {
      setResetStep('NEW_PASSWORD');
    } else {
      handleResetCancel();
      setError('Reset process stopped: MFA Validation Failed.');
    }
  };

  const handleResetPasswordFinal = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return setError('New password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords must be identical.');
    }

    if (resetTargetUser) {
      if (resetTargetUser.id.toLowerCase() === 'superadmin') {
        db.updateSuperAdminPassword(newPassword);
      } else {
        const existing = db.getAdmins().find(a => a.id === resetTargetUser.id);
        if (existing) {
          db.updateAdmin({ ...existing, password: newPassword });
        } else {
          db.addAdmin({ ...resetTargetUser, password: newPassword });
        }
      }
      
      db.addAuditLog({
        action: 'SUPER_ADMIN_PASSWORD_RESET',
        actorId: resetTargetUser.id,
        targetId: resetTargetUser.id,
        details: 'Super Admin password reset via security portal.'
      });
      
      setResetMessage('Password reset successful. Please login with your new credentials.');
      handleResetCancel();
    }
  };

  if (showPasswordChange) {
    const isStudent = pendingSession?.role === UserRole.STUDENT;
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-[3.5rem] p-12 max-w-md w-full shadow-2xl border-t-[12px] border-blue-900">
          <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Initialize Key</h2>
          {resetMessage && <p className="text-red-600 text-[10px] font-black uppercase mb-4 bg-red-50 p-2 rounded">{resetMessage}</p>}
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-10 leading-relaxed">
            {isStudent 
              ? "System access restricted. You must initialize your permanent 6-digit numeric secret key. This key can only be created once."
              : "Security Policy Enforcement: Your account requires a credential rotation. Please define a new secure password (min 6 characters)."}
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <input 
              type={isStudent ? "password" : "text"} 
              maxLength={isStudent ? 6 : undefined} 
              required 
              placeholder={isStudent ? "New 6-Digit Key" : "New Secure Password"} 
              onChange={e => setNewPassword(isStudent ? e.target.value.replace(/\D/g, '') : e.target.value)} 
              className="w-full p-5 bg-slate-50 rounded-2xl border-2 font-black text-center text-3xl" 
            />
            <input 
              type={isStudent ? "password" : "text"} 
              maxLength={isStudent ? 6 : undefined} 
              required 
              placeholder={isStudent ? "Verify 6-Digit Key" : "Verify Password"} 
              onChange={e => setConfirmPassword(isStudent ? e.target.value.replace(/\D/g, '') : e.target.value)} 
              className="w-full p-5 bg-slate-50 rounded-2xl border-2 font-black text-center text-3xl" 
            />
            {error && <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 p-4 rounded-xl border">{error}</p>}
            <button type="submit" className="w-full py-5 bg-blue-900 text-white rounded-2xl font-black uppercase tracking-widest">Authorize Key Activation</button>
          </form>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6">
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] shadow-2xl w-full max-w-5xl flex flex-col lg:flex-row overflow-hidden min-h-[auto] lg:min-h-[700px]">
          <div className="w-full lg:w-[42%] bg-blue-950 p-10 md:p-16 text-white flex flex-col justify-between">
            <h1 className="text-3xl md:text-5xl font-black uppercase italic font-serif text-center lg:text-left">EAU online ticket</h1>
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="w-48 h-48 md:w-72 md:h-72 bg-white rounded-full flex items-center justify-center shadow-2xl overflow-hidden border-8 border-white/10 p-4 md:p-6">
                <img 
                  src="/EAU.png" 
                  alt="East Africa University" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <p className="text-blue-200/60 uppercase tracking-widest text-[8px] md:text-[10px] text-center lg:text-left"></p>
          </div>
          <div className="w-full lg:w-[58%] p-10 md:p-16 flex flex-col justify-center bg-white">
            {resetStep !== 'NONE' ? (
              <div className="space-y-6 md:space-y-8 animate-in fade-in">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase font-serif">Reset Portal</h2>
                {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black text-center uppercase">{error}</div>}
                
                {resetStep === 'TYPE' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Account Type</p>
                    <div className="grid grid-cols-1 gap-3">
                      <button onClick={() => handleResetRoleSelect(UserRole.STUDENT)} className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-100 transition-all">Student</button>
                      <button onClick={() => handleResetRoleSelect(UserRole.ADMIN)} className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-100 transition-all">Administrator</button>
                      <button onClick={() => handleResetRoleSelect(UserRole.SUPER_ADMIN)} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-black transition-all shadow-lg">Super Administrator</button>
                    </div>
                    <button onClick={handleResetCancel} className="w-full text-[10px] font-black text-slate-400 uppercase mt-4 hover:text-slate-600">Cancel Process</button>
                  </div>
                )}

                {resetStep === 'ID' && (
                  <form onSubmit={handleResetIdSubmit} className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 2: Identity Verification</p>
                    <input type="text" required value={resetIdInput} onChange={e => setResetIdInput(e.target.value)} placeholder="Super Admin ID" className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 font-black focus:border-blue-900 outline-none transition-all" />
                    <button type="submit" className="w-full py-5 bg-blue-950 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Verify Identity</button>
                    <button type="button" onClick={handleResetCancel} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Cancel</button>
                  </form>
                )}

                {resetStep === 'PHONE' && (
                  <form onSubmit={handleResetPhoneSubmit} className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 3: Phone Verification</p>
                    <input type="text" required value={resetPhoneInput} onChange={e => setResetPhoneInput(e.target.value)} placeholder="Registered Phone Number" className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 font-black focus:border-blue-900 outline-none transition-all" />
                    <button type="submit" className="w-full py-5 bg-blue-950 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Verify Phone</button>
                    <button type="button" onClick={handleResetCancel} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Cancel</button>
                  </form>
                )}

                {resetStep === 'OTP' && (
                  <form onSubmit={handleResetOtpSubmit} className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 4: MFA Validation</p>
                    {smsStatus === 'SENT' && (
                      <div className="p-6 bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] animate-in zoom-in">
                        <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">RESET OTP RECEIVED</p>
                        <p className="text-3xl font-black text-emerald-950 font-mono tracking-tighter">{generatedOtp}</p>
                      </div>
                    )}
                    <input type="text" maxLength={6} required value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} className="w-full py-8 rounded-[2.5rem] bg-slate-50 border-4 border-slate-100 text-center font-black text-5xl focus:border-blue-900 outline-none transition-all" />
                    <button type="submit" className="w-full py-5 bg-blue-950 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Validate OTP</button>
                    <button type="button" onClick={handleResetCancel} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Cancel</button>
                  </form>
                )}

                {resetStep === 'NEW_PASSWORD' && (
                  <form onSubmit={handleResetPasswordFinal} className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 5: Define New Access Key</p>
                    <div className="space-y-4">
                      <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" title="Minimum 6 characters" className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 font-black focus:border-blue-900 outline-none transition-all" />
                      <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm New Password" className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-slate-100 font-black focus:border-blue-900 outline-none transition-all" />
                    </div>
                    <button type="submit" className="w-full py-5 bg-blue-950 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Update Credentials</button>
                    <button type="button" onClick={handleResetCancel} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Cancel</button>
                  </form>
                )}
              </div>
            ) : !showOtp ? (
              <form onSubmit={handleLogin} className="space-y-6 md:space-y-8">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase font-serif">Authentication</h2>
                {resetMessage && <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-[10px] font-black uppercase mb-4">{resetMessage}</div>}
                <div className="space-y-4 md:space-y-6">
                  <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Identity ID" className="w-full px-6 md:px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl bg-slate-50 border font-black" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access Key" className="w-full px-6 md:px-8 py-4 md:py-5 rounded-2xl md:rounded-3xl bg-slate-50 border font-black" />
                </div>
                {error && <div className="p-4 md:p-5 bg-red-50 text-red-600 rounded-2xl md:rounded-3xl text-[10px] font-black text-center uppercase">{error}</div>}
                <button type="submit" className="w-full py-5 md:py-6 bg-blue-950 text-white rounded-2xl md:rounded-[2rem] font-black uppercase tracking-widest transition-all">Authenticate Access</button>
                <div className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest mt-4">
                  Default: EAUGRW0001 / EAUGRW0001123 • Reset: 000000<br/>
                  Super Admin: superadmin / super123
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => setIsResetPasswordOpen(true)} className="w-full text-[10px] font-black text-blue-600 uppercase mt-4 hover:text-blue-800 transition-colors">Reset Password</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOtpVerify} className="space-y-6 md:space-y-8">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase font-serif">MFA Validation</h2>
                {smsStatus === 'SENT' && (
                  <div className="mb-6 md:mb-10 p-4 md:p-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl md:rounded-[2.5rem] animate-in zoom-in">
                    <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">SIMULATED SMS RECEIVED</p>
                    <p className="text-2xl md:text-3xl font-black text-emerald-950 font-mono">{generatedOtp}</p>
                  </div>
                )}
                <input type="text" maxLength={6} required value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} className="w-full py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] bg-slate-50 border-4 text-center font-black text-3xl md:text-5xl" />
                <button type="submit" className="w-full py-5 md:py-6 bg-blue-950 text-white rounded-2xl md:rounded-[2rem] font-black uppercase tracking-widest">Authorize Credentials</button>
              </form>
            )}
            {isResetPasswordOpen && <ResetPasswordModal onClose={() => setIsResetPasswordOpen(false)} />}
          </div>
        </div>
      </div>
    );
  }

  if (session && session.role === UserRole.TICKET_VERIFIER) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <VerifierDashboard session={session} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <Navbar session={session} onLogout={handleLogout} />
      <main className="pb-20">
        {session.role === UserRole.STUDENT && <StudentDashboard student={session.user as Student} />}
        {session.role === UserRole.ADMIN && <AdminDashboard currentUser={session.user as AdminUser} />}
        {session.role === UserRole.SUPER_ADMIN && <SuperAdminDashboard />}
      </main>
    </div>
  );
};

export default App;
