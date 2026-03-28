import { useData } from '../context/DataContext';

export const useInvestments = () => {
  const { investments, loading, addInvestment, deleteInvestment, updateInvestment, updateInvestmentPrices } = useData();
  return { investments, loading, addInvestment, deleteInvestment, updateInvestmentPrices, updateInvestment };
};
