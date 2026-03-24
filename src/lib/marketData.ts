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

    // 2. Döviz (Frankfurter - Key gerekmez)
    let usdToTry = 32.5; 
    try {
      const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY');
      if (fxRes.ok) {
        usdToTry = (await fxRes.json()).rates.TRY;
      }
    } catch {}

    // 3. ABD Hisse Senetleri (Finnhub) / BIST Hisseleri (CollectAPI / Yahoo)
    const stockInvestments = investments.filter(inv => inv.asset_type === 'stock');
    for (const inv of stockInvestments) {
      if (inv.symbol.includes('.IS')) {
        // Türk Hisse Senedi (BIST)
        if (COLLECT_API_KEY) {
          try {
            const res = await fetch(`https://api.collectapi.com/economy/hisseSenedi`, {
              headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
            });
            const data = await res.json();
            const stockData = data.result?.find((s: any) => s.code === inv.symbol.replace('.IS', ''));
            if (stockData?.current) updatedPrices[inv.id] = stockData.current;
          } catch {}
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

    // 4. Altın (Gram / Çeyrek vb.) - CollectAPI
    const goldInvestments = investments.filter(inv => inv.asset_type === 'gold');
    if (goldInvestments.length > 0 && COLLECT_API_KEY) {
      try {
        const res = await fetch(`https://api.collectapi.com/economy/goldPrice`, {
          headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
        });
        const data = await res.json();
        goldInvestments.forEach(inv => {
           // Örn: sembol 'GRAM' veya 'ÇEYREK'
           const goldData = data.result?.find((g: any) => g.name.toLowerCase().includes(inv.symbol.toLowerCase()) || g.name === 'Gram Altın');
           if (goldData?.buying) updatedPrices[inv.id] = goldData.buying;
        });
      } catch {}
    }
  } catch (error) {
    console.error("Fetch Hatası:", error);
  }

  return updatedPrices;
};
