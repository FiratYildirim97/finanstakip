export const calculateProfit = (cost: number, current: number): number => {
  return current - cost;
};

export const calculateProfitPercentage = (cost: number, current: number): number => {
  if (cost === 0) return 0;
  return ((current - cost) / cost) * 100;
};

export const calculateTotalNetWorth = (
  transactions: { type: 'income' | 'expense'; amount: number }[],
  investments: { quantity: number; current_price: number }[]
): number => {
  const transactionTotal = transactions.reduce((acc, curr) => {
    return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const investmentTotal = investments.reduce((acc, curr) => {
    return acc + (curr.quantity * curr.current_price);
  }, 0);

  return transactionTotal + investmentTotal;
};
