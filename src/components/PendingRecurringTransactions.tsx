import { useState, useEffect, useCallback } from 'react';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useTransactions } from '../hooks/useTransactions';
import { Bell, CheckSquare, XSquare, Play, CalendarClock, FastForward, Clock } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Geçmiş tarihleri otomatik ileri alır, sadece bugün veya bugünden max 3 gün önceki
 * işlemleri "Ekle" olarak gösterir. Çok eski olanlar sessizce next_date güncellenir.
 */
export const PendingRecurringTransactions = () => {
  const { recurring, updateRecurring, deleteRecurring } = useRecurringTransactions();
  const { addTransaction } = useTransactions();
  const [pending, setPending] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  // Sonraki tarihi hesapla
  const getNextDate = useCallback((currentDate: Date, frequency: string): Date => {
    const next = new Date(currentDate);
    if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
    return next;
  }, []);

  // Arka planda geçmiş giderleri ileri al ve geldiği gün olan GElİRLERİ otomatik işle
  const autoProcessBackgroundTasks = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Giderler için grace period: 3 gün
    const gracePeriod = new Date(today);
    gracePeriod.setDate(gracePeriod.getDate() - 3);

    const toProcess = recurring.filter(r => {
      if (!r.next_date) return false;
      const nextD = new Date(r.next_date);
      nextD.setHours(0, 0, 0, 0);
      
      // 1. GİDER (Expense): Eğer grace period'dan eskiyse (pas geçildiyse) sessizce ileri al
      if (r.type === 'expense') {
        return nextD < gracePeriod && r.frequency !== 'once';
      }
      
      // 2. GELİR (Income): Eğer zamanı gelmişse (bugün veya daha eskiyse), otomatik ekle ve ileri al
      if (r.type === 'income') {
        return nextD <= today; // Gelir için grace period yok, günü geldiyse hemen işlenir
      }
      
      return false;
    });

    if (toProcess.length === 0) return;

    setAutoAdvancing(true);
    
    for (const rec of toProcess) {
      let nextDate = new Date(rec.next_date);
      let installments = rec.total_installments;
      const hasInstallments = installments !== null && installments !== undefined;
      let finished = false;

      if (rec.type === 'income') {
        // GELİR: Sadece tarihini ileri al (addTransaction yapılmayacak, çünkü "Aylık" sekmesi sadece görünüm için)
        while (nextDate <= today && !finished) {
          if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
          else if (rec.frequency === 'once') { finished = true; break; }

          if (hasInstallments && installments! > 0) {
            installments = installments! - 1;
            if (installments === 0) finished = true;
          }
        }
      } else {
        // GİDER: Sadece grace period'a kadar tarihi sessizce ileri sar
        while (nextDate < gracePeriod && !finished) {
          if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
          else break;

          if (hasInstallments && installments! > 0) {
            installments = installments! - 1;
            if (installments === 0) finished = true;
          }
        }
      }

      if (finished) {
        await deleteRecurring(rec.id);
      } else {
        await updateRecurring(rec.id, {
          next_date: nextDate.toISOString().split('T')[0],
          ...(hasInstallments ? { total_installments: installments } : {})
        });
      }
    }
    
    setAutoAdvancing(false);
  }, [recurring, deleteRecurring, updateRecurring, addTransaction]);

  // Uygulama yüklendiğinde geçmiş işlemleri otomatik hesapla
  useEffect(() => {
    if (recurring.length > 0) {
      autoProcessBackgroundTasks();
    }
  }, [recurring.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Grace period: sadece 3 gün öncesinden bugüne kadar olan işlemleri göster
    const gracePeriod = new Date();
    gracePeriod.setDate(gracePeriod.getDate() - 3);
    gracePeriod.setHours(0, 0, 0, 0);

    const due = recurring.filter(r => {
      if (!r.next_date) return false;
      // Sadece GİDERLERİ hatırlat, gelirler pasif takip içindir
      if (r.type !== 'expense') return false;
      const nextD = new Date(r.next_date);
      nextD.setHours(0, 0, 0, 0);
      // Sadece grace period ile bugün arası (dahil)
      return nextD >= gracePeriod && nextD <= today;
    });

    setPending(due);
  }, [recurring]);

  if (pending.length === 0 && !autoAdvancing) return null;

  const handleProcess = async (rec: any) => {
    setProcessing(rec.id);
    
    // 1. Add to transactions
    const { error: txError } = await addTransaction({
      amount: rec.amount,
      category: rec.category,
      type: rec.type,
      date: new Date().toISOString(),
      description: `Düzenli ${rec.type === 'income' ? 'Gelir' : 'Gider'}: ${rec.description || rec.category}`
    });

    if (txError) {
      toast.error('İşlem eklenirken hata oluştu.');
      setProcessing(null);
      return;
    }

    // 2. Update recurring next_date
    let finished = false;
    let nextDate = new Date(rec.next_date);
    
    if (rec.frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (rec.frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (rec.frequency === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else if (rec.frequency === 'once') {
      finished = true;
    }

    let newInstallments = rec.total_installments;
    let hasInstallments = newInstallments !== null && newInstallments !== undefined;
    
    if (hasInstallments && newInstallments > 0) {
      newInstallments -= 1;
      if (newInstallments === 0) {
        finished = true;
      }
    }

    if (finished) {
      await deleteRecurring(rec.id);
      toast.success(`${rec.category} işlemi uygulandı ve sonlandığı için listeden kaldırıldı!`);
    } else {
      await updateRecurring(rec.id, {
        next_date: nextDate.toISOString().split('T')[0],
        total_installments: hasInstallments ? newInstallments : undefined
      });
      toast.success(`${rec.category} başarıyla eklendi! Sonraki tarih güncellendi.`);
    }
    
    setProcessing(null);
  };

  const handleSkip = async (rec: any) => {
    setProcessing(rec.id + '_skip');
    
    let finished = false;
    let nextDate = new Date(rec.next_date);
    
    if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (rec.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (rec.frequency === 'once') finished = true;

    let newInstallments = rec.total_installments;
    let hasInstallments = newInstallments !== null && newInstallments !== undefined;
    
    if (hasInstallments && newInstallments > 0) {
      newInstallments -= 1;
      if (newInstallments === 0) finished = true;
    }

    if (finished) {
      await deleteRecurring(rec.id);
      toast.info(`${rec.category} atlandı ve süresi dolduğu için silindi.`);
    } else {
      await updateRecurring(rec.id, {
        next_date: nextDate.toISOString().split('T')[0],
        total_installments: hasInstallments ? newInstallments : undefined
      });
      toast.info(`${rec.category} atlandı, sonraki döneme ertelendi.`);
    }
    setProcessing(null);
  };

  // İşlem bugün mü yoksa geçmişte mi?
  const getDueLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return { text: 'Bugün', color: 'text-[#ffcf70]' };
    if (diffDays === 1) return { text: 'Dün', color: 'text-orange-400' };
    if (diffDays > 1) return { text: `${diffDays} gün önce`, color: 'text-red-400' };
    return { text: new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }), color: 'text-[var(--color-text-variant)]' };
  };

  return (
    <div className="bg-[var(--color-surface-container)] rounded-3xl p-5 md:p-6 mb-6 md:mb-8 border border-[#ffcf70]/30 shadow-[0_10px_30px_rgba(255,207,112,0.1)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ffcf70] animate-pulse"></div>
      
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-[#ffcf70]/10 text-[#ffcf70] rounded-xl flex-shrink-0">
          <Bell size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white font-display">Günü Gelen Düzenli Giderler</h2>
          <p className="text-xs md:text-sm text-[var(--color-text-variant)] mt-0.5">
            Aşağıdaki düzenli giderlerin vadesi geldi. Onaylayarak aylık harcamalarınıza ekleyin.
          </p>
        </div>
      </div>

      {autoAdvancing && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 rounded-xl mb-3 animate-pulse">
          <FastForward size={14} className="text-[var(--color-brand-primary)]" />
          <span className="text-xs text-[var(--color-brand-primary)] font-medium">
            Geçmiş tarihli işlemler otomatik güncelleniyor...
          </span>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {pending.map((rec) => {
          const isIncome = rec.type === 'income';
          const isProcessing = processing === rec.id || processing === rec.id + '_skip';
          const dueInfo = getDueLabel(rec.next_date);

          return (
            <div key={rec.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${isProcessing ? 'opacity-50 pointer-events-none' : ''} ${isIncome ? 'bg-[#4edeb3]/5 border-[#4edeb3]/20' : 'bg-[#ffb4ab]/5 border-[#ffb4ab]/20'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-[#4edeb3]/10 text-[#4edeb3]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'}`}>
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display">{rec.category}</h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs font-mono font-bold ${isIncome ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                      {isIncome ? '+' : '-'}
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: rec.currency || 'TRY' }).format(rec.amount)}
                    </span>
                    <span className="text-white/20">•</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${dueInfo.color}`}>
                      <Clock size={10} />
                      {dueInfo.text}
                    </span>
                    {rec.description && (
                      <>
                        <span className="text-white/20 hidden sm:inline">•</span>
                        <span className="text-xs text-[var(--color-text-variant)] truncate max-w-[150px]">{rec.description}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  onClick={() => handleSkip(rec)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-text-variant)] hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <XSquare size={14} /> Atla
                </button>
                <button
                  onClick={() => handleProcess(rec)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#002113] transition-colors ${isIncome ? 'bg-[#4edeb3] hover:bg-[#3bc49c]' : 'bg-[#ffb4ab] hover:bg-[#e09e95]'}`}
                >
                  {processing === rec.id ? <Play size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                  Onayla & Ekle
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
