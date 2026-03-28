-- ═══════════════════════════════════════════════════════════
-- Performance indexes for all frequently queried tables
-- Each table is queried with WHERE user_id = ? and ORDER BY date/created_at
-- ═══════════════════════════════════════════════════════════

-- transactions: WHERE user_id = ? ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON public.transactions (user_id, type, date DESC);

-- investments: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_investments_user_created ON public.investments (user_id, created_at DESC);

-- recurring_transactions: WHERE user_id = ? ORDER BY next_date ASC
CREATE INDEX IF NOT EXISTS idx_recurring_user_next ON public.recurring_transactions (user_id, next_date ASC);
CREATE INDEX IF NOT EXISTS idx_recurring_user_type ON public.recurring_transactions (user_id, type);

-- bank_accounts: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_created ON public.bank_accounts (user_id, created_at DESC);

-- credit_cards: WHERE user_id = ? ORDER BY name ASC
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_name ON public.credit_cards (user_id, name ASC);

-- credit_card_expenses: WHERE user_id = ? ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_cc_expenses_user_date ON public.credit_card_expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cc_expenses_user_card ON public.credit_card_expenses (user_id, card_id);

-- net_worth_history: WHERE user_id = ? ORDER BY date ASC
CREATE INDEX IF NOT EXISTS idx_net_worth_user_date ON public.net_worth_history (user_id, date ASC);

-- gold_days: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_gold_days_user_created ON public.gold_days (user_id, created_at DESC);

-- bes_portfolios: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bes_user_created ON public.bes_portfolios (user_id, created_at DESC);

-- goals: WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id);

-- budgets: WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets (user_id);

-- profiles: already has PK on id
