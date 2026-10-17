-- A device may run more than one coding agent. Each worker keeps an independent lease.
alter table public.room_claims add column worker_id uuid;
update public.room_claims set worker_id='00000000-0000-0000-0000-000000000000' where worker_id is null;
alter table public.room_claims alter column worker_id set not null;
alter table public.room_claims alter column worker_id set default '00000000-0000-0000-0000-000000000000';
alter table public.room_claims drop constraint room_claims_room_id_user_id_device_id_file_path_key;
alter table public.room_claims add constraint room_claims_worker_file_key unique(room_id,user_id,device_id,worker_id,file_path);

drop function public.claim_lines(uuid,text,integer,integer,text,text,uuid);
create function public.claim_lines(p_room_id uuid,p_file_path text,p_start_line integer,p_end_line integer,p_branch text,p_agent text,p_device_id uuid default '00000000-0000-0000-0000-000000000000',p_worker_id uuid default '00000000-0000-0000-0000-000000000000') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_conflicts jsonb;
begin
  perform 1 from public.rooms where id=p_room_id for update;
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  if p_file_path is null or p_file_path ~ '(^/|//|/$|\\|(^|/)\.\.?(/|$)|[[:cntrl:]])' then raise exception 'Use a relative file path without dot segments'; end if;
  if p_start_line is null or p_end_line is null or p_start_line<1 or p_end_line<p_start_line or p_end_line>10000000 then raise exception 'Invalid line range'; end if;
  delete from public.room_claims where room_id=p_room_id and expires_at<=now();
  insert into public.room_claims(room_id,user_id,device_id,worker_id,file_path,start_line,end_line,branch,agent)
    values(p_room_id,auth.uid(),p_device_id,p_worker_id,p_file_path,p_start_line,p_end_line,trim(p_branch),trim(p_agent))
    on conflict(room_id,user_id,device_id,worker_id,file_path) do update set start_line=excluded.start_line,end_line=excluded.end_line,
      branch=excluded.branch,agent=excluded.agent,expires_at=now()+interval '90 seconds' returning id into v_id;
  update public.room_members set last_seen=now() where room_id=p_room_id and user_id=auth.uid();
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('display_name',m.display_name)),'[]'::jsonb) into v_conflicts
    from public.room_claims c join public.room_members m using(room_id,user_id)
    where c.room_id=p_room_id and (c.user_id<>auth.uid() or c.device_id<>p_device_id or c.worker_id<>p_worker_id) and c.file_path=p_file_path
      and c.start_line<=p_end_line and c.end_line>=p_start_line and c.expires_at>now();
  return jsonb_build_object('claim_id',v_id,'conflicts',v_conflicts);
end;
$$;

drop function public.heartbeat(uuid,uuid);
create function public.heartbeat(p_room_id uuid,p_device_id uuid default null,p_worker_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  update public.room_members set last_seen=now() where room_id=p_room_id and user_id=auth.uid();
  update public.room_claims set expires_at=now()+interval '90 seconds'
    where room_id=p_room_id and user_id=auth.uid() and device_id=p_device_id and expires_at>now()
      and (p_worker_id is null or worker_id=p_worker_id);
end;
$$;

revoke all on function public.claim_lines(uuid,text,integer,integer,text,text,uuid,uuid), public.heartbeat(uuid,uuid,uuid) from public, anon;
grant execute on function public.claim_lines(uuid,text,integer,integer,text,text,uuid,uuid), public.heartbeat(uuid,uuid,uuid) to authenticated;
