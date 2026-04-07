import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: transactions, error } = await supabase.from('transactions').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  // same logic as RecurringTransactionsPage
  const list = [];
  const today = new Date();
  for (let i = -6; i <= 12; i++) {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 15, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 14, 23, 59, 59);
    const label = `${start.toLocaleDateString('tr-TR', { month: 'short' })} - ${end.toLocaleDateString('tr-TR', { month: 'short' })} ${end.getFullYear()}`;
    list.push({ start, end, label });
  }
  const defaultPeriodIndex = today.getDate() < 15 ? 5 : 6;
  const currentPeriod = list[defaultPeriodIndex] || list[0];
  
  console.log(`Current Period: ${currentPeriod.label}`);
  console.log(`Start: ${currentPeriod.start}, End: ${currentPeriod.end}`);

  const txInPeriod = transactions.filter(t => {
    const d = new Date(t.date);
    return !t.is_exempt && d >= currentPeriod.start && d <= currentPeriod.end;
  });

  const expense = txInPeriod.filter(t => t.type === 'expense');
  const totalExpense = expense.reduce((a, b) => a + Number(b.amount), 0);
  
  console.log('--- ALL EXPENSES IN PERIOD ---');
  let sum = 0;
  expense.forEach(t => {
    console.log(`[${t.date}] ${t.category} / ${t.description || ''}: ${t.amount} TL`);
    sum += Number(t.amount);
  });
  console.log(`\nTOTAL EXPENSES: ${sum.toLocaleString('tr-TR')} TL`);

  // Let's also check if they meant Dashboard page or total expenses across all time
  const allExpenses = transactions.filter(t => t.type === 'expense' && !t.is_exempt).reduce((a, b) => a + Number(b.amount), 0);
  console.log(`TOTAL EXPENSES ALL TIME: ${allExpenses.toLocaleString('tr-TR')} TL`);
  
  // also check credit card expenses
  const { data: ccExpenses } = await supabase.from('credit_card_expenses').select('*');
  const allCcExpenses = (ccExpenses || []).reduce((a, b) => a + Number(b.amount), 0);
  console.log(`TOTAL CC EXPENSES ALL TIME: ${allCcExpenses.toLocaleString('tr-TR')} TL`);
}

check();
