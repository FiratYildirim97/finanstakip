import React, { useState, useEffect } from 'react';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useGoldDays } from '../hooks/useGoldDays';
import { useBesPortfolios } from '../hooks/useBesPortfolios';
import { useVirtualSavings } from '../hooks/useVirtualSavings';
import { ShieldAlert, Trash2, PiggyBank, Sparkles, Plus, Users, Landmark, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { fetchLivePrices } from '../lib/marketData';
import { supabase } from '../lib/supabase';
import { Investment, GoldDay, BesPortfolio } from '../types';

export const SavingsPage = () => {
  const { recurring, loading: recurringLoading } = useRecurringTransactions();
  const { goldDays, loading: goldLoading, addGoldDay, deleteGoldDay } = useGoldDays();
  const { bes, loading: besLoading, addBes, updateBes, deleteBes } = useBesPortfolios();
  const { combinedSavings, totalVirtualValue, loading: virtualLoading } = useVirtualSavings();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'gold' | 'bes'>('general');

  // Gold Form State
  const [goldName, setGoldName] = useState('');
  const [goldType, setGoldType] = useState('Gram');
  const [quantityPerMonth, setQuantityPerMonth] = useState('1');
  const [totalMonths, setTotalMonths] = useState('10');
  const [myTurnMonth, setMyTurnMonth] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [isGoldSubmitting, setIsGoldSubmitting] = useState(false);
  
  // BES Form State
  const [besName, setBesName] = useState('');
  const [besMonthly, setBesMonthly] = useState('');
  const [besStartDate, setBesStartDate] = useState('');
  const [besPaymentDay, setBesPaymentDay] = useState('15');
  const [besStateRate, setBesStateRate] = useState('30');
  const [besInitialAmount, setBesInitialAmount] = useState('');
  const [isBesSubmitting, setIsBesSubmitting] = useState(false);

  // BES One-Time Payment State
  const [extraPaymentAmount, setExtraPaymentAmount] = useState('');
  const [payingBesId, setPayingBesId] = useState<string | null>(null);

  // Accordion State
  const [expandedGoldDay, setExpandedGoldDay] = useState<string | null>(null);

  // General Edit State
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [generalInitialAmount, setGeneralInitialAmount] = useState('');
  const [generalStartDate, setGeneralStartDate] = useState('');

  const filterSavings = recurring.filter(r => r.is_investment);

  const handleGoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goldName || !startDate || !quantityPerMonth) return;
    
    setIsGoldSubmitting(true);
    const { error } = await addGoldDay({
      name: goldName,
      gold_type: goldType,
      quantity_per_month: parseFloat(quantityPerMonth),
      total_months: parseInt(totalMonths, 10),
      my_turn_month: parseInt(myTurnMonth, 10),
      start_date: startDate
    });

    if (!error) {
      toast.success('Altın günü eklendi!');
      setGoldName('');
      setGoldType('Gram');
      setQuantityPerMonth('1');
      setTotalMonths('10');
      setMyTurnMonth('1');
      setStartDate('');
    } else {
      toast.error('Altın günü eklenirken bir hata oluştu');
    }
    setIsGoldSubmitting(false);
    setIsModalOpen(false);
  };

  const handleBesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!besName || !besMonthly || !besStartDate) return;
    
    setIsBesSubmitting(true);
    const { error } = await addBes({
      name: besName,
      monthly_payment: parseFloat(besMonthly),
      start_date: besStartDate,
      payment_day: parseInt(besPaymentDay, 10),
      state_contribution_rate: parseFloat(besStateRate),
      initial_amount: besInitialAmount ? parseFloat(besInitialAmount) : 0,
      extra_payments_total: 0
    });

    if (!error) {
      toast.success('BES Hesabı sisteme entegre edildi!');
      setBesName('');
      setBesMonthly('');
      setBesStartDate('');
      setBesPaymentDay('15');
      setBesStateRate('30');
      setBesInitialAmount('');
    } else {
      toast.error('BES eklenirken bir hata oluştu');
    }
    setIsBesSubmitting(false);
    setIsModalOpen(false);
  };

  const handleBesExtraPayment = async (b: BesPortfolio) => {
    if (!extraPaymentAmount) return;
    const { error } = await updateBes(b.id, {
      extra_payments_total: b.extra_payments_total + parseFloat(extraPaymentAmount)
    });
    if (!error) {
      toast.success(`${extraPaymentAmount} ₺ ek ödeme başarıyla BES'e dahil edildi! (Devlet katkısı anında yansıdı)`);
      setExtraPaymentAmount('');
      setPayingBesId(null);
    }
  };

  const handleRemoveSaving = async (id: string, name: string) => {
    // If it's a gold day, use deleteGoldDay. Else if BES, deleteBes. Else update recurring.
    const isGold = goldDays.some(g => g.id === id);
    const isBes = bes.some(b => b.id === id);

    if (isGold) {
       const { error } = await deleteGoldDay(id);
       if (!error) toast.success(`${name} başarıyla iptal edildi.`);
    } else if (isBes) {
       const { error } = await deleteBes(id);
       if (!error) toast.success(`BES sözleşmesi başarıyla silindi.`);
    } else {
       const { error } = await supabase.from('recurring_transactions').update({ is_investment: false }).eq('id', id);
       if (!error) toast.success(`${name} başarıyla birikimlerden kaldırıldı.`);
       else toast.error('Kaldırma başarısız oldu.');
    }
  };

  const handleGeneralEditSave = async (id: string) => {
    const { error } = await supabase.from('recurring_transactions').update({
       initial_amount: generalInitialAmount ? parseFloat(generalInitialAmount) : null,
       start_date: generalStartDate || null
    }).eq('id', id);

    if (!error) {
       toast.success("Bilgiler güncellendi!");
       // To trigger re-fetch/update eagerly we could reload or wait for supabase realtime channel which is in useRecurringTransactions
       setEditingRecurringId(null);
    } else {
       toast.error("Bir hata oluştu");
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#ffcf70] font-display flex items-center gap-3">
            <PiggyBank size={36} /> Düzenli Birikimlerim
          </h1>
        </div>
        
        {activeTab === 'gold' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-[#ffcf70] text-black font-bold rounded-xl flex items-center gap-2 hover:brightness-110 transition-colors"
          >
            <Plus size={18} /> Yeni Çember Kur
          </button>
        )}
        {activeTab === 'bes' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-[#4edeb3] text-black font-bold rounded-xl flex items-center gap-2 hover:brightness-110 transition-colors"
          >
            <Plus size={18} /> BES Planı Ekle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <div className="md:col-span-1">
             <div className="bento-card border border-[#ffcf70]/20 shadow-[0_10px_30px_rgba(255,207,112,0.05)] text-center sm:text-left h-full flex flex-col justify-center">
                <p className="text-[#ffb52e] font-bold text-xs uppercase tracking-widest font-mono mb-2">Tüm Birikimlerimin Toplamı</p>
                <h2 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight mt-1 flex items-baseline justify-center sm:justify-start gap-2">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalVirtualValue)}
                </h2>
                {virtualLoading && <p className="text-[10px] text-[var(--color-text-variant)] mt-2 opacity-50 font-mono animate-pulse">Kur güncelleniyor...</p>}
             </div>
          </div>
          <div className="md:col-span-2">
            <div className="glass-panel p-6 rounded-3xl relative overflow-hidden shadow-[0_10px_30px_rgba(255,207,112,0.05)] border-[#ffcf70]/20 h-full">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffcf70]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
               <div className="flex items-center gap-2 text-[#ffcf70] font-bold mb-3 font-display">
                  <Sparkles size={20} /> Düzenli Birikim Havuzu
               </div>
               <p className="text-[var(--color-text-main)] text-sm leading-relaxed whitespace-pre-wrap">Aylık/Düzenli İşlemler sisteminde <strong>"Bu bir Yatırım / Birikim mi?"</strong> seçeğiyle işaretlediğiniz tüm periyodik döviz/fon kesintileriniz otomatik olarak burada hesaplanıp birikir. Sizin ekstra bir şey yapmanıza gerek kalmadan aylık döngünüzde güncel kurlar ile hesaplanmaya devam eder.</p>
            </div>
          </div>
      </div>

      <div className="flex bg-[var(--color-surface-container)] rounded-2xl p-1 shadow-inner border border-white/5 w-full">
          {[
            { id: 'general', label: 'Genel Birikim' },
            { id: 'gold', label: 'Altın Günü' },
            { id: 'bes', label: 'B.E.S.' }
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'gold' | 'bes')}
                className={`flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all font-mono ${activeTab === tab.id ? 'bg-[#ffcf70] text-black shadow-lg shadow-[#ffcf70]/20' : 'text-[var(--color-text-variant)] hover:text-white hover:bg-white/5'}`}
              >
                {tab.label}
              </button>
          ))}
      </div>

      {isModalOpen && activeTab === 'gold' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 bg-[#ffcf70]/10 flex justify-between items-center">
              <h3 className="font-bold text-[#ffcf70] flex items-center gap-2 text-lg">
                <Plus size={20} /> Altın Günü / Çemberi
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleGoldSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Grup Adı</label>
                  <input type="text" required value={goldName} onChange={e => setGoldName(e.target.value)} placeholder="Örn: Komşular Altın Günü" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Tür</label>
                    <select value={goldType} onChange={e => setGoldType(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors appearance-none">
                      <option value="Gram">Gram</option>
                      <option value="Çeyrek">Çeyrek</option>
                      <option value="Yarım">Yarım</option>
                      <option value="Tam">Tam</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Bana Çıkacak Sıra (Ay)</label>
                    <input type="number" required value={myTurnMonth} onChange={e => setMyTurnMonth(e.target.value)} placeholder="Örn: 5" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Aylık Ödeme</label>
                    <input type="number" step="0.5" required value={quantityPerMonth} onChange={e => setQuantityPerMonth(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Kişi Sayısı(Ay)</label>
                    <input type="number" required value={totalMonths} onChange={e => setTotalMonths(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Başlangıç</label>
                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#ffcf70] transition-colors" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={isGoldSubmitting} className="flex-1 bg-gradient-to-r from-[#ffcf70] to-[#ffb52e] text-black rounded-xl py-3 font-bold hover:brightness-110 transition disabled:opacity-50">
                    Çembere Katıl
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-[var(--color-surface-lowest)] text-white rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-colors">
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && activeTab === 'bes' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 bg-[#4edeb3]/10 flex justify-between items-center">
              <h3 className="font-bold text-[#4edeb3] flex items-center gap-2 text-lg">
                <Plus size={20} /> BES Düzenli Ödeme Ekle
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleBesSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Firma / Adı</label>
                    <input type="text" required value={besName} onChange={e => setBesName(e.target.value)} placeholder="Örn: Agesa" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Aylık Ödeme (₺)</label>
                    <input type="number" step="0.5" required value={besMonthly} onChange={e => setBesMonthly(e.target.value)} placeholder="Örn: 2000" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Çekim Günü</label>
                    <input type="number" min="1" max="31" required value={besPaymentDay} onChange={e => setBesPaymentDay(e.target.value)} placeholder="Örn: 15" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Katkı (%)</label>
                    <input type="number" required value={besStateRate} onChange={e => setBesStateRate(e.target.value)} placeholder="Örn: 30" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">İçerdeki Para(₺)</label>
                    <input type="number" step="0.5" value={besInitialAmount} onChange={e => setBesInitialAmount(e.target.value)} placeholder="0" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Başlangıç</label>
                    <input type="date" required value={besStartDate} onChange={e => setBesStartDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#4edeb3] transition-colors" />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={isBesSubmitting} className="flex-1 bg-[#4edeb3] text-black rounded-xl py-3 font-bold hover:brightness-110 transition disabled:opacity-50">
                    Sisteme Bağla
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-[var(--color-surface-lowest)] text-white rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-colors">
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      <div className="w-full">
        {activeTab === 'general' && (
          <div className="bento-card overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono flex items-center gap-2 mb-4">
              Birikim Kalemleri
            </h3>
            
            {recurringLoading ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Birikimleriniz Yükleniyor...</div>
            ) : combinedSavings.length === 0 ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
                 <ShieldAlert size={32} className="opacity-50" />
                 <p>Düzenli biriktirdiğiniz bir öğe bulunmuyor.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {combinedSavings.map((inv, idx) => {
                  const rate = inv.current_price || 1;
                  const currentValue = inv.quantity * rate;
                  
                  return (
                    <div key={inv.id} className="p-5 bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="bg-[#ffcf70]/10 text-[#ffb52e] p-3 rounded-2xl shadow-[inset_0_0_10px_rgba(255,207,112,0.1)] shrink-0 self-start sm:self-center">
                          {inv.asset_type === 'commodity' ? <Users size={24} strokeWidth={2.5} className="text-[#ffcf70]" /> : 
                           inv.name.includes('%') ? <Landmark size={24} strokeWidth={2.5} className="text-[#4edeb3]" /> : 
                           <PiggyBank size={24} strokeWidth={2.5}/>}
                        </div>
                        <div className="flex flex-col w-full">
                          <p className="font-bold text-white text-base font-display flex flex-wrap items-center gap-2">
                            {inv.name} 
                            {inv.symbol !== 'TRY' && <span className="text-[10px] text-[#ffcf70] border border-[#ffcf70]/30 px-2 py-0.5 rounded-md font-mono">{inv.symbol}</span>}
                          </p>
                          <p className="text-xs text-[var(--color-text-variant)] mt-1 font-mono">Oluşan Değer: <strong className="text-white">{(inv.quantity).toLocaleString('tr-TR')}</strong></p>

                          {editingRecurringId === inv.id && (
                             <div className="mt-3 p-4 bg-black/40 border border-white/10 rounded-xl space-y-3 w-full max-w-[350px]">
                                <div>
                                   <label className="block text-[10px] font-bold text-white/50 mb-1 font-mono">Geçmiş Bakiye (Varsa)</label>
                                   <input type="number" step="0.5" value={generalInitialAmount} onChange={e => setGeneralInitialAmount(e.target.value)} placeholder="0" className="w-full px-3 py-2 text-xs bg-black/50 text-white rounded-lg outline-none border border-white/5 focus:border-[#ffcf70] transition-colors" />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-white/50 mb-1 font-mono">Başlangıç Tarihi</label>
                                   <input type="date" value={generalStartDate} onChange={e => setGeneralStartDate(e.target.value)} className="w-full px-3 py-2 text-xs bg-black/50 text-white rounded-lg outline-none border border-white/5 focus:border-[#ffcf70] transition-colors" />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                   <button onClick={() => setEditingRecurringId(null)} className="px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/10 rounded transition-colors">İptal</button>
                                   <button onClick={() => handleGeneralEditSave(inv.id)} className="px-3 py-1.5 text-[10px] font-bold text-black bg-[#ffcf70] hover:brightness-110 rounded transition-colors">Kaydet</button>
                                </div>
                             </div>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <div>
                          <p className="font-black font-mono text-lg text-white">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentValue)}
                          </p>
                          {inv.symbol !== 'TRY' && (
                             <p className="text-[10px] text-[var(--color-text-variant)] mt-0.5 font-mono opacity-80">
                               Piyasa Karşılığı
                             </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 text-white lg:text-[var(--color-text-variant)] lg:bg-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                           {editingRecurringId !== inv.id && (
                              <button 
                                onClick={() => {
                                   const match = recurring.find(r => r.id === inv.id);
                                   setGeneralInitialAmount(match?.initial_amount?.toString() || '');
                                   setGeneralStartDate(match?.start_date || '');
                                   setEditingRecurringId(inv.id);
                                }}
                                className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ffcf70] hover:bg-[#ffcf70]/10 rounded-xl transition-all"
                              >
                                Düzenle
                              </button>
                           )}
                           <button 
                             onClick={() => handleRemoveSaving(inv.id, inv.name)}
                             className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ff7886]/10 rounded-xl transition-all"
                           >
                             <Trash2 size={18} />
                           </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'gold' && (
            <div className="bento-card overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide font-mono text-sm">
                  <Users size={18} className="text-[#ffcf70]" /> Altın Günlerim
                </h3>
                {goldDays.length === 0 ? (
                    <div className="p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
                       <Users size={32} className="opacity-50 text-[#ffcf70]" />
                       <p>Kayıtlı bir altın gününüz bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                       {goldDays.map(gd => {
                          const created = new Date(gd.start_date);
                          const today = new Date();
                          let paidMonths = Math.max(0, (today.getFullYear() - created.getFullYear()) * 12 + today.getMonth() - created.getMonth() + 1);
                          paidMonths = Math.min(paidMonths, gd.total_months);

                          return (
                             <div key={gd.id} className="bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
                                <button 
                                   onClick={() => setExpandedGoldDay(prev => prev === gd.id ? null : gd.id)}
                                   className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                >
                                   <div className="flex items-center gap-4">
                                     <div className="bg-[#ffcf70]/10 p-3 rounded-xl border border-[#ffcf70]/20">
                                        <Users size={20} className="text-[#ffb52e]" />
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="font-bold text-white font-display text-base truncate max-w-[200px]">{gd.name}</span>
                                       <span className="text-xs text-[var(--color-text-variant)] hover:text-white transition mt-0.5">{paidMonths} / {gd.total_months} Ay</span>
                                     </div>
                                   </div>
                                   <div className="flex flex-col items-end gap-1">
                                     {paidMonths === gd.my_turn_month ? (
                                        <span className="text-[10px] text-black bg-[#ffcf70] px-2 py-0.5 rounded font-bold animate-pulse">Sıra Sizde! 🤑</span>
                                     ) : paidMonths > gd.my_turn_month ? (
                                        <span className="text-[10px] text-[#4edeb3] border border-[#4edeb3]/30 px-2 py-0.5 rounded font-bold">🎉 Alındı</span>
                                     ) : (
                                        <span className="text-[10px] text-white/50 px-2 py-0.5 rounded font-bold border border-white/5">🕙 Bekleniyor</span>
                                     )}
                                     <span className="text-[10px] font-bold tracking-widest uppercase text-[#ffcf70]">{gd.gold_type}</span>
                                   </div>
                                </button>
                                {expandedGoldDay === gd.id && (
                                   <div className="px-5 pb-5 pt-3 text-sm text-[var(--color-text-variant)] space-y-3 border-t border-white/5 bg-black/20">
                                      <p className="flex justify-between items-center border-b border-white/5 pb-2"><span>📍 <strong>Kişi Sayısı:</strong></span> <span className="text-white bg-white/5 px-2 py-0.5 rounded">{gd.total_months}</span></p>
                                      <p className="flex justify-between items-center border-b border-white/5 pb-2"><span>💰 <strong>Aylık Ödeme:</strong></span> <span className="text-white bg-white/5 px-2 py-0.5 rounded">{gd.quantity_per_month} {gd.gold_type}</span></p>
                                      <p className="flex justify-between items-center border-b border-white/5 pb-2"><span>📅 <strong>Başlangıç:</strong></span> <span className="text-white bg-white/5 px-2 py-0.5 rounded">{new Date(gd.start_date).toLocaleDateString('tr-TR')}</span></p>
                                      <p className="flex justify-between items-center"><span>🧍 <strong>Sıram:</strong></span> <span className="text-[#ffcf70] font-bold border border-[#ffcf70]/20 px-2 py-0.5 rounded bg-[#ffcf70]/5">{gd.my_turn_month}. Ay</span></p>
                                      <div className="flex justify-between items-center text-lg text-black bg-gradient-to-r from-[#ffcf70] to-[#ffb52e] p-4 rounded-xl mt-4 shadow-lg shadow-[#ffcf70]/10">
                                          <span className="font-bold opacity-80 text-sm">💎 {paidMonths >= gd.my_turn_month ? 'Pot Büyüklüğünüz' : 'Pota Giren Miktar'}</span> 
                                          <span className="font-black font-mono text-2xl">{(paidMonths >= gd.my_turn_month ? gd.total_months * gd.quantity_per_month : paidMonths * gd.quantity_per_month).toLocaleString('tr-TR')} <span className="text-sm opacity-80">{gd.gold_type}</span></span>
                                      </div>
                                      <button 
                                         onClick={() => deleteGoldDay(gd.id)}
                                         className="flex items-center justify-center gap-2 text-[#ff7886] hover:text-white hover:bg-[#ff7886] px-3 py-2.5 rounded-xl w-full transition mt-2 border border-[#ff7886]/20 font-bold group"
                                      >
                                         <Trash2 size={16} className="group-hover:animate-bounce" /> Sistemi İptal Et
                                      </button>
                                   </div>
                                )}
                             </div>
                          );
                       })}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'bes' && (
            <div className="bento-card overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wide font-mono text-sm">
                  <Landmark size={18} className="text-[#4edeb3]" /> BES Portföylerim
                </h3>
                {bes.length === 0 ? (
                    <div className="p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
                       <Landmark size={32} className="opacity-50 text-[#4edeb3]" />
                       <p>Kayıtlı bir Bireysel Emeklilik sözleşmeniz bulunmuyor.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {bes.map(b => {
                        const created = new Date(b.start_date);
                        const today = new Date();
                        let paidMonths = 0;
                        let iterDate = new Date(created.getFullYear(), created.getMonth(), b.payment_day || 1);
                        if (iterDate < created) iterDate.setMonth(iterDate.getMonth() + 1);
                        while (iterDate <= today) { paidMonths++; iterDate.setMonth(iterDate.getMonth() + 1); }

                        const totalPrincipial = b.initial_amount + (paidMonths * b.monthly_payment) + b.extra_payments_total;
                        const matchValue = ((paidMonths * b.monthly_payment) + b.extra_payments_total) * (b.state_contribution_rate / 100);

                        return (
                          <div key={b.id} className="bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5 overflow-hidden">
                             <div className="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-black/10">
                               <div className="flex items-center gap-4">
                                  <div className="bg-[#4edeb3]/10 p-3 rounded-xl border border-[#4edeb3]/20">
                                     <Landmark size={20} className="text-[#4edeb3]" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-white font-display text-base">{b.name}</span>
                                    <p className="text-xs text-[var(--color-text-variant)] mt-1 font-mono">Her ayın {b.payment_day || 1}. Günü / {b.monthly_payment.toLocaleString('tr-TR')} ₺</p>
                                  </div>
                               </div>
                               <button onClick={() => deleteBes(b.id)} className="text-[#ff7886] opacity-50 hover:opacity-100 hover:bg-[#ff7886]/10 p-2.5 rounded-xl transition" title="Sil"><Trash2 size={18} /></button>
                             </div>
                             
                             <div className="p-5 flex flex-col gap-4">
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                  <span className="text-[var(--color-text-variant)]">Ana Para Birikimi <span className="text-[10px] opacity-50"></span></span>
                                  <span className="text-white font-bold font-mono text-lg">{totalPrincipial.toLocaleString('tr-TR')} ₺</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                  <span className="text-[var(--color-text-variant)]">Devlet Katkısı <span className="text-[#4edeb3]/50 text-[10px] border border-[#4edeb3]/20 px-1 py-0.5 rounded">% {b.state_contribution_rate}</span></span>
                                  <span className="text-[#4edeb3] font-bold font-mono text-lg">+{matchValue.toLocaleString('tr-TR')} ₺</span>
                                </div>

                                <div className="flex justify-between items-center text-base pt-1">
                                  <span className="text-[var(--color-text-variant)] uppercase tracking-wider text-[10px] font-bold">Toplam Fon Büyüklüğü</span>
                                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4edeb3] to-[#3bc49c] font-black font-mono text-xl">{(totalPrincipial + matchValue).toLocaleString('tr-TR')} ₺</span>
                                </div>
                                
                                {payingBesId === b.id ? (
                                   <div className="flex items-center gap-2 animate-in slide-in-from-top-1 bg-black/30 p-2 rounded-xl border border-[#4edeb3]/20 mt-2">
                                      <input type="number" required value={extraPaymentAmount} onChange={e => setExtraPaymentAmount(e.target.value)} placeholder="Tutar (₺)" className="w-full px-4 py-2 text-sm bg-black/50 text-white rounded-lg outline-none focus:border-[#4edeb3] border border-white/5 transition-colors" />
                                      <button onClick={() => handleBesExtraPayment(b)} className="px-5 py-2 text-sm bg-[#4edeb3] hover:brightness-110 transition text-black font-bold rounded-lg shrink-0">Bakiye Ekle</button>
                                      <button onClick={() => setPayingBesId(null)} className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white rounded-lg shrink-0 transition">İptal</button>
                                   </div>
                                ) : (
                                   <button onClick={() => { setPayingBesId(b.id); setExtraPaymentAmount(''); }} className="mt-2 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-wider text-black bg-[#4edeb3] hover:brightness-110 w-full py-3 rounded-xl transition shadow-lg shadow-[#4edeb3]/10">
                                      <Plus size={16} /> Tek Seferlik Ek Para
                                   </button>
                                )}
                             </div>
                          </div>
                        )
                      })}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
