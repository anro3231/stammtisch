-- Führe diese SQL-Anweisungen einmalig im SQL Editor deines Supabase-Projekts aus.
-- Niemals die service_role- oder secret-Schlüssel im Browser hinterlegen.
create table if not exists public.stammtisch_documents (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.stammtisch_documents enable row level security;

-- Die Tabelle ist für anonyme Nutzer gesperrt. Jeder angemeldete Nutzer
-- darf ausschließlich seinen eigenen Datensatz lesen oder verändern.
revoke all on public.stammtisch_documents from anon;
grant select, insert, update on public.stammtisch_documents to authenticated;

drop policy if exists "read own document" on public.stammtisch_documents;
drop policy if exists "insert own document" on public.stammtisch_documents;
drop policy if exists "update own document" on public.stammtisch_documents;

create policy "read own document" on public.stammtisch_documents
for select to authenticated using ((select auth.uid()) = owner_id);

create policy "insert own document" on public.stammtisch_documents
for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy "update own document" on public.stammtisch_documents
for update to authenticated using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
