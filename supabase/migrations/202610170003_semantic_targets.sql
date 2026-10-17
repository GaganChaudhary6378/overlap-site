-- Line numbers move. A target key reserves the same logical code region across line shifts.
alter table public.room_claims add column target_key text not null default '' check (char_length(target_key) <= 300);
create index room_claims_target on public.room_claims(room_id,file_path,target_key) where target_key <> '';

drop function public.claim_lines(uuid,text,integer,integer,text,text,uuid,uuid);
create function public.claim_lines(p_room_id uuid,p_file_path text,p_start_line integer,p_end_line integer,p_branch text,p_agent text,p_device_id uuid default '00000000-0000-0000-0000-000000000000',p_worker_id uuid default '00000000-0000-0000-0000-000000000000',p_target_key text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_conflicts jsonb; v_target text:=trim(coalesce(p_target_key,''));
begin
  perform 1 from public.rooms where id=p_room_id for update;
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  if p_file_path is null or p_file_path ~ '(^/|//|/$|\\|(^|/)\.\.?(/|$)|[[:cntrl:]])' then raise exception 'Use a relative file path without dot segments'; end if;
  if p_start_line is null or p_end_line is null or p_start_line<1 or p_end_line<p_start_line or p_end_line>10000000 then raise exception 'Invalid line range'; end if;
  if char_length(v_target)>300 or v_target ~ '[[:cntrl:]]' then raise exception 'Invalid work target'; end if;
  delete from public.room_claims where room_id=p_room_id and expires_at<=now();
  insert into public.room_claims(room_id,user_id,device_id,worker_id,file_path,start_line,end_line,branch,agent,target_key)
    values(p_room_id,auth.uid(),p_device_id,p_worker_id,p_file_path,p_start_line,p_end_line,trim(p_branch),trim(p_agent),v_target)
    on conflict(room_id,user_id,device_id,worker_id,file_path) do update set start_line=excluded.start_line,end_line=excluded.end_line,
      branch=excluded.branch,agent=excluded.agent,target_key=excluded.target_key,expires_at=now()+interval '90 seconds' returning id into v_id;
  update public.room_members set last_seen=now() where room_id=p_room_id and user_id=auth.uid();
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('display_name',m.display_name)),'[]'::jsonb) into v_conflicts
    from public.room_claims c join public.room_members m using(room_id,user_id)
    where c.room_id=p_room_id and (c.user_id<>auth.uid() or c.device_id<>p_device_id or c.worker_id<>p_worker_id) and c.file_path=p_file_path
      and (c.start_line<=p_end_line and c.end_line>=p_start_line or v_target<>'' and c.target_key=v_target) and c.expires_at>now();
  return jsonb_build_object('claim_id',v_id,'conflicts',v_conflicts);
end;
$$;

revoke all on function public.claim_lines(uuid,text,integer,integer,text,text,uuid,uuid,text) from public, anon;
grant execute on function public.claim_lines(uuid,text,integer,integer,text,text,uuid,uuid,text) to authenticated;
