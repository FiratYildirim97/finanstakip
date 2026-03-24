import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Goal, Budget } from '../types';
import { useAuth } from './useAuth';

export const useGoalsAndBudgets = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [goalsRes, budgetsRes] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id)
      ]);
      
      if (goalsRes.data) setGoals(goalsRes.data as Goal[]);
      if (budgetsRes.data) setBudgets(budgetsRes.data as Budget[]);
    };

    fetchData();

    // Supabase Realtime subscriptions would go here similar to useTransactions
  }, [user]);

  const addGoal = async (g: Partial<Goal>) => supabase.from('goals').insert([{ ...g, user_id: user?.id }]);
  const addBudget = async (b: Partial<Budget>) => supabase.from('budgets').insert([{ ...b, user_id: user?.id }]);

  return { goals, budgets, addGoal, addBudget };
};
