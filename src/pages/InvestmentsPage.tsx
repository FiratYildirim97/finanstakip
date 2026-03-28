import { useState, FormEvent, ChangeEvent, useEffect, useMemo } from 'react';
import { useInvestments } from '../hooks/useInvestments';
import { investmentAgent } from '../lib/agents';
import { Sparkles, Plus, Trash2, LineChart, ShieldAlert, RefreshCw, Edit2, TrendingUp, Coins, Landmark, Banknote, BarChart3, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { AssetType, Investment } from '../types';
import { fetchLivePrices } from '../lib/marketData';
import { ASSET_OPTIONS } from '../lib/constants';

type TabType = 'stock' | 'currency' | 'commodity' | 'crypto';

const TAB_CONFIG: { id: TabType; label: string; icon: any; color: string }[] = [
  { id: 'stock', label: 'Hisse', icon: TrendingUp, color: '#adc6ff' },
  { id: 'currency', label: 'Döviz', icon: Banknote, color: '#4edeb3' },
  { id: 'commodity', label: 'Emtia', icon: Coins, color: '#ffcf70' },
  { id: 'crypto', label: 'Kripto', icon: BarChart3, color: '#a78bfa' },
];

export const InvestmentsPage = () => {
  const { investments, loading, addInvestment, deleteInvestment, updateInvestmentPrices, updateInvestment } = useInvestments();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('stock');

  // Quick Add State
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [quickAddQty, setQuickAddQty] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  
  // Edit State
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [editCurrentPrice, setEditCurrentPrice] = useState('');

  // AI Form State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  
  // Sadece ilk açılışta bir kez otomatik çekim yapmak için
  const [hasAutoFetched, setHasAutoFetched] = useState(false);

  // Manual Form State
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  
  // Debug State
  const [debugError, setDebugError] = useState<string | null>(null);

  // Sync assetType with activeTab when opening modal
  const handleOpenModal = () => {
    setAssetType(activeTab);
    setQuickAddId('new_modal');
  };

  const handleAssetTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setAssetType(e.target.value as AssetType);
    setSymbol('');
    setName('');
  };

  const handleAssetSelect = async (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedSymbol = e.target.value;
    const option = ASSET_OPTIONS[assetType]?.find(opt => opt.symbol === selectedSymbol);
    if (option) {
      setSymbol(option.symbol);
      setName(option.name);
    } else {
      setSymbol('');
      setName('');
    }
  };

  useEffect(() => {
    if (!loading && investments.length > 0 && !hasAutoFetched) {
      setHasAutoFetched(true);
      fetchLivePrices(investments).then(livePrices => {
        if (Object.keys(livePrices).length > 0) {
          updateInvestmentPrices(livePrices);
        }
      }).catch(() => {});
    }
  }, [loading, investments, hasAutoFetched, updateInvestmentPrices]);

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
    let avg = avgPrice === '' ? null : parseFloat(avgPrice);
    let current = parseFloat(currentPrice);
    
    if (!qty || !name || !symbol) return;

    setIsFetchingPrices(true);
    toast.loading(`${name} portföye eklenirken fiyat değerleniyor...`, { id: 'submit-price' });

    try {
      const dummyInvestment: Investment = {
        id: 'temp',
        asset_type: assetType,
        symbol: symbol,
        name: name,
        quantity: qty,
        avg_price: avg,
        current_price: 1,
        user_id: '',
        created_at: ''
      };
      
      const prices = await fetchLivePrices([dummyInvestment]);
      if (prices['temp']) {
        current = prices['temp'];
      }
    } catch {
      // API fail silently handled below
    }

    if (isNaN(current) && avg === null) {
      toast.error('Güncel fiyat çekilemedi ve maliyet girmediniz. Lütfen en az birini doldurun.', { id: 'submit-price' });
      setIsFetchingPrices(false);
      return;
    }

    if (isNaN(current) && avg !== null) {
      current = avg;
    }

    const { error } = await addInvestment({
      asset_type: assetType,
      name,
      symbol,
      quantity: qty,
      avg_price: avg,
      current_price: current,
    });

    if (!error) {
      toast.success('Yatırım kaydedildi!', { id: 'submit-price' });
      setName('');
      setSymbol('');
      setQuantity('');
      setAvgPrice('');
      setCurrentPrice('');
      setDebugError(null);
    } else {
      const errMessage = (error as any).message || String(error);
      const errDetails = JSON.stringify(error, null, 2);
      setDebugError(`Hata Mesajı: ${errMessage}\nDetaylar:\n${errDetails}`);
      toast.error('Kayıt başarısız, lütfen sayfadaki hata kutusuna bakın.', { id: 'submit-price', duration: 8000 });
      console.error(error);
    }
    
    setIsFetchingPrices(false);
  };

  const totalValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
  
  const validInvestments = investments.filter(inv => inv.avg_price !== null);
  const calculableValue = validInvestments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
  const totalCost = validInvestments.reduce((acc, curr) => acc + (curr.quantity * (curr.avg_price as number)), 0);
  const totalProfit = calculableValue - totalCost;
  const isProfit = totalProfit >= 0;

  // Per-tab stats
  const tabStats = useMemo(() => {
    const stats: Record<TabType, { value: number; profit: number; count: number }> = {
      stock: { value: 0, profit: 0, count: 0 },
      currency: { value: 0, profit: 0, count: 0 },
      commodity: { value: 0, profit: 0, count: 0 },
      crypto: { value: 0, profit: 0, count: 0 },
    };
    investments.forEach(inv => {
      const t = inv.asset_type as TabType;
      if (!stats[t]) return;
      const val = inv.quantity * inv.current_price;
      stats[t].value += val;
      stats[t].count += 1;
      if (inv.avg_price !== null) {
        stats[t].profit += val - (inv.quantity * inv.avg_price);
      }
    });
    return stats;
  }, [investments]);

  const filteredInvestments = useMemo(() => {
    return investments.filter(inv => inv.asset_type === activeTab);
  }, [investments, activeTab]);

  const activeTabConfig = TAB_CONFIG.find(t => t.id === activeTab)!;

  const assetLabels: Record<AssetType, string> = {
    stock: 'Hisse Senetleri',
    crypto: 'Kripto Paralar',
    commodity: 'Emtia / Değerli Maden',
    currency: 'Döviz',
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Yatırım Portföyü</h1>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full md:w-auto">
          <button 
            onClick={handleFetchPrices}
            disabled={isFetchingPrices || investments.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto bg-[#4edeb3]/10 border border-[#4edeb3]/50 text-[#4edeb3] rounded-full hover:bg-[#4edeb3]/20 font-bold transition backdrop-blur-md disabled:opacity-50"
          >
            <RefreshCw size={18} className={isFetchingPrices ? "animate-spin" : ""} />
            Canlı Fiyat
          </button>
          <button 
            onClick={handleGetAnalysis}
            disabled={isAiLoading || investments.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2.5 w-full sm:w-auto bg-[var(--color-surface-variant)]/40 border border-[var(--color-brand-secondary)]/20 text-[var(--color-brand-secondary)] rounded-full hover:bg-[var(--color-brand-secondary)]/10 font-bold transition backdrop-blur-md disabled:opacity-50"
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

      {debugError && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
             <h3 className="text-red-400 font-bold flex items-center gap-2"><ShieldAlert size={18} /> Teknik Hata Meydana Geldi</h3>
             <button onClick={() => setDebugError(null)} className="text-red-300 hover:text-white text-xs">Gizle</button>
          </div>
          <p className="text-red-200/80 text-xs mb-2">Lütfen aşağıdaki hata metnini kopyalayıp asistana gönderin:</p>
          <textarea 
            readOnly 
            value={debugError} 
            className="w-full h-32 bg-black/50 text-red-300 p-3 rounded-lg border border-red-500/30 text-xs font-mono outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>
      )}

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bento-card border border-[var(--color-brand-secondary)]/20 shadow-[0_10px_30px_rgba(173,198,255,0.05)] text-center sm:text-left h-full flex flex-col justify-center">
          <p className="text-[var(--color-brand-secondary)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Portföy Değeri</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white font-display tracking-tight mt-1">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalValue)}
          </h2>
        </div>
        <div className="bento-card h-full flex flex-col justify-center">
          <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Kâr / Zarar</p>
          <h2 className={`text-2xl sm:text-3xl font-black font-display tracking-tight mt-1 ${isProfit ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'}`}>
            {isProfit ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalProfit)}
          </h2>
        </div>
        <div className="bento-card h-full flex flex-col justify-center">
          <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Varlık Dağılımı</p>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            {TAB_CONFIG.map(tab => {
              const st = tabStats[tab.id];
              if (st.count === 0) return null;
              const pct = totalValue > 0 ? ((st.value / totalValue) * 100).toFixed(0) : '0';
              return (
                <div key={tab.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tab.color }} />
                  <span className="text-xs font-mono text-[var(--color-text-variant)]">
                    {tab.label} <strong className="text-white">{pct}%</strong>
                  </span>
                </div>
              );
            })}
          </div>
          {totalValue > 0 && (
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex mt-3">
              {TAB_CONFIG.map(tab => {
                const st = tabStats[tab.id];
                if (st.value <= 0) return null;
                const pct = (st.value / totalValue) * 100;
                return (
                  <div
                    key={tab.id}
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: tab.color }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-[var(--color-surface-container)] rounded-2xl p-1 shadow-inner border border-white/5 w-full">
        {TAB_CONFIG.map(tab => {
          const st = tabStats[tab.id];
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setQuickAddId(null); setEditId(null); }}
              className={`flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-all font-mono flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? 'shadow-lg text-black'
                  : 'text-[var(--color-text-variant)] hover:text-white hover:bg-white/5'
              }`}
              style={activeTab === tab.id ? { backgroundColor: tab.color, boxShadow: `0 4px 15px ${tab.color}30` } : {}}
            >
              <TabIcon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label}</span>
              {st.count > 0 && (
                <span className={`text-[9px] ml-0.5 px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-black/20 text-black' : 'bg-white/10 text-white/60'
                }`}>
                  {st.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Per-Tab Stats Bar */}
      {(() => {
        const st = tabStats[activeTab];
        const tabProfit = st.profit;
        const tabIsProfit = tabProfit >= 0;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bento-card">
              <p className="text-[10px] font-bold uppercase tracking-widest font-mono mb-1.5" style={{ color: activeTabConfig.color }}>
                {activeTabConfig.label} Değeri
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(st.value)}
              </h3>
            </div>
            <div className="bento-card">
              <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono mb-1.5">Kâr / Zarar</p>
              <h3 className={`text-xl sm:text-2xl font-black font-display tracking-tight ${tabIsProfit ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'}`}>
                {tabIsProfit ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tabProfit)}
              </h3>
            </div>
            <div className="hidden sm:flex bento-card items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono mb-1.5">Varlık Sayısı</p>
                <h3 className="text-xl font-black text-white font-mono">{st.count}</h3>
              </div>
              <button
                onClick={handleOpenModal}
                className="p-3 rounded-2xl transition-all hover:scale-[1.05] active:scale-[0.95]"
                style={{ backgroundColor: `${activeTabConfig.color}20`, color: activeTabConfig.color, border: `1px solid ${activeTabConfig.color}30` }}
              >
                <Plus size={22} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Mobile Add Button */}
      <div className="sm:hidden">
        <button
          onClick={handleOpenModal}
          className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-black transition-all hover:brightness-110"
          style={{ backgroundColor: activeTabConfig.color }}
        >
          <Plus size={18} /> {activeTabConfig.label} Ekle
        </button>
      </div>

      {/* Modal for adding new investment */}
      {quickAddId === 'new_modal' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setQuickAddId(null)}>
          <div 
            className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 flex justify-between items-center" style={{ background: `linear-gradient(135deg, ${activeTabConfig.color}15, transparent)` }}>
              <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                <Plus size={20} style={{ color: activeTabConfig.color }} /> Yeni Varlık Ekle
              </h3>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Tür</label>
                <select value={assetType} onChange={handleAssetTypeChange} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors appearance-none">
                  <option value="stock">Hisse Senedi</option>
                  <option value="crypto">Kripto Para</option>
                  <option value="commodity">Altın / Emtia</option>
                  <option value="currency">Döviz</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">İsim / Varlık</label>
                  <select 
                    required 
                    value={symbol} 
                    onChange={handleAssetSelect} 
                    disabled={isFetchingPrices}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors appearance-none disabled:opacity-50"
                  >
                    <option value="" disabled>Seçiniz</option>
                    {ASSET_OPTIONS[assetType]?.map(opt => (
                      <option key={opt.symbol} value={opt.symbol}>{opt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Sembol</label>
                  <input type="text" required value={symbol} readOnly className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)]/50 text-[var(--color-text-variant)] border border-white/5 rounded-xl outline-none cursor-not-allowed" placeholder="Oto." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Miktar</label>
                <input type="number" step="0.0001" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Maliyet <span className="text-[9px] opacity-70 normal-case">(Ops)</span></label>
                  <input type="number" step="0.01" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} placeholder="Boşsa fiyata eşitlenir" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Güncel <span className="text-[9px] opacity-70 normal-case">(Ops)</span></label>
                  <input type="number" step="0.01" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="Oto. Çekilir" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
              </div>
              
              {quantity && (avgPrice || currentPrice) && (
                <div className="p-4 rounded-xl border flex items-center justify-between" style={{ backgroundColor: `${activeTabConfig.color}08`, borderColor: `${activeTabConfig.color}20` }}>
                  <span className="text-xs font-bold font-mono uppercase tracking-wider" style={{ color: activeTabConfig.color }}>Toplam Gösterge</span>
                  <div className="text-right">
                    <p className="font-black text-white font-mono text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format((parseFloat(quantity) || 0) * (avgPrice === '' ? (parseFloat(currentPrice) || 0) : parseFloat(avgPrice)))}</p>
                    <p className="text-[10px] text-[var(--color-text-variant)] font-mono uppercase opacity-70">Beklenen / Toplam Tutar</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setQuickAddId(null)} className="px-5 py-3 rounded-xl border border-white/10 text-white font-bold flex-1 hover:bg-white/5 transition-colors">İptal</button>
                <button type="submit" onClick={() => setTimeout(() => setQuickAddId(null), 500)} className="rounded-xl py-3 font-bold flex-[2] text-black transition-all hover:brightness-110" style={{ backgroundColor: activeTabConfig.color }}>
                  Yatırımı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List Section */}
      <div className="bento-card p-0 overflow-hidden flex flex-col h-full w-full animate-in fade-in zoom-in-95 duration-300">
        <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)] flex items-center justify-between">
          <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono flex items-center gap-2">
            <activeTabConfig.icon size={18} style={{ color: activeTabConfig.color }} />
            {assetLabels[activeTab]}
          </h3>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg border" style={{ color: activeTabConfig.color, borderColor: `${activeTabConfig.color}30`, backgroundColor: `${activeTabConfig.color}10` }}>
            {filteredInvestments.length} varlık
          </span>
        </div>
        
        {loading ? (
           <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Portföy Yükleniyor...</div>
        ) : filteredInvestments.length === 0 ? (
           <div className="p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
             <activeTabConfig.icon size={32} className="opacity-50" style={{ color: activeTabConfig.color }} />
             <p>Bu kategoride henüz yatırım bulunmuyor.</p>
             <button
               onClick={handleOpenModal}
               className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm text-black transition-all hover:brightness-110"
               style={{ backgroundColor: activeTabConfig.color }}
             >
               <Plus size={16} className="inline mr-1" /> {activeTabConfig.label} Ekle
             </button>
           </div>
        ) : (
          <div className="max-h-[700px] overflow-y-auto">
            <ul className="divide-y divide-white/5">
              {filteredInvestments.map((inv, idx) => {
                const currentValue = inv.quantity * inv.current_price;
                const hasCost = inv.avg_price !== null;
                const costValue = hasCost ? inv.quantity * (inv.avg_price as number) : 0;
                const profit = hasCost ? currentValue - costValue : 0;
                const profitPerc = costValue > 0 ? ((currentValue - costValue) / costValue) * 100 : 0;
                const isGain = profit >= 0;

                return (
                  <div key={inv.id}>
                  <li className={`relative p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="p-3 rounded-2xl shrink-0" style={{ backgroundColor: `${activeTabConfig.color}15`, color: activeTabConfig.color }}>
                        <LineChart size={24} strokeWidth={2.5}/>
                      </div>
                      <div>
                        <p className="font-bold text-white text-base font-display">{inv.name} <span className="text-[10px] border px-2 py-0.5 rounded-md ml-2 font-mono break-all line-clamp-1 truncate sm:inline-block" style={{ color: activeTabConfig.color, borderColor: `${activeTabConfig.color}30` }}>{inv.symbol}</span></p>
                        <div className="text-xs text-[var(--color-text-variant)] mt-1.5 font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Miktar: <strong className="text-white">{inv.quantity}</strong></span>
                          <span className="opacity-40 hidden sm:inline">•</span>
                          <span>Maliyet: <strong className="text-white">{hasCost ? `${parseFloat(inv.avg_price as unknown as string).toFixed(2)} ₺` : 'Yok'}</strong></span>
                          <span className="opacity-40 hidden sm:inline">•</span>
                          <span style={{ color: activeTabConfig.color }}>Güncel: <strong>{inv.current_price.toFixed(2)} ₺</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                      <div>
                        <p className="font-black font-mono text-lg text-white">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentValue)}</p>
                        {hasCost ? (
                          <p className={`text-xs font-bold font-mono tracking-wider ${isGain ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'}`}>
                            {isGain ? '+' : ''}{profitPerc.toFixed(2)}% ({isGain ? '+' : ''}{Math.round(profit)} ₺)
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--color-text-variant)] mt-1 font-mono tracking-wider opacity-60">
                            Maliyetsiz
                          </p>
                        )}
                      </div>
                      <div className="flex">
                        <button 
                          onClick={() => {
                            if (inv.id.startsWith('vir_')) {
                              toast.info('Düzenli birikim miktarı aylık döngüyle otomatik artar, manuel olarak o yatırıma eklenti veya düzenleme yapılamaz.', { id: 'vir-err' });
                              return;
                            }
                            setEditId(null);
                            setQuickAddId(quickAddId === inv.id ? null : inv.id);
                            setQuickAddQty('');
                            setQuickAddPrice('');
                          }}
                          className={`p-2.5 hover:bg-white/10 rounded-xl transition-all bg-white/5 text-white lg:text-[var(--color-text-variant)] lg:bg-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 ${quickAddId === inv.id ? 'opacity-100' : ''}`}
                          style={quickAddId === inv.id ? { color: activeTabConfig.color } : {}}
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            if (inv.id.startsWith('vir_')) {
                              toast.info('Düzenli birikimlerinizi ait olduğu bölümden (Genel Birikim, BES, vb.) güncelleyin.', { id: 'vir-err' });
                              return;
                            }
                            setQuickAddId(null);
                            if (editId === inv.id) {
                              setEditId(null);
                            } else {
                              setEditId(inv.id);
                              setEditQty(inv.quantity.toString());
                              setEditAvgPrice(inv.avg_price !== null ? inv.avg_price.toString() : '');
                              setEditCurrentPrice(inv.current_price.toString());
                            }
                          }}
                          className={`p-2.5 hover:bg-[var(--color-brand-secondary)]/10 rounded-xl transition-all bg-white/5 text-white lg:text-[var(--color-text-variant)] lg:bg-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 ${editId === inv.id ? 'text-[var(--color-brand-secondary)] opacity-100' : 'text-[var(--color-text-variant)] hover:text-[var(--color-brand-secondary)]'}`}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteInvestment(inv.id)}
                          className="p-2.5 text-[#ff7886] bg-[#ffb4ab]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#ff7886] lg:hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </li>
                  
                  {quickAddId === inv.id && !inv.id.startsWith('vir_') && (
                    <div className="bg-[var(--color-surface-lowest)]/50 p-4 border-t flex flex-col sm:flex-row gap-3 items-end rounded-b-xl -mt-1 ml-4 sm:ml-12 z-0 relative animate-in fade-in slide-in-from-top-2" style={{ borderColor: `${activeTabConfig.color}15` }}>
                      <div className="w-full sm:flex-1">
                         <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1 font-mono">Eklenen Miktar</label>
                         <input type="number" step="0.0001" value={quickAddQty} onChange={e => setQuickAddQty(e.target.value)} placeholder="+ Adet / Gram vb." className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg outline-none text-sm" style={{ ['--tw-ring-color' as any]: activeTabConfig.color }} />
                      </div>
                      <div className="w-full sm:flex-1">
                         <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1 font-mono">Birim Maliyeti (Opsiyonel)</label>
                         <input type="number" step="0.01" value={quickAddPrice} onChange={e => setQuickAddPrice(e.target.value)} placeholder="0.00 ₺ (Boşsa güncel fiyattan ekler)" className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg outline-none text-sm" />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={async () => {
                           const addedQty = parseFloat(quickAddQty);
                           if (!addedQty || addedQty <= 0) {
                              toast.error('Geçerli pozitif bir miktar girin'); return;
                           }
                           let addedCost = quickAddPrice ? parseFloat(quickAddPrice) : inv.current_price;
                           if (isNaN(addedCost) || addedCost <= 0) addedCost = inv.current_price;
                           
                           const currentCostBasis = (inv.avg_price !== null ? inv.avg_price : inv.current_price) * inv.quantity;
                           const newCostBasis = addedCost * addedQty;
                           
                           const newTotalQty = inv.quantity + addedQty;
                           const newWeightedAvg = (currentCostBasis + newCostBasis) / newTotalQty;
                           
                           const { error } = await updateInvestment(inv.id, {
                             quantity: newTotalQty,
                             avg_price: newWeightedAvg
                           });
                           
                           if (!error) {
                              toast.success(`${addedQty} ${inv.symbol} Eklendi. Yeni ortalamanız: ${newWeightedAvg.toFixed(2)} ₺`);
                              setQuickAddId(null);
                           } else {
                              toast.error('Güncelleme başarısız: ' + error);
                           }
                        }} className="px-4 py-2 text-black font-bold text-sm rounded-lg transition-colors flex-1 sm:flex-none hover:brightness-110" style={{ backgroundColor: activeTabConfig.color }}>Ekle ve Ortala</button>
                        <button onClick={() => setQuickAddId(null)} className="px-4 py-2 bg-transparent text-[var(--color-text-variant)] border border-white/10 font-bold text-sm rounded-lg hover:text-white transition-colors flex-1 sm:flex-none">İptal</button>
                      </div>
                    </div>
                  )}

                  {editId === inv.id && !inv.id.startsWith('vir_') && (
                    <div className="bg-[var(--color-surface-lowest)]/50 p-4 border-t border-[var(--color-brand-secondary)]/10 flex flex-col sm:flex-row gap-3 items-end rounded-b-xl -mt-1 ml-4 sm:ml-12 z-0 relative animate-in fade-in slide-in-from-top-2">
                      <div className="w-full sm:flex-1">
                         <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1 font-mono">Toplam Miktar</label>
                         <input type="number" step="0.0001" value={editQty} onChange={e => setEditQty(e.target.value)} className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg outline-none focus:border-[var(--color-brand-secondary)] text-sm" />
                      </div>
                      <div className="w-full sm:flex-1">
                         <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1 font-mono">Maliyet</label>
                         <input type="number" step="0.01" value={editAvgPrice} onChange={e => setEditAvgPrice(e.target.value)} placeholder="Opsiyonel" className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg outline-none focus:border-[var(--color-brand-secondary)] text-sm" />
                      </div>
                      <div className="w-full sm:flex-1">
                         <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1 font-mono">Güncel Fiyat</label>
                         <input type="number" step="0.01" value={editCurrentPrice} onChange={e => setEditCurrentPrice(e.target.value)} className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg outline-none focus:border-[var(--color-brand-secondary)] text-sm" />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={async () => {
                           const newQty = parseFloat(editQty);
                           const newCurrent = parseFloat(editCurrentPrice);
                           const newAvg = editAvgPrice === '' ? null : parseFloat(editAvgPrice);
                           if (!newQty || newQty <= 0 || isNaN(newCurrent)) {
                              toast.error('Girdiğiniz değerleri kontrol edin.'); return;
                           }
                           
                           const { error } = await updateInvestment(inv.id, {
                             quantity: newQty,
                             avg_price: newAvg,
                             current_price: newCurrent
                           });
                           
                           if (!error) {
                              toast.success(`${inv.symbol} Güncellendi!`);
                              setEditId(null);
                           } else {
                              toast.error('Hata: ' + error);
                           }
                        }} className="px-5 py-2 bg-[var(--color-brand-secondary)] text-[#002113] font-bold text-sm rounded-lg hover:bg-[var(--color-brand-secondary)]/80 hover:text-white transition-colors flex-1 sm:flex-none">Kaydet</button>
                        <button onClick={() => setEditId(null)} className="px-4 py-2 bg-transparent text-[var(--color-text-variant)] border border-white/10 font-bold text-sm rounded-lg hover:text-white transition-colors flex-1 sm:flex-none">İptal</button>
                      </div>
                    </div>
                  )}
                  </div>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
