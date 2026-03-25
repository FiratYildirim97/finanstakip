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
    for (const inv of stockInvestments) {
      if (inv.symbol.includes('.IS') || !inv.symbol.includes('.')) {
        // Türk Hisse Senedi (BIST) - Yahoo Finance (corsproxy.io) - Ücretsiz / Sınırsız
        try {
          const yfSymbol = inv.symbol.includes('.IS') ? inv.symbol : `${inv.symbol}.IS`;
          const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}`);
          const res = await fetch(`https://corsproxy.io/?url=${targetUrl}`);
          const data = await res.json();
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (price) {
            updatedPrices[inv.id] = price;
          }
        } catch (e) {
           console.error("BIST Hisse çekilemedi:", e);
        }
      } else {
        // ABD Hisse Senedi (Finnhub)
        if (FINNHUB_API_KEY) {
          try {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${inv.symbol}&token=${FINNHUB_API_KEY}`);
            const data = await res.json();
            if (data?.c) updatedPrices[inv.id] = data.c * usdToTry; // Dolardan TL'ye çeviriyoruz
          } catch {}
        }
      }
    }

    // 4. Altın ve Emtia (CollectAPI)
    const commodityInvestments = investments.filter(inv => inv.asset_type === 'commodity' || (inv.asset_type as any) === 'gold');
    if (commodityInvestments.length > 0 && COLLECT_API_KEY) {
      try {
        const res = await fetch(`https://api.collectapi.com/economy/goldPrice`, {
          headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
        });
        const data = await res.json();
        commodityInvestments.forEach(inv => {
           let searchName = inv.symbol.toLowerCase();
           if (searchName === 'gram') searchName = 'gram altın';
           if (searchName === 'çeyrek') searchName = 'çeyrek altın';
           
           const goldData = data.result?.find((g: any) => g.name.toLowerCase().includes(searchName) || g.name.toLowerCase() === inv.name.toLowerCase());
           if (goldData?.buying) updatedPrices[inv.id] = parseFloat(goldData.buying);
        });
      } catch (e) {
         console.warn("CollectAPI Altın Hatası:", e);
      }
    } 
    
    // Ücretsiz Altın Fallback (GC=F Ounce / 31.1034 * USD/TRY)
    const missingGolds = commodityInvestments.filter(inv => !updatedPrices[inv.id]);
    if (missingGolds.length > 0) {
       try {
          const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/GC=F`);
          const res = await fetch(`https://corsproxy.io/?url=${targetUrl}`);
          const data = await res.json();
          const ounceUsd = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (ounceUsd && usdToTry) {
            const tryPerGram = (ounceUsd / 31.1034768) * usdToTry;
            missingGolds.forEach(inv => {
               const type = inv.symbol.toLowerCase();
               let multiplier = 1;
               if (type.includes('çeyrek')) multiplier = 1.64; // Çeyrek altın safiyet çarpanı ortalama
               else if (type.includes('yarım')) multiplier = 3.28;
               else if (type.includes('tam')) multiplier = 6.56;
               
               updatedPrices[inv.id] = tryPerGram * multiplier;
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
