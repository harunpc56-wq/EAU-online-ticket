import React, { useState } from 'react';
import { db } from '../services/db';

interface AdminAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  adminId: string;
}

const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onSuccess, onCancel, adminId }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verify Logic
    const adminRecord = db.findAdminById(adminId);
    let isAuthenticated = false;
    if (adminRecord) isAuthenticated = adminRecord.password === password;

    if (isAuthenticated) {
      onSuccess();
      setPassword('');
      setError('');
    } else {
      setError('Invalid Admin Password');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-black mb-4 uppercase">Admin Authentication</h2>
        {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
        <input 
          type="password"
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="Admin Password" 
          className="w-full p-4 mb-4 border rounded-xl"
          autoFocus
        />
        <div className="flex gap-4">
          <button type="button" onClick={onCancel} className="flex-1 p-4 bg-slate-100 rounded-xl font-bold uppercase text-[10px]">Cancel</button>
          <button type="submit" className="flex-1 p-4 bg-blue-900 text-white rounded-xl font-black uppercase text-[10px]">Authorize</button>
        </div>
      </form>
    </div>
  );
};

export default AdminAuthModal;
