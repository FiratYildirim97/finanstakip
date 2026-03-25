import { useState, FormEvent } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { transactionAgent } from '../lib/agents';
import { Sparkles, Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TransactionType } from '../types';

export const TransactionsPage = () => {
  const { transactions, loading, addTransaction, deleteTransaction } = useTransactions();
  
  // AI Form State
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Manual Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');

  const handleAiSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    
    // Call the Groq Transaction Agent
    const parsed = await transactionAgent.parseText(aiInput);
    
    if (parsed && parsed.amount > 0) {
      const { error } = await addTransaction({
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        type: parsed.type,
        date: new Date().toISOString().split('T')[0]
      });

      if (!error) {
        toast.success(`Başarıyla eklendi: ${parsed.category} - ${parsed.amount} TL`);
        setAiInput('');
      } else {
        toast.error('Veritabanına eklenirken hata oluştu: ' + error);
      }
    } else {
      toast.error('Cümle anlaşılamadı. Lütfen miktarı ve detayı net yazın.');
    }
    setIsAiLoading(false);
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || !category) return;

    const { error } = await addTransaction({
      amount: numAmount,
      category,
      description,
      type,
      date: new Date().toISOString().split('T')[0]
    });

    if (!error) {
      toast.success('Harcama kaydedildi');
      setAmount('');
      setCategory('');
      setDescription('');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">İşlemler</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-6 md:space-y-8">
          {/* AI Quick Add Box */}
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-brand-primary)]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="flex items-center gap-2 text-[var(--color-brand-primary)] font-bold mb-4 font-display text-lg relative z-10">
              <Sparkles size={20} /> AI ile Akıllı Ekle
            </div>
            <form onSubmit={handleAiSubmit} className="relative z-10 w-full">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Örn: Migrostan 450 liraya mutfak alışverişi yaptım..."
                className="w-full px-5 py-4 bg-[var(--color-surface-lowest)]/50 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] focus:bg-[var(--color-surface-lowest)] transition-all resize-none pb-14 text-[var(--color-text-main)] placeholder-[var(--color-text-variant)]"
                rows={3}
              />
              <button
                type="submit"
                disabled={isAiLoading || !aiInput.trim()}
                className="absolute bottom-3 right-3 primary-gradient-btn rounded-xl px-5 py-2 text-sm transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
              >
                {isAiLoading ? 'Çözümleniyor...' : 'AI ile Ekle'}
              </button>
            </form>
          </div>

          {/* Manual Add Box */}
          <div className="bento-card">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              <Plus size={18} className="text-[var(--color-brand-secondary)]" /> Manuel Ekle
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div className="flex bg-[var(--color-surface-lowest)] p-1.5 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-[var(--color-surface-variant)] text-[var(--color-brand-tertiary)] shadow-md' : 'text-[var(--color-text-variant)] hover:text-white'}`}
                >
                  Gider
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'income' ? 'bg-[var(--color-surface-variant)] text-[var(--color-brand-primary)] shadow-md' : 'text-[var(--color-text-variant)] hover:text-white'}`}
                >
                  Gelir
                </button>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Tutar (TL)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Kategori</label>
                <input type="text" required value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" placeholder="Yemek, Fatura vb." />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Açıklama</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              
              <button type="submit" className="w-full primary-gradient-btn rounded-xl py-3 font-bold">
                Kaydet
              </button>
            </form>
          </div>
        </div>

        {/* Transactions List */}
        <div className="lg:col-span-2">
          <div className="bento-card p-0 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)]">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono">Geçmiş İşlemler</h3>
            </div>
            
            {loading ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Veri Senkronize Ediliyor...</div>
            ) : transactions.length === 0 ? (
               <div className="p-12 text-center text-[var(--color-text-variant)]">Henüz bir finansal işlem bulunmuyor.</div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[700px] overflow-y-auto">
                {transactions.map((tx, idx) => (
                  <li key={tx.id} className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className={`p-2.5 rounded-2xl shrink-0 ${tx.type === 'income' ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-tertiary)]/10 text-[var(--color-brand-tertiary)]'}`}>
                        {tx.type === 'income' ? <ArrowUpCircle size={22} strokeWidth={2.5} /> : <ArrowDownCircle size={22} strokeWidth={2.5} />}
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{tx.category}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-variant)] mt-1 font-mono flex-wrap">
                          <span>{tx.date}</span>
                          {tx.description && (
                            <>
                              <span className="text-white/20 hidden sm:inline">•</span>
                              <span className="truncate max-w-[200px] sm:max-w-[250px] block sm:inline">{tx.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                      <span className={`font-black font-mono text-lg ${tx.type === 'income' ? 'text-[var(--color-brand-primary)]' : 'text-white'}`}>
                        {tx.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('tr-TR').format(tx.amount)} ₺
                      </span>
                      <button 
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
