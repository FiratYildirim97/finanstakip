import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, ReceiptText, TrendingUp, Wallet, LogOut, Sprout } from 'lucide-react';

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
    { to: '/transactions', icon: <ReceiptText size={20} />, label: 'Harcama / Gelir' },
    { to: '/investments', icon: <TrendingUp size={20} />, label: 'Yatırımlar' },
    { to: '/net-worth', icon: <Wallet size={20} />, label: 'Net Varlık' },
  ];

  return (
    <div className="flex h-screen bg-[#131316] text-[#e4e1e6] font-sans selection:bg-[#4edea3]/30">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0e0e11] border-r border-white/5 flex flex-col relative z-20 shadow-2xl">
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
      <main className="flex-1 overflow-y-auto p-10 relative z-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat opacity-95 text-[#e4e1e6]">
        <div className="max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
