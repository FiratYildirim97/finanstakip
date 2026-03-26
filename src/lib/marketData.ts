import { Investment } from '../types';

const cryptoMap: Record<string, string> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether', 'BNB': 'binancecoin',
  'SOL': 'solana', 'XRP': 'ripple', 'ADA': 'cardano', 'AVAX': 'avalanche-2',
  'DOGE': 'dogecoin', 'DOT': 'polkadot', 'LINK': 'chainlink', 'TRX': 'tron', 'MATIC': 'matic-network'
};

export const fetchLivePrices = async (investments: Investment[]): Promise<Record<string, number>> => {
  const updatedPrices: Record<string, number> = {};
  
  const COLLECT_API_KEY = import.meta.env.VITE_COLLECT_API_KEY;
  const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

  try {
    // 1. Kripto Paralar İçin CoinGecko (Key gerekmez)
    const cryptoInvestments = investments.filter(inv => inv.asset_type === 'crypto');
    if (cryptoInvestments.length > 0) {
      const ids = cryptoInvestments.map(inv => cryptoMap[inv.symbol.toUpperCase()]).filter(Boolean).join(',');
      if (ids) {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=try`);
        if (response.ok) {
          const data = await response.json();
          cryptoInvestments.forEach(inv => {
            const cgId = cryptoMap[inv.symbol.toUpperCase()];
            if (cgId && data[cgId]?.try) updatedPrices[inv.id] = data[cgId].try;
          });
        }
      }
    }

    // 2. Genel USD/TRY Kuru (Finnhub için) - Ücretsiz / Sınırsız
    let usdToTry = 35.0; // Fallback
    try {
      const fxRes = await fetch(`https://open.er-api.com/v6/latest/TRY`);
      const fxData = await fxRes.json();
      if (fxData.rates && fxData.rates.USD) {
         usdToTry = 1 / fxData.rates.USD;
      }
    } catch {}

    // 3. Hisse Senetleri
    const stockInvestments = investments.filter(inv => inv.asset_type === 'stock');
    const bistStocks = stockInvestments.filter(inv => inv.symbol.includes('.IS') || !inv.symbol.includes('.'));
    const usStocks = stockInvestments.filter(inv => inv.symbol.includes('.') && !inv.symbol.includes('.IS'));

    // BIST hisseleri için öncelikli ve ultra hızlı: CollectAPI
    if (bistStocks.length > 0) {
       let bistSuccess = false;
       if (COLLECT_API_KEY) {
           try {
              const res = await fetch(`https://api.collectapi.com/economy/liveBorsa`, {
                 headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' },
                 signal: AbortSignal.timeout(6000)
              });
              const data = await res.json();
              if (data.success && data.result) {
                 bistStocks.forEach(inv => {
                    const searchSymbol = inv.symbol.replace('.IS', '').toUpperCase();
                    const stockData = data.result.find((s: any) => s.name === searchSymbol);
                    if (stockData && stockData.price) {
                       updatedPrices[inv.id] = typeof stockData.price === 'number' ? stockData.price : parseFloat(stockData.price.toString().replace(',', '.'));
                    }
                 });
                 bistSuccess = true;
              }
           } catch (e) {
              console.warn("CollectAPI BIST hatası:", e);
           }
       }

       // CollectAPI başarısız olursa Proxy yöntemine dön
       if (!bistSuccess) {
           const uniqueBistSymbols = Array.from(new Set(bistStocks.map(inv => inv.symbol)));
           await Promise.all(uniqueBistSymbols.map(async (symbol) => {
              const matchingInvs = bistStocks.filter(inv => inv.symbol === symbol);
              const yfSymbol = symbol.includes('.IS') ? symbol : `${symbol}.IS`;
              const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}`);
              let price = null;
              
              try {
                 const r = await fetch(`https://api.allorigins.win/raw?url=${targetUrl}`, { signal: AbortSignal.timeout(6000) });
                 if (!r.ok) throw new Error('allorigins fallback');
                 const d = await r.json();
                 price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
              } catch (e1) {
                 try {
                    const r2 = await fetch(`https://corsproxy.io/?url=${targetUrl}`, { signal: AbortSignal.timeout(6000) });
                    const d2 = await r2.json();
                    price = d2?.chart?.result?.[0]?.meta?.regularMarketPrice;
                 } catch (e2) {}
              }
              
              if (price) {
                 matchingInvs.forEach(inv => updatedPrices[inv.id] = price);
              }
           }));
       }
    }

    // ABD Hisseleri İçin Finnhub
    if (usStocks.length > 0 && FINNHUB_API_KEY) {
       const uniqueUsSymbols = Array.from(new Set(usStocks.map(inv => inv.symbol)));
       await Promise.all(uniqueUsSymbols.map(async (symbol) => {
          const matchingInvs = usStocks.filter(inv => inv.symbol === symbol);
          try {
             const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { signal: AbortSignal.timeout(5000) });
             const data = await res.json();
             if (data?.c) {
                matchingInvs.forEach(inv => updatedPrices[inv.id] = data.c * usdToTry);
             }
          } catch {}
       }));
    }

    // 4. Altın ve Emtia (CollectAPI)
    const commodityInvestments = investments.filter(inv => inv.asset_type === 'commodity' || (inv.asset_type as any) === 'gold');
    
    // CollectAPI altın adı eşleştirme tablosu
    const goldNameMap: Record<string, string[]> = {
      'GAU':        ['gram altın', 'gram altin'],
      'CEYREK':     ['çeyrek altın', 'ceyrek altin', 'çeyrek'],
      'YARIM':      ['yarım altın', 'yarim altin', 'yarım'],
      'TAM':        ['tam altın', 'tam altin', 'tam', 'ziynet'],
      'ATA':        ['ata altın', 'ata altin', 'ata'],
      'RESAT':      ['reşat altın', 'resat altin', 'reşat'],
      'HAMIT':      ['hamit altın', 'hamit altin', 'hamit'],
      'CUMHURIYET': ['cumhuriyet altını', 'cumhuriyet altin', 'cumhuriyet'],
      '22AYAR':     ['22 ayar bilezik', '22 ayar', 'bilezik'],
      '18AYAR':     ['18 ayar altın', '18 ayar'],
      '14AYAR':     ['14 ayar altın', '14 ayar'],
      'GREMESE':    ['gümüş', 'gumus', 'gram gümüş'],
    };

    if (commodityInvestments.length > 0 && COLLECT_API_KEY) {
      try {
        const res = await fetch(`https://api.collectapi.com/economy/goldPrice`, {
          headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
        });
        const data = await res.json();
        if (data.success && data.result) {
          commodityInvestments.forEach(inv => {
            const symbolUpper = inv.symbol.toUpperCase();
            const searchNames = goldNameMap[symbolUpper];
            
            if (searchNames) {
              // CollectAPI sonuçlarında adı arayarak eşleştir
              const goldData = data.result.find((g: any) => {
                const gName = g.name.toLowerCase();
                return searchNames.some(sn => gName.includes(sn));
              });
              if (goldData?.buying) {
                updatedPrices[inv.id] = parseFloat(goldData.buying.toString().replace(',', '.'));
              }
            }
          });
        }
      } catch (e) {
         console.warn("CollectAPI Altın Hatası:", e);
      }
    } 
    
    // Ücretsiz Altın Fallback (GC=F Ounce / 31.1034 * USD/TRY)
    const missingGolds = commodityInvestments.filter(inv => !updatedPrices[inv.id]);
    if (missingGolds.length > 0) {
       try {
          const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F`);
          let ounceUsd: number | null = null;
          try {
             const res = await fetch(`https://api.allorigins.win/raw?url=${targetUrl}`, { signal: AbortSignal.timeout(7000) });
             const data = await res.json();
             ounceUsd = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          } catch (e1) {
             const res = await fetch(`https://corsproxy.io/?url=${targetUrl}`, { signal: AbortSignal.timeout(7000) });
             const data = await res.json();
             ounceUsd = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          }
          if (ounceUsd && usdToTry) {
            const tryPerGram = (ounceUsd / 31.1034768) * usdToTry;
            
            // Gram altın bazında çarpan tablosu (safiyet ve ağırlık)
            const goldMultipliers: Record<string, number> = {
              'GAU':        1,           // 1 gram has altın
              'CEYREK':     1.75,        // ~1.75 gram
              'YARIM':      3.50,        // ~3.50 gram
              'TAM':        7.00,        // ~7.00 gram
              'ATA':        7.22,        // ~7.22 gram (ata lira)
              'RESAT':      7.22,        // ~7.22 gram
              'HAMIT':      7.22,        // ~7.22 gram
              'CUMHURIYET': 7.00,        // ~7.00 gram
              '22AYAR':     0.916,       // 22/24 safiyet
              '18AYAR':     0.750,       // 18/24 safiyet
              '14AYAR':     0.585,       // 14/24 safiyet
              'GREMESE':    0,           // Ayrı hesap
              'XAU':        0,           // Ayrı hesap
              'XAG':        0,           // Ayrı hesap
            };
            
            missingGolds.forEach(inv => {
               const sym = inv.symbol.toUpperCase();
               const multiplier = goldMultipliers[sym];
               
               if (sym === 'XAU') {
                 // ONS altın direkt USD cinsinden
                 updatedPrices[inv.id] = ounceUsd! * usdToTry;
               } else if (sym === 'XAG') {
                 // Gümüş ONS - Yahoo'dan çek
                 // Basit tahmin: altın/gümüş oranı ~80
                 updatedPrices[inv.id] = (ounceUsd! / 80) * usdToTry;
               } else if (multiplier && multiplier > 0) {
                 updatedPrices[inv.id] = tryPerGram * multiplier;
               } else if (sym === 'GREMESE') {
                 // Gram gümüş: ONS gümüş / 31.1 gram * TRY
                 updatedPrices[inv.id] = ((ounceUsd! / 80) / 31.1034768) * usdToTry;
               }
            });
          }
       } catch (e) {
          console.warn("Ücretsiz Altın Fallback Hatası:", e);
       }
    }

    // 5. Dövizler - Ücretsiz / Sınırsız
    const currencyInvestments = investments.filter(inv => inv.asset_type === 'currency');
    if (currencyInvestments.length > 0) {
      try {
        const fxRes = await fetch(`https://open.er-api.com/v6/latest/TRY`);
        const data = await fxRes.json();
        currencyInvestments.forEach(inv => {
          const rate = data.rates?.[inv.symbol.toUpperCase()];
          if (rate) {
            updatedPrices[inv.id] = 1 / rate;
          }
        });
      } catch {}
    }
  } catch (error) {
    console.error("Fetch Hatası:", error);
  }

  return updatedPrices;
};
