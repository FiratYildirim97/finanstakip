import { useData } from '../context/DataContext';

export const useBankAccounts = () => {
  const { accounts, loading, addAccount, deleteAccount, updateAccount } = useData();
  return { accounts, loading, addAccount, deleteAccount, updateAccount };
};
