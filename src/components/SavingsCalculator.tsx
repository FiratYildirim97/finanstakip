import React, { useState, useMemo } from 'react';
import { Calculator, Calendar, TrendingUp, ChevronDown, ChevronUp, Info, Percent } from 'lucide-react';

interface DailyStep {
  day: number;
  date: string;
  interest: number;
  balance: number;
}

export const SavingsCalculator = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [principal, setPrincipal] = useState<number>(100000);
    const [interestRate, setInterestRate] = useState<number>(45);
    const [taxRate, setTaxRate] = useState<number>(7.5);
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 32);
        return d.toISOString().split('T')[0];
    });
    const [isCompound, setIsCompound] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);

    const calculation = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        
        if (days === 0) return { breakdown: [], totalInterest: 0, finalBalance: principal, days: 0 };

        const dailyRate = (interestRate / 100) / 365;
        const taxMultiplier = 1 - (taxRate / 100);
        
        const breakdown: DailyStep[] = [];
        let currentBalance = principal;
        let totalInterest = 0;

        for (let i = 1; i <= days; i++) {
            const dailyGross = currentBalance * dailyRate;
            const dailyNet = dailyGross * taxMultiplier;
            
            totalInterest += dailyNet;
            
            if (isCompound) {
                currentBalance += dailyNet;
            }

            const currentDate = new Date(start);
            currentDate.setHours(12, 0, 0, 0); // Avoid DST issues
            currentDate.setDate(start.getDate() + i);
            
            breakdown.push({
                day: i,
                date: currentDate.toISOString().split('T')[0].split('-').reverse().join('.'),
                interest: dailyNet,
                balance: isCompound ? currentBalance : principal + totalInterest
            });
        }

        return {
            breakdown,
            totalInterest,
            finalBalance: isCompound ? currentBalance : principal + totalInterest,
            days
        };
    }, [principal, interestRate, taxRate, startDate, endDate, isCompound]);

    const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

    return (
        <div className="bento-card border border-[#cda4ff]/20 overflow-hidden transition-all duration-300">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 md:p-6 text-left"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-[#cda4ff]/15 text-[#cda4ff] p-3 rounded-2xl">
                        <Calculator size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white font-display">Vadeli Hesap Makinesi</h3>
                        <p className="text-xs text-[var(--color-text-variant)] font-mono">Faiz/Getiri hesaplaması ve günlük artış projeksiyonu</p>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="text-[var(--color-text-variant)]" /> : <ChevronDown className="text-[var(--color-text-variant)]" />}
            </button>

            {isOpen && (
                <div className="p-4 md:p-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono">Anapara (₺)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={principal} 
                                    onChange={e => setPrincipal(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono">Brüt Faiz Oranı (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={interestRate} 
                                    onChange={e => setInterestRate(Number(e.target.value))}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors"
                                />
                                <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono">Stopaj Oranı (%)</label>
                            <input 
                                type="number" 
                                value={taxRate} 
                                onChange={e => setTaxRate(Number(e.target.value))}
                                className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono">Başlangıç Tarihi</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono">Bitiş Tarihi / Vade Sonu</label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[#cda4ff] transition-colors"
                            />
                        </div>
                        <div className="flex items-end pb-1 text-white">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={isCompound} 
                                        onChange={e => setIsCompound(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-10 h-5 rounded-full transition-colors ${isCompound ? 'bg-[#cda4ff]' : 'bg-white/10 group-hover:bg-white/20'}`}></div>
                                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isCompound ? 'translate-x-5' : ''}`}></div>
                                </div>
                                <span className="text-sm font-medium">Bileşik (Birikimli) Faiz</span>
                                <div className="group/info relative">
                                    <Info size={14} className="text-white/40 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-[#1a1325] border border-[#cda4ff]/30 rounded-xl text-[10px] leading-relaxed opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                        Her gün kazanılan net faiz anaparaya eklenerek ertesi gün toplam üzerinden faiz kazanılmasına devam edilir. (Günlük Vadeli hesaplar için)
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[#cda4ff]/5 border border-[#cda4ff]/10 rounded-2xl p-4">
                            <p className="text-[10px] font-bold text-[#cda4ff] uppercase tracking-wider font-mono mb-1">Hesaplanan Vade</p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-black text-white font-display">{calculation.days}</span>
                                <span className="text-xs text-white/60 mb-1">Gün</span>
                            </div>
                        </div>
                        <div className="bg-[#4edeb3]/5 border border-[#4edeb3]/10 rounded-2xl p-4">
                            <p className="text-[10px] font-bold text-[#4edeb3] uppercase tracking-wider font-mono mb-1">Toplam Net Getiri</p>
                            <p className="text-2xl font-black text-[#4edeb3] font-display">+{fmt(calculation.totalInterest)}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-1">Vade Sonu Toplam</p>
                            <p className="text-2xl font-black text-white font-display">{fmt(calculation.finalBalance)}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button 
                                onClick={() => setShowBreakdown(!showBreakdown)}
                                className="flex items-center gap-2 text-sm font-bold text-[#cda4ff] hover:brightness-125 transition-all"
                            >
                                {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                Günlük Artış Tablosunu {showBreakdown ? 'Gizle' : 'Göster'}
                            </button>
                            {showBreakdown && <span className="text-[10px] text-white/40 font-mono italic">* Maksimum 31 gün gösterilir</span>}
                        </div>

                        {showBreakdown && calculation.breakdown.length > 0 && (
                            <div className="border border-white/5 rounded-2xl overflow-hidden overflow-x-auto ring-1 ring-white/5 bg-black/20">
                                <table className="w-full text-left text-sm font-mono">
                                    <thead className="bg-[#cda4ff]/5 text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">Gün</th>
                                            <th className="px-4 py-3">Tarih</th>
                                            <th className="px-4 py-3 text-right">Günlük Faiz (Net)</th>
                                            <th className="px-4 py-3 text-right">Yeni Bakiye</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {calculation.breakdown.slice(0, 31).map((step) => (
                                            <tr key={step.day} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-4 py-3 text-white/40">{step.day}</td>
                                                <td className="px-4 py-3 text-white">{step.date}</td>
                                                <td className="px-4 py-3 text-right text-[#4edeb3] font-medium">+{fmt(step.interest)}</td>
                                                <td className="px-4 py-3 text-right text-white font-bold">{fmt(step.balance)}</td>
                                            </tr>
                                        ))}
                                        {calculation.breakdown.length > 31 && (
                                            <tr className="bg-white/2">
                                                <td colSpan={4} className="px-4 py-2 text-center text-[10px] text-white/40 italic">
                                                    ... {calculation.breakdown.length - 31} gün daha hesaplandı ...
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="bg-[#4edeb3]/15 font-bold border-t border-[#4edeb3]/30">
                                            <td className="px-4 py-4 text-white">VADE SONU</td>
                                            <td className="px-4 py-4 text-white">{calculation.breakdown[calculation.breakdown.length - 1].date}</td>
                                            <td className="px-4 py-4 text-right text-[#4edeb3] text-lg">+{fmt(calculation.totalInterest)}</td>
                                            <td className="px-4 py-4 text-right text-white text-xl font-black">{fmt(calculation.finalBalance)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
