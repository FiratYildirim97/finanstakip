-- Kredi kartı harcamaları tablosu
create table public.credit_card_expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric not null,
  category text not null,
  description text,
  merchant text, -- İşlem yapılan yer (mağaza, market vb.)
  card_name text, -- Hangi kredi kartı (ör: Garanti Bonus, Yapı Kredi World)
  installments integer default 1, -- Taksit sayısı
  receipt_url text, -- Fiş/dekont fotoğrafı URL'si (Supabase Storage)
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.credit_card_expenses enable row level security;

create policy "Users can view own credit card expenses" on public.credit_card_expenses for select using (auth.uid() = user_id);
create policy "Users can insert own credit card expenses" on public.credit_card_expenses for insert with check (auth.uid() = user_id);
create policy "Users can update own credit card expenses" on public.credit_card_expenses for update using (auth.uid() = user_id);
create policy "Users can delete own credit card expenses" on public.credit_card_expenses for delete using (auth.uid() = user_id);
