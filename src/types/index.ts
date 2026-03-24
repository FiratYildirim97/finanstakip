export type TransactionType = 'income' | 'expense';
export type AssetType = 'stock' | 'crypto' | 'gold';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
  description: string | null;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  asset_type: AssetType;
  name: string;
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  created_at: string;
}

export interface NetWorthHistory {
  id: string;
  user_id: string;
  total_value: number;
  date: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  limit_amount: number;
  period: string;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  value: number;
  currency: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  next_date: string;
}
