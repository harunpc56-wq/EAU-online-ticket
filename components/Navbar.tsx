
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, UserSession, Notification } from '../types';
import { db } from '../services/db';
import { playNotificationSound } from '../services/audio';
import { useTheme } from '../ThemeContext';

interface NavbarProps {
  session: UserSession | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ session, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const lastNotificationCount = useRef(notifications.length);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (session) {
      setNotifications(db.getNotifications(session.user.id));
      unsubscribe = db.subscribe(() => {
        const newNotifications = db.getNotifications(session.user.id);
        
        // Check for new notifications
        if (newNotifications.length > lastNotificationCount.current) {
          playNotificationSound();
        }
        
        lastNotificationCount.current = newNotifications.length;
        setNotifications(newNotifications);
      }) as unknown as (() => void);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-[100] backdrop-blur-md bg-white/80 dark:bg-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20 items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg overflow-hidden p-1.5 dark:bg-blue-950 dark:border dark:border-blue-900">
              <img 
                src="/EAU.png" 
                alt="EAU Logo" 
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-blue-900 dark:text-blue-400 font-black text-sm md:text-lg tracking-tighter uppercase font-serif italic leading-none">East Africa University</span>
              <span className="text-[8px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] hidden sm:block">Academic Management Portal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/55 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
              title={`${theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} Mode`}
              aria-label="Toggle System Layout Theme"
            >
              {theme === 'dark' ? (
                <i className="fa-solid fa-sun text-amber-400 text-sm md:text-base"></i>
              ) : (
                <i className="fa-solid fa-moon text-slate-600 text-sm md:text-base"></i>
              )}
            </button>

            {session ? (
              <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Session</span>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-400 uppercase">{session.user.name}</span>
                </div>
                
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-xl flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                >
                  <i className="fa-solid fa-bell"></i>
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>

                <button 
                  onClick={onLogout}
                  className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-xl flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                  title="Terminate Session"
                >
                  <i className="fa-solid fa-power-off"></i>
                </button>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="text-blue-900 dark:text-blue-400 font-bold text-xs md:text-sm flex items-center gap-2 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/45 px-3 py-1.5 md:px-4 md:py-2.5 rounded-xl border border-blue-100 dark:border-blue-900/60 transition-all">
                  <i className="fa-solid fa-shield-halved"></i> Secure Portal
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNotifications && session && (
        <div className="absolute right-4 md:right-20 mt-2 w-80 bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[110] overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <h4 className="text-xs font-black uppercase text-slate-900 dark:text-slate-200">Recent Alerts</h4>
            <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase">No alerts.</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`p-4 border-b border-slate-50 dark:border-slate-800/60 ${!n.isRead ? 'bg-amber-50/70 dark:bg-amber-955/20' : ''}`}>
                  <h5 className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-100">{n.title}</h5>
                  <p className="text-[9px] text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-2 font-bold">{new Date(n.timestamp).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
