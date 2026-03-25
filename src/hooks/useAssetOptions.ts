import { useState, useEffect } from 'react';
import { AssetType } from '../types';
import { ASSET_OPTIONS as fallbackOptions } from '../lib/constants';

export interface AssetOption {
  symbol: string;
  name: string;
  price?: number;
}

export const useAssetOptions = () => {
  const [options, setOptions] = useState<Record<AssetType, AssetOption[]>>(fallbackOptions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLiveOptions = async () => {
      setLoading(true);
      const COLLECT_API_KEY = import.meta.env.VITE_COLLECT_API_KEY;
      
      const newOptions: Record<AssetType, AssetOption[]> = { ...fallbackOptions };

      // 1. Hisse Senetleri (BIST) -> CollectAPI
      if (COLLECT_API_KEY) {
        try {
          const res = await fetch(`https://api.collectapi.com/economy/hisseSenedi`, {
            headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
          });
          const data = await res.json();
          if (data.success && data.result) {
            newOptions.stock = data.result.map((s: any) => ({
              symbol: s.code, // CollectAPI hisseSenedi 'code' is THYAO
              name: s.text || s.code, // 'text' is "TÜRK HAVA YOLLARI"
              price: parseFloat(s.current || s.lastprice),
            })).filter((s: any) => s.symbol && s.price);
          }
        } catch (e) {
          console.error("Hisse API hatası:", e);
        }
      }

      // 2. Kripto Paralar -> CoinGecko (Ücretsiz, limitsiz sayılır)
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=try&order=market_cap_desc&per_page=100&page=1`);
        if (res.ok) {
          const data = await res.json();
          newOptions.crypto = data.map((c: any) => ({
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            price: c.current_price
          }));
        }
      } catch (e) {
        console.error("Kripto API hatası:", e);
      }

      // 3. Döviz -> Frankfurter (Ücretsiz açık API)
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=TRY`);
        if (res.ok) {
          const data = await res.json();
          // We map over fallback currencies to get their names, but update prices
          newOptions.currency = fallbackOptions.currency.map(c => {
            const tryRate = data.rates[c.symbol];
            return {
              ...c,
              price: tryRate ? (1 / tryRate) : undefined
            };
          });
        }
      } catch (e) {
        console.error("Döviz API hatası:", e);
      }

      // 4. Emtia / Altın -> CollectAPI
      if (COLLECT_API_KEY) {
        try {
          const res = await fetch(`https://api.collectapi.com/economy/goldPrice`, {
            headers: { 'authorization': `apikey ${COLLECT_API_KEY}`, 'content-type': 'application/json' }
          });
          const data = await res.json();
          if (data.success && data.result) {
            newOptions.commodity = data.result.map((g: any) => ({
              symbol: g.name, // e.g. "Gram Altın"
              name: g.name,
              price: parseFloat(g.buying || g.buyingstr)
            }));
          }
        } catch (e) {
          console.error("Emtia API hatası:", e);
        }
      }

      setOptions(newOptions);
      setLoading(false);
    };

    fetchLiveOptions();
  }, []);

  return { options, loading };
};
