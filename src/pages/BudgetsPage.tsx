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

  const [isModalOpen, setIsModalOpen] = useState(false);

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
      setIsModalOpen(false);
    }
  };

  const deleteBudgetFunc = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    toast.success('Bütçe silindi');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white font-display">Bütçe Yönetimi</h1>
          <p className="text-[var(--color-text-variant)] mt-1 font-mono text-sm">Aylık harcama limitlerinizi belirleyin.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-[var(--color-brand-primary)] text-black font-bold rounded-xl flex items-center gap-2 hover:bg-[#3bc49c] transition-colors"
        >
          Yeni Bütçe Ekle
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 bg-[var(--color-brand-primary)]/10 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                <Plus size={20} className="text-[var(--color-brand-primary)]" /> Yeni Bütçe
              </h3>
            </div>
            <div className="p-6">
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
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={isSubmitting} className="flex-1 primary-gradient-btn rounded-xl py-3 font-bold disabled:opacity-50">
                    Kaydet
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {budgets.map(budget => (
          <div key={budget.id} className="bento-card group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] rounded-2xl shadow-[inset_0_0_10px_rgba(78,222,163,0.1)]">
                <ShieldCheck size={24} />
              </div>
              <button onClick={() => deleteBudgetFunc(budget.id)} className="p-2.5 text-[#ff7886] bg-[#ffb4ab]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#ff7886] lg:hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100">
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="text-xl font-bold mb-1 capitalize text-white font-display line-clamp-1">{budget.category}</h3>
            <p className="text-[10px] text-[var(--color-text-variant)] mb-4 uppercase font-bold tracking-widest font-mono">Dönem: <span className="text-[var(--color-brand-primary)]">{budget.period}</span></p>
            <p className="text-3xl font-black text-white font-mono tracking-tight">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(budget.limit_amount)}</p>
          </div>
        ))}

        {budgets.length === 0 && (
          <div className="col-span-full py-16 text-center bento-card border-dashed border border-[var(--color-brand-primary)]/20">
            <p className="text-[var(--color-brand-primary)] font-mono">Henüz tanımlanmış bir bütçe yok.</p>
          </div>
        )}
      </div>
    </div>
  );
};
