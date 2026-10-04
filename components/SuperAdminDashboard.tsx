
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { AdminUser, UserRole, AuditLog } from '../types';

const SuperAdminDashboard: React.FC = () => {
  const [managedAdmins, setManagedAdmins] = useState<AdminUser[]>([]);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ id: '', name: '', phoneNumber: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Password View Modal State
  const [viewPasswordModalOpen, setViewPasswordModalOpen] = useState(false);
  const [selectedAdminForView, setSelectedAdminForView] = useState<AdminUser | null>(null);
  const [superAdminAuthPass, setSuperAdminAuthPass] = useState('');
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [viewError, setViewError] = useState('');

  // Logs Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logTab, setLogTab] = useState<'SYSTEM' | 'SESSIONS'>('SYSTEM');

  // Logs Date Filters State
  const [filterToday, setFilterToday] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Requests Modal State
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);

  // Reset Confirmation State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);

  // Delete Confirmation State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteSuperAdminPassword, setDeleteSuperAdminPassword] = useState('');

  useEffect(() => {
    setManagedAdmins(db.getAdmins());
    const unsubscribe = db.subscribe(() => {
      setManagedAdmins(db.getAdmins());
    });
    // High-frequency tick for real-time online status (Hot Reload feel)
    const statusInterval = setInterval(() => setTick(t => t + 1), 3000);
    return () => { 
      unsubscribe(); 
      clearInterval(statusInterval);
    };
  }, [tick]);

  // Use Managed Admins directly since Legacy Admin 'admin' is now seeded in native storage
  const allAdmins = useMemo(() => {
    const filteredManaged = managedAdmins.filter(a => a.id.toLowerCase() !== 'superadmin');
    return filteredManaged.map(a => ({ ...a, lastSeen: db.getAdminStatus(a.id) }));
  }, [managedAdmins, tick]);

  const pendingRequests = useMemo(() => {
    return db.getFeeRemovalRequests().filter(r => r.status === 'PENDING');
  }, [tick]);

  const pendingRequestsCount = pendingRequests.length;

  const filteredAdmins = useMemo(() => {
    return allAdmins.filter(a => 
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.phoneNumber.includes(searchQuery)
    );
  }, [allAdmins, searchQuery]);

  // Filter logs to show only those related to Admin activities
  const auditLogs = useMemo(() => db.getAuditLogs(), [isLogModalOpen, tick]);

  const filteredAuditLogs = useMemo(() => {
    if (!isLogModalOpen) return [];
    
    const filtered = auditLogs.filter(log => {
      const logDateTime = new Date(log.timestamp);
      
      // Filter Today
      if (filterToday) {
        const today = new Date();
        const isSameDay = logDateTime.getDate() === today.getDate() &&
                          logDateTime.getMonth() === today.getMonth() &&
                          logDateTime.getFullYear() === today.getFullYear();
        if (!isSameDay) return false;
      }
      
      // Filter From Date
      if (filterFromDate) {
        const from = new Date(filterFromDate + 'T00:00:00');
        if (logDateTime < from) return false;
      }
      
      // Filter To Date
      if (filterToDate) {
        const to = new Date(filterToDate + 'T23:59:59');
        if (logDateTime > to) return false;
      }
      
      return true;
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [isLogModalOpen, auditLogs, filterToday, filterFromDate, filterToDate]);
  
  const adminActivityLogs = useMemo(() => {
    return filteredAuditLogs.filter(log => {
      const isActorAdmin = log.actorId === 'admin' || log.actorId === 'superadmin' || managedAdmins.some(a => a.id === log.actorId);
      return isActorAdmin; 
    });
  }, [filteredAuditLogs, managedAdmins]);

  const sessionLogs = useMemo(() => {
    return filteredAuditLogs.filter(log => log.action === 'ADMIN_LOGIN' || log.action === 'ADMIN_LOGOUT');
  }, [filteredAuditLogs]);

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const newAdmin: AdminUser = {
      id: adminForm.id.trim(), 
      name: adminForm.name,
      phoneNumber: adminForm.phoneNumber,
      password: 'pass12345',
      isSuspended: false,
      mustChangePassword: true,
      role: UserRole.ADMIN
    };
    db.addAdmin(newAdmin);
    setIsAdminModalOpen(false);
    setAdminForm({ id: '', name: '', phoneNumber: '' });
    setTick(t => t + 1);
  };

  const handleDeleteAdmin = (id: string) => {
    setDeleteTargetId(id);
    setDeleteSuperAdminPassword('');
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteAdmin = () => {
    const superPass = db.getSuperAdminPassword();
    if (deleteTargetId && deleteSuperAdminPassword === superPass) {
      db.deleteAdmin(deleteTargetId);
      setTick(t => t + 1);
      setCopyFeedback(`Deleted: ${deleteTargetId}`);
      setTimeout(() => setCopyFeedback(null), 3000);
      setIsDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleToggleSuspension = (id: string) => {
    db.toggleAdminSuspension(id);
    setTick(t => t + 1);
  };

  const handleResetPasswordRequest = (id: string) => {
    setResetTargetId(id);
    setIsResetConfirmOpen(true);
  };

  const executeResetPassword = () => {
    if (resetTargetId) {
      db.resetAdminPassword(resetTargetId);
      setTick(t => t + 1);
      setCopyFeedback(`Reset: ${resetTargetId}`);
      setTimeout(() => setCopyFeedback(null), 3000);
    }
    setIsResetConfirmOpen(false);
    setResetTargetId(null);
  };

  const initiateViewPassword = (admin: AdminUser) => {
    setSelectedAdminForView(admin);
    setSuperAdminAuthPass('');
    setRevealedPassword(null);
    setViewError('');
    setViewPasswordModalOpen(true);
  };

  const handleVerifySuperAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const superPass = db.getSuperAdminPassword();
    if (superAdminAuthPass === superPass) {
        if (selectedAdminForView) {
            setRevealedPassword(selectedAdminForView.password);
        }
    } else {
        setViewError('Access Denied: Invalid Super Admin Key');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 45000; // Active within 45 seconds
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-10 lg:px-16 py-10 animate-in fade-in duration-700">
      {copyFeedback && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest animate-in slide-in-from-top-4 shadow-2xl z-[100]">
          {copyFeedback.startsWith('Reset') || copyFeedback.startsWith('Deleted') ? 'Confirmed: ' + copyFeedback : 'Copied ' + copyFeedback + ' to Clipboard'}
        </div>
      )}

      {/* Header Section - No Card, Flat Design */}
      <div className="mb-8 md:mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8 md:pb-10">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter uppercase font-serif italic leading-none">Super Administrator Portal</h1>
          <p className="text-slate-400 font-bold uppercase text-[8px] md:text-[10px] tracking-[0.4em]">Administrative Authority Overlord</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="relative group w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Filter Registry..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border-2 border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold w-full focus:border-blue-900 outline-none transition-all shadow-sm"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
              <i className="fa-solid fa-search"></i>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setIsRequestsModalOpen(true)}
              className="relative flex-1 sm:flex-none bg-white text-slate-800 border-2 border-slate-200 px-4 md:px-6 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-sm hover:text-blue-900 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-stamp text-amber-500"></i> Requests
              {pendingRequestsCount > 0 && (
                <span className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setIsLogModalOpen(true)}
              className="flex-1 sm:flex-none bg-white text-slate-600 px-4 md:px-6 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-sm hover:text-blue-900 transition-all border border-slate-200"
            >
              <i className="fa-solid fa-list-ul mr-2"></i> Logs
            </button>
            <button 
              onClick={() => setIsAdminModalOpen(true)}
              className="flex-1 sm:flex-none bg-blue-950 text-white px-4 md:px-8 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Provision
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black uppercase font-serif text-slate-900">Administrative Personnel Registry</h3>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Credentials Vault & Status Monitor</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xl md:text-2xl font-black text-blue-600 uppercase tracking-widest">{allAdmins.length} Active Administrators</p>
          <p className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase tracking-widest">Global Administrative Coverage</p>
        </div>
      </div>
      
      {/* Table Section - Flat, no wrapping card visual */}
      <div className="table-responsive-container bg-white rounded-[3rem] border border-slate-200 shadow-sm mb-20">
        <table className="w-full text-xs min-w-[1000px]">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
            <tr>
              <th className="p-8 text-left">System Status</th>
              <th className="p-8 text-left">Identity ID (Login)</th>
              <th className="p-8 text-left">Full Name</th>
              <th className="p-8 text-left">Authorized Phone</th>
              <th className="p-8 text-left">Password Vault</th>
              <th className="p-8 text-left">Access Status</th>
              <th className="p-8 text-right">Control Directives</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAdmins.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-24 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No administrative assets matching your query.</td>
              </tr>
            ) : (
              filteredAdmins.map((admin, index) => {
                const isLegacy = admin.id === 'admin';
                const active = isOnline(admin.lastSeen);
                return (
                  <tr key={`${admin.id}-${index}`} className={`hover:bg-slate-50 transition-colors ${admin.isSuspended ? 'bg-red-50/30' : ''} ${isLegacy ? 'bg-blue-50/20' : ''}`}>
                    <td className="p-8">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${active ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {active ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-blue-900 text-sm">{admin.id}</span>
                        <button onClick={() => copyToClipboard(admin.id, 'ID')} className="text-slate-300 hover:text-blue-600 transition-colors">
                          <i className="fa-regular fa-copy text-[10px]"></i>
                        </button>
                        {isLegacy && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[7px] font-black uppercase">System</span>}
                      </div>
                    </td>
                    <td className="p-8 font-black uppercase text-sm tracking-tight">{admin.name}</td>
                    <td className="p-8 font-bold text-slate-600">{admin.phoneNumber}</td>
                    <td className="p-8">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group/key">
                        <code className="font-mono text-slate-900 font-bold bg-white px-2 py-1 rounded border shadow-inner">
                          ••••••••
                        </code>
                        <button 
                          onClick={() => initiateViewPassword(admin)} 
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="View Secured Key"
                        >
                          <i className="fa-regular fa-eye"></i>
                        </button>
                      </div>
                    </td>
                    <td className="p-8">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${admin.isSuspended ? 'bg-red-600 text-white shadow-lg' : 'bg-emerald-100 text-emerald-700'}`}>
                        {admin.isSuspended ? 'Suspended' : 'Operational'}
                      </span>
                    </td>
                    <td className="p-8 text-right">
                        <div className="flex justify-end gap-3">
                          <button 
                            onClick={() => handleResetPasswordRequest(admin.id)}
                            className="bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all shadow-sm border border-amber-500/20 flex items-center gap-2"
                            title="Reset Password & Force Change"
                          >
                            <i className="fa-solid fa-lock"></i> Reset Password
                          </button>
                          <button 
                            onClick={() => handleToggleSuspension(admin.id)}
                            className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all shadow-sm ${admin.isSuspended ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'}`}
                          >
                            {admin.isSuspended ? 'Restore' : 'Suspend'}
                          </button>
                          <button 
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all shadow-lg shadow-red-600/20"
                          >
                            Delete
                          </button>
                        </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Admin Provisioning Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-blue-950/80 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-12 shadow-2xl scrollbar-admin overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black uppercase font-serif italic mb-2 text-blue-900 text-center">Admin Provisioning</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-10 tracking-widest">Provisioning Administrative Account</p>
            
            <form onSubmit={handleCreateAdmin} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-4">Username / ID</label>
                <input 
                  required 
                  placeholder="e.g. ali2020" 
                  value={adminForm.id} 
                  onChange={e => setAdminForm({...adminForm, id: e.target.value})} 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-4">Legal Name</label>
                <input 
                  required 
                  placeholder="Full Legal Name" 
                  value={adminForm.name} 
                  onChange={e => setAdminForm({...adminForm, name: e.target.value})} 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-4">Primary Telephone</label>
                <input 
                  required 
                  placeholder="+252..." 
                  value={adminForm.phoneNumber} 
                  onChange={e => setAdminForm({...adminForm, phoneNumber: e.target.value})} 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-xl" 
                />
              </div>
              
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 text-[9px] font-bold text-blue-900 leading-relaxed uppercase tracking-widest text-center">
                SYSTEM: Default access key "pass12345" will be assigned. Rotation required on first entry.
              </div>

              <div className="flex gap-4 pt-6">
                 <button type="submit" className="flex-1 py-5 bg-blue-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all">Provision Administrator</button>
                 <button type="button" onClick={() => setIsAdminModalOpen(false)} className="px-8 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - SIMPLIFIED */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-950/80 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-12 shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 text-3xl shadow-inner">
                <i className="fa-solid fa-skull"></i>
            </div>
            <h3 className="text-2xl font-black uppercase text-slate-900 mb-4 font-serif italic">Confirm Destruction</h3>
            <p className="text-xs font-bold text-slate-500 uppercase leading-relaxed mb-8 tracking-wide">
                Are you sure you want to permanently delete admin: <span className="text-red-900 font-black">{deleteTargetId}</span>?
                <br/><br/>
                This action is irreversible. Enter Super Admin password to proceed.
            </p>
            
            <div className="mb-8 space-y-4">
                <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4">Super Admin Password</label>
                    <input 
                        type="password" 
                        autoFocus
                        value={deleteSuperAdminPassword}
                        onChange={(e) => setDeleteSuperAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black text-blue-950 focus:border-red-600 outline-none transition-colors text-2xl"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={executeDeleteAdmin} 
                    disabled={deleteSuperAdminPassword !== db.getSuperAdminPassword()}
                    className={`py-5 rounded-2xl font-black uppercase text-xs shadow-xl transition-all ${deleteSuperAdminPassword === db.getSuperAdminPassword() ? 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    Destroy Asset
                </button>
                <button onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTargetId(null); }} className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* System Logs Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black uppercase font-serif text-blue-900">Admin Intelligence Center</h3>
                <div className="flex gap-4 mt-2">
                    <button onClick={() => setLogTab('SYSTEM')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all ${logTab === 'SYSTEM' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-400 hover:text-blue-900'}`}>General Activity</button>
                    <button onClick={() => setLogTab('SESSIONS')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-all ${logTab === 'SESSIONS' ? 'bg-blue-900 text-white shadow-lg' : 'text-slate-400 hover:text-blue-900'}`}>Session Audit</button>
                </div>
              </div>
              <button 
                onClick={() => setIsLogModalOpen(false)} 
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Filter controls panel */}
            <div className="bg-slate-50 border-b border-slate-100 px-10 py-6 flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <button 
                  onClick={() => {
                    setFilterToday(!filterToday);
                    if (!filterToday) {
                      setFilterFromDate('');
                      setFilterToDate('');
                    }
                  }} 
                  className={`text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all border ${filterToday ? 'bg-emerald-600 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  <i className="fa-solid fa-calendar-day mr-2"></i>
                  {filterToday ? "Today: ON" : "Filter Today"}
                </button>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-slate-400">From</span>
                    <input 
                      type="date" 
                      value={filterFromDate} 
                      disabled={filterToday}
                      onChange={e => {
                        setFilterFromDate(e.target.value);
                        setFilterToday(false);
                      }} 
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold font-mono text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-slate-400">To</span>
                    <input 
                      type="date" 
                      value={filterToDate} 
                      disabled={filterToday}
                      onChange={e => {
                        setFilterToDate(e.target.value);
                        setFilterToday(false);
                      }} 
                      className="p-2 border border-slate-200 bg-white rounded-lg text-xs font-bold font-mono text-slate-700 outline-none hover:border-slate-300 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {(filterToday || filterFromDate || filterToDate) && (
                <button 
                  onClick={() => {
                    setFilterToday(false);
                    setFilterFromDate('');
                    setFilterToDate('');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors"
                >
                  <i className="fa-solid fa-filter-circle-xmark mr-1"></i> Clear Filters
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 scrollbar-admin bg-slate-50">
              {logTab === 'SYSTEM' ? (
                <div className="space-y-4">
                  {adminActivityLogs.map((log, index) => (
                    <div key={`${log.id}-${index}`} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center gap-6 shadow-sm">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 shrink-0 bg-blue-50 text-blue-900`}>
                        <i className="fa-solid fa-shield-halved"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-black uppercase text-blue-900">{log.actorId}</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[8px] font-black uppercase tracking-widest">{log.action}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{log.details}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-black uppercase text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</p>
                        <p className="text-[9px] font-black uppercase text-slate-300 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {sessionLogs.map((log, index) => (
                    <div key={`${log.id}-${index}`} className={`p-6 rounded-3xl border bg-white flex items-center gap-6 shadow-sm border-l-8 ${log.action === 'ADMIN_LOGIN' ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0 bg-slate-50 ${log.action === 'ADMIN_LOGIN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.action === 'ADMIN_LOGIN' ? <i className="fa-solid fa-sign-in-alt"></i> : <i className="fa-solid fa-sign-out-alt"></i>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-xs font-black uppercase text-slate-900`}>{log.actorId}</span>
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] ${log.action === 'ADMIN_LOGIN' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                            {log.action === 'ADMIN_LOGIN' ? 'LOGIN' : 'LOGOUT'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Authorized system session event</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-black uppercase text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</p>
                        <p className={`text-sm font-black font-mono text-slate-900`}>{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Password Modal */}
      {viewPasswordModalOpen && selectedAdminForView && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in zoom-in">
             <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative overflow-hidden">
                {!revealedPassword ? (
                    <form onSubmit={handleVerifySuperAdmin} className="space-y-6">
                        <h3 className="text-xl font-black uppercase font-serif text-center text-blue-900">Security Clearance</h3>
                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter Super Admin Key for Decryption</p>
                        <input 
                          type="password" 
                          autoFocus
                          required 
                          placeholder="Super Admin Password"
                          value={superAdminAuthPass} 
                          onChange={(e) => setSuperAdminAuthPass(e.target.value)}
                          className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black"
                        />
                        {viewError && <p className="text-center text-red-600 text-[10px] font-black uppercase">{viewError}</p>}
                        <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Verify Authority</button>
                        <button type="button" onClick={() => setViewPasswordModalOpen(false)} className="w-full text-slate-400 text-[9px] font-black uppercase">Cancel</button>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-black uppercase font-serif text-emerald-600 mb-2">Access Granted</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decrypted Credential for {selectedAdminForView.id}</p>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-2xl relative">
                            <p className="text-center text-white text-3xl font-mono tracking-wider">{revealedPassword}</p>
                            <button onClick={() => copyToClipboard(revealedPassword!, 'Password')} className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors">
                                <i className="fa-regular fa-copy"></i>
                            </button>
                        </div>
                        <button onClick={() => setViewPasswordModalOpen(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest">Close Secure View</button>
                    </div>
                )}
             </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-950/80 backdrop-blur-md p-4 animate-in zoom-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600 text-3xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 className="text-xl font-black uppercase text-slate-900 mb-4">Reset Credential</h3>
            <p className="text-xs font-bold text-slate-500 uppercase leading-relaxed mb-8">
                Reset password for <span className="text-blue-900 font-black">{resetTargetId}</span> to "pass12345"?
            </p>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={executeResetPassword} className="py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Yes, Reset</button>
                <button onClick={() => { setIsResetConfirmOpen(false); setResetTargetId(null); }} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Removal Requests Modal */}
      {isRequestsModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black uppercase font-serif text-amber-600">Pending Deletion Approvals</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Super Admin Authority Required</p>
              </div>
              <button 
                onClick={() => setIsRequestsModalOpen(false)} 
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 scrollbar-admin bg-slate-50 space-y-6">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i className="fa-solid fa-check"></i>
                  </div>
                  <h4 className="text-lg font-black uppercase text-slate-900 mb-1">Clear Ledger Status</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No pending student fee removal requests found.</p>
                </div>
              ) : (
                pendingRequests.map((req, index) => (
                  <div key={`${req.id}-${index}`} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-500">REQUEST #{req.id}</span>
                        <span className="text-[9px] font-black uppercase bg-amber-50 px-2 py-0.5 rounded text-amber-700">Awaiting Approval</span>
                      </div>
                      <h4 className="font-black text-slate-800 uppercase text-lg mb-1">{req.studentName} <span className="text-xs font-bold text-slate-400 font-mono">({req.studentId})</span></h4>
                      <p className="text-xs font-bold text-slate-600 uppercase mb-1">Exam: <span className="text-blue-900 font-black">{req.examName}</span></p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Requested by Admin <span className="font-black text-slate-700">{req.requestedBy}</span> on {new Date(req.requestedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Net Value</p>
                        <p className="text-2xl font-black text-slate-900 font-serif">${req.amount.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            db.approveFeeRemovalRequest(req.id);
                            setTick(t => t + 1);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => {
                            db.rejectFeeRemovalRequest(req.id);
                            setTick(t => t + 1);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
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

export default SuperAdminDashboard;
