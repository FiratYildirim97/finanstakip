import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, CreditCard, TrendingUp, Wallet, LogOut, Sprout, CalendarDays, PiggyBank, Landmark } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/transactions', icon: <CreditCard size={20} />, label: 'Kart' },
    { to: '/recurring', icon: <CalendarDays size={20} />, label: 'Aylık' },
    { to: '/savings', icon: <PiggyBank size={20} />, label: 'Birikim' },
    { to: '/investments', icon: <TrendingUp size={20} />, label: 'Yatırımlar' },
    { to: '/accounts', icon: <Landmark size={20} />, label: 'Hesaplar' },
    { to: '/net-worth', icon: <Wallet size={20} />, label: 'Varlık' },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-[#131316] text-[#e4e1e6] font-sans selection:bg-[#4edea3]/30 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-[#0e0e11] border-r border-white/5 flex-col relative z-20 shadow-2xl">
        <div className="p-8 flex items-center gap-3 border-b border-white/5">
          <div className="bg-gradient-to-br from-[#10b981] to-[#4edea3] p-2.5 rounded-xl text-[#002113] shadow-[0_4px_20px_rgba(78,222,163,0.3)]">
            <Sprout size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            FinansTakip
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-medium ${
                  isActive 
                    ? 'bg-[#1b1b1e] text-[#4edea3] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_4px_10px_rgba(0,0,0,0.5)] border border-white/5' 
                    : 'text-[#bbcabf] hover:bg-[#1f1f22] hover:text-white border border-transparent hover:border-white/5'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-[#0e0e11]">
          <div className="mb-4 px-2">
            <p className="text-[10px] text-[#86948a] font-bold uppercase tracking-widest font-mono">Operator</p>
            <p className="text-sm font-medium text-white truncate mt-1">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition font-medium border border-transparent hover:border-[#ffb4ab]/20"
          >
            <LogOut size={18} />
            Bağlantıyı Kes
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#0e0e11] border-b border-white/5 z-20 shadow-sm relative">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-[#10b981] to-[#4edea3] p-1.5 rounded-lg text-[#002113]">
              <Sprout size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              FinansTakip
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-lg transition"
          >
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-4 md:p-10 pb-28 md:pb-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat opacity-95 text-[#e4e1e6]">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0e0e11]/95 backdrop-blur-md border-t border-white/10 z-50 flex justify-around items-center px-2 py-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 p-2 px-4 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'text-[#4edea3]' 
                  : 'text-[#86948a] hover:text-white'
              }`
            }
          >
            {item.icon}
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
