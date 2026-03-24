import { describe, it, expect } from 'vitest';
import { calculateProfit, calculateProfitPercentage, calculateTotalNetWorth } from './calculations';

describe('Financial Calculations', () => {
  it('calculates profit correctly', () => {
    expect(calculateProfit(1000, 1500)).toBe(500);
    expect(calculateProfit(2000, 1500)).toBe(-500);
  });

  it('calculates profit percentage correctly', () => {
    expect(calculateProfitPercentage(1000, 1500)).toBe(50);
    expect(calculateProfitPercentage(2000, 1000)).toBe(-50);
    expect(calculateProfitPercentage(0, 1000)).toBe(0); // edge case
  });

  it('calculates total net worth correctly combining transactions and investments', () => {
    const transactions = [
      { type: 'income' as const, amount: 5000 },
      { type: 'expense' as const, amount: 2000 },
    ];
    const investments = [
      { quantity: 2, current_price: 1500 }, // 3000
    ];
    
    // Total cash: 3000, Total invest: 3000 => 6000
    expect(calculateTotalNetWorth(transactions, investments)).toBe(6000);
  });
});
