-- FantastiX 3.15.0: Benachrichtigungen und Online-Status.
-- EINMALIG in Supabase > SQL Editor ausführen. Vorher Datenbank-Backup erstellen.
-- Benötigt bestehende Tabellen fantastix_public, fantastix_private, fantastix_reader_profiles.
create table if not exists public.fantastix_activity (
 member_id text primary key, last_seen_at timestamptz not null default now()
);
create table if not exists public.fantastix_updates (
 id bigint generated always as identity primary key,
 kind text not null, title text not null, body text not null,
 recipient_member_id text, -- NULL = alle Leser, 'ADMIN' = nur Administrator
 created_at timestamptz not null default now()
);
create table if not exists public.fantastix_update_reads (
 update_id bigint not null references public.fantastix_updates(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(update_id,user_id)
);
create index if not exists fantastix_updates_created_idx on public.fantastix_updates(created_at desc);
alter table public.fantastix_activity enable row level security;
alter table public.fantastix_updates enable row level security;
alter table public.fantastix_update_reads enable row level security;
revoke all on public.fantastix_activity,public.fantastix_updates,public.fantastix_update_reads from anon,authenticated;
grant select on public.fantastix_activity to authenticated;
grant select on public.fantastix_updates to authenticated;
grant select,insert on public.fantastix_update_reads to authenticated;
-- Mitglied darf sich nur über den eigenen Profil-Link als online melden.
create or replace function public.fantastix_touch_presence() returns void language plpgsql security definer set search_path=public as $$
declare mid text;
begin
 select member_id::text into mid from public.fantastix_reader_profiles where user_id=auth.uid() limit 1;
 if mid is null then return; end if;
 insert into public.fantastix_activity(member_id,last_seen_at) values(mid,now())
 on conflict(member_id) do update set last_seen_at=excluded.last_seen_at;
end $$;
revoke all on function public.fantastix_touch_presence() from public;
grant execute on function public.fantastix_touch_presence() to authenticated;
-- Nur authentifizierte, freigeschaltete Leser sehen den Status.
drop policy if exists fx_presence_read on public.fantastix_activity;
create policy fx_presence_read on public.fantastix_activity for select to authenticated using (
 exists(select 1 from public.fantastix_reader_profiles where user_id=auth.uid())
 or exists(select 1 from public.fantastix_private where id='main')
);
-- 'ADMIN'-Meldungen sind nur mit Zugriff auf den privaten Admin-Datenstand sichtbar.
drop policy if exists fx_updates_read on public.fantastix_updates;
create policy fx_updates_read on public.fantastix_updates for select to authenticated using (
 (recipient_member_id='ADMIN' and exists(select 1 from public.fantastix_private where id='main'))
 or (recipient_member_id is distinct from 'ADMIN' and exists(
   select 1 from public.fantastix_reader_profiles p
   where p.user_id=auth.uid() and (recipient_member_id is null or recipient_member_id=p.member_id::text)
 ))
);
drop policy if exists fx_update_reads_select on public.fantastix_update_reads;
create policy fx_update_reads_select on public.fantastix_update_reads for select to authenticated using(user_id=auth.uid());
drop policy if exists fx_update_reads_insert on public.fantastix_update_reads;
create policy fx_update_reads_insert on public.fantastix_update_reads for insert to authenticated
 with check(user_id=auth.uid() and exists(select 1 from public.fantastix_updates u where u.id=update_id));
-- Ereignisse aus dem veröffentlichten JSON-Datenstand ableiten.
-- INSERT erzeugt keinen historischen Nachrichtensturm.
create or replace function public.fantastix_updates_from_publish() returns trigger language plpgsql security definer set search_path=public as $$
declare olditem jsonb; newitem jsonb; oldarr jsonb; newarr jsonb; kind text; label text; k text; ident text; display text; mid text; oldstatus text; newstatus text;
begin
 if tg_op='INSERT' or new.content is null or old.content is null then return new; end if;
 foreach kind in array array['meetings','excursions'] loop
  label:=case when kind='meetings' then 'Stammtisch' else 'Event' end;
  oldarr:=coalesce(old.content->kind,'[]'::jsonb); newarr:=coalesce(new.content->kind,'[]'::jsonb);
  for newitem in select value from jsonb_array_elements(newarr) loop
   ident:=newitem->>'id'; if ident is null then continue; end if;
   select value into olditem from jsonb_array_elements(oldarr) where value->>'id'=ident limit 1;
   display:=coalesce(newitem->>'name',newitem->>'title',newitem->>'date','Termin');
   if olditem is null then
    insert into public.fantastix_updates(kind,title,body) values('created',label||' erstellt',display);
   else
    if coalesce(olditem->>'date','') is distinct from coalesce(newitem->>'date','') or coalesce(olditem->>'time','') is distinct from coalesce(newitem->>'time','') then
     insert into public.fantastix_updates(kind,title,body) values('schedule',label||': Termin geändert',display||' · '||coalesce(newitem->>'date','')||' '||coalesce(newitem->>'time',''));
    end if;
    if coalesce(olditem->>'location','') is distinct from coalesce(newitem->>'location','') then
     insert into public.fantastix_updates(kind,title,body) values('location',label||': Ort geändert',display||' · '||coalesce(newitem->>'location','Noch offen'));
    end if;
    -- Admin wird über Änderungen der veröffentlichten Stammtisch-Abstimmungen informiert.
    if kind='meetings' then
     for mid,newstatus in select key,value->>'status' from jsonb_each(coalesce(newitem->'attendance','{}'::jsonb)) loop
      oldstatus:=olditem->'attendance'->mid->>'status';
      if newstatus is distinct from oldstatus and newstatus in ('present','absent') then
       insert into public.fantastix_updates(kind,title,body,recipient_member_id)
       values('vote',case when newstatus='present' then 'Zusage' else 'Absage' end,
        coalesce((select m->>'name' from jsonb_array_elements(coalesce(new.content->'members','[]'::jsonb)) m where m->>'id'=mid limit 1),'Mitglied')||' · '||display,'ADMIN');
      end if;
     end loop;
    end if;
   end if;
  end loop;
  for olditem in select value from jsonb_array_elements(oldarr) loop
   if not exists(select 1 from jsonb_array_elements(newarr) where value->>'id'=olditem->>'id') then
    insert into public.fantastix_updates(kind,title,body) values('deleted',label||' gelöscht',coalesce(olditem->>'name',olditem->>'title',olditem->>'date','Termin'));
   end if;
  end loop;
 end loop;
 -- Strafen: nur das betroffene Mitglied; Zahlungssummen werden pro Strafe berechnet.
 for newitem in select value from jsonb_array_elements(coalesce(new.content->'fines','[]'::jsonb)) loop
  ident:=newitem->>'id'; mid:=coalesce(newitem->>'memberId',newitem->>'member_id');
  if mid is null then continue; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(old.content->'fines','[]'::jsonb)) where value->>'id'=ident) then
   insert into public.fantastix_updates(kind,title,body,recipient_member_id)
   values('fine','Neue Strafe',coalesce(newitem->>'reason',newitem->>'note','Eine Strafe wurde eingetragen.'),mid);
  else
   if coalesce((select sum(coalesce((v->>'amountCents')::numeric,0)) from jsonb_array_elements(coalesce(old.content->'payments','[]'::jsonb)) v where v->>'fineId'=ident),0)
     < coalesce((newitem->>'amountCents')::numeric,0)
     and coalesce((select sum(coalesce((v->>'amountCents')::numeric,0)) from jsonb_array_elements(coalesce(new.content->'payments','[]'::jsonb)) v where v->>'fineId'=ident),0)
     >= coalesce((newitem->>'amountCents')::numeric,0) then
    insert into public.fantastix_updates(kind,title,body,recipient_member_id)
    values('paid','Strafe bezahlt',coalesce(newitem->>'reason',newitem->>'note','Deine Strafe wurde als bezahlt markiert.'),mid);
   end if;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists fantastix_updates_publish on public.fantastix_public;
create trigger fantastix_updates_publish after update of content on public.fantastix_public
 for each row when (old.content is distinct from new.content) execute function public.fantastix_updates_from_publish();
-- Nur neue Meldungen; 90 Tage Aufbewahrung können später per Cron bereinigt werden.
