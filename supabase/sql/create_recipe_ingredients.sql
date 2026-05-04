create extension if not exists "pgcrypto";

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  raw_text text not null,
  raw_name text,
  normalized_name text,
  canonical_name text,
  amount numeric,
  unit text,
  category text,
  confidence numeric default 0,
  source text not null default 'MFDS_COOKRCP01',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 중복 방지
create unique index if not exists
  recipe_ingredients_recipe_raw_text_idx
  on public.recipe_ingredients (recipe_id, raw_text);

-- 조회 성능
create index if not exists
  recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);

create index if not exists
  recipe_ingredients_normalized_name_idx
  on public.recipe_ingredients (normalized_name);

-- RLS
alter table public.recipe_ingredients enable row level security;

drop policy if exists "recipe_ingredients_select" on public.recipe_ingredients;
create policy "recipe_ingredients_select"
  on public.recipe_ingredients for select
  to anon, authenticated
  using (true);
