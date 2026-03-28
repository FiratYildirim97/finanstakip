import { useData } from '../context/DataContext';

export const useRecurringTransactions = () => {
  const { recurring, loading, addRecurring, deleteRecurring, updateRecurring } = useData();
  return { recurring, loading, addRecurring, deleteRecurring, updateRecurring };
};
