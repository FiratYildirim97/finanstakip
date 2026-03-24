import React, { useState } from 'react';
import { useGoalsAndBudgets } from '../hooks/useGoalsAndBudgets';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export const BudgetsPage: React.FC = () => {
  const { budgets, addBudget } = useGoalsAndBudgets();
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // yyyy-MM
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !limit || !period) return;
    setIsSubmitting(true);
    
    const { error } = await addBudget({
      category,
      limit_amount: Number(limit),
      period
    });
    
    setIsSubmitting(false);

    if (error) {
      toast.error('Bütçe eklenirken hata oluştu');
    } else {
      toast.success('Bütçe başarıyla tanımlandı!');
      setCategory('');
      setLimit('');
    }
  };

  const deleteBudgetFunc = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    toast.success('Bütçe silindi');
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white font-display">Bütçe Yönetimi</h1>
          <p className="text-[var(--color-text-variant)] mt-1 font-mono text-sm">Aylık harcama limitlerinizi belirleyin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bento-card sticky top-8">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              <Plus size={18} className="text-[var(--color-brand-primary)]" /> Yeni Bütçe
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Kategori</label>
                <input 
                  required
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Örn: Market, Fatura"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Aylık Limit (TL)</label>
                <input 
                  type="number" required
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Dönem</label>
                <input 
                  type="month" required
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors"
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                />
              </div>
              <button disabled={isSubmitting} className="w-full primary-gradient-btn rounded-xl py-3 font-bold disabled:opacity-50">
                Bütçeyi Kaydet
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
          {budgets.map(budget => (
            <div key={budget.id} className="bento-card group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] rounded-2xl shadow-[inset_0_0_10px_rgba(78,222,163,0.1)]">
                  <ShieldCheck size={24} />
                </div>
                <button onClick={() => deleteBudgetFunc(budget.id)} className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-xl font-bold mb-1 capitalize text-white font-display">{budget.category}</h3>
              <p className="text-[10px] text-[var(--color-text-variant)] mb-4 uppercase font-bold tracking-widest font-mono">Dönem: <span className="text-[var(--color-brand-primary)]">{budget.period}</span></p>
              <p className="text-3xl font-black text-white font-mono tracking-tight">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(budget.limit_amount)}</p>
            </div>
          ))}

          {budgets.length === 0 && (
            <div className="col-span-full py-16 text-center bento-card border-dashed border border-white/10">
              <p className="text-[var(--color-text-variant)] font-mono">Henüz tanımlanmış bir bütçe yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
