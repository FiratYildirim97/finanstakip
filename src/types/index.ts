export type TransactionType = 'income' | 'expense';
export type AssetType = 'stock' | 'crypto' | 'commodity' | 'currency';

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
  avg_price: number | null;
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
  currency: string;
  description: string;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'once';
  next_date: string;
  is_investment: boolean;
  linked_bes_id?: string;
  linked_gold_day_id?: string;
  initial_amount?: number;
  start_date?: string;
  total_installments?: number;
  created_at: string;
}

export type BankAccountType = 'checking' | 'term_deposit' | 'daily_deposit';

export interface BankAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: BankAccountType;
  balance: number;
  interest_rate: number | null; // Vadeli için % faiz, Günlük için % faiz (örn: 45 = %45)
  tax_rate: number; // Stopaj oranı (%)
  maturity_date: string | null; // Sadece Vadeli için vade tarihi (Yıl-Ay-Gün)
  exempt_amount: number; // Sadece Günlük için boşta kalan para tutarı
  created_at: string;
}

export interface GoldDay {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  gold_type: string; // "Gram", "Çeyrek", "Yarım", "Tam"
  quantity_per_month: number;
  total_months: number;
  my_turn_month: number; // Kaçıncı ay bana çıkıyor
  created_at: string;
}

export interface BesPortfolio {
  id: string;
  user_id: string;
  name: string;
  monthly_payment: number;
  start_date: string;
  payment_day: number;
  state_contribution_rate: number;
  initial_amount: number;
  extra_payments_total: number;
  created_at: string;
}
