import { useData } from '../context/DataContext';

export const useNetWorth = () => {
  const { accounts, investments, netWorthHistory: history, loading, saveTodayNetWorth } = useData();
  const { totalVirtualValue } = useVirtualSavingsInternal();

  // Dynamic Calculation of Current Net Worth
  const bankCash = accounts.reduce((acc, a) => acc + a.balance, 0);
  const portfolioValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
  const currentNetWorth = bankCash + portfolioValue + totalVirtualValue;

  const saveToday = async () => {
    await saveTodayNetWorth(currentNetWorth);
  };

  return { currentNetWorth, history, loading, saveTodayNetWorth: saveToday };
};

// Internal version of useVirtualSavings to avoid circular dependency
// This only reads data from context — no separate fetches
import { useState, useEffect } from 'react';
import { fetchLivePrices } from '../lib/marketData';
import { Investment } from '../types';

function useVirtualSavingsInternal() {
  const { recurring, goldDays, besPortfolios: bes, loading: dataLoading } = useData();

  const [totalVirtualValue, setTotalVirtualValue] = useState(0);

  useEffect(() => {
    if (dataLoading) return;

    const today = new Date();
    const filterSavings = recurring.filter(r => r.is_investment);

    const virtualSavings = filterSavings.map(rec => {
      const created = new Date(rec.start_date || rec.created_at || new Date());
      let units = 1;

      if (rec.frequency === 'monthly') {
        units = Math.max(0, (today.getFullYear() - created.getFullYear()) * 12 + today.getMonth() - created.getMonth() + 1);
      } else if (rec.frequency === 'weekly') {
        const diffTime = Math.abs(today.getTime() - created.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        units = Math.max(0, Math.floor(diffDays / 7) + 1);
      } else if (rec.frequency === 'yearly') {
        units = Math.max(0, today.getFullYear() - created.getFullYear() + 1);
      }

      const accumulatedAmount = (rec.initial_amount || 0) + (rec.amount * units);

      return {
        id: rec.id,
        user_id: rec.user_id,
        asset_type: 'currency',
        name: `${rec.category}`,
        symbol: rec.currency || 'TRY',
        quantity: accumulatedAmount,
        avg_price: 1,
        current_price: 1,
        created_at: rec.start_date || rec.created_at
      } as Investment;
    });

    const virtualGoldDays = goldDays.reduce((acc, gd) => {
      const created = new Date(gd.start_date);
      const paidMonths = Math.max(0, (today.getFullYear() - created.getFullYear()) * 12 + today.getMonth() - created.getMonth() + 1);

      if (paidMonths >= gd.my_turn_month) {
        const fullPot = gd.total_months * gd.quantity_per_month;
        acc.push({
          id: gd.id,
          user_id: gd.user_id,
          asset_type: 'commodity',
          name: `${gd.name} (Ganimet)`,
          symbol: gd.gold_type,
          quantity: fullPot,
          avg_price: 1,
          current_price: 1,
          created_at: gd.created_at
        } as Investment);
      }
      return acc;
    }, [] as Investment[]);

    const virtualBes = bes.map(b => {
      const created = new Date(b.start_date);
      let paidMonths = 0;

      let iterDate = new Date(created.getFullYear(), created.getMonth(), b.payment_day || 1);
      if (iterDate < created) {
        iterDate.setMonth(iterDate.getMonth() + 1);
      }

      while (iterDate <= today) {
        paidMonths++;
        iterDate.setMonth(iterDate.getMonth() + 1);
      }

      const totalPrincipal = b.initial_amount + (paidMonths * b.monthly_payment) + b.extra_payments_total;
      const matchValue = ((paidMonths * b.monthly_payment) + b.extra_payments_total) * (b.state_contribution_rate / 100);
      const totalAccumulated = totalPrincipal + matchValue;

      return {
        id: b.id,
        user_id: b.user_id,
        asset_type: 'currency',
        name: `${b.name} (Devlet Katkısı Dahil)`,
        symbol: 'TRY',
        quantity: totalAccumulated,
        avg_price: 1,
        current_price: 1,
        created_at: b.created_at
      } as Investment;
    });

    const combined = [...virtualSavings, ...virtualGoldDays, ...virtualBes];

    if (combined.length > 0) {
      fetchLivePrices(combined).then(prices => {
        let totalVal = 0;
        combined.forEach(inv => {
          const price = prices[inv.id] || inv.current_price || 1;
          totalVal += inv.quantity * price;
        });
        setTotalVirtualValue(totalVal);
      }).catch(() => {
        const fallbackVal = combined.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
        setTotalVirtualValue(fallbackVal);
      });
    } else {
      setTotalVirtualValue(0);
    }
  }, [recurring, goldDays, bes, dataLoading]);

  return { totalVirtualValue };
}
