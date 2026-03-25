import { useState, FormEvent } from 'react';
import { useBankAccounts } from '../hooks/useBankAccounts';
import { BankAccountType, BankAccount } from '../types';
import { Landmark, Plus, Trash2, PiggyBank, Briefcase, CalendarClock, TrendingUp, Wallet, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export const BankAccountsPage = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useBankAccounts();

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('checking');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [taxRate, setTaxRate] = useState('7.5'); // Default stopaj
  const [maturityDate, setMaturityDate] = useState('');
  const [exemptAmount, setExemptAmount] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;

    setIsSubmitting(true);
    let errorMsg = null;
    
    const accountData = {
        name,
        account_type: accountType,
        balance: parseFloat(balance),
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        tax_rate: taxRate ? parseFloat(taxRate) : 0,
        maturity_date: maturityDate || null,
        exempt_amount: exemptAmount ? parseFloat(exemptAmount) : 0
    };

    try {
      if (editingId) {
        const { error } = await updateAccount(editingId, accountData);
        if (error) errorMsg = error;
      } else {
        const { error } = await addAccount(accountData);
        if (error) errorMsg = error;
      }
    } catch (e) {
      errorMsg = e;
    }

    if (!errorMsg) {
      toast.success(editingId ? 'Hesap başarıyla güncellendi!' : 'Banka hesabı eklendi!');
      setEditingId(null);
      setName('');
      setBalance('');
      setInterestRate('');
      setTaxRate('7.5');
      setMaturityDate('');
      setExemptAmount('');
    } else {
      toast.error('İşlem sırasında bir hata oluştu.');
      console.error(errorMsg);
    }
    setIsSubmitting(false);
  };

  // Summaries Calculations
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  
  let totalDailyInterest = 0;
  let totalMonthlyInterest = 0;

  accounts.forEach(acc => {
    const taxMulti = 1 - (acc.tax_rate || 0) / 100;
    if (acc.account_type === 'term_deposit' && acc.interest_rate) {
       const daily = (acc.balance * (acc.interest_rate / 100)) / 365;
       totalDailyInterest += daily * taxMulti;
       totalMonthlyInterest += daily * 30 * taxMulti;
    } else if (acc.account_type === 'daily_deposit' && acc.interest_rate) {
       const workingBalance = Math.max(0, acc.balance - acc.exempt_amount);
       const daily = (workingBalance * (acc.interest_rate / 100)) / 365;
       totalDailyInterest += daily * taxMulti;
       totalMonthlyInterest += daily * 30 * taxMulti;
    }
  });

  const handleEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setName(acc.name);
    setAccountType(acc.account_type);
    setBalance(acc.balance.toString());
    setInterestRate(acc.interest_rate ? acc.interest_rate.toString() : '');
    setTaxRate(acc.tax_rate !== undefined && acc.tax_rate !== null ? acc.tax_rate.toString() : '7.5');
    setMaturityDate(acc.maturity_date || '');
    setExemptAmount(acc.exempt_amount !== null && acc.exempt_amount !== undefined ? acc.exempt_amount.toString() : '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setBalance('');
    setInterestRate('');
    setTaxRate('7.5');
    setMaturityDate('');
    setExemptAmount('');
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#cda4ff] font-display flex items-center gap-3">
          <Landmark size={36} /> Banka Hesaplarım
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bento-card border border-[#cda4ff]/20">
             <p className="text-[#e2c7ff] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Nakit Bakiye</p>
             <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalBalance)}
             </h2>
          </div>
          <div className="bento-card border border-[#4edeb3]/20">
             <p className="text-[#4edeb3] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam NET Günlük Getiri</p>
             <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalDailyInterest)}
             </h2>
             <p className="text-xs text-[var(--color-text-variant)] mt-2 font-mono opacity-70">Stopaj Kesilmiş Net Bakiye</p>
          </div>
          <div className="bento-card border border-[#4edeb3]/20">
             <p className="text-[#4edeb3] font-bold text-xs uppercase tracking-widest font-mono mb-2">Aylık NET Tahmini Getiri</p>
             <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalMonthlyInterest)}
             </h2>
             <p className="text-xs text-[var(--color-text-variant)] mt-2 font-mono opacity-70">30 Günlük Tahmini Net Faiz</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bento-card">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              {editingId ? (
                <><Pencil size={18} className="text-[#4edeb3]" /> Hesabı Düzenle</>
              ) : (
                <><Plus size={18} className="text-[#cda4ff]" /> Yeni Hesap Ekle</>
              )}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Hesap Türü</label>
                <select value={accountType} onChange={e => setAccountType(e.target.value as BankAccountType)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors appearance-none">
                  <option value="checking">Vadesiz Hesap</option>
                  <option value="daily_deposit">Günlük Vadeli (Kaptan, Kiraz vb.)</option>
                  <option value="term_deposit">Klasik Vadeli Hesap</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Hesap Adı</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Örn: DenizBank Kaptan" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Toplam Bakiye (₺)</label>
                <input type="number" step="0.01" required value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
              </div>

              {(accountType === 'term_deposit' || accountType === 'daily_deposit') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Faiz Oranı (%)</label>
                    <input type="number" step="0.01" required value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="Örn: 45" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Stopaj (%)</label>
                    <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="Örn: 7.5" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
                  </div>
                </div>
              )}

              {accountType === 'term_deposit' && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Vade Sonu Tarihi</label>
                  <input type="date" required value={maturityDate} onChange={e => setMaturityDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
                </div>
              )}

              {accountType === 'daily_deposit' && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Vadesizde (Boşta) Kalan Tutar (₺)</label>
                  <input type="number" step="0.01" required value={exemptAmount} onChange={e => setExemptAmount(e.target.value)} placeholder="Örn: 5000" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
                  <p className="text-[9px] text-[var(--color-text-variant)] mt-1 ml-1 opacity-70">Hesabınızın kurallarına göre faiz işlemeyen boş bakiyeyi yazın (örn. 5000 ₺).</p>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={isSubmitting} className={`w-full text-black rounded-xl py-3 font-bold hover:brightness-110 transition disabled:opacity-50 ${editingId ? 'bg-gradient-to-r from-[#4edeb3] to-[#3bc49c]' : 'bg-gradient-to-r from-[#cda4ff] to-[#ae70fe]'}`}>
                  {editingId ? 'Değişiklikleri Kaydet' : 'Hesabı Kaydet'}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="w-full bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl py-3 font-bold hover:bg-white/5 transition">
                    İptal
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bento-card p-0 overflow-hidden flex flex-col h-full border border-[#cda4ff]/10">
            <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)] flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono flex items-center gap-2">
                Aktif Hesaplarınız
              </h3>
            </div>
            
            {loading ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Hesaplar Yükleniyor...</div>
            ) : accounts.length === 0 ? (
               <div className="p-12 text-center text-[var(--color-text-variant)]">Henüz banka hesabı eklemediniz.</div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                {accounts.map((acc, idx) => {
                  let workingBal = 0;
                  let dailyYield = 0;
                  let remainingDays = 0;
                  
                  if (acc.account_type === 'term_deposit') {
                     workingBal = acc.balance;
                     dailyYield = acc.interest_rate ? (workingBal * (acc.interest_rate / 100)) / 365 : 0;
                     if (acc.maturity_date) {
                        const today = new Date();
                        const maturity = new Date(acc.maturity_date);
                        const diffTime = maturity.getTime() - today.getTime();
                        remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                     }
                  } else if (acc.account_type === 'daily_deposit') {
                     workingBal = Math.max(0, acc.balance - acc.exempt_amount);
                     dailyYield = acc.interest_rate ? (workingBal * (acc.interest_rate / 100)) / 365 : 0;
                  }

                  const taxMultiplier = 1 - (acc.tax_rate || 0) / 100;
                  const netDailyYield = dailyYield * taxMultiplier;

                  return (
                    <li key={acc.id} className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className="bg-[#cda4ff]/10 text-[#cda4ff] p-3 rounded-2xl shadow-[inset_0_0_10px_rgba(205,164,255,0.1)] shrink-0">
                          {acc.account_type === 'checking' && <Wallet size={24} strokeWidth={2.5}/>}
                          {acc.account_type === 'term_deposit' && <CalendarClock size={24} strokeWidth={2.5}/>}
                          {acc.account_type === 'daily_deposit' && <TrendingUp size={24} strokeWidth={2.5}/>}
                        </div>
                        <div>
                          <p className="font-bold text-white text-base font-display">{acc.name}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                             <span className="text-[10px] text-[#cda4ff] border border-[#cda4ff]/30 px-2 py-0.5 rounded-md font-mono">
                               {acc.account_type === 'checking' ? 'Vadesiz' : acc.account_type === 'term_deposit' ? 'Vadeli' : 'Günlük Vadeli'}
                             </span>
                             {acc.interest_rate && (
                               <>
                                 <span className="text-[10px] text-[#4edeb3] border border-[#4edeb3]/30 px-2 py-0.5 rounded-md font-mono">
                                   Faiz: %{acc.interest_rate}
                                 </span>
                                 <span className="text-[10px] text-[var(--color-brand-secondary)] border border-[var(--color-brand-secondary)]/30 px-2 py-0.5 rounded-md font-mono">
                                   Stopaj: %{acc.tax_rate ?? 0}
                                 </span>
                               </>
                             )}
                          </div>
                          
                          {acc.account_type === 'term_deposit' && (
                             <p className="text-xs text-[var(--color-text-variant)] mt-2 font-mono">
                               Vade Kalen: <span className="text-white font-bold">{remainingDays} Gün</span> (Bitiş: {acc.maturity_date})
                             </p>
                          )}
                          {acc.account_type === 'daily_deposit' && (
                             <p className="text-xs text-[var(--color-text-variant)] mt-2 font-mono">
                               İşleyen: <strong className="text-white">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(workingBal)}</strong> <span className="opacity-50">•</span> Boşta: {acc.exempt_amount} ₺
                             </p>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                        <div>
                          <p className="font-black font-mono text-lg text-white">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(acc.balance)}
                          </p>
                          {netDailyYield > 0 && (
                             <p className="text-[10px] text-[var(--color-text-variant)] text-right mt-0.5 font-mono opacity-80 flex gap-1 justify-end">
                               Net Günlük: <span className="font-bold text-[#4edeb3]">+{netDailyYield.toFixed(2)} ₺</span>
                             </p>
                          )}
                        </div>
                        <div className="flex">
                            <button 
                              onClick={() => handleEdit(acc)}
                              className="p-2.5 text-[var(--color-text-variant)] hover:text-[#4edeb3] hover:bg-[#4edeb3]/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => deleteAccount(acc.id)}
                              className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
