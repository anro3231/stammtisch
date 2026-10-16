-- FantastiX 3.15.1: Admin-Meldungen bei Event-Zusagen und -Absagen.
-- Nach SQL 20 ausführen. Benötigt public.fantastix_excursion_votes.
-- Änderungen durch Mitglieder UND Admin werden erfasst; keine Meldung bei reiner Notizänderung.
create or replace function public.fantastix_notify_excursion_vote()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_status text;
  v_member text;
  v_excursion text;
  v_member_name text;
  v_event_name text;
  v_content jsonb;
begin
  if tg_op='DELETE' then return old; end if;
  v_status:=new.status::text;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if v_status not in ('yes','no') then return new; end if;
  v_member:=new.member_id::text;
  v_excursion:=new.excursion_id::text;
  select content into v_content from public.fantastix_private where id='main' limit 1;
  select m->>'name' into v_member_name
    from jsonb_array_elements(coalesce(v_content->'members','[]'::jsonb)) as m
    where m->>'id'=v_member limit 1;
  select coalesce(e->>'title',e->>'name',e->>'date') into v_event_name
    from jsonb_array_elements(coalesce(v_content->'excursions','[]'::jsonb)) as e
    where e->>'id'=v_excursion limit 1;
  insert into public.fantastix_updates(kind,title,body,recipient_member_id)
  values('vote',case when v_status='yes' then 'Event-Zusage' else 'Event-Absage' end,
    coalesce(v_member_name,'Mitglied')||' · '||coalesce(v_event_name,'Event'),'ADMIN');
  return new;
end $$;
revoke all on function public.fantastix_notify_excursion_vote() from public;
drop trigger if exists fantastix_notify_excursion_vote on public.fantastix_excursion_votes;
create trigger fantastix_notify_excursion_vote
  after insert or update of status on public.fantastix_excursion_votes
  for each row execute function public.fantastix_notify_excursion_vote();
