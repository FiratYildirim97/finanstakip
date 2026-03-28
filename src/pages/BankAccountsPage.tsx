import React, { useState, FormEvent, useMemo } from 'react';
import { useBankAccounts } from '../hooks/useBankAccounts';
import { BankAccountType, BankAccount } from '../types';
import { Landmark, Plus, Trash2, CalendarClock, TrendingUp, Wallet, Pencil, CheckCircle2, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Günlük vadeli hesap: Her gün faiz birikir → Toplam bakiye = ana para + birikmiş net faiz
 * Vadeli hesap: Vade bittiğinde anapara + faiz = Vadesiz olarak görünür
 */

// Yardımcı: İki tarih arasında geçen gün
function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// Yardımcı: İki tarih arasında kalan gün
function daysUntil(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Hesap için birikmiş faizi hesapla
function calculateAccruedInterest(acc: BankAccount, now: Date): { grossInterest: number; netInterest: number; daysAccrued: number; currentValue: number } {
  const taxMultiplier = 1 - (acc.tax_rate || 0) / 100;

  if (acc.account_type === 'daily_deposit') {
    const depositDate = acc.deposit_date || acc.created_at.split('T')[0];
    const daysAccrued = daysBetween(depositDate, now);
    const workingBal = Math.max(0, acc.balance - acc.exempt_amount);
    const dailyRate = acc.interest_rate ? (acc.interest_rate / 100) / 365 : 0;
    const grossInterest = workingBal * dailyRate * daysAccrued;
    const netInterest = grossInterest * taxMultiplier;
    return { grossInterest, netInterest, daysAccrued, currentValue: acc.balance + netInterest };
  }

  if (acc.account_type === 'term_deposit') {
    const depositDate = acc.deposit_date || acc.created_at.split('T')[0];
    const maturityDate = acc.maturity_date;
    
    if (!maturityDate) return { grossInterest: 0, netInterest: 0, daysAccrued: 0, currentValue: acc.balance };
    
    const totalDays = daysBetween(depositDate, new Date(maturityDate));
    const elapsedDays = daysBetween(depositDate, now);
    const actualDays = Math.min(elapsedDays, totalDays); // Vade dolmuşsa max gün sayısı
    
    const dailyRate = acc.interest_rate ? (acc.interest_rate / 100) / 365 : 0;
    const grossInterest = acc.balance * dailyRate * actualDays;
    const netInterest = grossInterest * taxMultiplier;
    
    return { grossInterest, netInterest, daysAccrued: actualDays, currentValue: acc.balance + netInterest };
  }

  return { grossInterest: 0, netInterest: 0, daysAccrued: 0, currentValue: acc.balance };
}

export const BankAccountsPage = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useBankAccounts();

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('checking');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [taxRate, setTaxRate] = useState('7.5');
  const [maturityDate, setMaturityDate] = useState('');
  const [exemptAmount, setExemptAmount] = useState('');
  const [depositDate, setDepositDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddingNew, setIsAddingNew] = useState(false);
  const isSubmittingRef = React.useRef(false); // To handle quick double clicks

  const now = useMemo(() => new Date(), []);

  // Hesapları sınıflandır: vadesi dolmuş → vadesiz gibi göster
  const processedAccounts = useMemo(() => {
    return accounts.map(acc => {
      const interest = calculateAccruedInterest(acc, now);
      const isMatured = acc.account_type === 'term_deposit' && acc.maturity_date && daysUntil(acc.maturity_date, now) <= 0;
      
      return {
        ...acc,
        ...interest,
        isMatured,
        displayType: isMatured ? 'matured' : acc.account_type,
      };
    });
  }, [accounts, now]);

  // Özet metrikleri
  const totalCurrentValue = processedAccounts.reduce((acc, curr) => acc + curr.currentValue, 0);
  const totalNetInterest = processedAccounts.reduce((acc, curr) => acc + curr.netInterest, 0);

  let totalDailyInterest = 0;
  processedAccounts.forEach(acc => {
    const taxMulti = 1 - (acc.tax_rate || 0) / 100;
    if (acc.account_type === 'term_deposit' && acc.interest_rate && !acc.isMatured) {
       const daily = (acc.balance * (acc.interest_rate / 100)) / 365;
       totalDailyInterest += daily * taxMulti;
    } else if (acc.account_type === 'daily_deposit' && acc.interest_rate) {
       const workingBalance = Math.max(0, acc.balance - acc.exempt_amount);
       const daily = (workingBalance * (acc.interest_rate / 100)) / 365;
       totalDailyInterest += daily * taxMulti;
    }
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !balance || isSubmittingRef.current) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    let errorMsg = null;
    
    const accountData = {
        name,
        account_type: accountType,
        balance: parseFloat(balance),
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        tax_rate: taxRate ? parseFloat(taxRate) : 0,
        maturity_date: maturityDate || null,
        exempt_amount: exemptAmount ? parseFloat(exemptAmount) : 0,
        deposit_date: depositDate || new Date().toISOString().split('T')[0],
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
      setIsAddingNew(false);
      resetForm();
    } else {
      toast.error('İşlem sırasında bir hata oluştu.');
      console.error(errorMsg);
    }
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  };

  const resetForm = () => {
    setName('');
    setBalance('');
    setInterestRate('');
    setTaxRate('7.5');
    setMaturityDate('');
    setExemptAmount('');
    setDepositDate('');
  };

  const handleEdit = (acc: BankAccount) => {
    setEditingId(acc.id);
    setIsAddingNew(false);
    setName(acc.name);
    setAccountType(acc.account_type);
    setBalance(acc.balance.toString());
    setInterestRate(acc.interest_rate ? acc.interest_rate.toString() : '');
    setTaxRate(acc.tax_rate !== undefined && acc.tax_rate !== null ? acc.tax_rate.toString() : '7.5');
    setMaturityDate(acc.maturity_date || '');
    setExemptAmount(acc.exempt_amount !== null && acc.exempt_amount !== undefined ? acc.exempt_amount.toString() : '0');
    setDepositDate(acc.deposit_date || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
    resetForm();
  };

  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

  // Grupla: Vadesiz/Aktif, Günlük Vadeli, Vadeli, Vadesi Dolmuş
  const maturedAccounts = processedAccounts.filter(a => a.isMatured);
  const checkingAccounts = processedAccounts.filter(a => a.account_type === 'checking');
  const dailyAccounts = processedAccounts.filter(a => a.account_type === 'daily_deposit');
  const termAccounts = processedAccounts.filter(a => a.account_type === 'term_deposit' && !a.isMatured);

  const isModalOpen = isAddingNew || editingId !== null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#cda4ff] font-display flex items-center gap-3">
          <Landmark size={36} /> Banka Hesaplarım
        </h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 flex-1">
            <div className="bento-card border border-[#cda4ff]/20">
               <p className="text-[#e2c7ff] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Güncel Değer</p>
               <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
                 {fmt(totalCurrentValue)}
               </h2>
               <p className="text-[10px] text-[var(--color-text-variant)] mt-1 font-mono">Ana para + birikmiş faiz</p>
            </div>
            <div className="bento-card border border-[#4edeb3]/20">
               <p className="text-[#4edeb3] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Birikmiş Faiz</p>
               <h2 className="text-2xl sm:text-3xl font-black text-[#4edeb3] font-display tracking-tight mt-1">
                 +{fmt(totalNetInterest)}
               </h2>
               <p className="text-[10px] text-[var(--color-text-variant)] mt-1 font-mono">Stopaj kesilmiş net</p>
            </div>
            <div className="bento-card border border-[#4edeb3]/20">
               <p className="text-[#4edeb3] font-bold text-xs uppercase tracking-widest font-mono mb-2">NET Günlük Getiri</p>
               <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
                 +{fmt(totalDailyInterest)}
               </h2>
               <p className="text-[10px] text-[var(--color-text-variant)] mt-1 font-mono">Bugünkü günlük</p>
            </div>
            <div className="bento-card border border-[#4edeb3]/20">
               <p className="text-[#4edeb3] font-bold text-xs uppercase tracking-widest font-mono mb-2">Aylık NET Getiri</p>
               <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight mt-1">
                 +{fmt(totalDailyInterest * 30)}
               </h2>
               <p className="text-[10px] text-[var(--color-text-variant)] mt-1 font-mono">30 günlük tahmini</p>
            </div>
        </div>
        <div className="flex flex-col justify-center">
            <button
              onClick={() => { resetForm(); setIsAddingNew(true); }}
              className="h-full px-8 py-4 bg-gradient-to-r from-[#cda4ff]/20 to-[#ae70fe]/20 border border-[#cda4ff]/30 text-[#cda4ff] rounded-3xl font-bold flex flex-row xl:flex-col items-center justify-center gap-3 hover:bg-[#cda4ff]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={28} />
              <span className="whitespace-nowrap text-lg">Hesap Ekle</span>
            </button>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={cancelEdit}>
            <div 
              className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#cda4ff]/10 to-[#ae70fe]/10 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                  {editingId ? (
                    <><Pencil size={20} className="text-[#4edeb3]" /> Hesabı Düzenle</>
                  ) : (
                    <><Plus size={20} className="text-[#cda4ff]" /> Yeni Hesap Ekle</>
                  )}
                </h3>
              </div>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
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
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                  {accountType === 'term_deposit' ? 'Yatırılan Ana Para (₺)' : 'Toplam Bakiye (₺)'}
                </label>
                <input type="number" step="0.01" required value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
              </div>

              {(accountType === 'term_deposit' || accountType === 'daily_deposit') && (
                <>
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
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Yatırma Tarihi</label>
                    <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors" />
                    <p className="text-[9px] text-[var(--color-text-variant)] mt-1 ml-1 opacity-70">Boş bırakılırsa bugünün tarihi kullanılır.</p>
                  </div>
                </>
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
                  <p className="text-[9px] text-[var(--color-text-variant)] mt-1 ml-1 opacity-70">Hesabınızın kurallarına göre faiz işlemeyen boş bakiyeyi yazın.</p>
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
          </div>
        )}

        <div className="space-y-6 w-full mt-6">
          
          {/* Vadesi Dolmuş - Vadesiz olarak göster */}
          {maturedAccounts.length > 0 && (
            <div className="bento-card p-0 overflow-hidden border border-[#4edeb3]/30">
              <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-[#4edeb3]/10 to-transparent flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#4edeb3]" />
                <h3 className="font-bold text-[#4edeb3] uppercase tracking-wider text-sm font-mono">Vadesi Dolmuş — Vadesiz Bakiye</h3>
              </div>
              <ul className="divide-y divide-white/5">
                {maturedAccounts.map((acc, idx) => (
                  <li key={acc.id} className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="bg-[#4edeb3]/15 text-[#4edeb3] p-3 rounded-2xl shrink-0 relative">
                        <Wallet size={24} strokeWidth={2.5}/>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#4edeb3] rounded-full flex items-center justify-center">
                          <CheckCircle2 size={10} className="text-black" />
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-white text-base font-display">{acc.name}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                           <span className="text-[10px] text-[#4edeb3] border border-[#4edeb3]/30 px-2 py-0.5 rounded-md font-mono bg-[#4edeb3]/5">
                             ✅ Vadesi Doldu → Vadesiz
                           </span>
                           <span className="text-[10px] text-white/60 font-mono">
                             Vade: {acc.maturity_date}
                           </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                          <span className="text-[var(--color-text-variant)]">Ana Para:</span>
                          <span className="text-white font-bold">{fmt(acc.balance)}</span>
                          <span className="text-[var(--color-text-variant)]">Brüt Faiz:</span>
                          <span className="text-white">{fmt(acc.grossInterest)}</span>
                          <span className="text-[var(--color-text-variant)]">Stopaj (-%{acc.tax_rate}):</span>
                          <span className="text-red-300">-{fmt(acc.grossInterest - acc.netInterest)}</span>
                          <span className="text-[var(--color-text-variant)]">Net Faiz:</span>
                          <span className="text-[#4edeb3] font-bold">+{fmt(acc.netInterest)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                      <div>
                        <p className="text-[10px] text-[var(--color-text-variant)] font-mono mb-0.5">Çekilebilir Toplam</p>
                        <p className="font-black font-mono text-xl text-[#4edeb3]">
                          {fmt(acc.currentValue)}
                        </p>
                      </div>
                      <div className="flex">
                          <button onClick={() => handleEdit(acc)} className="p-2.5 text-[#4edeb3] bg-[#4edeb3]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#4edeb3] lg:hover:bg-[#4edeb3]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                            <Pencil size={18} />
                          </button>
                          <button onClick={() => deleteAccount(acc.id)} className="p-2.5 text-[#ff7886] bg-[#ffb4ab]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#ff7886] lg:hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                            <Trash2 size={18} />
                          </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vadesiz Hesaplar */}
          {checkingAccounts.length > 0 && (
            <AccountGroup
              title="Vadesiz Hesaplar"
              icon={<Wallet size={18} className="text-[#cda4ff]" />}
              accounts={checkingAccounts}
              onEdit={handleEdit}
              onDelete={deleteAccount}
              fmt={fmt}
              borderColor="#cda4ff"
            />
          )}

          {/* Günlük Vadeli */}
          {dailyAccounts.length > 0 && (
            <AccountGroup
              title="Günlük Vadeli Hesaplar"
              subtitle="Her gün faiz birikir"
              icon={<TrendingUp size={18} className="text-[#4edeb3]" />}
              accounts={dailyAccounts}
              onEdit={handleEdit}
              onDelete={deleteAccount}
              fmt={fmt}
              borderColor="#4edeb3"
              showInterestDetails
            />
          )}

          {/* Vadeli Hesaplar */}
          {termAccounts.length > 0 && (
            <AccountGroup
              title="Vadeli Hesaplar"
              subtitle="Vade bitiminde faiz + anapara → vadesiz"
              icon={<CalendarClock size={18} className="text-[#ae70fe]" />}
              accounts={termAccounts}
              onEdit={handleEdit}
              onDelete={deleteAccount}
              fmt={fmt}
              borderColor="#ae70fe"
              showInterestDetails
              showMaturity
            />
          )}

          {!loading && accounts.length === 0 && (
            <div className="bento-card p-12 text-center text-[var(--color-text-variant)]">Henüz banka hesabı eklemediniz.</div>
          )}
          {loading && (
            <div className="bento-card p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Hesaplar Yükleniyor...</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Reusable hesap grubu bileşeni
interface AccountGroupProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accounts: any[];
  onEdit: (acc: any) => void;
  onDelete: (id: string) => void;
  fmt: (n: number) => string;
  borderColor: string;
  showInterestDetails?: boolean;
  showMaturity?: boolean;
}

function AccountGroup({ title, subtitle, icon, accounts, onEdit, onDelete, fmt, borderColor, showInterestDetails, showMaturity }: AccountGroupProps) {
  return (
    <div className="bento-card p-0 overflow-hidden" style={{ borderColor: `${borderColor}20`, borderWidth: 1 }}>
      <div className="px-6 py-4 border-b border-white/5 bg-[var(--color-surface-container)] flex items-center gap-2">
        {icon}
        <div>
          <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono">{title}</h3>
          {subtitle && <p className="text-[10px] text-[var(--color-text-variant)] font-mono mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <ul className="divide-y divide-white/5">
        {(accounts as any[]).map((acc: any, idx: number) => {
          const remaining = acc.maturity_date ? daysUntil(acc.maturity_date, new Date()) : 0;
          
          return (
            <li key={acc.id} className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
              <div className="flex items-center gap-4 md:gap-5">
                <div className="p-3 rounded-2xl shrink-0" style={{ backgroundColor: `${borderColor}15`, color: borderColor }}>
                  {acc.account_type === 'checking' && <Wallet size={24} strokeWidth={2.5}/>}
                  {acc.account_type === 'term_deposit' && <CalendarClock size={24} strokeWidth={2.5}/>}
                  {acc.account_type === 'daily_deposit' && <TrendingUp size={24} strokeWidth={2.5}/>}
                </div>
                <div>
                  <p className="font-bold text-white text-base font-display">{acc.name}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                     <span className="text-[10px] border px-2 py-0.5 rounded-md font-mono" style={{ color: borderColor, borderColor: `${borderColor}40` }}>
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
                  
                  {showInterestDetails && acc.daysAccrued > 0 && (
                    <div className="mt-2 text-[11px] font-mono space-y-0.5">
                      <p className="text-[var(--color-text-variant)]">
                        <Clock size={10} className="inline mr-1" />
                        {acc.daysAccrued} gündür faiz işliyor 
                        {acc.deposit_date && <span className="opacity-60"> (Yatırma: {acc.deposit_date})</span>}
                      </p>
                      <p className="text-[#4edeb3]">
                        Birikmiş net faiz: <strong>+{fmt(acc.netInterest)}</strong>
                        <span className="text-[var(--color-text-variant)] ml-1">(brüt: {fmt(acc.grossInterest)})</span>
                      </p>
                    </div>
                  )}
                  
                  {showMaturity && acc.maturity_date && (
                    <div className="mt-2 text-[11px] font-mono flex items-center gap-2">
                      <CalendarClock size={11} className="text-[var(--color-text-variant)]" />
                      <span className="text-[var(--color-text-variant)]">
                        Kalan: <span className="text-white font-bold">{remaining} gün</span>
                        <span className="opacity-50 ml-1">(Bitiş: {acc.maturity_date})</span>
                      </span>
                    </div>
                  )}
                  
                  {acc.account_type === 'daily_deposit' && (
                     <p className="text-[11px] text-[var(--color-text-variant)] mt-1 font-mono">
                       İşleyen: <strong className="text-white">{fmt(Math.max(0, acc.balance - acc.exempt_amount))}</strong>
                       <span className="opacity-50 mx-1">•</span>
                       Boşta: {fmt(acc.exempt_amount)}
                     </p>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                <div>
                  {showInterestDetails ? (
                    <>
                      <p className="text-[10px] text-[var(--color-text-variant)] font-mono mb-0.5">Bugünkü Değer</p>
                      <p className="font-black font-mono text-lg text-white">
                        {fmt(acc.currentValue)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-variant)] font-mono mt-0.5 flex gap-1 justify-end items-center">
                        <span className="opacity-60">Ana:</span> {fmt(acc.balance)}
                        <ArrowRight size={9} className="opacity-40" />
                        <span className="text-[#4edeb3]">+{fmt(acc.netInterest)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="font-black font-mono text-lg text-white">
                      {fmt(acc.balance)}
                    </p>
                  )}
                </div>
                <div className="flex">
                    <button onClick={() => onEdit(acc)} className="p-2.5 text-[#4edeb3] bg-[#4edeb3]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#4edeb3] lg:hover:bg-[#4edeb3]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => onDelete(acc.id)} className="p-2.5 text-[#ff7886] bg-[#ffb4ab]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#ff7886] lg:hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                      <Trash2 size={18} />
                    </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
