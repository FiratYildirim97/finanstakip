import { useData } from '../context/DataContext';

export const useGoalsAndBudgets = () => {
  const { goals, budgets, addGoal, updateGoalProgress, addBudget, deleteGoal, deleteBudget } = useData();
  return { goals, budgets, addGoal, updateGoalProgress, addBudget, deleteGoal, deleteBudget };
};
