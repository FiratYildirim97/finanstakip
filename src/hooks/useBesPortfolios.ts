import { useData } from '../context/DataContext';

export const useBesPortfolios = () => {
  const { besPortfolios: bes, loading, addBes, deleteBes, updateBes } = useData();
  return { bes, loading, addBes, deleteBes, updateBes };
};
