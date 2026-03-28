import { useData } from '../context/DataContext';

export const useCreditCardExpenses = () => {
  const { creditCardExpenses: expenses, loading, addExpense, deleteExpense, uploadReceipt } = useData();

  // Toplam harcama
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Kategoriye göre grupla
  const expensesByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return { 
    expenses, 
    loading, 
    addExpense, 
    deleteExpense, 
    uploadReceipt,
    totalExpenses,
    expensesByCategory 
  };
};
