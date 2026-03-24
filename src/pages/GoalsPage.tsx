import React, { useState } from 'react';
import { useGoalsAndBudgets } from '../hooks/useGoalsAndBudgets';
import { Target, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export const GoalsPage: React.FC = () => {
  const { goals, addGoal, updateGoalProgress } = useGoalsAndBudgets();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount) return;
    setIsSubmitting(true);
    
    const { error } = await addGoal({
      name,
      target_amount: Number(targetAmount),
      current_amount: 0,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      category: 'genel'
    });
    
    setIsSubmitting(false);

    if (error) {
      toast.error('Hedef eklenirken hata oluştu');
    } else {
      toast.success('Hedef başarıyla oluşturuldu!');
      setName('');
      setTargetAmount('');
      setDeadline('');
    }
  };

  const deleteGoalFunc = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    toast.success('Hedef silindi');
  };

  const handleUpdateProgress = async (id: string, current: number, target: number) => {
    const addVal = prompt('Eklenecek / Çıkarılacak tutarı girin:', '0');
    if (!addVal) return;
    const val = Number(addVal);
    if (!isNaN(val)) {
      const newAmount = Math.max(0, current + val);
      await updateGoalProgress(id, newAmount);
      toast.success('İlerleme güncellendi!');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white font-display">Finansal Hedefler</h1>
          <p className="text-[var(--color-text-variant)] mt-1 font-mono text-sm">Gelecek hayalleriniz için biriktirin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bento-card sticky top-8">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              <Target size={18} className="text-[var(--color-brand-primary)]" /> Yeni Hedef
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Hedef Adı</label>
                <input 
                  required
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Örn: Tatil, Araba"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Hedef Tutar (TL)</label>
                <input 
                  type="number" required
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Son Tarih (Opsiyonel)</label>
                <input 
                  type="date"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
              </div>
              <button disabled={isSubmitting} className="w-full primary-gradient-btn rounded-xl py-3 font-bold disabled:opacity-50">
                Hedefi Başlat
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 gap-6 content-start">
          {goals.map(goal => {
            const perc = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            return (
              <div key={goal.id} className="bento-card group relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] rounded-2xl shadow-[inset_0_0_10px_rgba(78,222,163,0.1)]">
                    <Target size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateProgress(goal.id, goal.current_amount, goal.target_amount)} className="p-2.5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <TrendingUp size={18} />
                    </button>
                    <button onClick={() => deleteGoalFunc(goal.id)} className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-1 capitalize text-white font-display">{goal.name}</h3>
                  {goal.deadline && <p className="text-[10px] text-[var(--color-text-variant)] uppercase font-bold tracking-widest font-mono">Son Tarih: <span className="text-[var(--color-brand-primary)]">{new Date(goal.deadline).toLocaleDateString('tr-TR')}</span></p>}
                </div>

                <div>
                   <div className="flex justify-between text-xs font-mono mb-2">
                     <span className="text-white">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(goal.current_amount)}</span>
                     <span className="text-[var(--color-text-variant)]">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(goal.target_amount)}</span>
                   </div>
                   <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                     <div 
                       className="h-full rounded-full transition-all duration-1000" 
                       style={{ 
                         width: `${perc}%`, 
                         background: perc >= 100 ? 'var(--color-brand-primary)' : 'linear-gradient(90deg, var(--color-brand-primary), #63ebd0)' 
                       }}
                     />
                   </div>
                   <p className="text-right text-[10px] font-mono mt-2 text-[var(--color-brand-primary)]">% {perc} Tamamlandı</p>
                </div>
              </div>
            );
          })}

          {goals.length === 0 && (
            <div className="py-16 text-center bento-card border-dashed border border-white/10">
              <p className="text-[var(--color-text-variant)] font-mono">Henüz tanımlanmış bir hedef yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
