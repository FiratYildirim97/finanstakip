import { useState, FormEvent } from 'react';
import { useInvestments } from '../hooks/useInvestments';
import { investmentAgent } from '../lib/agents';
import { Sparkles, Plus, Trash2, LineChart, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AssetType } from '../types';
import { fetchLivePrices } from '../lib/marketData';

export const InvestmentsPage = () => {
  const { investments, loading, addInvestment, deleteInvestment, updateInvestmentPrices } = useInvestments();
  
  // AI Form State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  // Manual Form State
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

  const handleGetAnalysis = async () => {
    if (investments.length === 0) {
      toast.error('Analiz edilecek varlığınız bulunmuyor.');
      return;
    }
    setIsAiLoading(true);
    const analysis = await investmentAgent.analyzePortfolio(investments, []);
    setAdvice(analysis);
    setIsAiLoading(false);
  };

  const handleFetchPrices = async () => {
    if (investments.length === 0) return;
    setIsFetchingPrices(true);
    toast.loading('Piyasa verileri çekiliyor...', { id: 'fetch-prices' });
    try {
      const livePrices = await fetchLivePrices(investments);
      if (Object.keys(livePrices).length > 0) {
        await updateInvestmentPrices(livePrices);
        toast.success(`${Object.keys(livePrices).length} varlığın fiyatı güncellendi!`, { id: 'fetch-prices' });
      } else {
        toast.error('Fiyatı bulunabilen bir varlık yok.', { id: 'fetch-prices' });
      }
    } catch (e) {
      toast.error('Canlı veri çekilemedi.', { id: 'fetch-prices' });
    } finally {
      setIsFetchingPrices(false);
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const avg = parseFloat(avgPrice);
    const current = parseFloat(currentPrice);
    
    if (!qty || !avg || !current || !name || !symbol) return;

    const { error } = await addInvestment({
      asset_type: assetType,
      name,
      symbol,
      quantity: qty,
      avg_price: avg,
      current_price: current,
    });

    if (!error) {
      toast.success('Yatırım kaydedildi');
      setName('');
      setSymbol('');
      setQuantity('');
      setAvgPrice('');
      setCurrentPrice('');
    } else {
      toast.error((error as any).message || String(error));
    }
  };

  const totalValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
  const totalCost = investments.reduce((acc, curr) => acc + (curr.quantity * curr.avg_price), 0);
  const totalProfit = totalValue - totalCost;
  const isProfit = totalProfit >= 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight text-white font-display">Yatırım Portföyü</h1>
        <div className="flex gap-4">
          <button 
            onClick={handleFetchPrices}
            disabled={isFetchingPrices || investments.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4edeb3]/10 border border-[#4edeb3]/50 text-[#4edeb3] rounded-full hover:bg-[#4edeb3]/20 font-bold transition backdrop-blur-md disabled:opacity-50"
          >
            <RefreshCw size={18} className={isFetchingPrices ? "animate-spin" : ""} />
            Canlı Fiyat
          </button>
          <button 
            onClick={handleGetAnalysis}
            disabled={isAiLoading || investments.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-surface-variant)]/40 border border-[var(--color-brand-secondary)]/20 text-[var(--color-brand-secondary)] rounded-full hover:bg-[var(--color-brand-secondary)]/10 font-bold transition backdrop-blur-md disabled:opacity-50"
          >
            {isAiLoading ? <Sparkles size={18} className="animate-spin" /> : <Sparkles size={18} />}
            AI Analizi İste
          </button>
        </div>
      </div>

      {advice && (
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden shadow-[0_10px_30px_rgba(173,198,255,0.05)] border-[var(--color-brand-secondary)]/20">
          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-brand-secondary)]"></div>
          <div className="flex items-center gap-2 text-[var(--color-brand-secondary)] font-bold mb-3 font-display">
             <ShieldAlert size={20} /> Portföy Analizi (Yatırım Tavsiyesi Değildir)
          </div>
          <p className="text-[var(--color-text-main)] text-sm leading-relaxed whitespace-pre-wrap">{advice}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bento-card">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              <Plus size={18} className="text-[var(--color-brand-secondary)]" /> Yeni Varlık Ekle
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Tür</label>
                <select value={assetType} onChange={e => setAssetType(e.target.value as AssetType)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors appearance-none">
                  <option value="stock">Hisse Senedi</option>
                  <option value="crypto">Kripto Para</option>
                  <option value="gold">Altın / Emtia</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">İsim</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Bitcoin" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Sembol</label>
                  <input type="text" required value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="BTC" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Miktar</label>
                <input type="number" step="0.0001" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Maliyet</label>
                  <input type="number" step="0.01" required value={avgPrice} onChange={e => setAvgPrice(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Güncel Fiyat</label>
                  <input type="number" step="0.01" required value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
              </div>
              
              <button type="submit" className="w-full primary-gradient-btn rounded-xl py-3 font-bold">
                Portföye Ekle
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
           <div className="grid grid-cols-2 gap-6">
              <div className="bento-card">
                 <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Portföy Değeri</p>
                 <h2 className="text-3xl font-black text-white font-display tracking-tight mt-1">
                   {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalValue)}
                 </h2>
              </div>
              <div className="bento-card">
                 <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Kâr / Zarar</p>
                 <h2 className={`text-3xl font-black font-display tracking-tight mt-1 ${isProfit ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'}`}>
                   {isProfit ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalProfit)}
                 </h2>
              </div>
           </div>

          <div className="bento-card p-0 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)]">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono">Varlıklarınız</h3>
            </div>
            
            {loading ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Portföy Yükleniyor...</div>
            ) : investments.length === 0 ? (
               <div className="p-12 text-center text-[var(--color-text-variant)]">Henüz yatırım bulunmuyor.</div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                {investments.map((inv, idx) => {
                  const currentValue = inv.quantity * inv.current_price;
                  const costValue = inv.quantity * inv.avg_price;
                  const profit = currentValue - costValue;
                  const profitPerc = costValue > 0 ? ((currentValue - costValue) / costValue) * 100 : 0;
                  const isGain = profit >= 0;

                  return (
                    <li key={inv.id} className={`p-5 hover:bg-[var(--color-surface-container)] transition-colors flex items-center justify-between group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                      <div className="flex items-center gap-5">
                        <div className="bg-[var(--color-brand-secondary)]/10 text-[var(--color-brand-secondary)] p-3 rounded-2xl shadow-[inset_0_0_10px_rgba(173,198,255,0.1)]">
                          <LineChart size={24} strokeWidth={2.5}/>
                        </div>
                        <div>
                          <p className="font-bold text-white text-base font-display">{inv.name} <span className="text-[10px] text-[var(--color-brand-secondary)] border border-[var(--color-brand-secondary)]/30 px-2 py-0.5 rounded-md ml-2 font-mono">{inv.symbol}</span></p>
                          <p className="text-xs text-[var(--color-text-variant)] mt-1 font-mono">Miktar: <strong className="text-white">{inv.quantity}</strong> • Maliyet: {inv.avg_price} ₺</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-5">
                        <div>
                          <p className="font-black font-mono text-lg text-white">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentValue)}</p>
                          <p className={`text-xs font-bold font-mono tracking-wider ${isGain ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'}`}>
                            {isGain ? '+' : ''}{profitPerc.toFixed(2)}% ({isGain ? '+' : ''}{Math.round(profit)} ₺)
                          </p>
                        </div>
                        <button 
                          onClick={() => deleteInvestment(inv.id)}
                          className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
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
