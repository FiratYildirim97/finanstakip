import { useData } from '../context/DataContext';

export const useTransactions = () => {
  const { transactions, loading, addTransaction, deleteTransaction } = useData();
  return { transactions, loading, addTransaction, deleteTransaction };
};
