-- FantastiX 3.16.0: Nach SQL 20 und 21 ausführen.
-- Verhindert doppelte Event-Meldungen und schließt Abstimmungsnachrichten
-- für Mitglieder auf Datenbankebene aus.
-- Nur der Trigger auf der Event-Stimmentabelle erzeugt Event-Meldungen.
-- Admin-Benachrichtigungen dürfen nicht über ein zweites Verfahren
-- erneut eingefügt werden.
create unique index if not exists fx_event_vote_message_dedupe
 on public.fantastix_updates (kind, title, body, recipient_member_id, date_trunc('minute', created_at at time zone 'UTC'))
 where recipient_member_id='ADMIN' and kind='vote';
-- Frühere fälschlich öffentliche Abstimmungsmeldungen ausblenden.
-- Vorhandene private Admin-Meldungen bleiben bestehen.
delete from public.fantastix_updates
 where kind='vote' and recipient_member_id is distinct from 'ADMIN';
-- Leser können ausschließlich allgemeine Meldungen oder eigene Strafen sehen.
drop policy if exists fx_updates_read on public.fantastix_updates;
create policy fx_updates_read on public.fantastix_updates for select to authenticated using (
 (recipient_member_id='ADMIN' and exists(select 1 from public.fantastix_private where id='main'))
 or (kind <> 'vote' and recipient_member_id is distinct from 'ADMIN' and exists(
  select 1 from public.fantastix_reader_profiles p
  where p.user_id=auth.uid() and (recipient_member_id is null or recipient_member_id=p.member_id::text)
 ))
);
