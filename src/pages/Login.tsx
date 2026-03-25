import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const Login = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Giriş başarısız: ' + error.message);
    } else {
      toast.success('Başarıyla giriş yaptınız');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password) {
      toast.error('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error('Kayıt başarısız: ' + error.message);
    } else {
      toast.success('Kayıt başarılı, lütfen giriş yapın veya e-postanızı doğrulayın.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#131316] p-4 text-[#e4e1e6] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-repeat">
      <div className="max-w-md w-full bento-card p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--color-brand-primary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="text-center mb-8 relative z-10">
          <div className="bg-gradient-to-br from-[#10b981] to-[#4edea3] w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-[0_4px_20px_rgba(78,222,163,0.3)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#002113" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3a4 4 0 0 0 4-4V6a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1-2 2h-7a3 3 0 0 1-3-3"></path></svg>
          </div>
          <h2 className="text-3xl font-black text-white font-display tracking-tight">Finans Takip</h2>
          <p className="text-[var(--color-text-variant)] mt-2 font-mono text-xs sm:text-sm">Hesabınıza giriş yapın veya kayıt olun</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">E-posta Adresi</label>
            <input 
              type="email" 
              required
              placeholder="ornek@mail.com"
              className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Şifre</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:flex-1 primary-gradient-btn py-3 px-4 rounded-xl font-bold transition disabled:opacity-50"
            >
              {loading ? 'Bekleniyor...' : 'Giriş Yap'}
            </button>
            <button 
              type="button" 
              onClick={handleRegister}
              disabled={loading}
              className="w-full sm:flex-1 bg-[var(--color-surface-variant)]/40 hover:bg-[var(--color-surface-variant)]/80 border border-white/5 text-white py-3 px-4 rounded-xl transition disabled:opacity-50 font-bold"
            >
              Kayıt Ol
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
