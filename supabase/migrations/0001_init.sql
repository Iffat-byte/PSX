-- PSX Pilot — initial schema for cloud accounts (Supabase / PostgreSQL).
-- Every user-owned table carries user_id and is protected by row-level security
-- so that one user can never read or modify another user's records.

create extension if not exists "pgcrypto";

-- Profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  number_system text not null default 'international' check (number_system in ('international','south-asian')),
  theme text not null default 'dark' check (theme in ('dark','light')),
  settings jsonb not null default '{}'::jsonb,           -- fee profile, risk limits, checklist template, dashboard layout
  plan text not null default 'free' check (plan in ('free','pro','premium')),
  role text not null default 'user' check (role in ('user','admin')),
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Portfolios & ledger -----------------------------------------------------------
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  kind text not null default 'real' check (kind in ('real','paper')),
  benchmark text not null default 'KSE100' check (benchmark in ('KSE100','KMI30','none')),
  description text,
  created_at timestamptz not null default now()
);
create index on public.portfolios (user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  trade_date date not null check (trade_date <= current_date),
  type text not null check (type in ('BUY','SELL','DIVIDEND','DEPOSIT','WITHDRAWAL','FEE','BONUS')),
  symbol text check (symbol ~ '^[A-Z0-9][A-Z0-9.\-]{0,11}$'),
  quantity numeric(18,4) not null default 0 check (quantity >= 0),
  price numeric(18,4) not null default 0 check (price >= 0),
  fees numeric(18,2) not null default 0 check (fees >= 0),
  amount numeric(18,2) not null default 0 check (amount >= 0),
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('manual','import','paper')),
  created_at timestamptz not null default now(),
  constraint trade_fields check (
    (type in ('BUY','SELL') and symbol is not null and quantity > 0 and price > 0)
    or (type = 'BONUS' and symbol is not null and quantity > 0)
    or (type = 'DIVIDEND' and symbol is not null and amount > 0)
    or (type in ('DEPOSIT','WITHDRAWAL','FEE') and amount > 0)
  )
);
create index on public.transactions (user_id, portfolio_id, trade_date);

-- Journal & behavior --------------------------------------------------------------
create table public.journal_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null default 'LONG' check (side in ('LONG','SHORT')),
  entry_date date not null,
  entry_price numeric(18,4) not null check (entry_price > 0),
  quantity numeric(18,4) not null check (quantity > 0),
  exit_date date,
  exit_price numeric(18,4),
  fees numeric(18,2) not null default 0,
  stop_loss numeric(18,4),
  target numeric(18,4),
  strategy text,
  tags text[] not null default '{}',
  entry_reason text not null default '',
  exit_reason text,
  confidence smallint not null check (confidence between 1 and 5),
  emotion_entry text not null,
  emotion_exit text,
  followed_plan boolean not null,
  risk_respected boolean not null,
  impulsive boolean not null default false,
  pressured boolean not null default false,
  lessons text,
  notes text,
  created_at timestamptz not null default now(),
  check (exit_date is null or exit_date >= entry_date)
);
create index on public.journal_trades (user_id, entry_date);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  iso_week text not null,
  went_well text, improve text, focus text,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, iso_week)
);

-- Watchlists, alerts, notifications -------------------------------------------------
create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'general' check (kind in ('general','shariah')),
  created_at timestamptz not null default now()
);
create table public.watchlist_items (
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  note text,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, symbol)
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  kind text not null check (kind in ('above','below','pctUp','pctDown','volumeAbove','positionWeight')),
  value numeric(18,4) not null check (value > 0),
  note text,
  active boolean not null default true,
  triggered_at timestamptz,
  triggered_value numeric(18,4),
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text not null,
  kind text not null check (kind in ('alert','reminder','system','dividend')),
  href text, read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Research, Shariah, calendar, dividends, planning ------------------------------------
create table public.research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null, title text not null, body text,
  stance text not null default 'neutral' check (stance in ('bull','bear','neutral')),
  created_at timestamptz not null default now()
);
create table public.theses (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  summary text, evidence_for text[] not null default '{}', evidence_against text[] not null default '{}',
  invalidation text, review_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);
create table public.shariah_records (            -- user-recorded classifications from official sources
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  status text not null check (status in ('Compliant','Non-compliant')),
  source_name text not null, source_url text check (source_url is null or source_url like 'https://%'),
  published_on date not null,
  recorded_at timestamptz not null default now()
);
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null, symbol text,
  type text not null check (type in ('Results','Board Meeting','Dividend','Book Closure','Bonus','Rights','AGM','Other')),
  title text not null, note text, remind boolean not null default false
);
create table public.dividend_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  status text not null check (status in ('expected','declared','received')),
  dps numeric(18,4) not null check (dps > 0), quantity numeric(18,4) not null check (quantity > 0),
  tax_pct numeric(6,3) not null default 0,
  book_closure date, payment_date date, note text,
  ledger_tx_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.saved_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calculator text not null, name text not null, inputs jsonb not null, summary text,
  created_at timestamptz not null default now()
);
create table public.daily_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  data jsonb not null default '{}'::jsonb,
  primary key (user_id, plan_date)
);

-- Operator-managed configuration (read by all, written by admins only) ---------------
create table public.plan_tiers (
  id text primary key check (id in ('free','pro','premium')),
  name text not null, monthly_pkr numeric(12,2) not null default 0, yearly_pkr numeric(12,2) not null default 0,
  features text[] not null default '{}'
);

-- Row-level security ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['portfolios','transactions','journal_trades','weekly_reviews','watchlists','watchlist_items',
    'alerts','notifications','research_notes','theses','shariah_records','calendar_events','dividend_records',
    'saved_scenarios','daily_plans']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Child rows must belong to the caller's own parent rows.
create policy "tx portfolio ownership" on public.transactions as restrictive for all to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())));
create policy "item watchlist ownership" on public.watchlist_items as restrictive for all to authenticated
  using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())));
create policy "dividend portfolio ownership" on public.dividend_records as restrictive for all to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())));

alter table public.profiles enable row level security;
create policy "profile: self read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profile: self update" on public.profiles for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
              and plan = (select p.plan from public.profiles p where p.id = (select auth.uid())));  -- users cannot self-promote or change plan

alter table public.plan_tiers enable row level security;
create policy "tiers: public read" on public.plan_tiers for select using (true);
create policy "tiers: admin write" on public.plan_tiers for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Create a profile row on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.plan_tiers (id, name) values ('free','Free'), ('pro','Pro'), ('premium','Premium');
