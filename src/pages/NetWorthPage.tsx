import { useNetWorth } from '../hooks/useNetWorth';
import { NetWorthLineChart } from '../components/charts/NetWorthLineChart';

export const NetWorthPage = () => {
  const { history, currentNetWorth, loading, saveTodayNetWorth } = useNetWorth();

  return (
    <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Net Varlık (Net Worth)</h1>
          <p className="text-[var(--color-text-variant)] mt-1 font-mono text-sm">Sahip olduğunuz tüm birikim ve varlıkların toplam değeri.</p>
         </div>
      </div>

      <div className="bento-card relative overflow-hidden flex flex-col justify-center min-h-[220px]">
         <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
           <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
         </div>
         <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Güncel Net Varlığınız</p>
         <h2 className="text-4xl sm:text-5xl font-black text-white font-display tracking-tight">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentNetWorth || 0)}
         </h2>
         <button 
            onClick={saveTodayNetWorth}
            className="mt-8 primary-gradient-btn w-full sm:w-fit justify-center px-8 py-3 rounded-xl flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            Günün Kapanışını Kaydet
          </button>
      </div>

       <div className="bento-card">
          <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-6">Tarihsel Değişim</h3>
          {loading ? (
             <div className="h-64 flex items-center justify-center text-[var(--color-text-variant)] font-mono animate-pulse">Veriler yükleniyor...</div>
          ) : (
             <NetWorthLineChart history={history} />
          )}
        </div>
    </div>
  );
};
