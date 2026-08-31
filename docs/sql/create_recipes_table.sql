create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  name text not null,
  cooking_method text,
  dish_type text,
  serving_weight text,
  calories numeric,
  carbohydrate numeric,
  protein numeric,
  fat numeric,
  sodium numeric,
  hash_tag text,
  image_small_url text,
  image_large_url text,
  ingredients_text text,
  steps jsonb not null default '[]'::jsonb,
  sodium_tip text,
  source text not null default 'MFDS_COOKRCP01',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_source_idx on public.recipes (source);
create index if not exists recipes_name_idx on public.recipes (name);
create index if not exists recipes_dish_type_idx on public.recipes (dish_type);

create or replace function public.set_recipes_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_recipes_updated_at();

revoke execute on function public.set_recipes_updated_at() from public;
revoke execute on function public.set_recipes_updated_at() from anon, authenticated;

alter table public.recipes enable row level security;

drop policy if exists "Public recipes are readable by anon users" on public.recipes;
create policy "Public recipes are readable by anon users"
on public.recipes
for select
to anon
using (true);

drop policy if exists "Public recipes are readable by authenticated users" on public.recipes;
create policy "Public recipes are readable by authenticated users"
on public.recipes
for select
to authenticated
using (true);

