-- club Lambda Supabase schema
-- Applied to https://naxlamszrokhjgabqjcf.supabase.co on 2026-06-27.

create table if not exists public.wallets (
  uid text primary key,
  name text default '',
  balance text default '1000',
  biggest_win text default '0',
  total_wagered text default '0',
  hands_played text default '0',
  last_top_up bigint default 0,
  linked_user_id text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_wallets_linked on public.wallets(linked_user_id);
create index if not exists idx_wallets_balance on public.wallets(((balance)::numeric) desc);

create table if not exists public.promo_codes (
  code text primary key,
  reward text not null,
  blurb text not null,
  max_uses int default 1,
  uses int default 0
);

create table if not exists public.promo_redemptions (
  uid text not null references public.wallets(uid) on delete cascade,
  code text not null references public.promo_codes(code) on delete cascade,
  redeemed_at timestamp with time zone default now(),
  primary key (uid, code)
);

create index if not exists idx_promo_redemptions_code on public.promo_redemptions(code);

insert into public.promo_codes (code, reward, blurb, max_uses)
values ('WELCOME', '500', 'Welcome bonus - 500 Lambda credits!', 999999)
on conflict (code) do update set
  reward = excluded.reward,
  blurb = excluded.blurb,
  max_uses = excluded.max_uses;

alter table public.wallets enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

drop policy if exists "anon_all_wallets" on public.wallets;
create policy "anon_all_wallets" on public.wallets for all to anon using (true) with check (true);

drop policy if exists "anon_all_promo_codes" on public.promo_codes;
create policy "anon_all_promo_codes" on public.promo_codes for all to anon using (true) with check (true);

drop policy if exists "anon_all_promo_redemptions" on public.promo_redemptions;
create policy "anon_all_promo_redemptions" on public.promo_redemptions for all to anon using (true) with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.wallets to anon;
grant select, insert, update, delete on public.promo_codes to anon;
grant select, insert, update, delete on public.promo_redemptions to anon;
