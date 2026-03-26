import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCardExpense } from '../types';
import { useAuth } from './useAuth';

export const useCreditCardExpenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const fetchExpenses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('credit_card_expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (!error && data) {
        setExpenses(data as CreditCardExpense[]);
      }
      setLoading(false);
    };

    fetchExpenses();

    // Realtime Subscription
    const subscription = supabase
      .channel('public:credit_card_expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_card_expenses', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setExpenses((prev) => [payload.new as CreditCardExpense, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setExpenses((prev) => prev.filter((e) => e.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setExpenses((prev) => prev.map((e) => e.id === payload.new.id ? payload.new as CreditCardExpense : e));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addExpense = async (expense: Partial<CreditCardExpense>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('credit_card_expenses').insert([{ ...expense, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setExpenses(prev => [data[0] as CreditCardExpense, ...prev]);
    }
    return { data, error };
  };

  const deleteExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('credit_card_expenses').delete().eq('id', id);
    return { error };
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    
    if (error) {
      console.error('Receipt upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  };

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
