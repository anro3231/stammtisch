-- Einmalig im Supabase SQL Editor ausführen.
-- Authentifizierte Leser dürfen alle Notizen lesen, aber nur ihre eigenen ändern.
create table if not exists public.fantastix_meeting_notes (
 meeting_id text not null,
 member_id text not null,
 note text not null default '' check (char_length(note)<=160),
 updated_at timestamptz not null default now(),
 primary key(meeting_id,member_id)
);
alter table public.fantastix_meeting_notes enable row level security;
grant select,insert,update on public.fantastix_meeting_notes to authenticated;
drop policy if exists meeting_notes_read on public.fantastix_meeting_notes;
create policy meeting_notes_read on public.fantastix_meeting_notes for select to authenticated using (true);
drop policy if exists meeting_notes_insert_own on public.fantastix_meeting_notes;
create policy meeting_notes_insert_own on public.fantastix_meeting_notes for insert to authenticated
 with check (exists(select 1 from public.fantastix_reader_profiles p where p.user_id=(select auth.uid()) and p.member_id::text=member_id));
drop policy if exists meeting_notes_update_own on public.fantastix_meeting_notes;
create policy meeting_notes_update_own on public.fantastix_meeting_notes for update to authenticated
 using (exists(select 1 from public.fantastix_reader_profiles p where p.user_id=(select auth.uid()) and p.member_id::text=member_id))
 with check (exists(select 1 from public.fantastix_reader_profiles p where p.user_id=(select auth.uid()) and p.member_id::text=member_id));
