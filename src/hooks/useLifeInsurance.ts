import { useData } from '../context/DataContext';

export const useLifeInsurance = () => {
  const { lifeInsurance, loading, addLifeInsurance, deleteLifeInsurance, updateLifeInsurance } = useData();
  return { lifeInsurance, loading, addLifeInsurance, deleteLifeInsurance, updateLifeInsurance };
};
