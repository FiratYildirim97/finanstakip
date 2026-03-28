import { useData } from '../context/DataContext';

export const useGoldDays = () => {
  const { goldDays, loading, addGoldDay, deleteGoldDay } = useData();
  return { goldDays, loading, addGoldDay, deleteGoldDay };
};
